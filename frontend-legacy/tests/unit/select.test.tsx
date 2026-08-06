import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'

describe('Select', () => {
  it('renders trigger and exposes combobox role', () => {
    render(
      <div dir="rtl">
        <Select defaultValue="bgd">
          <SelectTrigger aria-label="مدينة">
            <SelectValue placeholder="اختر" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bgd">بغداد</SelectItem>
            <SelectItem value="bsr">البصرة</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
    const trigger = screen.getByRole('combobox', { name: 'مدينة' })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens the listbox on click', async () => {
    const user = userEvent.setup()
    render(
      <Select>
        <SelectTrigger aria-label="مدينة">
          <SelectValue placeholder="اختر" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bgd">بغداد</SelectItem>
        </SelectContent>
      </Select>
    )
    const trigger = screen.getByRole('combobox', { name: 'مدينة' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
  })
})
