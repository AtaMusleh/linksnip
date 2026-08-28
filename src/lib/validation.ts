import { z } from 'zod';

import { isReservedSlug } from './slug';

/**
 * Only these two schemes are ever stored. Everything else — `javascript:`,
 * `data:`, `file:`, `vbscript:`, custom app schemes — is rejected, because a
 * shortener that redirects to them turns into a script-injection vector.
 */
export const ALLOWED_URL_PROTOCOLS: ReadonlySet<string> = new Set([
  'http:',
  'https:',
]);

export const MAX_URL_LENGTH = 2048;
export const MIN_CUSTOM_SLUG_LENGTH = 3;
export const MAX_CUSTOM_SLUG_LENGTH = 32;
export const CUSTOM_SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

const urlSchema = z
  .string()
  .trim()
  .min(1, 'A URL is required')
  .max(MAX_URL_LENGTH, `URL must be at most ${MAX_URL_LENGTH} characters`)
  .transform((value, ctx) => {
    let parsed: URL;

    try {
      // `new URL` without a base only accepts absolute URLs, which is exactly
      // the constraint we want; relative paths throw here.
      parsed = new URL(value);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a complete URL, including http:// or https://',
      });
      return z.NEVER;
    }

    if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Only http:// and https:// URLs can be shortened',
      });
      return z.NEVER;
    }

    // Guards against inputs like `http:///path`, which parse but address nothing.
    if (parsed.hostname === '') {
      ctx.addIssue({
        code: 'custom',
        message: 'That URL is missing a hostname',
      });
      return z.NEVER;
    }

    return parsed.toString();
  });

const customSlugSchema = z
  .string()
  .trim()
  .min(
    MIN_CUSTOM_SLUG_LENGTH,
    `Slug must be at least ${MIN_CUSTOM_SLUG_LENGTH} characters`,
  )
  .max(
    MAX_CUSTOM_SLUG_LENGTH,
    `Slug must be at most ${MAX_CUSTOM_SLUG_LENGTH} characters`,
  )
  .regex(
    CUSTOM_SLUG_PATTERN,
    'Slug may only contain letters, numbers, hyphens, and underscores',
  )
  .refine((slug) => !isReservedSlug(slug), {
    message: 'That slug is reserved',
  });

const expiresAtSchema = z.coerce
  .date('Enter a valid expiry date')
  .refine((date) => date.getTime() > Date.now(), {
    message: 'Expiry must be in the future',
  });

export const createLinkSchema = z.object({
  url: urlSchema,
  customSlug: customSlugSchema.optional(),
  expiresAt: expiresAtSchema.optional(),
});

/** Shape accepted by `createLinkSchema.parse` — what a form or request body sends. */
export type CreateLinkInput = z.input<typeof createLinkSchema>;

/** Shape produced by `createLinkSchema.parse` — normalized and safe to persist. */
export type CreateLinkValues = z.output<typeof createLinkSchema>;
