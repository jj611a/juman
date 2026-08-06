import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { Icon, type IconName } from '@/components/icons'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/utils/cn'
import {
  dismissToast,
  getToastSnapshot,
  subscribeToasts,
  type ToastRecord,
  type ToastVariant
} from './toast-store'

const VARIANT_ICON: Record<ToastVariant, IconName> = {
  success: 'CheckCircle2',
  info: 'Info',
  warning: 'AlertTriangle',
  error: 'CircleAlert'
}

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success: 'border-success/40 bg-panel text-foreground',
  info: 'border-info/40 bg-panel text-foreground',
  warning: 'border-warning/40 bg-panel text-foreground',
  error: 'border-destructive/40 bg-panel text-foreground'
}

const ICON_CLASS: Record<ToastVariant, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-destructive'
}

export interface ToastProviderProps {
  children: React.ReactNode
  /** Max simultaneous toasts (defaults to store constant 3). */
  swipeDirection?: React.ComponentPropsWithoutRef<typeof ToastPrimitive.Provider>['swipeDirection']
}

export function ToastProvider({
  children,
  swipeDirection = 'left'
}: ToastProviderProps): React.ReactElement {
  const [visible, setVisible] = React.useState<ToastRecord[]>(() => getToastSnapshot().visible)

  React.useEffect(() => {
    return subscribeToasts(() => {
      setVisible(getToastSnapshot().visible)
    })
  }, [])

  return (
    <ToastPrimitive.Provider swipeDirection={swipeDirection} duration={5000}>
      {children}
      {visible.map((item) => (
        <ToastItem key={item.id} item={item} />
      ))}
      <ToastPrimitive.Viewport
        className={cn(
          'fixed bottom-4 start-4 z-[var(--z-toast)] flex w-[min(100vw-2rem,24rem)] flex-col gap-2 outline-none'
        )}
      />
    </ToastPrimitive.Provider>
  )
}

function ToastItem({ item }: { item: ToastRecord }): React.ReactElement {
  const open = true
  return (
    <ToastPrimitive.Root
      open={open}
      duration={item.duration}
      onOpenChange={(next) => {
        if (!next) dismissToast(item.id)
      }}
      className={cn(
        'pointer-events-auto relative flex w-full items-start gap-3 rounded-md border p-3 shadow-md',
        VARIANT_CLASS[item.variant]
      )}
      type={item.variant === 'error' ? 'foreground' : 'background'}
    >
      <Icon
        name={VARIANT_ICON[item.variant]}
        size="sm"
        className={cn('mt-0.5 shrink-0', ICON_CLASS[item.variant])}
      />
      <div className="min-w-0 flex-1">
        <ToastPrimitive.Title className="text-caption font-medium text-foreground">
          {item.title}
        </ToastPrimitive.Title>
        {item.description ? (
          <ToastPrimitive.Description className="mt-0.5 text-caption text-muted-foreground">
            {item.description}
          </ToastPrimitive.Description>
        ) : null}
        {item.action ? (
          <ToastPrimitive.Action
            altText={item.action.altText ?? item.action.label}
            className="mt-2 inline-flex rounded-md border border-border px-2 py-1 text-caption text-brand hover:bg-brand-subtle"
            onClick={() => {
              item.action?.onClick()
              dismissToast(item.id)
            }}
          >
            {item.action.label}
          </ToastPrimitive.Action>
        ) : null}
      </div>
      <ToastPrimitive.Close asChild>
        <IconButton icon="X" size="sm" variant="ghost" aria-label="إغلاق" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  )
}
