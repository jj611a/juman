import { PERMISSION, type PermissionKey } from '@/shared/constants/permissions'
import { ROUTES, type AppRoutePath } from '@/shared/constants/routes'

export type NavGroupId =
  | 'home'
  | 'catalog'
  | 'operations'
  | 'money'
  | 'insights'

export interface NavItem {
  readonly id: string
  readonly to: AppRoutePath
  readonly label: string
  readonly group: NavGroupId
  readonly phase: string
  readonly permission?: PermissionKey | readonly PermissionKey[]
  readonly keywords?: readonly string[]
}

export interface NavGroup {
  readonly id: NavGroupId
  readonly label: string
}

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'catalog', label: 'الكتالوج' },
  { id: 'operations', label: 'التشغيل' },
  { id: 'money', label: 'المالية' },
  { id: 'insights', label: 'التقارير' },
] as const

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    to: ROUTES.HOME,
    label: 'لوحة القيادة',
    group: 'home',
    phase: '9.3',
    keywords: ['dashboard', 'home'],
  },
  {
    id: 'shell',
    to: ROUTES.SHELL_GUIDE,
    label: 'هيكل التطبيق',
    group: 'home',
    phase: '9.1',
    keywords: ['shell', 'architecture'],
  },
  {
    id: 'customers',
    to: ROUTES.CUSTOMERS,
    label: 'العملاء',
    group: 'catalog',
    phase: '9.4',
    permission: PERMISSION.CUSTOMER_VIEW,
    keywords: ['customers', 'crm'],
  },
  {
    id: 'inventory',
    to: ROUTES.INVENTORY,
    label: 'المخزون',
    group: 'catalog',
    phase: '9.5',
    permission: PERMISSION.INVENTORY_VIEW,
  },
  {
    id: 'categories',
    to: ROUTES.CATEGORIES,
    label: 'التصنيفات',
    group: 'catalog',
    phase: '9.5',
    permission: PERMISSION.CATEGORIES_VIEW,
  },
  {
    id: 'brands',
    to: ROUTES.BRANDS,
    label: 'العلامات',
    group: 'catalog',
    phase: '9.5',
    permission: PERMISSION.INVENTORY_VIEW,
  },
  {
    id: 'colors',
    to: ROUTES.COLORS,
    label: 'الألوان',
    group: 'catalog',
    phase: '9.5',
    permission: PERMISSION.INVENTORY_VIEW,
  },
  {
    id: 'sizes',
    to: ROUTES.SIZES,
    label: 'المقاسات',
    group: 'catalog',
    phase: '9.5',
    permission: PERMISSION.INVENTORY_VIEW,
  },
  {
    id: 'media',
    to: ROUTES.MEDIA,
    label: 'الوسائط',
    group: 'catalog',
    phase: '9.5',
    permission: PERMISSION.MEDIA_VIEW,
  },
  {
    id: 'barcodes',
    to: ROUTES.BARCODES,
    label: 'الباركود',
    group: 'catalog',
    phase: '9.5',
    permission: PERMISSION.BARCODE_VIEW,
  },
  {
    id: 'pos',
    to: ROUTES.POS,
    label: 'نقطة البيع',
    group: 'operations',
    phase: '9.8',
    permission: PERMISSION.SALES_VIEW,
    keywords: ['pos', 'cashier', 'sale', 'barcode', 'كاشير'],
  },
  {
    id: 'reservations',
    to: ROUTES.RESERVATIONS,
    label: 'الحجوزات',
    group: 'operations',
    phase: '9.6',
    permission: PERMISSION.RESERVATIONS_VIEW,
  },
  {
    id: 'rentals',
    to: ROUTES.RENTALS,
    label: 'التأجير',
    group: 'operations',
    phase: '9.7',
    permission: PERMISSION.RENTALS_VIEW,
  },
  {
    id: 'sales',
    to: ROUTES.SALES,
    label: 'المبيعات',
    group: 'operations',
    phase: '9.8',
    permission: PERMISSION.SALES_VIEW,
  },
  {
    id: 'finance',
    to: ROUTES.FINANCE,
    label: 'المالية',
    group: 'money',
    phase: '9.9',
    permission: PERMISSION.FINANCE_VIEW,
  },
  {
    id: 'settlements',
    to: ROUTES.SETTLEMENTS,
    label: 'التسويات',
    group: 'money',
    phase: '9.9',
    permission: PERMISSION.FINANCE_SETTLEMENT_VIEW,
  },
  {
    id: 'reports',
    to: ROUTES.REPORTS,
    label: 'التقارير',
    group: 'insights',
    phase: '9.10',
    permission: PERMISSION.REPORTS_VIEW,
  },
] as const

export function breadcrumbForPath(pathname: string): readonly { label: string; to?: string }[] {
  const item = NAV_ITEMS.find((n) => n.to === pathname)
  if (!item || item.to === ROUTES.HOME) {
    return [{ label: 'لوحة القيادة' }]
  }
  return [{ label: 'الرئيسية', to: ROUTES.HOME }, { label: item.label }]
}
