import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { 
  useCustomerDetail, 
  useCustomerRentals, 
  useCustomerReservations, 
  useCustomerOutstanding, 
  useCustomerPayments 
} from '../hooks/useCustomers'
import { useOutstanding as useFinanceOutstanding } from '@/features/finance/hooks/useFinance'
import { useSettlementsList, useSettlementPayment } from '@/features/settlements/hooks/useSettlements'
import { useCreateFinancePayment } from '@/features/finance/hooks/useFinance'
import { PaymentDialog } from '@/features/finance/components/PaymentDialog'
import { usePermission } from '@/features/permissions/PermissionProvider'
import { PERMISSION } from '@/shared/constants/permissions'
import { formatIQD } from '@/shared/utils/money'
import { 
  ChevronRight, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  DollarSign, 
  Calendar, 
  Shirt, 
  History,
  AlertTriangle,
  Banknote
} from 'lucide-react'

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermission()

  const [payDialogOpen, setPayDialogOpen] = useState(false)

  // Queries
  const detail = useCustomerDetail(id ?? '')
  const rentals = useCustomerRentals(id ?? '')
  const reservations = useCustomerReservations(id ?? '')
  const outstanding = useCustomerOutstanding(id ?? '')
  const payments = useCustomerPayments(id ?? '')
  const financeOutstanding = useFinanceOutstanding(id ? { customerId: id } : {})
  const settlements = useSettlementsList({
    customerId: id,
    sortBy: 'createdAt',
    sortDir: 'desc',
    limit: 10,
  })

  const settlementPayment = useSettlementPayment()
  const createFinancePayment = useCreateFinancePayment()

  const openSettlement = (settlements.data?.items ?? []).find(
    (s) => s.status === 'open' || s.status === 'partially_paid',
  )
  const canPay = can(PERMISSION.FINANCE_PAYMENT)

  const handlePaySubmit = async (payload: { amountFils: number; method: string; notes?: string; idempotencyKey: string }) => {
    // When an open/partial settlement exists the backend rejects standalone
    // finance payments — route through the settlement payment endpoint instead.
    if (openSettlement) {
      try {
        await settlementPayment.mutateAsync({
          id: openSettlement.id,
          body: { amountFils: payload.amountFils, method: payload.method, notes: payload.notes, idempotencyKey: payload.idempotencyKey },
        })
        setPayDialogOpen(false)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'فشل تسجيل الدفعة' }
      }
    }
    if (!financeOutstanding.data?.accountId) {
      return { ok: false, error: 'لا يوجد حساب مالي مرتبط بالعميل' }
    }
    try {
      await createFinancePayment.mutateAsync({
        accountId: financeOutstanding.data.accountId,
        amountFils: payload.amountFils,
        method: payload.method,
        notes: payload.notes,
      })
      setPayDialogOpen(false)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'فشل تسجيل الدفعة' }
    }
  }

  if (detail.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" dir="rtl">
        <span className="loading loading-spinner text-primary loading-lg" />
      </div>
    )
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="alert alert-error text-sm max-w-lg mx-auto mt-8 flex gap-2" dir="rtl">
        <AlertTriangle size={18} />
        <span>تعذر تحميل بيانات العميل المطلوبة.</span>
      </div>
    )
  }

  const cust = detail.data
  const initial = (cust.fullName || 'U').charAt(0).toUpperCase()
  const remainingFils = outstanding.data?.remainingFils ?? 0

  return (
    <div className="space-y-6 select-none text-sm" dir="rtl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-base-content/50 border-b border-base-content/5 pb-4">
        <button onClick={() => navigate('/customers')} className="hover:text-primary transition-colors">
          قائمة العملاء
        </button>
        <ChevronRight size={14} />
        <span className="font-bold text-base-content">{cust.fullName}</span>
      </div>

      {/* Main Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-base-300/40 p-6 rounded-2xl border border-base-content/5">
        <div className="avatar placeholder">
          <div className="bg-primary/20 text-primary w-24 rounded-full border-2 border-primary/50 shadow-inner">
            <span className="text-4xl font-extrabold">{initial}</span>
          </div>
        </div>
        <div className="flex-1 text-center md:text-right space-y-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <h1 className="text-2xl font-black text-base-content">{cust.fullName}</h1>
            <span className="badge badge-primary font-mono text-xs">{cust.customerNumber}</span>
            {cust.status === 'active' ? (
              <span className="badge badge-success badge-xs font-bold text-[9px] rounded-sm">نشط</span>
            ) : (
              <span className="badge badge-ghost badge-xs font-bold text-[9px] rounded-sm">غير نشط</span>
            )}
          </div>
          <p className="text-xs text-base-content/40 font-mono">ID: {cust.id}</p>
          <p className="text-xs text-base-content/50">تم التسجيل في: {new Date(cust.createdAt).toLocaleString('ar-IQ')}</p>
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Profile General Information Details */}
        <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 h-fit">
          <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
            <User size={16} className="text-primary" />
            المعلومات الشخصية
          </h3>
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex flex-col gap-1 border-b border-base-content/5 pb-2">
              <span className="text-base-content/40 flex items-center gap-1.5"><Phone size={12} /> رقم الهاتف الأساسي</span>
              <span className="font-mono font-bold">{cust.phone}</span>
            </div>
            {cust.secondaryPhone && (
              <div className="flex flex-col gap-1 border-b border-base-content/5 pb-2">
                <span className="text-base-content/40 flex items-center gap-1.5"><Phone size={12} /> رقم الهاتف البديل</span>
                <span className="font-mono">{cust.secondaryPhone}</span>
              </div>
            )}
            <div className="flex flex-col gap-1 border-b border-base-content/5 pb-2">
              <span className="text-base-content/40 flex items-center gap-1.5"><MapPin size={12} /> العنوان والمدينة</span>
              <span>{cust.address ? `${cust.address}، ` : ''}{cust.city || 'بدون مدينة محددة'}</span>
            </div>
            {cust.nationalId && (
              <div className="flex flex-col gap-1 border-b border-base-content/5 pb-2">
                <span className="text-base-content/40">الهوية الوطنية / جواز السفر</span>
                <span className="font-mono">{cust.nationalId}</span>
              </div>
            )}
            <div className="flex flex-col gap-1 border-b border-base-content/5 pb-2">
              <span className="text-base-content/40">الجنس</span>
              <span>{cust.gender === 'FEMALE' ? 'أنثى' : cust.gender === 'MALE' ? 'ذكر' : 'آخر'}</span>
            </div>
            {cust.birthDate && (
              <div className="flex flex-col gap-1 border-b border-base-content/5 pb-2">
                <span className="text-base-content/40">تاريخ الميلاد</span>
                <span>{new Date(cust.birthDate).toLocaleDateString('ar-IQ')}</span>
              </div>
            )}
            {cust.notes && (
              <div className="flex flex-col gap-1">
                <span className="text-base-content/40 flex items-center gap-1.5"><FileText size={12} /> ملاحظات العميل</span>
                <p className="bg-base-200/50 p-2 rounded-lg text-base-content/80 whitespace-pre-line leading-relaxed">{cust.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Operational / Financial Histories */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial summary card */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="stat rounded-xl border border-base-content/10 bg-base-300/80 p-4 shadow">
              <div className="stat-title text-base-content/50 text-xs flex items-center gap-1.5">
                <DollarSign size={14} className="text-warning" /> المبالغ المعلقة
              </div>
              <div className="stat-value text-lg text-warning mt-1 font-bold">
                {outstanding.isLoading ? '...' : formatIQD(remainingFils)}
              </div>
              {canPay && remainingFils > 0 && (
                <button
                  onClick={() => setPayDialogOpen(true)}
                  className="btn btn-primary btn-xs mt-3 gap-1 w-full"
                >
                  <Banknote size={12} />
                  دفع الرصيد
                </button>
              )}
            </div>
            <div className="stat rounded-xl border border-base-content/10 bg-base-300/80 p-4 shadow">
              <div className="stat-title text-base-content/50 text-xs flex items-center gap-1.5">
                <Shirt size={14} className="text-primary" /> عقود التأجير
              </div>
              <div className="stat-value text-lg text-primary mt-1 font-bold">
                {rentals.isLoading ? '...' : rentals.data?.items?.length ?? 0}
              </div>
            </div>
            <div className="stat rounded-xl border border-base-content/10 bg-base-300/80 p-4 shadow">
              <div className="stat-title text-base-content/50 text-xs flex items-center gap-1.5">
                <Calendar size={14} className="text-info" /> الحجوزات النشطة
              </div>
              <div className="stat-value text-lg text-info mt-1 font-bold">
                {reservations.isLoading ? '...' : reservations.data?.items?.length ?? 0}
              </div>
            </div>
          </div>

          {/* Section: Rentals History */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6">
            <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
              <Shirt size={16} className="text-primary" />
              سجل عقود التأجير
            </h3>
            {rentals.isLoading ? (
              <span className="loading loading-spinner text-primary loading-sm" />
            ) : rentals.data?.items?.length === 0 ? (
              <p className="text-xs text-base-content/40 italic">لا توجد عقود تأجير مسجلة لهذا العميل</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="border-b border-base-content/10 text-base-content/60">
                      <th>رقم العقد</th>
                      <th>تاريخ التسليم</th>
                      <th>تاريخ الإرجاع المتوقع</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rentals.data?.items || []).map((rent: any) => (
                      <tr key={rent.id} className="border-b border-base-content/5 hover:bg-base-200/40">
                        <td className="font-mono font-bold text-primary">{rent.rentalNumber}</td>
                        <td>{new Date(rent.rentalDate).toLocaleDateString('ar-IQ')}</td>
                        <td>{new Date(rent.expectedReturnDate).toLocaleDateString('ar-IQ')}</td>
                        <td>
                          <span className="badge badge-outline badge-xs font-semibold">{rent.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section: Payments History */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6">
            <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
              <History size={16} className="text-primary" />
              سجل العمليات المالية والمتحصلات
            </h3>
            {payments.isLoading ? (
              <span className="loading loading-spinner text-primary loading-sm" />
            ) : payments.data?.items?.length === 0 ? (
              <p className="text-xs text-base-content/40 italic">لا توجد معاملات دفع مسجلة لهذا العميل</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="border-b border-base-content/10 text-base-content/60">
                      <th>رقم السند</th>
                      <th>المبلغ</th>
                      <th>حالة الدفع</th>
                      <th>تاريخ السند</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payments.data?.items || []).map((pay: any) => (
                      <tr key={pay.id} className="border-b border-base-content/5 hover:bg-base-200/40">
                        <td className="font-mono font-bold text-primary">{pay.paymentNumber}</td>
                        <td className="font-bold">{formatIQD(pay.amountFils)}</td>
                        <td>
                          <span className={`badge badge-xs font-bold ${pay.status === 'completed' ? 'badge-success' : 'badge-ghost'}`}>
                            {pay.status}
                          </span>
                        </td>
                        <td className="text-base-content/50">{new Date(pay.completedAt || pay.createdAt).toLocaleDateString('ar-IQ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <PaymentDialog
        open={payDialogOpen}
        onClose={() => setPayDialogOpen(false)}
        targetLabel={`العميل ${cust.fullName}`}
        subtitle={openSettlement ? `تسوية ${openSettlement.settlementNumber}` : 'دفعة على الحساب'}
        remainingFils={remainingFils}
        defaultAmountFils={remainingFils > 0 ? remainingFils : undefined}
        title="دفع الرصيد"
        onSubmit={handlePaySubmit}
      />
    </div>
  )
}
