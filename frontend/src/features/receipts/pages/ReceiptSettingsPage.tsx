import { useMemo } from 'react'
import { useReceiptSettings } from '../hooks/useReceiptSettings'
import { useReceiptPrint } from '../hooks/useReceiptPrint'
import { ReceiptPreview } from '../components/ReceiptPreview'
import { buildPreviewReceiptData } from '../utils/previewData'
import type { ReceiptPaperWidth, ReceiptSettings } from '../types/receipt'
import { useToast } from '@/app/providers/ToastProvider'
import { useDialog } from '@/app/providers/DialogProvider'
import {
  Printer,
  RotateCcw,
  Save,
  Image as ImageIcon,
  Type,
  AlignRight,
  Ruler,
  AlertTriangle,
} from 'lucide-react'

function SectionCard({ title, icon, children }: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card bg-base-300/40 border border-base-content/10 p-4 rounded-xl space-y-3">
      <h3 className="font-bold text-sm text-base-content/80 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  )
}

function ToggleRow({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-xs text-base-content/80">{label}</span>
      <input
        type="checkbox"
        className="toggle toggle-sm toggle-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

function TextInput({ label, value, onChange, dir }: {
  label: string
  value: string
  onChange: (v: string) => void
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <label className="form-control w-full">
      <span className="label-text mb-1 text-[10px] text-base-content/50">{label}</span>
      <input
        type="text"
        className="input input-bordered input-sm w-full bg-base-200"
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function ReceiptSettingsPage() {
  const { settings, update, reset, isModified } = useReceiptSettings()
  const print = useReceiptPrint()
  const toast = useToast()
  const dialog = useDialog()

  const previewData = useMemo(() => buildPreviewReceiptData(), [])

  const paperOptions: Array<{ value: ReceiptPaperWidth; label: string }> = [
    { value: 58, label: '58 مم (حراري ضيق)' },
    { value: 80, label: '80 مم (حراري قياسي)' },
  ]

  const handleSaveLogo = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.push({ title: 'الرجاء اختيار ملف صورة', tone: 'error' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      update({ store: { ...settings.store, logoDataUrl: String(reader.result) } })
      toast.push({ title: 'تم تحديث شعار المتجر', tone: 'success' })
    }
    reader.onerror = () => toast.push({ title: 'فشل قراءة الصورة', tone: 'error' })
    reader.readAsDataURL(file)
  }

  const handlePrintPreview = async () => {
    const ok = await print.print(previewData, settings)
    if (ok) toast.push({ title: 'تم إرسال المعاينة إلى الطابعة', tone: 'success' })
    else if (!print.lastResult?.cancelled) {
      toast.push({ title: print.error ?? 'فشل الطباعة — راجع الاتصال بالطابعة', tone: 'error' })
    }
  }

  const handleReset = async () => {
    const ok = await dialog.confirm({
      title: 'إعادة ضبط الإعدادات',
      message: 'سيتم إرجاع إعدادات الإيصال إلى الافتراضية. هل تريد المتابعة؟',
      confirmLabel: 'إعادة الضبط',
      tone: 'error',
    })
    if (!ok) return
    reset()
    toast.push({ title: 'تمت إعادة ضبط الإعدادات', tone: 'success' })
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <Printer className="text-primary" />
            إعدادات الإيصالات
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            تخصيص شكل الإيصال وعرضه على مقاسات الطابعة الحرارية
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isModified && (
            <button onClick={() => void handleReset()} className="btn btn-outline btn-error btn-sm gap-2">
              <RotateCcw size={14} />
              استعادة الافتراضي
            </button>
          )}
          <button
            onClick={() => void handlePrintPreview()}
            className="btn btn-primary btn-sm gap-2"
            disabled={print.printing}
          >
            {print.printing ? <span className="loading loading-spinner loading-xs" /> : <Printer size={14} />}
            طباعة المعاينة
          </button>
        </div>
      </div>

      <div className="alert alert-warning text-xs p-3 flex gap-2 rounded-xl">
        <AlertTriangle size={14} />
        <span>
          هذه الإعدادات تُحفظ محلياً فقط (المتصفح/التطبيق) — لا يوفر الخادم حاليًا نقطة نهاية إعدادات إيصالات،
          لذلك لا تتم مزامنتها بين الأجهزة.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings column */}
        <div className="space-y-4">
<SectionCard title="المتجر" icon={<ImageIcon size={14} className="text-primary" />}>
            <TextInput label="اسم المتجر" value={settings.store.name} onChange={(v) => update({ store: { ...settings.store, name: v } })} />
            <TextInput label="العنوان" value={settings.store.address} onChange={(v) => update({ store: { ...settings.store, address: v } })} />
            <TextInput label="الهاتف" value={settings.store.phone} onChange={(v) => update({ store: { ...settings.store, phone: v } })} />
            <TextInput label="الرقم الضريبي" value={settings.store.taxId} onChange={(v) => update({ store: { ...settings.store, taxId: v } })} />
            <div className="flex items-center gap-3">
              <button
                className="btn btn-sm btn-outline border-base-content/10 gap-2"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = () => {
                    if (input.files?.[0]) handleSaveLogo(input.files[0])
                  }
                  input.click()
                }}
              >
                <ImageIcon size={14} />
                {settings.store.logoDataUrl ? 'استبدال الشعار' : 'رفع شعار'}
              </button>
              {settings.store.logoDataUrl && (
                <div className="flex items-center gap-2">
                  <img src={settings.store.logoDataUrl} alt="شعار المتجر" className="h-8 w-8 object-contain rounded bg-white p-0.5" />
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => update({ store: { ...settings.store, logoDataUrl: null } })}
                  >
                    إزالة
                  </button>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="التخطيط والأبعاد" icon={<Ruler size={14} className="text-primary" />}>
            <label className="form-control w-full">
              <span className="label-text mb-1 text-[10px] text-base-content/50">عرض الورق</span>
              <select
                className="select select-bordered select-sm w-full bg-base-200 text-xs"
                value={settings.paperWidth}
                onChange={(e) => update({ paperWidth: Number(e.target.value) as ReceiptPaperWidth })}
              >
                {paperOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-1 text-[10px] text-base-content/50">حجم الخط</span>
              <select
                className="select select-bordered select-sm w-full bg-base-200 text-xs"
                value={settings.fontSize}
                onChange={(e) => update({ fontSize: e.target.value as ReceiptSettings['fontSize'] })}
              >
                <option value="sm">صغير</option>
                <option value="md">متوسط</option>
                <option value="lg">كبير</option>
              </select>
            </label>
            <label className="form-control w-full">
              <span className="label-text mb-1 text-[10px] text-base-content/50">تباعد الأسطر</span>
              <select
                className="select select-bordered select-sm w-full bg-base-200 text-xs"
                value={settings.lineHeight}
                onChange={(e) => update({ lineHeight: e.target.value as ReceiptSettings['lineHeight'] })}
              >
                <option value="tight">مضغوط</option>
                <option value="normal">عادي</option>
                <option value="relaxed">متسع</option>
              </select>
            </label>
          </SectionCard>

          <SectionCard title="عناصر الإيصال" icon={<Type size={14} className="text-primary" />}>
            <TextInput
              label="نص الترويسة"
              value={settings.headerText}
              onChange={(v) => update({ headerText: v })}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <ToggleRow label="الشعار" checked={settings.showLogo} onChange={(v) => update({ showLogo: v })} />
              <ToggleRow label="معلومات المتجر" checked={settings.showStoreInfo} onChange={(v) => update({ showStoreInfo: v })} />
              <ToggleRow label="نص الترويسة" checked={settings.showHeaderText} onChange={(v) => update({ showHeaderText: v })} />
              <ToggleRow label="الباركود" checked={settings.showBarcode} onChange={(v) => update({ showBarcode: v })} />
              <ToggleRow label="الكاشير" checked={settings.showCashier} onChange={(v) => update({ showCashier: v })} />
              <ToggleRow label="العميل" checked={settings.showCustomer} onChange={(v) => update({ showCustomer: v })} />
              <ToggleRow label="أكواد الأصناف" checked={settings.showItemCodes} onChange={(v) => update({ showItemCodes: v })} />
              <ToggleRow label="الأسعار" checked={settings.showPrices} onChange={(v) => update({ showPrices: v })} />
              <ToggleRow label="المجموع الفرعي" checked={settings.showSubtotal} onChange={(v) => update({ showSubtotal: v })} />
              <ToggleRow label="الخصومات" checked={settings.showDiscount} onChange={(v) => update({ showDiscount: v })} />
              <ToggleRow label="التأمين" checked={settings.showDeposit} onChange={(v) => update({ showDeposit: v })} />
              <ToggleRow label="المدفوع" checked={settings.showPaid} onChange={(v) => update({ showPaid: v })} />
              <ToggleRow label="المتبقي" checked={settings.showOutstanding} onChange={(v) => update({ showOutstanding: v })} />
              <ToggleRow label="خط فاصل" checked={settings.showSeparatorLine} onChange={(v) => update({ showSeparatorLine: v })} />
            </div>
          </SectionCard>

          <SectionCard title="التذييل وسياسة الإرجاع" icon={<AlignRight size={14} className="text-primary" />}>
            <TextInput label="نص التذييل" value={settings.footerText} onChange={(v) => update({ footerText: v })} />
            <TextInput
              label="سياسة الإرجاع"
              value={settings.returnPolicyText}
              onChange={(v) => update({ returnPolicyText: v })}
            />
          </SectionCard>

          <div className="card bg-base-200/50 border border-base-content/5 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-base-content/50">
              <Save size={14} />
              التغييرات تُحفظ تلقائياً محلياً
            </div>
          </div>
        </div>

        {/* Preview column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-base-content/80">معاينة</h3>
            <span className="badge badge-warning badge-xs font-bold">بيانات معاينة فقط</span>
          </div>
          <div className="rounded-box border border-base-content/10 bg-base-200/60 p-4 flex justify-center overflow-auto max-h-[85vh]">
            <ReceiptPreview data={previewData} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  )
}
