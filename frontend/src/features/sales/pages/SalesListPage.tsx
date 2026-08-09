import { useState } from 'react'
import { useNavigate } from 'react-router'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { useSalesList } from '../hooks/useSales'
import { SALE_STATUS_LABELS, SALE_STATUS_BADGE, formatFils, formatDateTime } from '../constants/sales'
import type { SaleDto } from '@/features/pos/api/salesApi'
import { ROUTES } from '@/shared/constants/routes'
import {
  Search,
  Receipt,
  Eye,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
} from 'lucide-react'

const PAGE_SIZE = 20

export function SalesListPage() {
  const { can } = usePermission()
  const navigate = useNavigate()

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('')
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError, refetch } = useSalesList({
    q: q.trim() || undefined,
    status: status || undefined,
    sortBy: 'createdAt',
    sortDir: 'desc',
    limit: PAGE_SIZE,
    offset,
  })

  const canViewDetail = can(PERMISSION.SALES_VIEW)

  const total = data?.meta?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="space-y-6 select-none" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content flex items-center gap-2">
            <Receipt className="text-primary" />
            المبيعات
          </h1>
          <p className="text-xs text-base-content/50 mt-1">
            فواتير البيع وتفاصيلها وتسوياتها المالية
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => navigate(ROUTES.POS)}
            className="btn btn-primary btn-sm gap-2"
          >
            <Receipt size={14} />
            فتح نقطة البيع
          </button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 bg-base-300/40 p-4 rounded-xl border border-base-content/5 items-end">
        <div className="form-control w-full md:col-span-2">
          <span className="label-text mb-1.5 text-xs text-base-content/50">بحث برقم الفاتورة أو اسم العميل</span>
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة أو العميل..."
              className="input input-bordered w-full bg-base-200 pl-10"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOffset(0)
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
              <Search size={16} />
            </span>
          </div>
        </div>
        <div className="form-control w-full">
          <span className="label-text mb-1.5 text-xs text-base-content/50 font-semibold">حالة الفاتورة</span>
          <select
            className="select select-bordered w-full bg-base-200 text-xs"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">كل الحالات</option>
            {Object.entries(SALE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 w-full bg-base-300/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="alert alert-error text-sm flex gap-2">
          <AlertTriangle size={18} />
          <span>حدث خطأ أثناء تحميل قائمة المبيعات.</span>
          <button onClick={() => void refetch()} className="btn btn-sm btn-ghost">
            <RefreshCw size={14} /> إعادة المحاولة
          </button>
        </div>
      ) : (data?.items || []).length === 0 ? (
        <div className="text-center py-16 bg-base-300/25 border border-dashed border-base-content/10 rounded-2xl flex flex-col items-center justify-center">
          <Receipt size={48} className="text-base-content/20 mb-3" />
          <p className="font-bold text-base-content/50">لا توجد فواتير بيع مطابقة</p>
          <p className="text-xs text-base-content/40 mt-1">جرّب تعديل البحث أو أنشئ عملية بيع من نقطة البيع</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-base-content/10 bg-base-300/40 rounded-xl shadow-md">
          <table className="table table-sm md:table-md w-full">
            <thead>
              <tr className="border-b border-base-content/10 text-xs text-base-content/60">
                <th>رقم الفاتورة</th>
                <th>العميل</th>
                <th>الحالة</th>
                <th>الإجمالي</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>التاريخ</th>
                <th className="text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((sale: SaleDto) => (
                <tr key={sale.id} className="border-b border-base-content/5 hover:bg-base-200/40 transition-colors">
                  <td className="font-mono font-bold text-primary">{sale.saleNumber}</td>
                  <td className="font-bold">{sale.customer?.fullName ?? 'زبون نقدي (Walk-in)'}</td>
                  <td>
                    <span className={`badge badge-xs font-bold text-[9px] rounded-sm ${SALE_STATUS_BADGE[sale.status]}`}>
                      {SALE_STATUS_LABELS[sale.status]}
                    </span>
                  </td>
                  <td className="font-mono font-bold">{formatFils(sale.totalFils)}</td>
                  <td className="font-mono text-xs">{formatFils(sale.settlement?.paidFils)}</td>
                  <td className="font-mono text-xs text-error">{formatFils(sale.settlement?.remainingFils)}</td>
                  <td className="text-xs text-base-content/50">{formatDateTime(sale.createdAt)}</td>
                  <td className="text-left flex justify-end gap-1.5">
                    {canViewDetail && (
                      <button
                        onClick={() => navigate(`/sales/${sale.id}`)}
                        className="btn btn-ghost btn-square btn-xs text-primary"
                        title="عرض الفاتورة"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center p-4 border-t border-base-content/5 bg-base-300/60">
            <span className="text-xs text-base-content/50">
              عرض {total === 0 ? 0 : offset + 1} - {Math.min(offset + PAGE_SIZE, total)} من إجمالي {total} فاتورة
            </span>
            <div className="flex gap-1.5">
              <button
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
              >
                <ChevronRight size={16} />
              </button>
              <span className="text-xs font-bold self-center px-2">صفحة {page} من {totalPages}</span>
              <button
                className="btn btn-ghost btn-square btn-xs"
                onClick={() => setOffset(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
