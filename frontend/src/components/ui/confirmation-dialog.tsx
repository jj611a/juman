import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export interface ConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
  tone?: 'default' | 'danger'
  loading?: boolean
  /** When true (default), Enter confirms unless focus is on cancel or loading. */
  confirmShortcut?: boolean
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  onConfirm,
  onCancel,
  tone = 'default',
  loading = false,
  confirmShortcut = true
}: ConfirmationDialogProps): React.ReactElement {
  const cancelRef = React.useRef<HTMLButtonElement>(null)
  const confirmRef = React.useRef<HTMLButtonElement>(null)

  const handleCancel = (): void => {
    if (loading) return
    onCancel?.()
    onOpenChange(false)
  }

  const handleConfirm = (): void => {
    if (loading) return
    void onConfirm()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        showClose={!loading}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          if (tone === 'danger') cancelRef.current?.focus()
          else confirmRef.current?.focus()
        }}
        onKeyDown={(e) => {
          if (!confirmShortcut || loading) return
          if (e.key !== 'Enter') return
          const target = e.target as HTMLElement | null
          if (target?.closest('[data-confirm-cancel]')) return
          e.preventDefault()
          handleConfirm()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            data-confirm-cancel=""
            disabled={loading}
            onClick={handleCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
