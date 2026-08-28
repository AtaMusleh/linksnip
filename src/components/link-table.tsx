'use client';

import {
  BarChart3Icon,
  CopyIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  QrCodeIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { CopyButton } from '@/components/copy-button';
import { QrDialog } from '@/components/qr-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LinkResponse } from '@/lib/api';
import { ApiRequestError, deleteLink } from '@/lib/client-api';
import {
  faviconUrl,
  formatAbsoluteTime,
  formatNumber,
  formatRelativeTime,
  isExpired,
  prettyUrl,
} from '@/lib/format';

type LinkTableProps = {
  links: LinkResponse[];
};

export function LinkTable({ links }: LinkTableProps) {
  const router = useRouter();
  const [qrTarget, setQrTarget] = useState<LinkResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LinkResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete(): Promise<void> {
    if (deleteTarget === null) {
      return;
    }

    setDeleting(true);

    try {
      await deleteLink(deleteTarget.id);
      toast.success(`Deleted /${deleteTarget.slug}`);
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError
          ? error.message
          : 'Could not delete the link. Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="border-border overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30%]">Short link</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {links.map((link) => {
              const favicon = faviconUrl(link.url);
              const expired = isExpired(link.expiresAt);

              return (
                <TableRow key={link.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <a
                        href={link.shortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-mono text-sm font-medium underline-offset-4 hover:underline"
                      >
                        /{link.slug}
                      </a>
                      <CopyButton value={link.shortUrl} label={`Copy link to /${link.slug}`} />
                      {expired ? (
                        <Badge variant="secondary" className="shrink-0">
                          Expired
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>

                  <TableCell className="max-w-0">
                    <div className="flex items-center gap-2">
                      {favicon !== null ? (
                        /* eslint-disable-next-line @next/next/no-img-element --
                           a 16px third-party favicon gains nothing from the
                           image optimizer and would need a remote-pattern rule */
                        <img
                          src={favicon}
                          alt=""
                          width={16}
                          height={16}
                          loading="lazy"
                          className="size-4 shrink-0 rounded-sm"
                        />
                      ) : (
                        <span className="bg-muted size-4 shrink-0 rounded-sm" />
                      )}
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        title={link.url}
                        className="text-muted-foreground hover:text-foreground truncate text-sm"
                      >
                        {prettyUrl(link.url)}
                      </a>
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-medium tabular-nums">
                    {formatNumber(link.clickCount)}
                  </TableCell>

                  <TableCell
                    className="text-muted-foreground hidden text-right text-sm whitespace-nowrap sm:table-cell"
                    title={formatAbsoluteTime(link.createdAt)}
                    // "now" differs by a few ms between server and client, which
                    // can render a different word; the value is refreshed on
                    // navigation and the exact time is in the tooltip.
                    suppressHydrationWarning
                  >
                    {formatRelativeTime(link.createdAt)}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for /${link.slug}`}
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onSelect={() => {
                            void navigator.clipboard
                              .writeText(link.shortUrl)
                              .then(() => toast.success('Copied to clipboard'))
                              .catch(() => toast.error('Could not copy — copy it manually'));
                          }}
                        >
                          <CopyIcon /> Copy
                        </DropdownMenuItem>

                        <DropdownMenuItem onSelect={() => setQrTarget(link)}>
                          <QrCodeIcon /> QR code
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/${link.id}`}>
                            <BarChart3Icon /> View analytics
                          </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                          <a href={link.url} target="_blank" rel="noreferrer">
                            <ExternalLinkIcon /> Open destination
                          </a>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleteTarget(link)}
                        >
                          <Trash2Icon /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {qrTarget !== null ? (
        <QrDialog
          slug={qrTarget.slug}
          shortUrl={qrTarget.shortUrl}
          open
          onOpenChange={(open) => {
            if (!open) {
              setQrTarget(null);
            }
          }}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete /{deleteTarget?.slug}?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone who follows this link will get a &ldquo;not found&rdquo; page, and its{' '}
              {formatNumber(deleteTarget?.clickCount ?? 0)} recorded{' '}
              {deleteTarget?.clickCount === 1 ? 'click' : 'clicks'} will be deleted too. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog open while the request is in flight so the
                // spinner is visible and a double-click cannot fire twice.
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              {deleting ? 'Deleting…' : 'Delete link'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
