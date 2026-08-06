import { useParams, useNavigate } from 'react-router'
import { useItemDetail } from '../hooks/useInventory'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { 
  ChevronRight, 
  Tag, 
  DollarSign, 
  Calendar, 
  Shirt, 
  Info,
  AlertTriangle,
  History,
  Barcode
} from 'lucide-react'

// Formatting helper for Fils to AED
function formatFils(fils: number | null | undefined): string {
  if (!fils) return '— د.إ'
  return `${(fils / 1000).toLocaleString('ar-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`
}

export function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Queries
  const { data: item, isLoading, isError } = useItemDetail(id ?? '')

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" dir="rtl">
        <span className="loading loading-spinner text-primary loading-lg" />
      </div>
    )
  }

  if (isError || !item) {
    return (
      <div className="alert alert-error text-sm max-w-lg mx-auto mt-8 flex gap-2" dir="rtl">
        <AlertTriangle size={18} />
        <span>تعذر تحميل تفاصيل قطعة المخزون المطلوبة.</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 select-none text-sm" dir="rtl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-base-content/50 border-b border-base-content/5 pb-4">
        <button onClick={() => navigate('/inventory')} className="hover:text-primary transition-colors">
          كتالوج المخزون
        </button>
        <ChevronRight size={14} />
        <span className="font-bold text-base-content">{item.displayName}</span>
      </div>

      {/* Item Profile Header */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-base-300/40 p-6 rounded-2xl border border-base-content/5">
        <div className="avatar placeholder">
          <div className="bg-primary/20 text-primary w-24 h-24 rounded-xl border border-primary/30 flex items-center justify-center">
            <Shirt size={48} className="text-primary/70" />
          </div>
        </div>
        <div className="flex-1 text-center md:text-right space-y-2">
          <div className="flex flex-col md:flex-row md:items-center gap-2 justify-center md:justify-start">
            <h1 className="text-2xl font-black text-base-content">{item.displayName}</h1>
            <span className="badge badge-primary font-mono text-xs">{item.internalCode}</span>
            {item.status === 'active' ? (
              <span className="badge badge-success badge-xs font-bold text-[9px] rounded-sm">نشط</span>
            ) : (
              <span className="badge badge-ghost badge-xs font-bold text-[9px] rounded-sm">غير نشط</span>
            )}
          </div>
          <p className="text-xs text-base-content/40 font-mono">ID: {item.id}</p>
          <div className="flex justify-center md:justify-start gap-3 mt-2 wrap">
            <span className="badge badge-outline badge-xs py-2 px-3 font-semibold">التصنيف: {item.category?.name || 'غير محدد'}</span>
            <span className="badge badge-outline badge-xs py-2 px-3 font-semibold">الماركة: {item.brand?.name || 'غير محدد'}</span>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left Column: Availability & Specs */}
        <div className="space-y-6">
          <AvailabilityPanel itemId={item.id} />

          {/* Item Technical Specifications Details */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6 h-fit space-y-4">
            <h3 className="text-sm font-bold text-base-content/60 flex items-center gap-2 border-b border-base-content/5 pb-2.5">
              <Info size={16} className="text-primary" />
              تفاصيل ومواصفات القطعة
            </h3>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">اللون</span>
                <span className="font-semibold">{item.color?.name || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">المقاس</span>
                <span className="font-semibold">{item.size?.name || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">حالة القطعة الفنية</span>
                <span className="font-semibold">{item.condition}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-base-content/50">دورة الحياة الحالية</span>
                <span className="badge badge-neutral badge-xs font-mono py-2">{item.lifecycleState}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing & Barcode Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="stat rounded-xl border border-base-content/10 bg-base-300/80 p-4 shadow">
              <div className="stat-title text-base-content/50 text-xs flex items-center gap-1.5">
                <DollarSign size={14} className="text-primary" /> سعر الإيجار المقترح
              </div>
              <div className="stat-value text-base text-primary mt-1 font-bold">
                {formatFils(item.rentalPrice)}
              </div>
            </div>
            <div className="stat rounded-xl border border-base-content/10 bg-base-300/80 p-4 shadow">
              <div className="stat-title text-base-content/50 text-xs flex items-center gap-1.5">
                <DollarSign size={14} className="text-success" /> سعر البيع النهائي
              </div>
              <div className="stat-value text-base text-success mt-1 font-bold">
                {formatFils(item.salePrice)}
              </div>
            </div>
            <div className="stat rounded-xl border border-base-content/10 bg-base-300/80 p-4 shadow">
              <div className="stat-title text-base-content/50 text-xs flex items-center gap-1.5">
                <DollarSign size={14} className="text-warning" /> سعر التكلفة / الشراء
              </div>
              <div className="stat-value text-base text-warning mt-1 font-bold">
                {formatFils(item.purchasePrice)}
              </div>
            </div>
          </div>

          {/* Barcode section */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6">
            <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2 border-b border-base-content/5 pb-2">
              <Barcode size={16} className="text-primary" />
              الرموز الباركودية الملحقة بالقطعة
            </h3>
            {(!item.barcodes || item.barcodes.length === 0) ? (
              <p className="text-xs text-base-content/40 italic">لا توجد رموز باركود نشطة مرتبطة بهذه القطعة حالياً</p>
            ) : (
              <div className="space-y-2">
                {item.barcodes.map((bc) => (
                  <div key={bc.id} className="flex justify-between items-center bg-base-200/50 p-2.5 rounded-lg border border-base-content/5">
                    <span className="font-mono font-bold text-sm text-primary">{bc.value}</span>
                    <span className="badge badge-outline badge-xs font-semibold">{bc.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline of events (Stub from backend timeline mapping) */}
          <div className="card border border-base-content/10 bg-base-300/80 shadow-md p-6">
            <h3 className="text-sm font-bold text-base-content/60 mb-4 flex items-center gap-2 border-b border-base-content/5 pb-2">
              <History size={16} className="text-primary" />
              سجل التحديثات ودورة الحياة
            </h3>
            <div className="flex gap-2.5 text-xs text-base-content/50 items-center">
              <Calendar size={14} />
              <span>آخر تحديث للقطعة في: {new Date(item.updatedAt).toLocaleString('ar-AE')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
