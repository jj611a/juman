import * as React from 'react'
import { Outlet, useMatches, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AppShellFrame, DEFAULT_SHELL_SECTIONS } from '@/layouts/shell'
import { useShortcut } from '@/app/shortcuts'
import { apiClient } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui'
import type { BreadcrumbCrumb } from '@/components/ui/breadcrumb'

type RouteHandle = {
  title?: string
  breadcrumb?: BreadcrumbCrumb | BreadcrumbCrumb[]
}

export function AppShell(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const matches = useMatches()
  const setSession = useAuthStore((s) => s.setSession)

  const [collapsed, setCollapsed] = React.useState(false)
  const [online, setOnline] = React.useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [appName, setAppName] = React.useState('جمان')
  const [backendVersion, setBackendVersion] = React.useState<string | undefined>()

  React.useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  React.useEffect(() => {
    void apiClient.app.getConfig().then((c) => setAppName(c.appNameAr || c.appName || 'جمان'))
    void apiClient.system
      .version()
      .then((v) => {
        if (typeof v === 'object' && v && 'version' in v) {
          setBackendVersion(String((v as { version: unknown }).version))
        }
      })
      .catch(() => undefined)
  }, [])

  const title = React.useMemo(() => {
    for (let i = matches.length - 1; i >= 0; i -= 1) {
      const handle = matches[i]?.handle as RouteHandle | undefined
      if (handle?.title) return handle.title
    }
    return t('app.name')
  }, [matches, t])

  const breadcrumbs = React.useMemo(() => {
    const crumbs: BreadcrumbCrumb[] = [{ id: 'root', label: appName }]
    for (const match of matches) {
      const handle = match.handle as RouteHandle | undefined
      if (!handle?.breadcrumb) continue
      const list = Array.isArray(handle.breadcrumb) ? handle.breadcrumb : [handle.breadcrumb]
      crumbs.push(...list)
    }
    return crumbs
  }, [matches, appName])

  React.useEffect(() => {
    const full = `${title} · ${appName}`
    document.title = full
    void apiClient.desktop.window.setTitle(full).catch(() => undefined)
  }, [title, appName])

  useShortcut('shell.toggleSidebar', 'Control+b', () => setCollapsed((c) => !c))
  // Search / command palette stubs stay disabled — no toast on Ctrl+K

  const onSignOut = async () => {
    try {
      const session = await apiClient.auth.logout()
      setSession(session)
      navigate('/login', { replace: true })
    } catch {
      toast.error(t('auth.logoutFailed'))
    }
  }

  return (
    <AppShellFrame
      sections={DEFAULT_SHELL_SECTIONS}
      title={title}
      breadcrumbs={breadcrumbs}
      sidebarCollapsed={collapsed}
      onSidebarCollapsedChange={setCollapsed}
      onSignOut={() => void onSignOut()}
      online={online}
      appVersion={appName}
      backendVersion={backendVersion}
    >
      {/* Single page gutter — Page components must not add horizontal padding */}
      <div className="p-6">
        <Outlet />
      </div>
    </AppShellFrame>
  )
}
