import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/utils/cn'
import { apiClient } from '@/services/apiClient'
import type { LabelPreview, PrintStatus } from '@shared/hardware'

export interface BarcodeDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  label?: string
  title?: string
  /** Show label print affordance (desktop hardware). */
  printable?: boolean
}

export function BarcodeDisplay({
  value,
  label,
  title,
  printable = false,
  className,
  ...props
}: BarcodeDisplayProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<LabelPreview | null>(null)
  const [status, setStatus] = React.useState<PrintStatus | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function openPreview(): Promise<void> {
    setBusy(true)
    setStatus(null)
    try {
      const data = await apiClient.hardware.previewLabel({ barcode: value, title: title ?? label })
      setPreview(data)
      setOpen(true)
    } catch (error) {
      setStatus({
        ok: false,
        message: error instanceof Error ? error.message : 'تعذر تجهيز المعاينة',
        printerName: null,
        at: new Date().toISOString()
      })
    } finally {
      setBusy(false)
    }
  }

  async function confirmPrint(): Promise<void> {
    setBusy(true)
    try {
      const result = await apiClient.hardware.printLabel({ barcode: value, title: title ?? label })
      setStatus(result)
      if (result.ok) setOpen(false)
    } catch (error) {
      setStatus({
        ok: false,
        message: error instanceof Error ? error.message : 'فشلت الطباعة',
        printerName: null,
        at: new Date().toISOString()
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center gap-1 rounded-md border border-border bg-secondary px-4 py-3',
        className
      )}
      {...props}
    >
      {label ? <span className="text-caption text-muted-foreground">{label}</span> : null}
      <span
        dir="ltr"
        className="font-mono text-lg tracking-[0.35em] text-foreground"
        aria-label={value}
      >
        {value}
      </span>
      <svg
        role="img"
        aria-hidden
        width="160"
        height="36"
        viewBox="0 0 160 36"
        className="text-foreground"
      >
        {value.split('').map((_, i) => {
          const x = 4 + i * 6
          const w = i % 3 === 0 ? 2 : 1
          return <rect key={i} x={x} y={2} width={w} height={32} fill="currentColor" />
        })}
      </svg>
      {printable ? (
        <Button type="button" variant="outline" size="sm" disabled={busy || !value} onClick={() => void openPreview()}>
          طباعة ملصق
        </Button>
      ) : null}
      {status && !open ? (
        <span className={cn('text-caption', status.ok ? 'text-success' : 'text-destructive')}>
          {status.message}
        </span>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>معاينة ملصق الباركود</DialogTitle>
          </DialogHeader>
          {preview ? (
            <div
              className="flex justify-center rounded-md border border-border bg-secondary p-3"
              dangerouslySetInnerHTML={{ __html: preview.svg }}
            />
          ) : null}
          {status ? (
            <p className={cn('text-sm', status.ok ? 'text-success' : 'text-destructive')}>{status.message}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" disabled={busy} onClick={() => void confirmPrint()}>
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
