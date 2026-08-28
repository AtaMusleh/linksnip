const RELATIVE_UNITS: readonly { limitSeconds: number; perUnit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limitSeconds: 60, perUnit: 1, unit: 'second' },
  { limitSeconds: 3600, perUnit: 60, unit: 'minute' },
  { limitSeconds: 86400, perUnit: 3600, unit: 'hour' },
  { limitSeconds: 604800, perUnit: 86400, unit: 'day' },
  { limitSeconds: 2629800, perUnit: 604800, unit: 'week' },
  { limitSeconds: 31557600, perUnit: 2629800, unit: 'month' },
  { limitSeconds: Number.POSITIVE_INFINITY, perUnit: 31557600, unit: 'year' },
];

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "3 minutes ago" — the compact age used in list rows. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const elapsedSeconds = (new Date(iso).getTime() - now) / 1000;
  const magnitude = Math.abs(elapsedSeconds);

  for (const { limitSeconds, perUnit, unit } of RELATIVE_UNITS) {
    if (magnitude < limitSeconds) {
      return relativeFormatter.format(Math.round(elapsedSeconds / perUnit), unit);
    }
  }

  return relativeFormatter.format(Math.round(elapsedSeconds / 31557600), 'year');
}

const absoluteFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatAbsoluteTime(iso: string): string {
  return absoluteFormatter.format(new Date(iso));
}

/** "Aug 28" — axis ticks on the clicks chart. */
export function formatShortDate(isoDay: string): string {
  const [year, month, day] = isoDay.split('-').map(Number);

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en').format(value);
}

/** Strips the scheme and any `www.` so a long target reads as its destination. */
export function prettyUrl(url: string): string {
  try {
    const parsed = new URL(url);

    return `${parsed.host.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Favicons come from Google's cache so we never fetch a third-party site ourselves. */
export function faviconUrl(url: string, size = 32): string | null {
  const hostname = hostnameOf(url);

  return hostname === null
    ? null
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${size}`;
}

/**
 * Whether a link's expiry has passed. Kept out of component bodies so the
 * `Date.now()` call is not treated as an impure read during render.
 */
export function isExpired(expiresAt: string | null, now: number = Date.now()): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= now;
}
