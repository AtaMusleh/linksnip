import { LinkIcon } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/empty-state';
import { LinkTable } from '@/components/link-table';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import { fetchOwnerLinks } from '@/lib/server-api';

export const metadata = {
  title: 'Dashboard · LinkSnip',
};

export default async function DashboardPage() {
  const links = await fetchOwnerLinks();
  const totalClicks = links.reduce((sum, link) => sum + link.clickCount, 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your links</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {links.length === 0
              ? 'Links you create are tied to this browser.'
              : `${formatNumber(links.length)} ${links.length === 1 ? 'link' : 'links'} · ${formatNumber(totalClicks)} total ${totalClicks === 1 ? 'click' : 'clicks'}`}
          </p>
        </div>

        <Button asChild>
          <Link href="/">New link</Link>
        </Button>
      </div>

      <div className="mt-6">
        {links.length === 0 ? (
          <EmptyState
            icon={LinkIcon}
            title="No links yet"
            description="Shorten your first URL from the home page — it takes one paste and a click."
            action={
              <Button asChild size="sm">
                <Link href="/">Create a short link</Link>
              </Button>
            }
          />
        ) : (
          <LinkTable links={links} />
        )}
      </div>
    </main>
  );
}
