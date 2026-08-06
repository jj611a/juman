import { Outlet } from 'react-router'
import { ErrorBoundary } from '@/app/ErrorBoundary'
import { DRAWER_ID } from '@/shared/constants/app'
import { Sidebar } from '@/layouts/shell/Sidebar'
import { TopBar } from '@/layouts/shell/TopBar'
import { StatusBar } from '@/layouts/shell/StatusBar'
import { useTheme } from '@/app/providers/ThemeProvider'
import { cn } from '@/shared/utils/cn'

export function AppShell() {
  const { glass } = useTheme()

  return (
    <div className="drawer lg:drawer-open h-full">
      <input id={DRAWER_ID} type="checkbox" className="drawer-toggle" />
      <div className="drawer-content flex min-h-0 flex-col">
        <TopBar />
        <main
          className={cn(
            'flex-1 overflow-auto p-4 md:p-6',
            glass === 'strong' && 'bg-base-100/40',
          )}
        >
          <ErrorBoundary>
            <div
              className={cn(
                'mx-auto min-h-full max-w-7xl rounded-box',
                glass !== 'off' &&
                  'border border-base-content/5 bg-base-200/30 p-4 backdrop-blur-sm md:p-6',
                glass === 'off' && 'p-0',
              )}
            >
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
        <StatusBar />
      </div>

      <div className="drawer-side z-40">
        <label
          htmlFor={DRAWER_ID}
          className="drawer-overlay"
          aria-label="إغلاق القائمة"
        />
        <Sidebar />
      </div>
    </div>
  )
}
