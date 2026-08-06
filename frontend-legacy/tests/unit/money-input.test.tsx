import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoneyInput } from '@/components/ui'

describe('MoneyInput', () => {
  it('emits fils integers from IQD typing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MoneyInput aria-label="مبلغ" value={null} onChange={onChange} />)
    const input = screen.getByLabelText('مبلغ')
    expect(input.className).toMatch(/input-numeric/)
    await user.clear(input)
    await user.type(input, '2.500')
    await user.tab()
    const calls = onChange.mock.calls.map((c) => c[0]).filter((v) => typeof v === 'number')
    expect(calls.at(-1)).toBe(2500)
  })
})
