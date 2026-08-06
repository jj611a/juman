import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '@/components/ui'

describe('FilterBar', () => {
  it('emits text filter values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <div dir="rtl">
        <FilterBar
          fields={[{ id: 'name', label: 'الاسم', type: 'text' }]}
          value={[]}
          onChange={onChange}
        />
      </div>
    )
    await user.type(screen.getByLabelText('الاسم'), 'أ')
    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)?.[0]
    expect(last).toEqual([{ id: 'name', value: 'أ' }])
  })

  it('emits boolean filter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <div dir="rtl">
        <FilterBar
          fields={[{ id: 'vip', label: 'VIP', type: 'boolean', placeholder: 'عميل مميز' }]}
          value={[]}
          onChange={onChange}
        />
      </div>
    )
    await user.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith([{ id: 'vip', value: true }])
  })

  it('emits number and select filter values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    function Harness(): React.ReactElement {
      const [value, setValue] = React.useState<Array<{ id: string; value: string | number | boolean | string[] }>>([])
      return (
        <FilterBar
          fields={[
            { id: 'amount', label: 'المبلغ', type: 'number' },
            {
              id: 'status',
              label: 'الحالة',
              type: 'select',
              options: [
                { value: 'AVAILABLE', label: 'متاح' },
                { value: 'RENTED', label: 'مؤجّر' }
              ]
            }
          ]}
          value={value}
          onChange={(next) => {
            setValue(next)
            onChange(next)
          }}
        />
      )
    }

    render(
      <div dir="rtl">
        <Harness />
      </div>
    )
    await user.type(screen.getByLabelText('المبلغ'), '12')
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([{ id: 'amount', value: 12 }])

    await user.click(screen.getByRole('combobox', { name: 'الحالة' }))
    await user.click(await screen.findByRole('option', { name: 'متاح' }))
    const last = onChange.mock.calls.at(-1)?.[0] as Array<{ id: string; value: unknown }>
    expect(last.find((f) => f.id === 'status')).toEqual({ id: 'status', value: 'AVAILABLE' })
  })

  it('accepts ISO date strings in the filter value contract', () => {
    const onChange = vi.fn()
    render(
      <div dir="rtl">
        <FilterBar
          fields={[{ id: 'day', label: 'اليوم', type: 'date' }]}
          value={[{ id: 'day', value: '2026-07-15' }]}
          onChange={onChange}
        />
      </div>
    )
    expect(screen.getByDisplayValue('2026-07-15')).toBeInTheDocument()
  })

  it('emits multiSelect string arrays', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <div dir="rtl">
        <FilterBar
          fields={[
            {
              id: 'tags',
              label: 'وسوم',
              type: 'multiSelect',
              options: [
                { value: 'a', label: 'أ' },
                { value: 'b', label: 'ب' }
              ]
            }
          ]}
          value={[]}
          onChange={onChange}
        />
      </div>
    )
    await user.click(screen.getByRole('button', { name: 'وسوم' }))
    await user.click(await screen.findByText('أ'))
    expect(onChange).toHaveBeenCalled()
    const last = onChange.mock.calls.at(-1)?.[0] as Array<{ id: string; value: unknown }>
    expect(last[0]?.id).toBe('tags')
    expect(Array.isArray(last[0]?.value)).toBe(true)
  })
})
