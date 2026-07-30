import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/utils/cn'

export const Drawer = DialogPrimitive.Root
export const DrawerTrigger = DialogPrimitive.Trigger
export const DrawerClose = DialogPrimitive.Close
export const DrawerPortal = DialogPrimitive.Portal

const drawerOverlayClass =
  'fixed inset-0 z-[var(--z-overlay)] bg-background/70 data-[state=open]:animate-in data-[state=closed]:animate-out'

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn(drawerOverlayClass, className)} {...props} />
))
DrawerOverlay.displayName = DialogPrimitive.Overlay.displayName

const drawerContentVariants = cva(
  'fixed z-[var(--z-modal)] flex flex-col border-border bg-dialog shadow-lg outline-none duration-[var(--duration-normal)]',
  {
    variants: {
      side: {
        right: 'inset-y-0 end-0 h-full border-s',
        left: 'inset-y-0 start-0 h-full border-e',
        top: 'inset-x-0 top-0 w-full border-b',
        bottom: 'inset-x-0 bottom-0 w-full border-t'
      },
      size: {
        sm: '',
        md: '',
        lg: '',
        xl: '',
        full: ''
      }
    },
    compoundVariants: [
      { side: 'right', size: 'sm', class: 'w-[var(--drawer-sm)] max-w-full' },
      { side: 'right', size: 'md', class: 'w-[var(--drawer-md)] max-w-full' },
      { side: 'right', size: 'lg', class: 'w-[var(--drawer-lg)] max-w-full' },
      { side: 'right', size: 'xl', class: 'w-[var(--drawer-xl)] max-w-full' },
      { side: 'right', size: 'full', class: 'w-screen' },
      { side: 'left', size: 'sm', class: 'w-[var(--drawer-sm)] max-w-full' },
      { side: 'left', size: 'md', class: 'w-[var(--drawer-md)] max-w-full' },
      { side: 'left', size: 'lg', class: 'w-[var(--drawer-lg)] max-w-full' },
      { side: 'left', size: 'xl', class: 'w-[var(--drawer-xl)] max-w-full' },
      { side: 'left', size: 'full', class: 'w-screen' },
      { side: 'top', size: 'sm', class: 'h-[var(--drawer-sm)] max-h-full' },
      { side: 'top', size: 'md', class: 'h-[var(--drawer-md)] max-h-full' },
      { side: 'top', size: 'lg', class: 'h-[var(--drawer-lg)] max-h-full' },
      { side: 'top', size: 'xl', class: 'h-[var(--drawer-xl)] max-h-full' },
      { side: 'top', size: 'full', class: 'h-screen' },
      { side: 'bottom', size: 'sm', class: 'h-[var(--drawer-sm)] max-h-full' },
      { side: 'bottom', size: 'md', class: 'h-[var(--drawer-md)] max-h-full' },
      { side: 'bottom', size: 'lg', class: 'h-[var(--drawer-lg)] max-h-full' },
      { side: 'bottom', size: 'xl', class: 'h-[var(--drawer-xl)] max-h-full' },
      { side: 'bottom', size: 'full', class: 'h-screen' }
    ],
    defaultVariants: { side: 'right', size: 'md' }
  }
)

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerContentVariants> {
  showClose?: boolean
  /** When false, overlay click does not close (pass to Root modal still applies). Prefer Root onOpenChange. */
  showOverlay?: boolean
  customSize?: string
}

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(
  (
    {
      className,
      children,
      side = 'right',
      size = 'md',
      showClose = true,
      showOverlay = true,
      customSize,
      style,
      ...props
    },
    ref
  ) => {
    const customStyle =
      customSize != null
        ? side === 'top' || side === 'bottom'
          ? { ...style, height: customSize }
          : { ...style, width: customSize }
        : style

    return (
      <DrawerPortal>
        {showOverlay ? <DrawerOverlay /> : null}
        <DialogPrimitive.Content
          ref={ref}
          className={cn(drawerContentVariants({ side, size: customSize ? undefined : size }), className)}
          style={customStyle}
          {...props}
        >
          {showClose ? (
            <DialogPrimitive.Close asChild>
              <IconButton
                icon="X"
                size="sm"
                variant="ghost"
                aria-label="إغلاق"
                className="absolute start-3 top-3 z-10"
              />
            </DialogPrimitive.Close>
          ) : null}
          {children}
        </DialogPrimitive.Content>
      </DrawerPortal>
    )
  }
)
DrawerContent.displayName = 'DrawerContent'

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={cn('flex flex-col gap-1.5 border-b border-border px-4 py-3 pe-4 ps-12', className)} {...props} />
  )
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={cn('mt-auto flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3', className)} {...props} />
  )
}

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-title text-foreground', className)} {...props} />
))
DrawerTitle.displayName = DialogPrimitive.Title.displayName

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body text-muted-foreground', className)}
    {...props}
  />
))
DrawerDescription.displayName = DialogPrimitive.Description.displayName

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return <div className={cn('flex-1 overflow-auto p-4', className)} {...props} />
}

/** Semantic alias of Drawer. */
export const Sheet = Drawer
export const SheetTrigger = DrawerTrigger
export const SheetClose = DrawerClose
export const SheetContent = DrawerContent
export const SheetHeader = DrawerHeader
export const SheetFooter = DrawerFooter
export const SheetTitle = DrawerTitle
export const SheetDescription = DrawerDescription
export const SheetBody = DrawerBody
