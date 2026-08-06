import * as React from 'react'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { Workspace } from './workspace'
import { StatusBar } from './status-bar'
import { DEFAULT_SHELL_SECTIONS } from './nav-config'
import type { ShellNavSection } from './types'
import type { BreadcrumbCrumb } from '@/components/ui/breadcrumb'
import { cn } from '@/utils/cn'

export interface AppShellProps {
  children?: React.ReactNode
  sections?: ShellNavSection[]
  title?: React.ReactNode
  breadcrumbs?: BreadcrumbCrumb[]
  sidebarCollapsed?: boolean
  defaultSidebarCollapsed?: boolean
  onSidebarCollapsedChange?: (collapsed: boolean) => void
  onSearch?: () => void
  onCommandPalette?: () => void
  onNotifications?: () => void
  onSignOut?: () => void
  showWindowControls?: boolean
  className?: string
  resizable?: boolean
  online?: boolean
  appVersion?: string
  backendVersion?: string
  workspaceLoading?: boolean
  workspaceEmpty?: boolean
  workspaceError?: Error | string | null
}

export function AppShellFrame({
  children,
  sections = DEFAULT_SHELL_SECTIONS,
  title,
  breadcrumbs = [{ id: 'home', label: 'جمان' }],
  sidebarCollapsed,
  defaultSidebarCollapsed,
  onSidebarCollapsedChange,
  onSearch,
  onCommandPalette,
  onNotifications,
  onSignOut,
  showWindowControls = true,
  className,
  resizable = true,
  online = true,
  appVersion,
  backendVersion,
  workspaceLoading,
  workspaceEmpty,
  workspaceError
}: AppShellProps): React.ReactElement {
  const [collapsed, setCollapsed] = React.useState(defaultSidebarCollapsed ?? false)
  const isCollapsed = sidebarCollapsed ?? collapsed

  const handleCollapsed = (next: boolean) => {
    if (sidebarCollapsed === undefined) setCollapsed(next)
    onSidebarCollapsedChange?.(next)
  }

  const sidebar = (
    <Sidebar sections={sections} collapsed={isCollapsed} onCollapsedChange={handleCollapsed} />
  )

  const main = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TopBar
        title={title}
        breadcrumbs={breadcrumbs}
        onSearch={onSearch}
        onCommandPalette={onCommandPalette}
        onNotifications={onNotifications}
        onSignOut={onSignOut}
        showWindowControls={showWindowControls}
      />
      <Workspace loading={workspaceLoading} empty={workspaceEmpty} error={workspaceError}>
        {children}
      </Workspace>
      <StatusBar online={online} appVersion={appVersion} backendVersion={backendVersion} />
    </div>
  )

  return (
    <div className={cn('flex h-full min-h-screen flex-col bg-background', className)} dir="rtl">
      {resizable && !isCollapsed ? (
        <ResizablePanelGroup orientation="horizontal" className="min-h-screen flex-1">
          <ResizablePanel defaultSize="18%" minSize="12%" maxSize="32%" className="min-w-[12rem]">
            {sidebar}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="82%" minSize="50%">
            {main}
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex min-h-screen flex-1">
          <div className={cn(isCollapsed ? 'w-[4.5rem] shrink-0' : 'w-64 shrink-0')}>{sidebar}</div>
          {main}
        </div>
      )}
    </div>
  )
}
