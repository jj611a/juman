import type { ShellNavSection } from './types'

/**
 * Primary app navigation — permission-filtered in shell.
 * Modules without Nest V2 HTTP (returns, processing, sales, users, roles,
 * system, calendar) are omitted so they stay hidden.
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
      // calendar: no Availability HTTP in Nest V2 — hidden
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
      // returns / processing / sales: V2_UNSUPPORTED — hidden
      {
        id: 'settlements',
        label: 'التسويات',
        href: '/settlements',
        icon: 'Wallet',
        anyOf: ['rental.settlement.view', 'finance.settlement.view']
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
      // users / roles / system: no Nest V2 admin CRUD HTTP — hidden
      {
        id: 'settings',
        label: 'الإعدادات',
        href: '/settings',
        icon: 'Settings',
        permission: 'settings.view'
      },
      {
        id: 'hardware',
        label: 'الأجهزة',
        href: '/hardware',
        icon: 'Cpu',
        permission: 'settings.view'
      },
      {
        id: 'audit',
        label: 'التدقيق',
        href: '/audit',
        icon: 'ScrollText',
        permission: 'audit.view'
      }
    ]
  }
]
