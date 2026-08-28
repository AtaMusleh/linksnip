import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';

import { LinkForm } from '@/components/link-form';
import { LinkTable } from '@/components/link-table';
import { Button } from '@/components/ui/button';
import { fetchOwnerLinks } from '@/lib/server-api';

const RECENT_LIMIT = 5;

export default async function HomePage() {
  const links = await fetchOwnerLinks();
  const recent = links.slice(0, RECENT_LIMIT);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Short links with real analytics
        </h1>
        <p className="text-muted-foreground text-base text-pretty sm:text-lg">
          Paste a long URL, get a short one, and see exactly how often it gets opened — no
          account needed.
        </p>

        <div className="mt-2">
          <LinkForm />
        </div>
      </section>

      {recent.length > 0 ? (
        <section className="mt-14">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-sm font-medium">Recent links</h2>
            {links.length > recent.length ? (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link href="/dashboard">
                  View all {links.length} <ArrowRightIcon />
                </Link>
              </Button>
            ) : null}
          </div>

          <LinkTable links={recent} />
        </section>
      ) : null}
    </main>
  );
}
