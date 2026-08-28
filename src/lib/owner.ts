import { createId } from '@paralleldrive/cuid2';
import { cookies } from 'next/headers';

export const OWNER_COOKIE_NAME = 'linksnip_owner';

/** One year, refreshed whenever a visitor without a cookie arrives. */
export const OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Collision-resistant opaque id, matching the cuid ids Prisma generates for rows. */
export function generateOwnerKey(): string {
  return createId();
}

/**
 * Reads the caller's owner key, minting one if this is their first visit.
 *
 * The key scopes the dashboard to the links a visitor created without asking
 * them to sign up. It is httpOnly, so only the server can read it — a client
 * script cannot enumerate or forge another visitor's key.
 *
 * Note: Next.js only permits writing cookies from a Server Action or a Route
 * Handler. During a Server Component render the write is silently skipped and
 * the fresh key is returned for this request, so a brand-new visitor sees an
 * empty dashboard rather than an error. Call this from a Server Action or
 * Route Handler whenever the key needs to persist.
 */
export async function getOwnerKey(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(OWNER_COOKIE_NAME)?.value;

  if (existing !== undefined && existing !== '') {
    return existing;
  }

  const ownerKey = generateOwnerKey();

  try {
    cookieStore.set(OWNER_COOKIE_NAME, ownerKey, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: OWNER_COOKIE_MAX_AGE,
    });
  } catch {
    // Read-only cookie store (Server Component render). See the note above.
  }

  return ownerKey;
}

/**
 * Reads the owner key without minting one. Use this for reads that should show
 * nothing to a visitor who has never created a link.
 */
export async function peekOwnerKey(): Promise<string | null> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(OWNER_COOKIE_NAME)?.value;

  return existing !== undefined && existing !== '' ? existing : null;
}
