import { useState } from 'react'
import { useFinancialReport, useInventoryValueReport, useInventoryAvailabilityReport, useInventoryGroupReport, useRentalsReport } from '../hooks/useReports'
import { useToast } from '@/app/providers/ToastProvider'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { formatFils, formatDate } from './reportUtils'
import { LIFECYCLE_LABELS } from '@/features/inventory/constants/inventory'
import { AlertTriangle, BarChart3, Database, Truck, FileDown, Info, Receipt } from 'lucide-react'

type Tab = 'financial' | 'inventory' | 'rentals' | 'sales'

export function ReportsPage() {
  const { can } = usePermission()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('financial')
  const [exporting, setExporting] = useState(false)

  const { data: financial, isLoading: finLoading } = useFinancialReport()
  const { data: invValue } = useInventoryValueReport()
  const { data: invAvailability } = useInventoryAvailabilityReport()
  const { data: invCategory } = useInventoryGroupReport('category')
  const { data: invBrand } = useInventoryGroupReport('brand')
  const { data: currentRentals } = useRentalsReport('current', { limit: 10 })
  const { data: overdueRentals } = useRentalsReport('overdue', { limit: 10 })

  const canExport = can(PERMISSION.REPORTS_EXPORT)

  const handleExport = async (report: string, format: 'csv' | 'json') => {
    setExporting(true)
    try {
      const result = await window.juman.reports.export({ report, format })
      if (result.saved) toast.push({ title: `تم تصدير التقرير: ${result.path}`, tone: 'success' })
      else if (!result.cancelled) toast.push({ title: 'فشل التصدير', tone: 'error' })
    } catch (err) {
      toast.push({ title: err instanceof Error ? err.message : 'فشل التصدير', tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 select-none" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <BarChart3 className="text-primary" />
            التقارير
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            تقارير مالية ومخزنية وتأجيرية من بيانات الخادم الفعلية
          </p>
        </div>
      </div>

      <div className="tabs tabs-boxed bg-base-300/40 w-fit flex-wrap">
        {([
          ['financial', 'مالي'],
          ['inventory', 'مخزون'],
          ['rentals', 'تأجير'],
          ['sales', 'مبيعات'],
        ] as Array<[Tab, string]>).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`tab tab-sm ${tab === t ? 'tab-active' : ''}`}>
            {label}
          </button>
        ))}
      </div>

      {/* SALES TAB — clearly unsupported */}
      {tab === 'sales' && (
        <div className="card bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl p-10 text-center space-y-3">
          <Receipt size={40} className="text-base-content/20 mx-auto" />
          <p className="font-bold text-base-content/60">تقارير تجميع المبيعات غير متوفرة</p>
          <p className="text-xs text-base-content/40 max-w-md mx-auto leading-relaxed">
            الخادم (Nest) لا يعرض حالياً تقرير تجميع مبيعات (لا توجد نقطة نهاية
            <span className="font-mono"> /reports/sales</span>). لا نعرض أرقاماً مختلقة.
            يمكن متابعة المبيعات الفردية من صفحة المبيعات أو عبر التقرير المالي (الإيرادات والدفعات).
          </p>
        </div>
      )}

      {/* FINANCIAL TAB */}
      {tab === 'financial' && (
        <div className="space-y-4">
          {finLoading ? (
            <div className="flex flex-col gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-base-300/50 rounded-xl animate-pulse" />)}</div>
          ) : financial ? (
            <>
              <div className="flex justify-end">
                <div className="flex gap-2">
                  {canExport && (
                    <>
                      <button onClick={() => void handleExport('financial', 'csv')} disabled={exporting} className="btn btn-outline btn-xs border-base-content/10 gap-1">
                        <FileDown size={12} /> تصدير CSV
                      </button>
                      <button onClick={() => void handleExport('financial', 'json')} disabled={exporting} className="btn btn-outline btn-xs border-base-content/10 gap-1">
                        <FileDown size={12} /> تصدير JSON
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="الإيرادات (دفعات مكتملة)" value={formatFils(financial.revenueFils)} accent="text-primary" />
                <Kpi label="عدد الدفعات" value={financial.paymentsCount.toLocaleString('ar-AE')} />
                <Kpi label="الرصيد المستحق" value={formatFils(financial.outstandingFils)} accent="text-error" />
                <Kpi label="تسويات مفتوحة" value={financial.openSettlementsCount.toLocaleString('ar-AE')} />
                <Kpi label="المردودات" value={formatFils(financial.refundsFils)} />
                <Kpi label="الخصومات" value={formatFils(financial.discountsFils)} />
                <Kpi label="غرامات التأخير" value={formatFils(financial.lateFeesFils)} />
                <Kpi label="الرسوم (تأجير)" value={formatFils(financial.chargesFils)} />
              </div>
            </>
          ) : (
            <div className="alert alert-error text-xs flex gap-2"><AlertTriangle size={14} /><span>تعذر تحميل التقرير المالي.</span></div>
          )}
        </div>
      )}

      {/* INVENTORY TAB */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="إجمالي القطع" value={(invValue?.itemCount ?? 0).toLocaleString('ar-AE')} />
            <Kpi label="قيمة الإيجار" value={formatFils(invValue?.rentalPriceSumFils)} />
            <Kpi label="قيمة البيع" value={formatFils(invValue?.salePriceSumFils)} />
            <Kpi label="قيمة الشراء" value={formatFils(invValue?.purchasePriceSumFils)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
              <div className="p-4 border-b border-base-content/5 font-bold text-sm flex items-center gap-2"><Database size={14} className="text-primary" /> الحالة التشغيلية</div>
              <div className="p-4 space-y-1.5">
                {(invAvailability ?? []).length === 0 && <div className="text-xs text-base-content/40">لا توجد بيانات</div>}
                {(invAvailability ?? []).map((row) => (
                  <div key={row.lifecycleState} className="flex justify-between text-xs">
                    <span>{LIFECYCLE_LABELS[row.lifecycleState as keyof typeof LIFECYCLE_LABELS] ?? row.lifecycleState}</span>
                    <span className="font-mono font-bold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
              <div className="p-4 border-b border-base-content/5 font-bold text-sm">التوزيع حسب التصنيف</div>
              <div className="p-4 space-y-1.5">
                {(invCategory ?? []).length === 0 && <div className="text-xs text-base-content/40">لا توجد بيانات</div>}
                {(invCategory ?? []).map((row) => (
                  <div key={row.label} className="flex justify-between text-xs">
                    <span>{row.label}</span>
                    <span className="font-mono font-bold">{row.count} · {formatFils(row.rentalPriceSumFils)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card bg-base-300/25 border border-base-content/5 rounded-xl p-4 text-xs text-base-content/50 flex items-center gap-2">
            <Info size={14} />
            يمكن تصدير تقارير المخزون التفصيلية (المتقاعد/الصيانة/العلامات...) عبر أزرار التصدير عند توفره.
          </div>
        </div>
      )}

      {/* RENTALS TAB */}
      {tab === 'rentals' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RentalCard title="تأجيرات جارية" rows={currentRentals?.items ?? []} />
          <RentalCard title="متأخرة الإرجاع" rows={overdueRentals?.items ?? []} accent="error" />
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, accent = '' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card bg-base-300/40 border border-base-content/10 p-4 rounded-xl">
      <div className="text-[10px] text-base-content/50">{label}</div>
      <div className={`font-mono font-black mt-1 text-sm ${accent || 'text-base-content'}`}>{value}</div>
    </div>
  )
}

function RentalCard({ title, rows, accent = 'primary' }: { title: string; rows: Array<{ id: string; rentalNumber: string; customer?: { fullName: string } | null; rentalDate: string; expectedReturnDate: string; status: string }>; accent?: 'primary' | 'error' }) {
  const iconClass = accent === 'error' ? 'text-error' : 'text-primary'
  return (
    <div className="card bg-base-300/40 border border-base-content/10 rounded-xl">
      <div className="p-4 border-b border-base-content/5 font-bold text-sm flex items-center gap-2">
        <Truck size={14} className={iconClass} />
        {title}
        <span className="badge badge-xs badge-neutral ms-auto">{rows.length}</span>
      </div>
      <div className="p-3 space-y-1.5">
        {rows.length === 0 && <div className="text-xs text-base-content/40 p-3">لا توجد سجلات</div>}
        {rows.map((r) => (
          <div key={r.id} className="flex justify-between items-center text-xs p-2 bg-base-200/40 rounded-lg">
            <div>
              <span className="font-mono font-bold">{r.rentalNumber}</span>
              <div className="text-[10px] text-base-content/40">{r.customer?.fullName ?? '—'}</div>
            </div>
            <div className="text-left">
              <div className="text-[10px] text-base-content/50">{formatDate(r.rentalDate)}</div>
              <div className="text-[10px] text-base-content/40">حتى {formatDate(r.expectedReturnDate)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
