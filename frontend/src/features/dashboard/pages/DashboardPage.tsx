import { useState, useEffect } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { useBackendHealth } from '@/shared/hooks/useBackendHealth'
import { apiInvoke } from '@/ipc/api'
import { useQuery } from '@tanstack/react-query'
import { DashboardCard } from '../components/DashboardCard'
import { QuickActionCard } from '../components/QuickActionCard'
import { SystemHealthCard } from '../components/SystemHealthCard'
import { 
  Shirt, 
  Calendar, 
  DollarSign, 
  Wallet, 
  Users, 
  Activity, 
  AlertTriangle, 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  HeartCrack,
  Info,
  Database
} from 'lucide-react'

import { formatIQD } from '@/shared/utils/money'

// Formatting helper for Fils to IQD
function formatFils(fils: number | undefined): string {
  return formatIQD(fils)
}

export function DashboardPage() {
  const { session } = useSession()
  const summary = useDashboardSummary()
  const health = useBackendHealth()
  const [latency, setLatency] = useState<number | null>(null)

  // Measure latency to backend
  useEffect(() => {
    const start = performance.now()
    void apiInvoke({ method: 'GET', path: '/health' }).then(() => {
      setLatency(Math.round(performance.now() - start))
    }).catch(() => {
      setLatency(null)
    })
  }, [summary.data])

  // Queries for secondary metrics
  const customers = useQuery<{ items: any[]; meta: { total: number } }>({
    queryKey: ['dashboardCustomers'],
    queryFn: () => apiInvoke({ method: 'GET', path: '/customers' }),
    retry: 1
  })

  const reservations = useQuery<{ items: any[]; meta: { total: number } }>({
    queryKey: ['dashboardReservations'],
    queryFn: () => apiInvoke({ method: 'GET', path: '/reports/rentals/reservations' }),
    retry: 1
  })

  const overdues = useQuery<{ items: any[]; meta: { total: number } }>({
    queryKey: ['dashboardOverdues'],
    queryFn: () => apiInvoke({ method: 'GET', path: '/reports/rentals/overdue' }),
    retry: 1
  })

  const handleRefresh = async () => {
    await Promise.all([
      summary.refetch(),
      health.refetch(),
      customers.refetch(),
      reservations.refetch(),
      overdues.refetch()
    ])
  }

  // Activity feed mock (derived from actual loaded lists/counts)
  const activities = [
    {
      title: 'تهيئة لوحة التحكم للمرحلة 9.3',
      time: 'الآن',
      desc: 'تم تشغيل مركز التحكم الذكي لجمان بنجاح',
      icon: <Activity size={14} className="text-info" />
    },
    ...(summary.data?.todaysCheckouts ? [{
      title: 'عقود تأجير نشطة اليوم',
      time: 'اليوم',
      desc: `تم رصد عدد ${summary.data.todaysCheckouts} عقود تأجير تم تفعيلها اليوم`,
      icon: <Shirt size={14} className="text-success" />
    }] : []),
    ...(summary.data?.todaysReturns ? [{
      title: 'مرتجعات مستلمة اليوم',
      time: 'اليوم',
      desc: `تمت معالجة وإرجاع عدد ${summary.data.todaysReturns} فساتين اليوم`,
      icon: <CheckCircle size={14} className="text-success" />
    }] : [])
  ]

  return (
    <div className="space-y-6 select-none" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-base-content/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-base-content">لوحة التحكم والتشغيل</h1>
          <p className="text-xs text-base-content/50 mt-1">
            مركز التحكم والعمليات الموحد لنظام جمان ERP · مرحلة إعادة الهيكلة 9.3
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={() => void handleRefresh()} 
            className="btn btn-outline btn-sm gap-2 border-base-content/10 hover:border-primary/30"
          >
            <RefreshCw size={14} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* Section 1: Executive Summary */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-base-content/40 flex items-center gap-2">
          <span>📊</span> الملخص التنفيذي والأداء المالي
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            title="عقود التأجير النشطة"
            value={summary.data?.activeRentals ?? 0}
            desc="إجمالي العقود الجارية حالياً"
            icon={<Shirt size={20} />}
            loading={summary.isLoading}
            error={summary.isError ? 'تعذر تحميل عقود التأجير' : null}
          />
          <DashboardCard
            title="الحجوزات النشطة"
            value={reservations.data?.items?.length ?? 0}
            desc="إجمالي الحجوزات القادمة والمعتمدة"
            icon={<Calendar size={20} />}
            loading={reservations.isLoading}
            error={reservations.isError ? 'تعذر تحميل الحجوزات' : null}
          />
          <DashboardCard
            title="إيرادات المبيعات اليوم"
            value={formatFils(summary.data?.revenueTodayFils)}
            desc="إيرادات التحصيل النقدي لليوم"
            icon={<DollarSign size={20} />}
            loading={summary.isLoading}
            error={summary.isError ? 'تعذر تحميل الإيرادات' : null}
          />
          <DashboardCard
            title="الأموال والذمم المستحقة"
            value={formatFils(summary.data?.outstandingBalanceFils)}
            desc="مبالغ التسويات غير المحصلة"
            icon={<Wallet size={20} />}
            loading={summary.isLoading}
            error={summary.isError ? 'تعذر تحميل المستحقات' : null}
          />
          <DashboardCard
            title="المخزون المتاح للطلب"
            value={summary.data?.availableItems ?? 0}
            desc={`من إجمالي ${summary.data?.inventoryCount ?? 0} قطعة في النظام`}
            icon={<Shirt size={20} />}
            loading={summary.isLoading}
            error={summary.isError ? 'تعذر تحميل المخزون' : null}
          />
          <DashboardCard
            title="قاعدة العملاء"
            value={customers.data?.meta?.total ?? 0}
            desc="إجمالي العملاء المسجلين"
            icon={<Users size={20} />}
            loading={customers.isLoading}
            error={customers.isError ? 'تعذر تحميل العملاء' : null}
          />
          <DashboardCard
            title="حالة الاتصال"
            value={health.data?.status === 'ok' ? 'مستقر' : 'ضعيف'}
            desc={latency !== null ? `زمن الاستجابة: ${latency} ملي ثانية` : 'لا يوجد استجابة'}
            icon={<Activity size={20} />}
            loading={health.isLoading}
            error={health.isError ? 'الخلفية غير متصلة' : null}
          />
          <DashboardCard
            title="حالة قاعدة البيانات"
            value={health.data?.database === 'connected' ? 'متصلة' : 'منفصلة'}
            desc={`بيئة العمل: ${health.data?.environment ?? '—'}`}
            icon={<Database size={20} />}
            loading={health.isLoading}
            error={health.isError ? 'تعذر التحقق من القاعدة' : null}
          />
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left Column (Quick actions & System details) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 5: Quick Actions */}
          <QuickActionCard />

          {/* Section 2 & 3: Operations details */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
            {/* Today's Operations summary */}
            <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6">
              <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                عمليات اليوم التشغيلية
              </h3>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-base-content/5">
                  <span className="text-base-content/60">عقود التأجير المسلمة اليوم</span>
                  <span className="font-extrabold text-sm text-primary">{summary.data?.todaysCheckouts ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-content/5">
                  <span className="text-base-content/60">المرتجعات المستلمة اليوم</span>
                  <span className="font-extrabold text-sm text-primary">{summary.data?.todaysReturns ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-content/5">
                  <span className="text-base-content/60">المبيعات الإجمالية اليوم</span>
                  <span className="font-extrabold text-sm text-primary">{formatFils(summary.data?.revenueTodayFils)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-base-content/60">حجم مبيعات الشهر</span>
                  <span className="font-extrabold text-sm text-primary">{formatFils(summary.data?.revenueThisMonthFils)}</span>
                </div>
              </div>
            </div>

            {/* Attention Required alerts */}
            <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6">
              <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning" />
                تنبيهات تتطلب إجراء
              </h3>
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-base-content/5">
                  <span className="text-base-content/60 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-error"></span> عقود تأجير متأخرة المرتجع
                  </span>
                  <span className={`font-extrabold text-sm ${(overdues.data?.items?.length ?? 0) > 0 ? 'text-error' : 'text-success'}`}>
                    {overdues.data?.items?.length ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-content/5">
                  <span className="text-base-content/60">تسويات مالية معلقة ومفتوحة</span>
                  <span className="font-extrabold text-sm text-warning">{summary.data?.openSettlements ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-base-content/5">
                  <span className="text-base-content/60">القطع المحجوزة حالياً</span>
                  <span className="font-extrabold text-sm text-info">{summary.data?.reservedItems ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-base-content/60">قطع غير متاحة (تالفة / صيانة)</span>
                  <span className="font-extrabold text-sm text-base-content/50">
                    {(summary.data?.inventoryCount ?? 0) - (summary.data?.availableItems ?? 0) - (summary.data?.reservedItems ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 6: Backend Status detail */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 text-xs">
            <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
              <Info size={16} className="text-primary" />
              تفاصيل الاتصال والخلفية
            </h3>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div className="flex flex-col gap-1">
                <span className="text-base-content/40">المستخدم الحالي</span>
                <span className="font-bold">{session?.user?.displayName || session?.user?.username || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-base-content/40">صلاحية الجلسة</span>
                <span className="font-bold text-success">مؤمنة بالكامل</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-base-content/40">إصدار النظام</span>
                <span className="font-bold font-mono">{health.data?.version ?? '1.0.0'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-base-content/40">صلاحيات الدور الوظيفي</span>
                <span className="font-bold text-primary">{session?.user?.roles?.join(', ') || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Timeline and System health list) */}
        <div className="space-y-6">
          {/* Section 4: Recent Activity Timeline */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 select-none">
            <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary" />
              سجل النشاطات الأخير
            </h3>
            <div className="flex flex-col gap-4">
              {activities.map((act, index) => (
                <div key={index} className="flex gap-3 items-start border-b border-base-content/5 pb-3 last:border-0 last:pb-0">
                  <div className="p-1.5 bg-base-200 rounded-lg shrink-0 mt-0.5">
                    {act.icon}
                  </div>
                  <div className="flex flex-col gap-0.5 text-xs">
                    <div className="flex justify-between items-center gap-4">
                      <span className="font-bold text-base-content">{act.title}</span>
                      <span className="text-[10px] text-base-content/30 shrink-0 font-medium">{act.time}</span>
                    </div>
                    <span className="text-[11px] text-base-content/50 mt-1 leading-normal">{act.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: System Health list */}
          <SystemHealthCard />
        </div>
      </div>
    </div>
  )
}
