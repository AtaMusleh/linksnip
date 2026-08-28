import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  apiError,
  resolveBaseUrl,
  serializeLink,
  toErrorDetails,
  type ApiErrorBody,
  type LinkResponse,
} from '@/lib/api';
import { getOwnerKey, peekOwnerKey } from '@/lib/owner';
import { prisma } from '@/lib/prisma';
import { generateUniqueSlug, isReservedSlug, SlugGenerationError } from '@/lib/slug';
import { createLinkSchema } from '@/lib/validation';

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * A sliding window of creation timestamps per owner key.
 *
 * This map lives in process memory, which means the budget is per-instance: it
 * resets on deploy and is not shared between serverless invocations or replicas,
 * so the real-world ceiling is `RATE_LIMIT_MAX * instances`. Production would
 * keep this in Redis — `INCR` with `EXPIRE`, or a sorted set of timestamps per
 * key — so every instance decrements one shared budget.
 */
const rateLimitBuckets = new Map<string, number[]>();

/** Bounds the map so a flood of one-off owner keys cannot grow it forever. */
function pruneRateLimitBuckets(cutoff: number): void {
  for (const [key, timestamps] of rateLimitBuckets) {
    if (timestamps.every((timestamp) => timestamp <= cutoff)) {
      rateLimitBuckets.delete(key);
    }
  }
}

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function consumeRateLimit(ownerKey: string): RateLimitResult {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  if (rateLimitBuckets.size > 10_000) {
    pruneRateLimitBuckets(cutoff);
  }

  const recent = (rateLimitBuckets.get(ownerKey) ?? []).filter(
    (timestamp) => timestamp > cutoff,
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(ownerKey, recent);
    const oldest = recent[0];

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000),
      ),
    };
  }

  recent.push(now);
  rateLimitBuckets.set(ownerKey, recent);

  return { allowed: true };
}

/** Pulls `customSlug` out of an unvalidated body so a reserved name can 409 before validation. */
function readCustomSlug(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('customSlug' in body)) {
    return undefined;
  }

  const value = (body as { customSlug: unknown }).customSlug;

  return typeof value === 'string' ? value.trim() : undefined;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ link: LinkResponse } | ApiErrorBody>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return apiError(400, 'invalid_json', 'Request body must be valid JSON');
  }

  // Checked ahead of validation so a reserved name reports as a conflict — the
  // input was well formed, the name is simply unavailable — rather than as a
  // schema violation, which is how `createLinkSchema` would otherwise report it.
  const requestedSlug = readCustomSlug(body);

  if (requestedSlug !== undefined && isReservedSlug(requestedSlug)) {
    return apiError(409, 'slug_reserved', `The slug "${requestedSlug}" is reserved`);
  }

  const parsed = createLinkSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(422, 'validation_error', 'The request body is invalid', {
      details: toErrorDetails(parsed.error.issues),
    });
  }

  const ownerKey = await getOwnerKey();
  const rateLimit = consumeRateLimit(ownerKey);

  if (!rateLimit.allowed) {
    return apiError(
      429,
      'rate_limited',
      `You can create at most ${RATE_LIMIT_MAX} links per hour`,
      { headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { url, customSlug, expiresAt } = parsed.data;
  let slug: string;

  if (customSlug !== undefined) {
    const taken = await prisma.link.findUnique({
      where: { slug: customSlug },
      select: { id: true },
    });

    if (taken !== null) {
      return apiError(409, 'slug_taken', `The slug "${customSlug}" is already in use`);
    }

    slug = customSlug;
  } else {
    try {
      slug = await generateUniqueSlug();
    } catch (error) {
      if (error instanceof SlugGenerationError) {
        return apiError(503, 'internal_error', 'Could not allocate a slug, please retry');
      }

      throw error;
    }
  }

  try {
    const link = await prisma.link.create({
      data: { slug, url, ownerKey, expiresAt: expiresAt ?? null },
    });

    return NextResponse.json(
      { link: serializeLink({ ...link, clickCount: 0 }, resolveBaseUrl(request)) },
      { status: 201 },
    );
  } catch (error) {
    // P2002 is the unique-index violation. The pre-check above narrows the race
    // window but cannot close it, so the index stays the source of truth.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return apiError(409, 'slug_taken', `The slug "${slug}" is already in use`);
    }

    throw error;
  }
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<{ links: LinkResponse[] }>> {
  // A visitor with no cookie owns nothing yet, so this reads rather than mints —
  // no reason for a dashboard fetch to hand out an identity.
  const ownerKey = await peekOwnerKey();

  if (ownerKey === null) {
    return NextResponse.json({ links: [] });
  }

  const links = await prisma.link.findMany({
    where: { ownerKey },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { clicks: true } } },
  });

  const baseUrl = resolveBaseUrl(request);

  return NextResponse.json({
    links: links.map(({ _count, ...link }) =>
      serializeLink({ ...link, clickCount: _count.clicks }, baseUrl),
    ),
  });
}
