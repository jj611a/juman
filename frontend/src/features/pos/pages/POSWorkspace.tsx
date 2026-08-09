import { useState, useRef, useEffect } from 'react'
import { usePOSShortcuts } from '../hooks/usePOSShortcuts'
import { useCustomersList } from '@/features/customers/hooks/useCustomers'
import { useItemsList } from '@/features/inventory/hooks/useInventory'
import { useCreateRental } from '@/features/rentals/hooks/useRentals'
import { salesApi } from '../api/salesApi'
import { inventoryApi } from '@/features/inventory/api/api'
import { useQueryClient } from '@tanstack/react-query'
import { 
  Barcode, 
  Search, 
  User, 
  Layers, 
  Tag, 
  Clock, 
  Trash2, 
  Sparkles, 
  Activity, 
  CheckCircle,
  AlertTriangle,
  FileText,
  Printer,
  ChevronLeft,
  ShoppingBag,
  Shirt,
  DollarSign,
  Monitor,
  Volume2,
  Calendar,
  X,
  CreditCard,
  XCircle,
  HelpCircle
} from 'lucide-react'

import { formatIQD } from '@/shared/utils/money'
import { useReceiptSettings } from '@/features/receipts/hooks/useReceiptSettings'
import { useReceiptPrint } from '@/features/receipts/hooks/useReceiptPrint'
import { buildSaleReceipt } from '@/features/receipts/utils/receipt'
import { useSession } from '@/app/providers/SessionProvider'

// Formatting helper
function formatFils(fils: number | null | undefined): string {
  return formatIQD(fils)
}

export function POSWorkspace() {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'rental' | 'sale' | 'return'>('rental')
  
  // Customer selection
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; fullName: string; phone: string } | null>(null)
  
  // Barcode / Item scanner
  const [barcodeInput, setBarcodeInput] = useState('')
  const [searchItemQuery, setSearchItemQuery] = useState('')
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const discountInputRef = useRef<HTMLInputElement>(null)
  const depositInputRef = useRef<HTMLInputElement>(null)
  const customerSearchRef = useRef<HTMLInputElement>(null)

  // Cart
  const [cart, setCart] = useState<Array<{
    id: string
    displayName: string
    internalCode: string
    rentalPrice: number
    salePrice: number
    quantity: number
    lifecycleState: string
    isAvailable: boolean
  }>>([])

  // Settlement and Payments
  const [discountAmount, setDiscountAmount] = useState(0)
  const [paymentAmountFils, setPaymentAmountFils] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash')

  // Scanner animation trigger
  const [flashSuccess, setFlashSuccess] = useState(false)
  const [flashError, setFlashError] = useState(false)

  // Modal dialog states
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showReservationModal, setShowReservationModal] = useState(false)
  const [reservationSearch, setReservationSearch] = useState('')

  // Last completed sale — needed to print its receipt
  const [lastSale, setLastSale] = useState<import('@/features/pos/api/salesApi').SaleDto | null>(null)

  const printReceipt = useReceiptPrint()
  const { settings } = useReceiptSettings()
  const { session } = useSession()

  // Live indicators clock
  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString('ar-AE'))
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString('ar-AE'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Lists queries
  const { data: customersData } = useCustomersList({ q: customerSearch || undefined, limit: 5 })
  const { data: itemsData } = useItemsList({ q: searchItemQuery || undefined, limit: 5 })

  // Mutations
  const createRental = useCreateRental()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Shortcuts hook
  usePOSShortcuts({
    onNewCart: () => handleClearCart(),
    onRentalMode: () => setMode('rental'),
    onSaleMode: () => setMode('sale'),
    onReturnMode: () => setMode('return'),
    onFocusBarcode: () => barcodeInputRef.current?.focus(),
    onFocusCustomer: () => customerSearchRef.current?.focus(),
    onFocusDiscount: () => discountInputRef.current?.focus(),
    onFocusDeposit: () => depositInputRef.current?.focus(),
    onPrint: () => handlePrintReceipt(),
    onEscape: () => {
      setBarcodeInput('')
      setErrorMsg(null)
      setSuccessMsg(null)
      setShowPaymentModal(false)
      setShowReturnModal(false)
      setShowCancelModal(false)
      setShowReservationModal(false)
      barcodeInputRef.current?.focus()
    },
    onProcessTransaction: () => {
      void handleProcessTransaction()
    },
    onOpenPaymentModal: () => setShowPaymentModal(true),
    onReservationLookup: () => setShowReservationModal(true)
  })

  // Autofocus barcode input on mount and after actions
  useEffect(() => {
    if (!showPaymentModal && !showReturnModal && !showCancelModal && !showReservationModal) {
      barcodeInputRef.current?.focus()
    }
  }, [cart, selectedCustomer, mode, errorMsg, successMsg, showPaymentModal, showReturnModal, showCancelModal, showReservationModal])

  const handleClearCart = () => {
    setCart([])
    setSelectedCustomer(null)
    setCustomerSearch('')
    setDiscountAmount(0)
    setPaymentAmountFils(0)
    setErrorMsg(null)
    setSuccessMsg(null)
    barcodeInputRef.current?.focus()
  }

  const handlePrintReceipt = async () => {
    if (!lastSale) {
      setErrorMsg('لا توجد فاتورة مكتملة للطباعة.')
      return
    }
    const cashierName = session?.user?.displayName ?? session?.user?.username ?? ''
    const data = buildSaleReceipt(lastSale, settings, cashierName)
    const ok = await printReceipt.print(data, settings)
    if (ok) {
      setSuccessMsg('تم إرسال الفاتورة إلى طابعة الإيصالات بنجاح.')
    } else if (!printReceipt.lastResult?.cancelled) {
      setErrorMsg(printReceipt.error ?? 'فشل الطباعة')
    }
    barcodeInputRef.current?.focus()
  }

  // Handle scanned barcode input (resolves availability via real backend)
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcodeInput.trim()) return

    setBusy(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      // 1. Fetch item by barcode / code
      const listRes = await inventoryApi.list({ q: barcodeInput.trim(), limit: 1 })
      const matched = listRes.items?.[0]

      if (!matched) {
        setFlashError(true)
        setTimeout(() => setFlashError(false), 300)
        setErrorMsg(`القطعة رقم ${barcodeInput} غير موجودة بالمخزن.`)
        setBusy(false)
        setBarcodeInput('')
        return
      }

      // 2. Query Availability endpoint
      const avail = await inventoryApi.getItemAvailability(matched.id)

      if (!avail) {
        setErrorMsg('فشل استعلام حالة توفر القطعة.')
        setBusy(false)
        setBarcodeInput('')
        return
      }

      // 3. Add to cart if available
      if (cart.some((c) => c.id === matched.id)) {
        setCart(cart.map((c) => c.id === matched.id ? { ...c, quantity: c.quantity + 1 } : c))
      } else {
        setCart([
          ...cart,
          {
            id: matched.id,
            displayName: matched.displayName,
            internalCode: matched.internalCode,
            rentalPrice: matched.rentalPrice ?? 0,
            salePrice: matched.salePrice ?? 0,
            quantity: 1,
            lifecycleState: avail.lifecycleState,
            isAvailable: avail.isAvailable
          }
        ])
      }
      setBarcodeInput('')
      
      // Trigger scan success flash
      setFlashSuccess(true)
      setTimeout(() => setFlashSuccess(false), 300)
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء معالجة باركود القطعة.')
    } finally {
      setBusy(false)
    }
  }

  // Quick Action Favorites Ribbon handler
  const handleAddFavorite = async (code: string) => {
    setBarcodeInput(code)
    setTimeout(() => {
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus()
      }
    }, 50)
  }

  const handleRemoveItem = (id: string) => {
    setCart(cart.filter((c) => c.id !== id))
    barcodeInputRef.current?.focus()
  }

  const handleProcessTransaction = async () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setBusy(true)

    if (cart.length === 0) {
      setErrorMsg('سلة المشتريات فارغة.')
      setBusy(false)
      return
    }

    try {
      if (mode === 'rental') {
        if (!selectedCustomer) {
          setErrorMsg('يرجى اختيار عميل لإتمام عملية التأجير.')
          setBusy(false)
          return
        }

        const payload = {
          customerId: selectedCustomer.id,
          rentalDate: new Date().toISOString(),
          expectedReturnDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          items: cart.map((c) => ({
            itemId: c.id,
            agreedRentalPrice: c.rentalPrice
          }))
        }

        const rent = await createRental.mutateAsync(payload)
        
        await queryClient.invalidateQueries({ queryKey: ['items'] })
        await queryClient.invalidateQueries({ queryKey: ['rentals'] })
        
        setSuccessMsg(`تم إنشاء عقد التأجير وتفعيله بنجاح: ${rent.rentalNumber}`)
        setCart([])
      } else {
        // Sales flow
        const payload = {
          customerId: selectedCustomer?.id || undefined,
          discountFils: discountAmount * 1000,
          items: cart.map((c) => ({
            itemId: c.id,
            priceFils: c.salePrice,
            quantity: c.quantity
          }))
        }

        const sale = await salesApi.create(payload)
        await salesApi.confirm(sale.id)
        if (paymentAmountFils > 0) {
          await salesApi.payment(sale.id, {
            amountFils: paymentAmountFils,
            method: paymentMethod
          })
        }
        const completed = await salesApi.complete(sale.id)

        await queryClient.invalidateQueries({ queryKey: ['items'] })
        await queryClient.invalidateQueries({ queryKey: ['sales'] })
        await queryClient.invalidateQueries({ queryKey: ['settlements'] })
        await queryClient.invalidateQueries({ queryKey: ['finance'] })
        await queryClient.invalidateQueries({ queryKey: ['customerOutstanding'] })
        await queryClient.invalidateQueries({ queryKey: ['customerPayments'] })
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        await queryClient.invalidateQueries({ queryKey: ['reports'] })
        await queryClient.invalidateQueries({ queryKey: ['customers'] })

        setLastSale(completed)
        setSuccessMsg(`تم إكمال فاتورة البيع بنجاح: ${sale.saleNumber}`)
        setCart([])
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ أثناء إتمام المعاملة.')
    } finally {
      setBusy(false)
      barcodeInputRef.current?.focus()
    }
  }

  // Calculate totals
  const subtotalFils = cart.reduce((acc, c) => acc + (mode === 'rental' ? c.rentalPrice : c.salePrice) * c.quantity, 0)
  const discountFils = discountAmount * 1000
  const totalFils = Math.max(0, subtotalFils - discountFils)

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] select-none text-xs gap-4 overflow-hidden" dir="rtl">
      
      {/* Top Store & Shift status banner */}
      <div className="flex flex-wrap items-center justify-between bg-base-300/60 p-3 rounded-2xl border border-base-content/10 shrink-0 text-[10px] text-base-content/50 gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-ping" />
            المتجر مفتوح (وردية صباحية)
          </span>
          <span>أمين الصندوق: admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Activity size={12} className="text-success" />
            الخادم متصل
          </span>
          <span className="flex items-center gap-1">
            <Printer size={12} className="text-primary" />
            طابعة الإيصالات متصلة
          </span>
          <span className="flex items-center gap-1">
            <Barcode size={12} className="text-success" />
            الماسح جاهز
          </span>
          <span className="font-mono font-bold text-base-content flex items-center gap-1">
            <Clock size={12} />
            {timeStr}
          </span>
        </div>
      </div>

      {/* Top Ribbon Favorites Bar */}
      <div className="flex items-center gap-3 bg-base-300/40 p-3 rounded-2xl border border-base-content/10 overflow-x-auto shrink-0 scrollbar-thin">
        <span className="font-bold text-[10px] text-base-content/50 shrink-0">أكواد سريعة:</span>
        <button onClick={() => handleAddFavorite('DR-0001')} className="btn btn-neutral btn-xs gap-1 rounded-lg">
          <Shirt size={10} />
          فستان الزفاف A
        </button>
        <button onClick={() => handleAddFavorite('DR-0002')} className="btn btn-neutral btn-xs gap-1 rounded-lg">
          <Shirt size={10} />
          فستان الحفلة B
        </button>
        <button onClick={() => handleAddFavorite('DR-0003')} className="btn btn-neutral btn-xs gap-1 rounded-lg">
          <Shirt size={10} />
          فستان الخطوبة C
        </button>
        <div className="divider divider-horizontal my-1" />
        <button onClick={() => setShowReservationModal(true)} className="btn btn-primary btn-xs gap-1 rounded-lg">
          <Calendar size={10} />
          بحث الحجوزات (Ctrl+R)
        </button>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="alert alert-error text-xs p-3 flex gap-2 shrink-0 rounded-xl">
          <AlertTriangle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success text-xs p-3 flex gap-2 shrink-0 rounded-xl">
          <CheckCircle size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        
        {/* Column 1: Customer panel (Left) */}
        <div className="card bg-base-300/60 border border-base-content/10 p-5 space-y-4 flex flex-col justify-between overflow-y-auto rounded-3xl backdrop-blur-md">
          <div className="space-y-4">
            <h3 className="font-bold text-base-content/70 flex items-center gap-1.5 border-b border-base-content/5 pb-2">
              <User size={14} className="text-primary" />
              العميل الحالي
            </h3>

            {/* Quick Customer Search */}
            <div className="form-control w-full">
              <div className="relative">
                <input
                  ref={customerSearchRef}
                  type="text"
                  placeholder="ابحث عن العميل بالاسم أو رقم الهاتف... (F4)"
                  className="input input-bordered w-full bg-base-200 pl-8 text-[11px] h-10 min-h-0 rounded-xl"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40">
                  <Search size={14} />
                </span>
              </div>

              {/* Dynamic Suggestions List */}
              {customerSearch && (customersData?.items || []).length > 0 && (
                <div className="bg-base-200 border border-base-content/5 rounded-xl mt-1 overflow-hidden divide-y divide-base-content/5 shadow-lg z-10 relative">
                  {(customersData?.items || []).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c)
                        setCustomerSearch('')
                      }}
                      className="w-full text-right p-3 hover:bg-primary/10 transition-colors text-[11px] flex justify-between items-center"
                    >
                      <span className="font-bold">{c.fullName}</span>
                      <span className="text-[9px] text-base-content/40 font-mono">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Profile Detail Info */}
            {selectedCustomer ? (
              <div className="p-4 bg-base-200/80 rounded-2xl border border-base-content/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-primary text-sm">{selectedCustomer.fullName}</span>
                  <button 
                    onClick={() => setSelectedCustomer(null)}
                    className="text-[10px] text-error hover:underline font-bold"
                  >
                    حذف العميل
                  </button>
                </div>
                <div className="text-[11px] text-base-content/60 font-mono">هاتف: {selectedCustomer.phone}</div>
                <div className="border-t border-base-content/5 pt-2 mt-2">
                  <div className="flex justify-between text-[10px] text-base-content/50">
                    <span>الرصيد المتبقي:</span>
                    <span className="font-bold text-error">0.00 د.إ</span>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => {
                  if (customersData?.items?.[0]) {
                    setSelectedCustomer(customersData.items[0])
                  }
                }}
                className="w-full btn btn-outline border-base-content/10 hover:border-primary/20 btn-md text-xs rounded-xl flex items-center justify-center gap-2 h-10 min-h-0"
              >
                زبون نقدي عام (سريع)
              </button>
            )}
          </div>

          {/* Shortcuts Reference Panel */}
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-2">
            <span className="text-[10px] text-primary/70 font-semibold flex items-center gap-1">
              <Activity size={12} />
              اختصارات لوحة المفاتيح
            </span>
            <div className="grid grid-cols-1 gap-1 text-[9px] text-base-content/60 font-mono">
              <div>F1: وضع التأجير</div>
              <div>F2: وضع البيع</div>
              <div>F3: وضع الإرجاع</div>
              <div>F4: تركيز بحث العميل</div>
              <div>F5: تأكيد وحفظ العملية</div>
              <div>F6: نافذة تفاصيل الدفع</div>
              <div>F7: تركيز قيمة الخصم</div>
            </div>
          </div>
        </div>

        {/* Column 2 & 3: Cart / Current operation (Center) */}
        <div className="card lg:col-span-2 bg-base-300/60 border border-base-content/10 p-5 flex flex-col justify-between min-h-0 rounded-3xl backdrop-blur-md">
          <div className="space-y-4 flex flex-col min-h-0 flex-1">
            <div className="flex justify-between items-center border-b border-base-content/5 pb-3">
              <h3 className="font-bold text-base-content/70 flex items-center gap-2 text-sm">
                <ShoppingBag size={16} className="text-success" />
                سلة عمليات مشغل الـ POS
              </h3>
              <div className="flex gap-1.5 bg-base-200/50 p-1 rounded-xl">
                <button
                  onClick={() => setMode('rental')}
                  className={`btn btn-xs font-bold px-3 rounded-lg ${mode === 'rental' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  وضع التأجير (F1)
                </button>
                <button
                  onClick={() => setMode('sale')}
                  className={`btn btn-xs font-bold px-3 rounded-lg ${mode === 'sale' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  وضع البيع (F2)
                </button>
                <button
                  onClick={() => setMode('return')}
                  className={`btn btn-xs font-bold px-3 rounded-lg ${mode === 'return' ? 'btn-primary' : 'btn-ghost'}`}
                >
                  وضع الإرجاع (F3)
                </button>
              </div>
            </div>

            {/* Barcode scan search input (With Green Success / Red Error Flash Animations) */}
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="امسح الباركود أو اكتب الكود الداخلي للقطعة... (Ctrl+F)"
                  className={`input input-bordered w-full bg-base-200 pl-8 text-xs h-10 min-h-0 rounded-xl transition-all duration-300 ${
                    flashSuccess ? 'border-success bg-success/10' : flashError ? 'border-error bg-error/10' : ''
                  }`}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  disabled={busy}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40">
                  <Barcode size={16} />
                </span>
              </div>
              <button 
                type="submit" 
                className="btn btn-neutral btn-md px-6 h-10 min-h-0 text-xs rounded-xl"
                disabled={busy}
              >
                إضافة
              </button>
            </form>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 mt-2 pr-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-base-content/30 py-16">
                  <Barcode size={48} className="mb-2 text-base-content/20" />
                  <span>السلة فارغة. يرجى مسح باركود لإضافة قطع.</span>
                </div>
              ) : (
                cart.map((c) => (
                  <div key={c.id} className="flex justify-between items-center bg-base-200/50 p-3 rounded-2xl border border-base-content/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base-content">{c.displayName}</span>
                        {c.isAvailable ? (
                          <span className="badge badge-success badge-xs font-bold text-[8px] py-1">متاح</span>
                        ) : (
                          <span className="badge badge-error badge-xs font-bold text-[8px] py-1">غير متاح</span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-base-content/40">{c.internalCode} · {c.lifecycleState}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-primary text-sm">
                        {formatFils(mode === 'rental' ? c.rentalPrice : c.salePrice)}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(c.id)}
                        className="btn btn-ghost btn-square btn-xs text-error rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Totals panel summaries */}
          <div className="border-t border-base-content/10 pt-4 mt-4 space-y-2.5">
            <div className="flex justify-between text-base-content/60">
              <span>المجموع الفرعي:</span>
              <span className="font-mono font-bold">{(subtotalFils / 1000).toFixed(2)} د.إ</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-base-content/60">الخصم الفعلي (د.إ) (F7):</span>
              <input
                ref={discountInputRef}
                type="number"
                className="input input-bordered bg-base-200 text-left w-24 text-xs h-8 min-h-0 font-mono rounded-lg"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-between font-bold text-sm text-base-content border-t border-base-content/5 pt-2">
              <span>الإجمالي النهائي المستحق:</span>
              <span className="text-primary font-mono text-lg font-black">{(totalFils / 1000).toFixed(2)} د.إ</span>
            </div>
          </div>
        </div>

        {/* Column 4: Quick Actions & Payments (Right) */}
        <div className="card bg-base-300/60 border border-base-content/10 p-5 space-y-4 flex flex-col justify-between overflow-y-auto rounded-3xl backdrop-blur-md">
          <div className="space-y-4">
            <h3 className="font-bold text-base-content/70 flex items-center gap-1.5 border-b border-base-content/5 pb-2">
              <Sparkles size={14} className="text-warning" />
              العمليات السريعة والدفع
            </h3>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setShowPaymentModal(true)} 
                className="btn btn-outline border-base-content/10 hover:border-primary/20 btn-sm text-xs rounded-lg flex items-center gap-1.5"
              >
                <CreditCard size={12} />
                تفاصيل الدفع (F6)
              </button>
            </div>

            <button
              onClick={handleProcessTransaction}
              className="btn btn-primary btn-md w-full font-bold text-sm h-12 min-h-0 flex items-center justify-center gap-2 rounded-xl active:scale-[0.96] transition-transform"
              disabled={cart.length === 0 || busy}
            >
              {busy ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  <CheckCircle size={16} />
                  {mode === 'rental' ? 'تأكيد وحفظ عقد التأجير (F5)' : 'إتمام الدفع والبيع (F5)'}
                </>
              )}
            </button>

            <button
              onClick={handleClearCart}
              className="btn btn-outline btn-error btn-sm w-full font-bold text-xs rounded-lg active:scale-[0.96] transition-transform"
              disabled={cart.length === 0 || busy}
            >
              إلغاء وتفريغ السلة (Esc)
            </button>
          </div>

          <div className="flex justify-between items-center text-[10px] text-base-content/40 border-t border-base-content/5 pt-3">
            <span className="flex items-center gap-1">
              <Activity size={10} className="text-success animate-pulse" />
              الخادم متصل
            </span>
            <span>مشغل الـ POS نشط</span>
          </div>
        </div>

      </div>

      {/* Modal 1: Payment Details Modal */}
      {showPaymentModal && (
        <div className="modal modal-open modal-middle select-none z-50" dir="rtl">
          <div className="modal-box border border-base-content/10 bg-base-200 shadow-2xl max-w-md rounded-2xl relative">
            <button 
              onClick={() => setShowPaymentModal(false)}
              className="absolute left-4 top-4 text-base-content/50 hover:text-base-content"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-1.5 text-base-content border-b border-base-content/5 pb-2">
              <CreditCard size={16} className="text-primary" />
              تسجيل دفعة نقدية أو بنكية
            </h3>
            <div className="space-y-4 pt-2">
              <div className="form-control">
                <span className="label-text mb-1 text-[10px] text-base-content/50 font-semibold">طريقة الدفع</span>
                <select
                  className="select select-bordered w-full bg-base-300 text-xs h-9 min-h-0 py-0 rounded-xl"
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">نقدي (Cash)</option>
                  <option value="card">بطاقة بنكية (Card)</option>
                  <option value="bank_transfer">تحويل (Bank Transfer)</option>
                </select>
              </div>
              <div className="form-control">
                <span className="label-text mb-1 text-[10px] text-base-content/50 font-semibold">المبلغ المدفوع حالياً (فلس)</span>
                <input
                  ref={depositInputRef}
                  type="number"
                  className="input input-bordered w-full bg-base-300 text-xs h-9 min-h-0 font-mono rounded-xl"
                  value={paymentAmountFils}
                  onChange={(e) => setPaymentAmountFils(Number(e.target.value))}
                />
              </div>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="btn btn-primary btn-sm w-full font-bold text-xs mt-4 rounded-xl"
              >
                تحديث وحفظ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Reservation Lookup Search Modal */}
      {showReservationModal && (
        <div className="modal modal-open modal-middle select-none z-50" dir="rtl">
          <div className="modal-box border border-base-content/10 bg-base-200 shadow-2xl max-w-lg rounded-2xl relative">
            <button 
              onClick={() => setShowReservationModal(false)}
              className="absolute left-4 top-4 text-base-content/50 hover:text-base-content"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-1.5 text-base-content border-b border-base-content/5 pb-2">
              <Calendar size={16} className="text-primary" />
              البحث عن الحجوزات النشطة
            </h3>
            <div className="space-y-4 pt-2">
              <div className="form-control w-full">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ابحث برقم الحجز أو اسم العميل..."
                    className="input input-bordered w-full bg-base-300 pl-8 text-xs h-9 min-h-0 rounded-xl"
                    value={reservationSearch}
                    onChange={(e) => setReservationSearch(e.target.value)}
                  />
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40">
                    <Search size={14} />
                  </span>
                </div>
              </div>
              <div className="p-4 border border-dashed border-base-content/10 rounded-xl text-center text-base-content/40 text-[11px]">
                لا توجد حجوزات نشطة تطابق البحث حالياً.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
