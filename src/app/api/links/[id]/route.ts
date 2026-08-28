import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  apiError,
  resolveBaseUrl,
  serializeLink,
  type ApiErrorBody,
  type LinkResponse,
} from '@/lib/api';
import { peekOwnerKey } from '@/lib/owner';
import { prisma } from '@/lib/prisma';
import type { ClickBreakdown, ClickDataPoint } from '@/types';

type RouteContext = { params: Promise<{ id: string }> };

export const ANALYTICS_WINDOW_DAYS = 30;

export type LinkDetailResponse = {
  link: LinkResponse;
  analytics: {
    windowDays: number;
    clicksByDay: ClickDataPoint[];
    referrers: ClickBreakdown[];
  };
};

/** Midnight UTC, `days` ago — the inclusive start of the analytics window. */
function windowStart(days: number): Date {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  return start;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fills every day in the window, including the silent ones. A chart that skips
 * empty days misreads a quiet week as a dense one.
 */
function zeroFillDays(
  rows: readonly { day: string; clicks: number }[],
  from: Date,
  days: number,
): ClickDataPoint[] {
  const counts = new Map(rows.map((row) => [row.day, row.clicks]));

  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + offset);
    const day = isoDay(date);

    return { date: day, clicks: counts.get(day) ?? 0 };
  });
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<LinkDetailResponse | ApiErrorBody>> {
  const { id } = await context.params;
  const ownerKey = await peekOwnerKey();

  if (ownerKey === null) {
    return apiError(404, 'not_found', 'Link not found');
  }

  // Ownership is part of the lookup, so a link owned by someone else is
  // indistinguishable from one that does not exist.
  const link = await prisma.link.findFirst({
    where: { id, ownerKey },
    include: { _count: { select: { clicks: true } } },
  });

  if (link === null) {
    return apiError(404, 'not_found', 'Link not found');
  }

  const from = windowStart(ANALYTICS_WINDOW_DAYS);

  // Grouping by calendar day needs `date_trunc`, which Prisma's `groupBy`
  // cannot express — it would group by the exact timestamp instead.
  const dailyRows = await prisma.$queryRaw<{ day: string; clicks: number }[]>`
    SELECT to_char(date_trunc('day', "clickedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
           count(*)::int AS clicks
    FROM "Click"
    WHERE "linkId" = ${id} AND "clickedAt" >= ${from}
    GROUP BY 1
    ORDER BY 1
  `;

  const referrerRows = await prisma.click.groupBy({
    by: ['referrer'],
    where: { linkId: id, clickedAt: { gte: from } },
    _count: { _all: true },
  });

  const referrers: ClickBreakdown[] = referrerRows
    .map((row) => ({
      // A click with no `Referer` header is someone typing the link or opening
      // it from an app, which reads as "direct" rather than as missing data.
      label: row.referrer ?? 'direct',
      clicks: row._count._all,
    }))
    .sort((a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label));

  const { _count, ...linkFields } = link;

  return NextResponse.json({
    link: serializeLink(
      { ...linkFields, clickCount: _count.clicks },
      resolveBaseUrl(request),
    ),
    analytics: {
      windowDays: ANALYTICS_WINDOW_DAYS,
      clicksByDay: zeroFillDays(dailyRows, from, ANALYTICS_WINDOW_DAYS),
      referrers,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<{ id: string; deleted: true } | ApiErrorBody>> {
  const { id } = await context.params;
  const ownerKey = await peekOwnerKey();

  if (ownerKey === null) {
    return apiError(404, 'not_found', 'Link not found');
  }

  // `deleteMany` filters on ownership in the same statement, so there is no
  // window between the ownership check and the delete. Clicks cascade.
  const { count } = await prisma.link.deleteMany({ where: { id, ownerKey } });

  if (count === 0) {
    return apiError(404, 'not_found', 'Link not found');
  }

  return NextResponse.json({ id, deleted: true });
}
