import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { apiClient } from '@/services/apiClient'
import { AppLogo } from './app-logo'

export interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps): React.ReactElement {
  const [appVersion, setAppVersion] = React.useState<string>('—')
  const [backendVersion, setBackendVersion] = React.useState<string>('—')

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const v = await apiClient.app.getVersion()
        if (!cancelled) setAppVersion(v || '1.0.0')
      } catch {
        if (!cancelled) setAppVersion('1.0.0')
      }
      try {
        const version = await apiClient.system.version()
        const v =
          typeof version === 'object' && version && 'version' in version
            ? String((version as { version: unknown }).version)
            : typeof version === 'string'
              ? version
              : '—'
        if (!cancelled) setBackendVersion(v)
      } catch {
        if (!cancelled) setBackendVersion('—')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <AppLogo size="mark" />
          </div>
          <DialogTitle>حول جمان</DialogTitle>
          <DialogDescription>نظام إدارة تأجير وبيع الفساتين</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-2 text-body text-foreground">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">إصدار التطبيق</dt>
            <dd className="font-mono">{appVersion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">إصدار الخادم</dt>
            <dd className="font-mono">{backendVersion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">حقوق النشر</dt>
            <dd>Copyright Juman</dd>
          </div>
        </dl>
      </DialogContent>
    </Dialog>
  )
}
