import { usePermission } from '@/features/permissions/PermissionProvider'
import { Link } from 'react-router'
import { ROUTES } from '@/shared/constants/routes'
import { PERMISSION } from '@/shared/constants/permissions'
import { UserPlus, Calendar, Shirt, DollarSign, List, BarChart3, AlertCircle } from 'lucide-react'

export function QuickActionCard() {
  const { can } = usePermission()

  const actions = [
    {
      label: 'عميل جديد',
      to: ROUTES.CUSTOMERS,
      permission: PERMISSION.CUSTOMER_VIEW, // Let's check permission required
      icon: <UserPlus size={20} />,
      color: 'bg-primary/10 hover:bg-primary/20 text-primary',
      desc: 'إضافة وإدارة سجلات العملاء'
    },
    {
      label: 'حجز جديد',
      to: ROUTES.RESERVATIONS,
      permission: PERMISSION.RESERVATIONS_VIEW,
      icon: <Calendar size={20} />,
      color: 'bg-primary/10 hover:bg-primary/20 text-primary',
      desc: 'جدولة حجوزات الفساتين والقطع'
    },
    {
      label: 'تأجير فوري',
      to: ROUTES.RENTALS,
      permission: PERMISSION.RENTALS_VIEW,
      icon: <Shirt size={20} />,
      color: 'bg-primary/10 hover:bg-primary/20 text-primary',
      desc: 'تسليم فستان وتفعيل عقد فوري'
    },
    {
      label: 'نقطة بيع فوري',
      to: ROUTES.SALES,
      permission: PERMISSION.SALES_VIEW,
      icon: <DollarSign size={20} />,
      color: 'bg-primary/10 hover:bg-primary/20 text-primary',
      desc: 'بيع فستان مباشر وإصدار فاتورة'
    },
    {
      label: 'كتالوج المخزون',
      to: ROUTES.INVENTORY,
      permission: PERMISSION.INVENTORY_VIEW,
      icon: <List size={20} />,
      color: 'bg-base-200 hover:bg-base-300 text-base-content',
      desc: 'عرض كافة القطع وحالة إتاحتها'
    },
    {
      label: 'تقارير الإحصاءات',
      to: ROUTES.REPORTS,
      permission: PERMISSION.REPORTS_VIEW,
      icon: <BarChart3 size={20} />,
      color: 'bg-base-200 hover:bg-base-300 text-base-content',
      desc: 'المبيعات اليومية والشهرية والنشاط'
    }
  ]

  // Filter actions based on permissions
  const allowedActions = actions.filter((act) => !act.permission || can(act.permission))

  return (
    <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 select-none col-span-1 md:col-span-2">
      <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2">
        <Shirt size={18} className="text-primary" />
        إجراءات التشغيل السريعة
      </h3>

      {allowedActions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-base-content/40 text-xs">
          <AlertCircle size={32} className="mb-2 text-warning/75" />
          <span>ليس لديك صلاحيات كافية لتنفيذ أي إجراءات تشغيلية سريعة حالياً.</span>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {allowedActions.map((act, i) => (
            <Link
              key={i}
              to={act.to}
              className={`p-4 rounded-xl flex flex-col gap-2.5 transition-all duration-300 border border-base-content/5 group shadow-sm hover:shadow-md hover:border-primary/20 ${act.color}`}
            >
              <div className="shrink-0 group-hover:scale-110 transition-transform duration-300">
                {act.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">{act.label}</span>
                <span className="text-[10px] opacity-60 leading-normal mt-1">{act.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
