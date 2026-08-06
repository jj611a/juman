import type { ShellNavSection } from './types'

/**
 * Primary app navigation — permission-filtered in shell.
 * Brands / colors / sizes admin pages removed from product UI (Nest APIs remain).
 * Modules without Nest V2 HTTP stay hidden.
 */
export const DEFAULT_SHELL_SECTIONS: ShellNavSection[] = [
  {
    id: 'main',
    label: 'القائمة',
    items: [
      { id: 'home', label: 'الرئيسية', href: '/', icon: 'Home' },
      {
        id: 'categories',
        label: 'الفئات',
        href: '/categories',
        icon: 'Tags',
        permission: 'categories.view'
      },
      {
        id: 'customers',
        label: 'العملاء',
        href: '/customers',
        icon: 'Users',
        permission: 'customer.view'
      },
      {
        id: 'inventory',
        label: 'المخزون',
        href: '/inventory',
        icon: 'Shirt',
        permission: 'inventory.view'
      },
      {
        id: 'reservations',
        label: 'الحجوزات',
        href: '/reservations',
        icon: 'Bookmark',
        anyOf: ['reservation.view', 'reservations.view']
      },
      {
        id: 'rentals',
        label: 'التأجير',
        href: '/rentals',
        icon: 'ShoppingBag',
        anyOf: ['rental.view', 'rentals.view']
      },
      {
        id: 'settlements',
        label: 'التسويات',
        href: '/settlements',
        icon: 'Wallet',
        anyOf: ['rental.settlement.view', 'finance.settlement.view']
      },
      {
        id: 'finance',
        label: 'المالية',
        href: '/finance',
        icon: 'Banknote',
        permission: 'finance.view'
      },
      {
        id: 'barcodes',
        label: 'الباركود',
        href: '/barcodes',
        icon: 'Barcode',
        permission: 'barcode.view'
      },
      {
        id: 'reports',
        label: 'التقارير',
        href: '/reports',
        icon: 'BarChart3',
        anyOf: ['reports.view', 'reports.financial.view']
      }
    ]
  },
  {
    id: 'admin',
    label: 'الإدارة',
    items: [
      {
        id: 'hardware',
        label: 'الأجهزة',
        href: '/hardware',
        icon: 'Cpu',
        permission: 'settings.view'
      }
    ]
  }
]
