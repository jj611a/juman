import { NAV_GROUPS, NAV_ITEMS } from '@/navigation/nav.config'
import { SEARCH_SHORTCUT, SIDEBAR_SHORTCUT } from '@/shared/constants/app'

export function ShellGuidePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">هيكل التطبيق — المرحلة 9.1</h1>
        <p className="mt-1 text-sm text-base-content/60">
          الشريط الجانبي، الشريط العلوي، مساحة العمل، التنبيهات، الحوارات، والاختصارات.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card border border-base-content/10 bg-base-300/50">
          <div className="card-body">
            <h2 className="card-title text-base">شجرة المكوّنات</h2>
            <pre className="overflow-x-auto rounded-field bg-base-100 p-3 text-xs leading-relaxed" dir="ltr">
{`AppProviders
 ├ ThemeProvider
 ├ SessionProvider
 ├ ToastProvider → ToastHost
 ├ DialogProvider (confirm modal)
 ├ ShortcutProvider
 └ AppShell
    ├ TopBar (search · notifications · theme · session · window)
    ├ Sidebar (permission-aware nav)
    ├ Workspace (Outlet + ErrorBoundary)
    └ StatusBar (backend · session)`}
            </pre>
          </div>
        </div>

        <div className="card border border-base-content/10 bg-base-300/50">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">اختصارات</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <td>
                      <kbd className="kbd kbd-sm">{SEARCH_SHORTCUT}</kbd>
                    </td>
                    <td>بحث الوحدات</td>
                  </tr>
                  <tr>
                    <td>
                      <kbd className="kbd kbd-sm">{SIDEBAR_SHORTCUT}</kbd>
                    </td>
                    <td>طي / توسيع القائمة</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h2 className="card-title text-base">مجموعات التنقّل</h2>
            <ul className="space-y-1 text-sm">
              {NAV_GROUPS.map((g) => (
                <li key={g.id}>
                  <span className="font-medium">{g.label}</span>
                  <span className="text-base-content/50">
                    {' '}
                    — {NAV_ITEMS.filter((i) => i.group === g.id).length} عنصر
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
