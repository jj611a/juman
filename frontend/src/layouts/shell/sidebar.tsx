import * as React from 'react'
import { IconButton } from '@/components/ui/icon-button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AppLogo } from './app-logo'
import { CompanySwitcher } from './company-switcher'
import { NavigationSection } from './navigation-section'
import type { ShellNavSection } from './types'
import { cn } from '@/utils/cn'

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  sections?: ShellNavSection[]
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

export function Sidebar({
  sections = [],
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  className,
  ...props
}: SidebarProps): React.ReactElement {
  const [uncontrolled, setUncontrolled] = React.useState(defaultCollapsed)
  const collapsed = collapsedProp ?? uncontrolled
  const setCollapsed = (next: boolean) => {
    if (collapsedProp === undefined) setUncontrolled(next)
    onCollapsedChange?.(next)
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-e border-border bg-sidebar text-foreground',
        collapsed ? 'w-[4.5rem]' : 'w-full',
        className
      )}
      aria-label="التنقل الرئيسي"
      {...props}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <AppLogo collapsed={collapsed} />
        <IconButton
          type="button"
          icon={collapsed ? 'PanelLeftOpen' : 'PanelLeftClose'}
          aria-label={collapsed ? 'توسيع الشريط الجانبي' : 'طي الشريط الجانبي'}
          aria-expanded={!collapsed}
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
        />
      </div>
      <div className="border-b border-border px-2 py-2">
        <CompanySwitcher className="w-full" />
      </div>
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-4" aria-label="أقسام التنقل">
          {sections.map((section) => (
            <NavigationSection key={section.id} section={section} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>
    </aside>
  )
}
