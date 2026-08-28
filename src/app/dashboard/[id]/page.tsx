import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClicksChart } from '@/components/clicks-chart';
import { CopyButton } from '@/components/copy-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  faviconUrl,
  formatAbsoluteTime,
  formatNumber,
  isExpired,
  prettyUrl,
} from '@/lib/format';
import { fetchLinkDetail } from '@/lib/server-api';

export const metadata = {
  title: 'Link analytics · LinkSnip',
};

export default async function LinkAnalyticsPage({
  params,
}: PageProps<'/dashboard/[id]'>) {
  const { id } = await params;
  const detail = await fetchLinkDetail(id);

  if (detail === null) {
    notFound();
  }

  const { link, analytics } = detail;
  const favicon = faviconUrl(link.url);
  const expired = isExpired(link.expiresAt);
  const windowClicks = analytics.clicksByDay.reduce((sum, point) => sum + point.clicks, 0);
  const referrerTotal = analytics.referrers.reduce((sum, row) => sum + row.clicks, 0);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
        <Link href="/dashboard">
          <ArrowLeftIcon /> All links
        </Link>
      </Button>

      <header className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-semibold tracking-tight">/{link.slug}</h1>
          <CopyButton value={link.shortUrl} size="sm" variant="outline" />
          <Button asChild variant="outline" size="sm">
            <a href={link.shortUrl} target="_blank" rel="noreferrer">
              Open <ExternalLinkIcon />
            </a>
          </Button>
          {expired ? <Badge variant="secondary">Expired</Badge> : null}
        </div>

        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {favicon !== null ? (
            /* eslint-disable-next-line @next/next/no-img-element --
               a 16px third-party favicon gains nothing from the image optimizer */
            <img src={favicon} alt="" width={16} height={16} className="size-4 rounded-sm" />
          ) : null}
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            title={link.url}
            className="hover:text-foreground truncate underline-offset-4 hover:underline"
          >
            {prettyUrl(link.url)}
          </a>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="border-border rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Total clicks
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(link.clickCount)}
          </p>
        </div>
        <div className="border-border rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Last {analytics.windowDays} days
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatNumber(windowClicks)}
          </p>
        </div>
        <div className="border-border rounded-xl border p-4">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Created
          </p>
          <p className="mt-1 text-sm font-medium">{formatAbsoluteTime(link.createdAt)}</p>
          {link.expiresAt !== null ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {expired ? 'Expired' : 'Expires'} {formatAbsoluteTime(link.expiresAt)}
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-border mt-6 rounded-xl border p-4 sm:p-5">
        <h2 className="text-sm font-medium">
          Clicks over the last {analytics.windowDays} days
        </h2>
        <div className="mt-4">
          <ClicksChart data={analytics.clicksByDay} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium">Referrers</h2>

        {analytics.referrers.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm">
            <p className="text-foreground font-medium">No referrers recorded yet</p>
            <p className="mt-1">
              Once someone opens this link, where they came from will be listed here.
            </p>
          </div>
        ) : (
          <div className="border-border overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Source</TableHead>
                  <TableHead className="w-24 text-right">Clicks</TableHead>
                  <TableHead className="w-20 text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.referrers.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="max-w-0">
                      <span className="block truncate text-sm" title={row.label}>
                        {row.label === 'direct' ? 'Direct or unknown' : prettyUrl(row.label)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.clicks)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {referrerTotal === 0
                        ? '—'
                        : `${Math.round((row.clicks / referrerTotal) * 100)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
