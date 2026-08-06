/** Central route paths — single source for nav + router. */
export const ROUTES = {
  LOGIN: '/login',
  HOME: '/',
  CUSTOMERS: '/customers',
  INVENTORY: '/inventory',
  CATEGORIES: '/categories',
  BRANDS: '/brands',
  COLORS: '/colors',
  SIZES: '/sizes',
  MEDIA: '/media',
  BARCODES: '/barcodes',
  RESERVATIONS: '/reservations',
  RENTALS: '/rentals',
  SALES: '/sales',
  POS: '/pos',
  FINANCE: '/finance',
  SETTLEMENTS: '/settlements',
  REPORTS: '/reports',
  SHELL_GUIDE: '/shell',
} as const

export type AppRoutePath = (typeof ROUTES)[keyof typeof ROUTES]
