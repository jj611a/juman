import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/utils/cn'

/**
 * Page/panel workspace tabs — not app chrome navigation.
 * Controlled: `value` + `onValueChange`. Uncontrolled: `defaultValue`.
 */
export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-start gap-1 rounded-md border border-border bg-muted/40 p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export interface TabsTriggerProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  icon?: IconName
  /** Compact count / status chip next to the label. */
  badge?: React.ReactNode
  /**
   * Future-ready closable affordance. Not interactive unless `onClose` is provided.
   * Default remains non-closable.
   */
  closable?: boolean
  onClose?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, children, icon, badge, closable = false, onClose, disabled, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    disabled={disabled}
    data-closable={closable || undefined}
    className={cn(
      'group inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-caption font-medium',
      'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      'data-[state=active]:border-b-2 data-[state=active]:border-brand',
      className
    )}
    {...props}
  >
    {icon ? <Icon name={icon} size="sm" className="opacity-80" /> : null}
    <span className="min-w-0 truncate">{children}</span>
    {badge != null ? (
      <span className="inline-flex min-w-4 items-center justify-center rounded-sm bg-secondary px-1 text-[10px] font-medium text-secondary-foreground data-[state=active]:bg-brand-subtle data-[state=active]:text-brand group-data-[state=active]:bg-brand-subtle group-data-[state=active]:text-brand">
        {badge}
      </span>
    ) : null}
    {closable ? (
      <span
        role="presentation"
        className={cn(
          'ms-0.5 inline-flex size-4 items-center justify-center rounded-sm opacity-60',
          onClose ? 'hover:bg-hover hover:opacity-100' : 'pointer-events-none'
        )}
        onClick={
          onClose
            ? (e) => {
                e.preventDefault()
                e.stopPropagation()
                onClose(e as unknown as React.MouseEvent<HTMLButtonElement>)
              }
            : undefined
        }
        onKeyDown={
          onClose
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onClose(e as unknown as React.MouseEvent<HTMLButtonElement>)
                }
              }
            : undefined
        }
        tabIndex={onClose ? 0 : undefined}
        aria-hidden={!onClose}
      >
        <Icon name="X" size={12} />
      </span>
    ) : null}
  </TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export interface TabsContentProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content> {
  /**
   * When true (default), inactive panels unmount (Radix default).
   * When false, keep mounted via `forceMount` for stateful panels.
   */
  lazy?: boolean
}

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, lazy = true, forceMount, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    forceMount={lazy === false ? true : forceMount}
    className={cn(
      'mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'data-[state=inactive]:hidden',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName
