import type { Click, Link } from '@prisma/client';

/**
 * Row shapes come straight from the generated client, so `prisma generate`
 * propagates every schema change into these types automatically.
 */
export type { Click, Link };

/** A dashboard row: the link plus how many times it has been visited. */
export type LinkWithClickCount = Link & {
  clickCount: number;
};

/** One bucket of a click-over-time chart. */
export type ClickDataPoint = {
  date: string;
  clicks: number;
};

/** A single row of a top-referrers or top-countries breakdown. */
export type ClickBreakdown = {
  label: string;
  clicks: number;
};
