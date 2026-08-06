import { describe, expect, it } from 'vitest'
import { createDataColumn } from '@/components/ui'

describe('createDataColumn', () => {
  it('returns a typed column def with flags', () => {
    const col = createDataColumn<{ name: string }>({
      accessorKey: 'name',
      header: 'الاسم',
      sortable: true,
      filterable: true,
      resizable: true
    })
    expect(col.accessorKey).toBe('name')
    expect(col.sortable).toBe(true)
    expect(col.filterable).toBe(true)
  })

  it('throws without id/accessor', () => {
    expect(() => createDataColumn({ header: 'x' })).toThrow(/provide id/)
  })
})
