import { NavLink } from 'react-router'
import { AppLogo } from '@/shared/components/AppLogo'
import { useFilteredNav } from '@/navigation/useFilteredNav'
import { useTheme } from '@/app/providers/ThemeProvider'
import { cn } from '@/shared/utils/cn'
import { DRAWER_ID } from '@/shared/constants/app'

export function Sidebar() {
  const { groups, itemsByGroup } = useFilteredNav()
  const { sidebarCollapsed } = useTheme()

  return (
    <aside
      className={cn(
        'flex min-h-full flex-col border-s border-base-content/10 bg-base-300 transition-[width]',
        sidebarCollapsed ? 'w-[4.5rem]' : 'w-72',
      )}
    >
      <div className="border-b border-base-content/10 p-4">
        {sidebarCollapsed ? (
          <AppLogo size="mark" className="justify-center [&>span]:hidden" />
        ) : (
          <AppLogo size="mark" />
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="القائمة الرئيسية">
        {groups.map((group) => {
          const items = itemsByGroup.get(group.id) ?? []
          return (
            <ul key={group.id} className="menu menu-md w-full gap-0.5">
              {!sidebarCollapsed ? (
                <li className="menu-title px-3 pt-3 text-base-content/50">
                  {group.label}
                </li>
              ) : null}
              {items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    title={item.label}
                    className={({ isActive }) =>
                      cn(
                        'juman-focus rounded-field',
                        isActive && 'menu-active bg-primary/15 font-medium text-primary',
                      )
                    }
                    onClick={() => {
                      const el = document.getElementById(
                        DRAWER_ID,
                      ) as HTMLInputElement | null
                      if (el?.checked) el.checked = false
                    }}
                  >
                    <span className="truncate">{item.label}</span>
                    {!sidebarCollapsed ? (
                      <span className="badge badge-ghost badge-xs opacity-50">
                        {item.phase}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          )
        })}
      </nav>
      {!sidebarCollapsed ? (
        <p className="border-t border-base-content/10 p-4 text-xs text-base-content/40">
          Nest مصدر الحقيقة · الواجهة تتكيّف
        </p>
      ) : null}
    </aside>
  )
}
