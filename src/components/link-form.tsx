'use client';

import {
  ArrowRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LinkResponse } from '@/lib/api';
import { ApiRequestError, createLink } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { createLinkSchema } from '@/lib/validation';

type FieldName = 'url' | 'customSlug' | 'expiresAt';
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly FieldName[] = ['url', 'customSlug', 'expiresAt'];

function isFieldName(value: string): value is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(value);
}

export function LinkForm() {
  const router = useRouter();
  const urlId = useId();
  const slugId = useId();
  const expiryId = useId();

  const [url, setUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<LinkResponse | null>(null);

  function reset(): void {
    setUrl('');
    setCustomSlug('');
    setExpiresAt('');
    setAdvancedOpen(false);
    setCreated(null);
    setFieldErrors({});
    setFormError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const input = {
      url,
      ...(customSlug.trim() !== '' ? { customSlug: customSlug.trim() } : {}),
      ...(expiresAt !== '' ? { expiresAt } : {}),
    };

    // The same schema the route handler runs, so an obvious mistake is caught
    // before a round trip and reported on the field that caused it.
    const parsed = createLinkSchema.safeParse(input);

    if (!parsed.success) {
      const next: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? '');

        if (isFieldName(field) && next[field] === undefined) {
          next[field] = issue.message;
        }
      }

      setFieldErrors(next);

      if (next.customSlug !== undefined || next.expiresAt !== undefined) {
        setAdvancedOpen(true);
      }

      return;
    }

    setPending(true);

    try {
      const link = await createLink(input);
      setCreated(link);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        // A taken or reserved slug is a problem with one field, so it is shown
        // on that field rather than as a banner the visitor has to interpret.
        if (error.code === 'slug_taken' || error.code === 'slug_reserved') {
          setFieldErrors({ customSlug: error.message });
          setAdvancedOpen(true);
        } else if (error.code === 'validation_error' && error.details.length > 0) {
          const next: FieldErrors = {};

          for (const detail of error.details) {
            const field = detail.path.split('.')[0];

            if (isFieldName(field) && next[field] === undefined) {
              next[field] = detail.message;
            }
          }

          setFieldErrors(next);
          setFormError(Object.keys(next).length === 0 ? error.message : null);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setPending(false);
    }
  }

  if (created !== null) {
    return (
      <div className="border-border bg-card rounded-xl border p-5 shadow-sm sm:p-6">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Your short link is ready
        </p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            href={created.shortUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate font-mono text-base font-medium underline-offset-4 hover:underline sm:text-lg"
          >
            {created.shortUrl.replace(/^https?:\/\//, '')}
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <CopyButton value={created.shortUrl} size="sm" variant="outline" />
            <Button asChild variant="outline" size="sm">
              <a href={created.shortUrl} target="_blank" rel="noreferrer">
                Open <ExternalLinkIcon />
              </a>
            </Button>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 truncate text-sm">
          Redirects to {created.url}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              reset();
              router.refresh();
            }}
          >
            <PlusIcon /> Create another
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              router.refresh();
              router.push(`/dashboard/${created.id}`);
            }}
          >
            View analytics <ArrowRightIcon />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor={urlId} className="sr-only">
            Destination URL
          </Label>
          <Input
            id={urlId}
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com/a-very-long-link"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            aria-invalid={fieldErrors.url !== undefined}
            aria-describedby={fieldErrors.url !== undefined ? `${urlId}-error` : undefined}
            className="h-11 text-base sm:text-sm"
          />
        </div>
        <Button type="submit" size="lg" disabled={pending} className="h-11 shrink-0">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {pending ? 'Shortening…' : 'Shorten'}
        </Button>
      </div>

      {fieldErrors.url !== undefined ? (
        <p id={`${urlId}-error`} className="text-destructive text-sm">
          {fieldErrors.url}
        </p>
      ) : null}

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground -ml-2 self-start"
          >
            <ChevronDownIcon
              className={cn('transition-transform', advancedOpen && 'rotate-180')}
            />
            Advanced
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-3">
          <div className="border-border grid gap-4 rounded-lg border border-dashed p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={slugId}>Custom slug</Label>
              <Input
                id={slugId}
                name="customSlug"
                placeholder="launch-2026"
                value={customSlug}
                onChange={(event) => setCustomSlug(event.target.value)}
                aria-invalid={fieldErrors.customSlug !== undefined}
                aria-describedby={
                  fieldErrors.customSlug !== undefined ? `${slugId}-error` : `${slugId}-hint`
                }
              />
              {fieldErrors.customSlug !== undefined ? (
                <p id={`${slugId}-error`} className="text-destructive text-sm">
                  {fieldErrors.customSlug}
                </p>
              ) : (
                <p id={`${slugId}-hint`} className="text-muted-foreground text-xs">
                  3–32 characters. Letters, numbers, hyphens, underscores.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={expiryId}>Expires</Label>
              <Input
                id={expiryId}
                name="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                aria-invalid={fieldErrors.expiresAt !== undefined}
                aria-describedby={
                  fieldErrors.expiresAt !== undefined ? `${expiryId}-error` : `${expiryId}-hint`
                }
              />
              {fieldErrors.expiresAt !== undefined ? (
                <p id={`${expiryId}-error`} className="text-destructive text-sm">
                  {fieldErrors.expiresAt}
                </p>
              ) : (
                <p id={`${expiryId}-hint`} className="text-muted-foreground text-xs">
                  Leave empty to keep the link forever.
                </p>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {formError !== null ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}
    </form>
  );
}
