import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhoneInput } from '@/components/ui'

describe('PhoneInput', () => {
  it('normalizes to E.164 on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PhoneInput aria-label="هاتف" value={null} onChange={onChange} />)
    const input = screen.getByLabelText('هاتف')
    expect(input.className).toMatch(/input-phone/)
    await user.type(input, '07701234567')
    await user.tab()
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('+9647701234567')
  })
})
