import { customAlphabet } from 'nanoid';

export const SLUG_LENGTH = 7;

/**
 * URL-safe alphabet with the visually ambiguous characters removed: `0`/`O`,
 * `I`/`l`/`1`. `_` is excluded too, because a leading underscore is reserved
 * (see `isReservedSlug`) and generating one would waste an attempt.
 *
 * 57 characters over 7 positions is ~1.95e12 slugs.
 */
export const SLUG_ALPHABET =
  '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const nanoid = customAlphabet(SLUG_ALPHABET, SLUG_LENGTH);

export function generateSlug(): string {
  return nanoid();
}

/** Slugs that would collide with an application route or a well-known file. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'api',
  'dashboard',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

/**
 * Any slug starting with `_` is reserved, which keeps the whole `_next`-style
 * namespace free for framework-owned paths.
 */
export function isReservedSlug(slug: string): boolean {
  return slug.startsWith('_') || RESERVED_SLUGS.has(slug.toLowerCase());
}

export const MAX_SLUG_ATTEMPTS = 5;
