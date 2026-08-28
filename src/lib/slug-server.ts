import { prisma } from './prisma';
import { generateSlug, isReservedSlug, MAX_SLUG_ATTEMPTS } from './slug';

export class SlugGenerationError extends Error {
  constructor(attempts: number) {
    super(`Could not generate an unused slug after ${attempts} attempts`);
    this.name = 'SlugGenerationError';
  }
}

/**
 * Generates a slug that is not already stored. The unique index on `slug` is
 * the real guarantee — this check just avoids surfacing a constraint violation
 * on the common path, so callers should still handle a write conflict.
 *
 * Lives apart from `slug.ts` because it touches the database: `validation.ts`
 * pulls the pure helpers into the browser bundle, and importing Prisma there
 * would drag the driver in with it.
 */
export async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = generateSlug();

    if (isReservedSlug(slug)) {
      continue;
    }

    const existing = await prisma.link.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing === null) {
      return slug;
    }
  }

  throw new SlugGenerationError(MAX_SLUG_ATTEMPTS);
}
