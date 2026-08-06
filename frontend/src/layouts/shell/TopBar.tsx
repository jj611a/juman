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

export function TopBar() {
  const { session, logout } = useSession()
  const { confirm } = useDialog()
  const { push } = useToast()
  const { glass, setGlass, toggleSidebarCollapsed } = useTheme()
  const { register } = useShortcuts()
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

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
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-sm juman-focus"
              title="الإشعارات"
            >
              <span className="indicator">
                <span className="status status-primary indicator-item status-xs" />
                تنبيهات
              </span>
            </div>
            <div
              tabIndex={0}
              className="dropdown-content z-50 mt-2 w-72 rounded-box border border-base-content/10 bg-base-200 p-3 shadow"
            >
              <p className="text-sm font-medium">مركز التنبيهات</p>
              <p className="mt-1 text-xs text-base-content/60">
                عنصر نائب — لا مصدر Nest للإشعارات الفورية بعد.
              </p>
            </div>
          </div>

          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm juman-focus">
              المظهر
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content menu z-50 mt-2 w-52 rounded-box border border-base-content/10 bg-base-200 p-2 shadow"
            >
              <li className="menu-title">زجاج الواجهة</li>
              {(['off', 'subtle', 'strong'] as const).map((level) => (
                <li key={level}>
                  <button
                    type="button"
                    className={glass === level ? 'menu-active' : ''}
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
