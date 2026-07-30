import type { ShellNavSection } from './types'

/** Primary app navigation — permission-filtered in shell. */
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
        id: 'calendar',
        label: 'التقويم',
        href: '/calendar',
        icon: 'Calendar',
        permission: 'calendar.view'
      },
      {
        id: 'reservations',
        label: 'الحجوزات',
        href: '/reservations',
        icon: 'Bookmark',
        permission: 'reservation.view'
      },
      {
        id: 'rentals',
        label: 'التأجير',
        href: '/rentals',
        icon: 'ShoppingBag',
        permission: 'rental.view'
      },
      {
        id: 'returns',
        label: 'المرتجعات',
        href: '/returns',
        icon: 'Undo2',
        permission: 'return.view'
      },
      {
        id: 'processing',
        label: 'المعالجة',
        href: '/processing',
        icon: 'WashingMachine',
        anyOf: ['processing.view', 'inspection.view']
      },
      {
        id: 'sales',
        label: 'المبيعات',
        href: '/sales',
        icon: 'BadgeDollarSign',
        permission: 'sale.view'
      },
      {
        id: 'settlements',
        label: 'التسويات',
        href: '/settlements',
        icon: 'Wallet',
        permission: 'rental.settlement.view'
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
        id: 'users',
        label: 'المستخدمون',
        href: '/users',
        icon: 'UserCog',
        anyOf: ['users.view', 'users.manage']
      },
      {
        id: 'roles',
        label: 'الأدوار',
        href: '/roles',
        icon: 'Shield',
        anyOf: ['roles.view', 'roles.manage']
      },
      {
        id: 'settings',
        label: 'الإعدادات',
        href: '/settings',
        icon: 'Settings',
        permission: 'settings.view'
      },
      {
        id: 'audit',
        label: 'التدقيق',
        href: '/audit',
        icon: 'ScrollText',
        permission: 'audit.view'
      },
      {
        id: 'system',
        label: 'النظام',
        href: '/system',
        icon: 'Server',
        anyOf: ['system.view', 'system.backup', 'system.restore', 'system.maintenance']
      }
    ]
  }
]
