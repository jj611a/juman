import { useEffect } from 'react'

interface POSShortcuts {
  onNewCart?: () => void
  onRentalMode?: () => void
  onSaleMode?: () => void
  onReturnMode?: () => void
  onFocusBarcode?: () => void
  onFocusCustomer?: () => void
  onFocusDiscount?: () => void
  onFocusDeposit?: () => void
  onPrint?: () => void
  onEscape?: () => void
  onProcessTransaction?: () => void
  onOpenPaymentModal?: () => void
  onReservationLookup?: () => void
}

export function usePOSShortcuts({
  onNewCart,
  onRentalMode,
  onSaleMode,
  onReturnMode,
  onFocusBarcode,
  onFocusCustomer,
  onFocusDiscount,
  onFocusDeposit,
  onPrint,
  onEscape,
  onProcessTransaction,
  onOpenPaymentModal,
  onReservationLookup
}: POSShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl combinations
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault()
            onNewCart?.()
            break
          case 'f':
            e.preventDefault()
            onFocusBarcode?.()
            break
          case 'r':
            e.preventDefault()
            onReservationLookup?.()
            break
          default:
            break
        }
      }

      // Function keys
      switch (e.key) {
        case 'F1':
          e.preventDefault()
          onRentalMode?.()
          break
        case 'F2':
          e.preventDefault()
          onSaleMode?.()
          break
        case 'F3':
          e.preventDefault()
          onReturnMode?.()
          break
        case 'F4':
          e.preventDefault()
          onFocusCustomer?.()
          break
        case 'F5':
          e.preventDefault()
          onProcessTransaction?.()
          break
        case 'F6':
          e.preventDefault()
          onOpenPaymentModal?.()
          break
        case 'F7':
          e.preventDefault()
          onFocusDiscount?.()
          break
        case 'F8':
          e.preventDefault()
          onFocusDeposit?.()
          break
        case 'Escape':
          e.preventDefault()
          onEscape?.()
          break
        default:
          break
      }
    };

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    onNewCart,
    onRentalMode,
    onSaleMode,
    onReturnMode,
    onFocusBarcode,
    onFocusCustomer,
    onFocusDiscount,
    onFocusDeposit,
    onPrint,
    onEscape,
    onProcessTransaction,
    onOpenPaymentModal,
    onReservationLookup
  ])
}
