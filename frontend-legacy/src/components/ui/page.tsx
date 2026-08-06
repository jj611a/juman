import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { BusyIndicator } from '@/components/ui/busy-indicator'
import { cn } from '@/utils/cn'

/** Horizontal gutters come from AppShell workspace (`p-6`) — Page must not add px. */
const pageSizeVariants = cva('mx-auto w-full', {
  variants: {
    size: {
      md: 'max-w-5xl',
      lg: 'max-w-6xl',
      xl: 'max-w-7xl',
      full: 'max-w-none'
    }
  },
  defaultVariants: { size: 'lg' }
})

export interface PageProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof pageSizeVariants> {
  /** Landmark element. Default `section`; use `main` for the primary app page region. */
  as?: 'section' | 'main' | 'div'
}

export const Page = React.forwardRef<HTMLElement, PageProps>(
  ({ className, size, as: Comp = 'section', ...props }, ref) => (
    <Comp
      ref={ref as never}
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-6 bg-base-200',
        pageSizeVariants({ size }),
        className
      )}
      {...props}
    />
  )
)
Page.displayName = 'Page'

export function PageTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return <h1 className={cn('text-h1 text-base-content tracking-tight', className)} {...props} />
}

export function PageSubtitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return <p className={cn('text-body text-base-content/60', className)} {...props} />
}

export const PageActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-wrap items-center justify-end gap-2', className)}
      {...props}
    />
  )
)
PageActions.displayName = 'PageActions'

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** Prop API — ignored for the title row when compositional children are provided. */
  title?: React.ReactNode
  description?: React.ReactNode
  breadcrumbs?: React.ReactNode
  actions?: React.ReactNode
  toolbar?: React.ReactNode
  children?: React.ReactNode
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  toolbar,
  children,
  className,
  ...props
}: PageHeaderProps): React.ReactElement {
  const hasComposition = React.Children.count(children) > 0

  return (
    <header
      className={cn('flex flex-col gap-4 border-b border-base-content/10 pb-5', className)}
      {...props}
    >
      {hasComposition ? (
        children
      ) : (
        <>
          {breadcrumbs ? <div className="min-w-0">{breadcrumbs}</div> : null}
          {(title != null || description != null || actions != null) && (
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex flex-col gap-1">
                {title != null ? <PageTitle>{title}</PageTitle> : null}
                {description != null ? <PageSubtitle>{description}</PageSubtitle> : null}
              </div>
              {actions != null ? <PageActions>{actions}</PageActions> : null}
            </div>
          )}
        </>
      )}
      {toolbar ? <div className="min-w-0">{toolbar}</div> : null}
    </header>
  )
}

export interface PageToolbarProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PageToolbar = React.forwardRef<HTMLDivElement, PageToolbarProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-box border border-base-content/10 bg-base-300 px-3 py-2.5 shadow-sm',
        className
      )}
      {...props}
    />
  )
)
PageToolbar.displayName = 'PageToolbar'

export interface PageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  loading?: boolean
  empty?: React.ReactNode
}

export const PageContent = React.forwardRef<HTMLDivElement, PageContentProps>(
  ({ className, loading = false, empty, children, ...props }, ref) => {
    const showEmpty =
      !loading && empty != null && (children === undefined || children === null || children === false)

    return (
      <div ref={ref} className={cn('flex min-h-0 flex-1 flex-col gap-6', className)} {...props}>
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <BusyIndicator label="جاري التحميل…" />
          </div>
        ) : showEmpty ? (
          empty
        ) : (
          children
        )}
      </div>
    )
  }
)
PageContent.displayName = 'PageContent'

export interface PageFooterProps extends React.HTMLAttributes<HTMLElement> {
  sticky?: boolean
}

export const PageFooter = React.forwardRef<HTMLElement, PageFooterProps>(
  ({ className, sticky = false, ...props }, ref) => (
    <footer
      ref={ref}
      className={cn(
        'mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-base-content/10 pt-4',
        sticky && 'sticky bottom-0 z-[1] bg-base-200/95 backdrop-blur-sm',
        className
      )}
      {...props}
    />
  )
)
PageFooter.displayName = 'PageFooter'
