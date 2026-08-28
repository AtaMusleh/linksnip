import { after } from 'next/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { apiError } from '@/lib/api';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * 302 Found, deliberately — not 301.
 *
 * A 301 is permanent and browsers cache it aggressively, often indefinitely.
 * After one visit the browser would jump straight to the target and never touch
 * this handler again, so every later visit from that browser would go
 * uncounted and analytics would silently under-report. A 301 also cannot be
 * taken back: it would keep sending people to the old target after the link is
 * edited or deleted. 302 costs one request per visit and keeps the server in
 * the loop, which is the whole point of a shortener.
 */
const REDIRECT_STATUS = 302;

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { slug } = await context.params;

  const link = await prisma.link.findUnique({
    where: { slug },
    select: { id: true, url: true, expiresAt: true },
  });

  if (link === null) {
    return NextResponse.redirect(new URL('/not-found', request.url), REDIRECT_STATUS);
  }

  if (link.expiresAt !== null && link.expiresAt.getTime() <= Date.now()) {
    // 410 rather than 404: the link was real and is deliberately finished, which
    // also tells crawlers to drop it instead of retrying.
    return apiError(
      410,
      'link_expired',
      `This link expired on ${link.expiresAt.toISOString().slice(0, 10)} and is no longer available.`,
    );
  }

  // Read the headers now — the callback below runs after the response is sent.
  const referrer = request.headers.get('referer');
  const country = request.headers.get('x-vercel-ip-country');

  // Logging must never delay or break a redirect. `after` runs this once the
  // response is on the wire, so the visitor waits on nothing, and the platform
  // still keeps the invocation alive to finish it — unlike a bare floating
  // promise, which can be cut off when the response ends. Any failure here is
  // swallowed: a lost click beats a broken link.
  after(async () => {
    try {
      await prisma.click.create({
        data: { linkId: link.id, referrer, country },
      });
    } catch {
      // Intentionally ignored.
    }
  });

  return NextResponse.redirect(link.url, REDIRECT_STATUS);
}
