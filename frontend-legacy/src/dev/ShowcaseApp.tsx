import { NavLink, Outlet } from 'react-router'
import { cn } from '@/utils/cn'

const LINKS = [
  { to: '/dev/all', label: 'الكل' },
  { to: '/dev/buttons', label: 'الأزرار' },
  { to: '/dev/inputs', label: 'الحقول' },
  { to: '/dev/forms', label: 'النماذج' },
  { to: '/dev/selection', label: 'الاختيار' },
  { to: '/dev/display', label: 'العرض' },
  { to: '/dev/feedback', label: 'التغذية' },
  { to: '/dev/layout', label: 'التخطيط' },
  { to: '/dev/data', label: 'البيانات' },
  { to: '/dev/business', label: 'الأعمال' },
  { to: '/dev/shell', label: 'الهيكل' },
  { to: '/dev/auth', label: 'المصادقة' },
  { to: '/dev/tokens', label: 'الرموز' }
] as const

export function ShowcaseApp(): React.ReactElement {
  return (
    <div className="flex min-h-full flex-col bg-background" dir="rtl">
      <header className="border-b border-border bg-header px-6 py-4">
        <p className="text-caption text-muted-foreground">تطوير فقط · DEV SHOWCASE</p>
        <h1 className="text-h2 text-foreground">معرض مكوّنات جمان</h1>
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="صفحات المعرض">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md border px-3 py-1.5 text-caption transition-colors',
                  isActive
                    ? 'border-brand-border bg-brand-subtle text-brand'
                    : 'border-border text-foreground-secondary hover:bg-hover'
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 bg-surface px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
