import { cookies, headers } from 'next/headers';

import type { LinkResponse } from '@/lib/api';
import type { LinkDetailResponse } from '@/app/api/links/[id]/route';

/**
 * The origin this server can reach itself on. Deliberately *not*
 * `NEXT_PUBLIC_BASE_URL`: that is the public address short links are printed
 * with, which may be a CDN or custom domain that loops back out to the internet.
 * Self-fetches have to go to the host actually serving this request.
 */
async function internalOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get('host') ?? 'localhost:3000';
  const protocol =
    headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');

  return `${protocol}://${host}`;
}

/** Server components have no ambient credentials, so the owner cookie is forwarded by hand. */
async function apiFetch(path: string): Promise<Response> {
  const [origin, cookieStore] = await Promise.all([internalOrigin(), cookies()]);

  return fetch(`${origin}${path}`, {
    headers: { cookie: cookieStore.toString() },
    cache: 'no-store',
  });
}

export async function fetchOwnerLinks(): Promise<LinkResponse[]> {
  const response = await apiFetch('/api/links');

  if (!response.ok) {
    return [];
  }

  const body = (await response.json()) as { links: LinkResponse[] };

  return body.links;
}

export async function fetchLinkDetail(id: string): Promise<LinkDetailResponse | null> {
  const response = await apiFetch(`/api/links/${encodeURIComponent(id)}`);

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as LinkDetailResponse;
}
