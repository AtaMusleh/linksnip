import { NextResponse } from 'next/server';
import type { $ZodIssue } from 'zod/v4/core';

import type { LinkWithClickCount } from '@/types';

/**
 * Every handler answers with the same envelope so clients can branch on
 * `error.code` instead of parsing prose or matching on status alone.
 */
export type ApiErrorCode =
  | 'invalid_json'
  | 'validation_error'
  | 'slug_reserved'
  | 'slug_taken'
  | 'rate_limited'
  | 'not_found'
  | 'link_expired'
  | 'internal_error';

export type ApiErrorDetail = {
  path: string;
  message: string;
};

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
};

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  options?: { details?: ApiErrorDetail[]; headers?: HeadersInit },
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(options?.details !== undefined ? { details: options.details } : {}),
    },
  };

  return NextResponse.json(body, { status, headers: options?.headers });
}

/** Flattens Zod issues into the `details` array of an error envelope. */
export function toErrorDetails(issues: readonly $ZodIssue[]): ApiErrorDetail[] {
  return issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Resolves the origin short links are built against. The env var wins so links
 * stay stable behind a proxy or a custom domain; the request origin is the
 * fallback for local development and preview deployments.
 */
export function resolveBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  const origin =
    configured !== undefined && configured !== ''
      ? configured
      : new URL(request.url).origin;

  return origin.replace(/\/+$/, '');
}

/** The public projection of a link. `ownerKey` is a secret and never leaves the server. */
export type LinkResponse = {
  id: string;
  slug: string;
  url: string;
  shortUrl: string;
  clickCount: number;
  createdAt: string;
  expiresAt: string | null;
};

export function serializeLink(
  link: LinkWithClickCount,
  baseUrl: string,
): LinkResponse {
  return {
    id: link.id,
    slug: link.slug,
    url: link.url,
    shortUrl: `${baseUrl}/${link.slug}`,
    clickCount: link.clickCount,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt?.toISOString() ?? null,
  };
}
