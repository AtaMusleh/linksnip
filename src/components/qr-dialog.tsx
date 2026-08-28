'use client';

import { DownloadIcon } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const QR_RENDER_SIZE = 224;

/**
 * Rendered larger than it is displayed so the downloaded PNG stays sharp when
 * it is printed or dropped into a slide.
 */
const QR_EXPORT_SCALE = 4;

type QrDialogProps = {
  slug: string;
  shortUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QrDialog({ slug, shortUrl, open, onOpenChange }: QrDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const download = useCallback(() => {
    const canvas = containerRef.current?.querySelector('canvas');

    if (!(canvas instanceof HTMLCanvasElement)) {
      toast.error('Could not generate the image');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = canvas.toDataURL('image/png');
    anchor.download = `linksnip-${slug}.png`;
    anchor.click();

    toast.success('QR code downloaded');
  }, [slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code</DialogTitle>
          <DialogDescription className="break-all">
            Scans open {shortUrl.replace(/^https?:\/\//, '')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          {/* White quiet zone regardless of theme — scanners need the contrast,
              and a dark-on-dark code fails to read on many phones. */}
          <div ref={containerRef} className="rounded-lg bg-white p-4 shadow-sm">
            <QRCodeCanvas
              value={shortUrl}
              size={QR_RENDER_SIZE * QR_EXPORT_SCALE}
              marginSize={2}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              style={{ width: QR_RENDER_SIZE, height: QR_RENDER_SIZE }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={download} className="w-full sm:w-auto">
            <DownloadIcon /> Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
