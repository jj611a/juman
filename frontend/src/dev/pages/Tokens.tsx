import { Icon } from '@/components/icons'
import { CSS_VARS, THEME_ID, TYPOGRAPHY_SCALE, themeMeta } from '@/theme/tokens'

const SURFACE_SWATCHES: Array<{ label: string; varName: string; className: string }> = [
  { label: 'Background', varName: CSS_VARS.background, className: 'bg-background' },
  { label: 'Surface', varName: CSS_VARS.surface, className: 'bg-surface' },
  { label: 'Card', varName: CSS_VARS.card, className: 'bg-card' },
  { label: 'Panel', varName: CSS_VARS.panel, className: 'bg-panel' },
  { label: 'Sidebar', varName: CSS_VARS.sidebar, className: 'bg-sidebar' },
  { label: 'Header', varName: CSS_VARS.header, className: 'bg-header' },
  { label: 'Dialog', varName: CSS_VARS.dialog, className: 'bg-dialog' }
]

const BRAND_SWATCHES: Array<{ label: string; className: string }> = [
  { label: 'Brand', className: 'bg-brand' },
  { label: 'Brand hover', className: 'bg-brand-hover' },
  { label: 'Brand active', className: 'bg-brand-active' },
  { label: 'Brand subtle', className: 'bg-brand-subtle' }
]

const FEEDBACK_SWATCHES: Array<{ label: string; className: string }> = [
  { label: 'Success', className: 'bg-success' },
  { label: 'Warning', className: 'bg-warning' },
  { label: 'Danger', className: 'bg-destructive' },
  { label: 'Info', className: 'bg-info' }
]

const TYPE_CLASS: Record<(typeof TYPOGRAPHY_SCALE)[number], string> = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  title: 'text-title',
  subtitle: 'text-subtitle',
  body: 'text-body',
  caption: 'text-caption',
  label: 'text-label',
  button: 'text-button'
}

/**
 * Development-only token showcase. Not a product screen.
 */
export default function TokensPage(): React.ReactElement {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10" dir="rtl">
      <header className="border-b border-brand-border pb-4">
        <p className="text-caption text-muted-foreground">تطوير فقط · DEV ONLY</p>
        <h1 className="text-display mt-1 text-foreground">نظام التصميم · {themeMeta.name}</h1>
        <p className="text-subtitle mt-2 text-foreground-secondary">
          المعرّف: <code className="text-brand">{THEME_ID}</code> · الوضع: dark فقط
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 text-foreground">الأسطح (محايدة)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SURFACE_SWATCHES.map((s) => (
            <div
              key={s.label}
              className={`rounded-md border border-border p-4 ${s.className}`}
            >
              <p className="text-sm text-foreground">{s.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.varName}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 text-foreground">الذهب (لمسة فقط)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {BRAND_SWATCHES.map((s) => (
            <div
              key={s.label}
              className={`rounded-md border border-border p-4 ${s.className}`}
            >
              <p
                className={
                  s.className === 'bg-brand-subtle'
                    ? 'text-sm text-foreground'
                    : 'text-sm text-brand-foreground'
                }
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          القاعدة: حوالي 90٪ داكن محايد · 8٪ نص · 2٪ ذهب
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 text-foreground">الحالات</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {FEEDBACK_SWATCHES.map((s) => (
            <div
              key={s.label}
              className={`rounded-md border border-border p-4 ${s.className}`}
            >
              <p className="text-sm text-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 text-foreground">الطباعة</h2>
        <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-6">
          {TYPOGRAPHY_SCALE.map((key) => (
            <p key={key} className={`${TYPE_CLASS[key]} text-foreground`}>
              {key} · جمان · نظام إدارة تأجير وبيع الفساتين
            </p>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 text-foreground">الأيقونات</h2>
        <div className="flex items-center gap-6 rounded-md border border-border bg-card p-6 text-foreground">
          <Icon name="Search" size="sm" title="بحث" />
          <Icon name="Search" size="md" title="بحث" />
          <Icon name="Search" size="lg" title="بحث" className="text-brand" />
          <Icon name="ArrowLeft" size="md" rtlFlip title="اتجاه" />
          <Icon name="Sparkles" size="md" className="text-brand" title="تمييز" />
        </div>
      </section>
    </div>
  )
}
