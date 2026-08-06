import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Icon, type IconName } from '@/components/icons'
import { cn } from '@/utils/cn'

/**
 * Module-hierarchy location trail — not primary app navigation (Sidebar owns that).
 */
export function Breadcrumb({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'nav'>): React.ReactElement {
  return <nav aria-label="breadcrumb" className={cn(className)} {...props} />
}

export interface BreadcrumbListProps extends React.ComponentPropsWithoutRef<'ol'> {
  /** Truncate overflowing crumb text with ellipsis. */
  truncate?: boolean
}

export function BreadcrumbList({
  className,
  truncate = false,
  ...props
}: BreadcrumbListProps): React.ReactElement {
  return (
    <ol
      data-truncate={truncate || undefined}
      className={cn(
        'flex flex-wrap items-center gap-1.5 break-words text-caption text-muted-foreground',
        truncate && 'flex-nowrap overflow-hidden',
        className
      )}
      {...props}
    />
  )
}

export function BreadcrumbItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'li'>): React.ReactElement {
  return <li className={cn('inline-flex min-w-0 items-center gap-1.5', className)} {...props} />
}

export interface BreadcrumbLinkProps extends React.ComponentPropsWithoutRef<'a'> {
  asChild?: boolean
  icon?: IconName
}

export function BreadcrumbLink({
  asChild,
  className,
  icon,
  children,
  ...props
}: BreadcrumbLinkProps): React.ReactElement {
  const classes = cn(
    'inline-flex min-w-0 max-w-[12rem] items-center gap-1 truncate transition-colors duration-[var(--duration-fast)]',
    'text-muted-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    className
  )

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    )
  }

  return (
    <a className={classes} {...props}>
      {icon ? <Icon name={icon} size="sm" className="shrink-0 opacity-80" /> : null}
      <span className="truncate">{children}</span>
    </a>
  )
}

export interface BreadcrumbCurrentProps extends React.ComponentPropsWithoutRef<'span'> {
  icon?: IconName
}

/** Current page — text only (not a link). */
export function BreadcrumbCurrent({
  className,
  icon,
  children,
  ...props
}: BreadcrumbCurrentProps): React.ReactElement {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn(
        'inline-flex min-w-0 max-w-[16rem] items-center gap-1 truncate font-medium text-foreground',
        className
      )}
      {...props}
    >
      {icon ? <Icon name={icon} size="sm" className="shrink-0 text-brand" /> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** @deprecated Prefer `BreadcrumbCurrent`. Kept for existing call sites. */
export const BreadcrumbPage = BreadcrumbCurrent

export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'li'>): React.ReactElement {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn('shrink-0 [&>svg]:size-3.5', className)}
      {...props}
    >
      {/* ChevronLeft reads correctly between RTL crumbs (reading order →). */}
      {children ?? <Icon name="ChevronLeft" size="sm" className="text-muted-foreground" />}
    </li>
  )
}

export function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'span'>): React.ReactElement {
  return (
    <span
      role="presentation"
      aria-hidden="true"
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <Icon name="MoreHorizontal" size="sm" />
      <span className="sr-only">المزيد</span>
    </span>
  )
}

export type BreadcrumbCrumb = {
  id: string
  label: React.ReactNode
  href?: string
  icon?: IconName
  current?: boolean
}

/**
 * Helper for router-driven trails without changing the compound public API.
 * Collapses middle crumbs when `maxItems` is set (keeps first + last).
 */
export function buildBreadcrumbTrail(
  crumbs: BreadcrumbCrumb[],
  options?: { maxItems?: number }
): BreadcrumbCrumb[] {
  const max = options?.maxItems
  if (!max || crumbs.length <= max) return crumbs
  if (max < 3) return crumbs
  const head = crumbs[0]!
  const tail = crumbs.slice(-(max - 2))
  return [head, { id: '__ellipsis', label: '…', current: false }, ...tail]
}
