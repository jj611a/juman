import { describe, expect, it } from 'vitest'
import {
  hasPermission,
  isUnrestricted,
  PERMISSION,
} from '@/shared/constants/permissions'
import { breadcrumbForPath, NAV_ITEMS } from '@/navigation/nav.config'
import { ROUTES } from '@/shared/constants/routes'

describe('permissions helpers', () => {
  it('gates by permission list', () => {
    expect(hasPermission(['sales.view'], PERMISSION.SALES_VIEW)).toBe(true)
    expect(hasPermission(['sales.view'], PERMISSION.FINANCE_VIEW)).toBe(false)
    expect(hasPermission(undefined, PERMISSION.SALES_VIEW)).toBe(false)
  })

  it('treats Admin role as unrestricted', () => {
    expect(isUnrestricted([], ['Admin'])).toBe(true)
    expect(isUnrestricted(['a'], ['Cashier'])).toBe(false)
  })
})

describe('navigation', () => {
  it('has unique routes and breadcrumb for home', () => {
    const paths = NAV_ITEMS.map((i) => i.to)
    expect(new Set(paths).size).toBe(paths.length)
    expect(breadcrumbForPath(ROUTES.HOME)).toEqual([{ label: 'لوحة القيادة' }])
    expect(breadcrumbForPath(ROUTES.SALES).at(-1)?.label).toBe('المبيعات')
  })
})
