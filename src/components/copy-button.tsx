'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CopyButtonProps = {
  value: string;
  label?: string;
  size?: 'default' | 'sm' | 'icon' | 'icon-sm';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  className?: string;
};

export function CopyButton({
  value,
  label = 'Copy short link',
  size = 'icon-sm',
  variant = 'ghost',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 2000);

    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied to clipboard');
    } catch {
      // Clipboard access is denied in insecure contexts and some embedded
      // browsers; tell the visitor rather than failing silently.
      toast.error('Could not copy — copy it manually');
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      onClick={copy}
      className={cn(className)}
    >
      {copied ? <CheckIcon className="text-emerald-600 dark:text-emerald-500" /> : <CopyIcon />}
    </Button>
  );
}
