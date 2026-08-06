import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DatePicker } from '@/components/ui'

describe('DatePicker', () => {
  it('opens calendar and selects today', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DatePicker aria-label="تاريخ" value={null} onChange={onChange} />)
    await user.click(screen.getByLabelText('تاريخ'))
    await user.click(await screen.findByRole('button', { name: 'اليوم' }))
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0]).toBeInstanceOf(Date)
  })
})
