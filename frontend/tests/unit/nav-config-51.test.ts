import { describe, expect, it } from 'vitest'
import { DEFAULT_SHELL_SECTIONS } from '@/layouts/shell/nav-config'

describe('nav-config categories/customers', () => {
  it('enables categories and customers with correct permission keys', () => {
    const main = DEFAULT_SHELL_SECTIONS.find((s) => s.id === 'main')
    expect(main).toBeTruthy()
    const categories = main!.items.find((i) => i.id === 'categories')
    const customers = main!.items.find((i) => i.id === 'customers')
    expect(categories?.href).toBe('/categories')
    expect(categories?.permission).toBe('categories.view')
    expect(categories?.disabled).toBeFalsy()
    expect(customers?.href).toBe('/customers')
    expect(customers?.permission).toBe('customer.view')
    expect(customers?.disabled).toBeFalsy()
  })
})
