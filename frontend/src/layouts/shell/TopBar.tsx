import { useEffect, useState } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import { useDialog } from '@/app/providers/DialogProvider'
import { useToast } from '@/app/providers/ToastProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { useShortcuts } from '@/app/providers/ShortcutProvider'
import { DRAWER_ID, SEARCH_SHORTCUT, SIDEBAR_SHORTCUT } from '@/shared/constants/app'
import { ShellBreadcrumbs } from '@/layouts/shell/ShellBreadcrumbs'
import { WindowControls } from '@/layouts/shell/WindowControls'
import { CommandSearch } from '@/layouts/shell/CommandSearch'
import { cn } from '@/shared/utils/cn'
import { UserProfileDialog } from '@/features/authentication/UserProfileDialog'
import { PasswordChangeDialog } from '@/features/authentication/PasswordChangeDialog'
import { NAV_GROUPS, NAV_ITEMS } from '@/navigation/nav.config'
import { PERMISSION, hasPermission } from '@/shared/constants/permissions'
import { useLocation } from 'react-router'

export function TopBar() {
  const { session, logout } = useSession()
  const { confirm } = useDialog()
  const { push } = useToast()
  const { glass, setGlass, toggleSidebarCollapsed } = useTheme()
  const { register } = useShortcuts()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [viewSwitcherOpen, setViewSwitcherOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  useEffect(() => {
    return register('Ctrl+K', () => setSearchOpen(true))
  }, [register])

  useEffect(() => {
    return register('Ctrl+B', () => toggleSidebarCollapsed())
  }, [register, toggleSidebarCollapsed])

  const onLogout = async () => {
    const ok = await confirm({
      title: 'تسجيل الخروج',
      message: 'هل تريد إنهاء الجلسة الحالية؟',
      confirmLabel: 'خروج',
      tone: 'error',
    })
    if (!ok) return
    await logout()
    push({ title: 'تم تسجيل الخروج', tone: 'info' })
  }

  const filteredNavItems = NAV_ITEMS.filter((item) => {
    if (!item.permission) return true
    return hasPermission(session?.user?.permissions, item.permission)
  })

  const groupedNavItems = NAV_GROUPS.map((group) => ({
    group,
    items: filteredNavItems.filter((item) => item.group === group.id),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <header
        className={cn(
          'navbar min-h-14 border-b border-base-content/10 px-3',
          glass === 'off' ? 'bg-base-200' : 'glass bg-base-200/70',
        )}
      >
        <div className="navbar-start gap-2">
          <label
            htmlFor={DRAWER_ID}
            className="btn btn-ghost btn-square drawer-button lg:hidden juman-focus"
            aria-label="فتح القائمة"
          >
            ☰
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm hidden lg:inline-flex juman-focus"
            onClick={() => toggleSidebarCollapsed()}
            title={SIDEBAR_SHORTCUT}
          >
            القائمة
          </button>
          <ShellBreadcrumbs />
        </div>

        <div className="navbar-center hidden md:flex">
          <button
            type="button"
            className="btn btn-ghost btn-sm gap-2 border border-base-content/10 juman-focus"
            onClick={() => setSearchOpen(true)}
          >
            <span>بحث في الوحدات</span>
            <kbd className="kbd kbd-sm">{SEARCH_SHORTCUT}</kbd>
          </button>
        </div>

        <div className="navbar-end gap-2">
          {/* Notifications Dropdown */}
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className={cn('btn btn-ghost btn-sm juman-focus', notificationsOpen && 'btn-active')}
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              title="الإشعارات"
            >
              <span className="indicator">
                <span className="status status-primary indicator-item status-xs" />
                تنبيهات
              </span>
            </div>
            <div
              tabIndex={0}
              className={cn(
                'dropdown-content z-50 mt-2 w-80 rounded-box border border-base-content/10 bg-base-200 p-3 shadow',
                notificationsOpen ? 'dropdown-open' : ''
              )}
            >
              <p className="text-sm font-medium">مركز التنبيهات</p>
              <p className="mt-1 text-xs text-base-content/60">
                عنصر نائب — لا مصدر Nest للإشعارات الفورية بعد.
              </p>
            </div>
          </div>

          {/* View Switcher / Portal Dropdown */}
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className={cn('btn btn-ghost btn-sm juman-focus', viewSwitcherOpen && 'btn-active')}
              onClick={() => setViewSwitcherOpen(!viewSwitcherOpen)}
              title="تغيير العرض / البوابة"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="hidden sm:inline">البوابة</span>
            </div>
            <div
              tabIndex={0}
              className={cn(
                'dropdown-content z-50 mt-2 w-64 rounded-box border border-base-content/10 bg-base-200 p-2 shadow',
                viewSwitcherOpen ? 'dropdown-open' : ''
              )}
            >
              <div className="px-2 py-1 text-xs font-medium text-base-content/60 uppercase">التنقل السريع</div>
              {groupedNavItems.map(({ group, items }) => (
                <div key={group.id} className="py-1">
                  <div className="px-2 text-xs font-semibold text-base-content/50 uppercase">{group.label}</div>
                  {items.map((item) => (
                    <a
                      key={item.id}
                      href={item.to}
                      className={cn(
                        'block px-3 py-1.5 rounded-md text-sm transition-colors',
                        location.pathname === item.to
                          ? 'bg-primary text-primary-content'
                          : 'text-base-content/80 hover:bg-base-300'
                      )}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              ))}
              <hr className="my-2 border-base-content/10" />
              <a
                href="/shell"
                className={cn(
                  'block px-3 py-1.5 rounded-md text-sm transition-colors',
                  location.pathname === '/shell'
                    ? 'bg-primary text-primary-content'
                    : 'text-base-content/80 hover:bg-base-300'
                )}
              >
                هيكل التطبيق
              </a>
            </div>
          </div>

          {/* Theme Dropdown */}
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className={cn('btn btn-ghost btn-sm juman-focus', themeOpen && 'btn-active')}
              onClick={() => setThemeOpen(!themeOpen)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="hidden sm:inline">المظهر</span>
            </div>
            <ul
              tabIndex={0}
              className={cn(
                'dropdown-content menu z-50 mt-2 w-52 rounded-box border border-base-content/10 bg-base-200 p-2 shadow',
                themeOpen ? 'dropdown-open' : ''
              )}
            >
              <li className="menu-title">زجاج الواجهة</li>
              {(['off', 'subtle', 'strong'] as const).map((level) => (
                <li key={level}>
                  <button
                    type="button"
                    className={cn(glass === level ? 'menu-active' : '')}
                    onClick={() => setGlass(level)}
                  >
                    {level === 'off'
                      ? 'بدون'
                      : level === 'subtle'
                        ? 'خفيف'
                        : 'قوي'}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm juman-focus font-semibold"
            onClick={() => setProfileOpen(true)}
          >
            {session?.user?.displayName || session?.user?.username || 'مستخدم'}
          </button>

          <WindowControls />
        </div>
      </header>
      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      
      {/* Dialogs */}
      <UserProfileDialog
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onChangePasswordClick={() => setPasswordOpen(true)}
      />

      <PasswordChangeDialog
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />
    </>
  )
}
