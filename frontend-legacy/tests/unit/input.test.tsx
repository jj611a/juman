import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberInput, PasswordInput, TextArea, TextInput } from '@/components/ui'

describe('inputs', () => {
  it('renders TextInput and marks error', () => {
    render(
      <div dir="rtl">
        <TextInput id="n" aria-label="اسم" errorMessage="مطلوب" />
      </div>
    )
    expect(screen.getByLabelText('اسم')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('مطلوب')
  })

  it('disables TextInput', () => {
    render(<TextInput aria-label="حقل" disabled />)
    expect(screen.getByLabelText('حقل')).toBeDisabled()
  })

  it('toggles PasswordInput visibility', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="كلمة" />)
    const input = screen.getByLabelText('كلمة')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }))
    expect(input).toHaveAttribute('type', 'text')
  })

  it('normalizes NumberInput Arabic-Indic digits', async () => {
    const user = userEvent.setup()
    render(<NumberInput aria-label="رقم" />)
    const input = screen.getByLabelText('رقم')
    expect(input.className).toMatch(/input-numeric/)
    await user.type(input, '١٢٣')
    expect(input).toHaveValue('123')
  })

  it('renders TextArea', () => {
    render(<TextArea aria-label="ملاحظات" />)
    expect(screen.getByLabelText('ملاحظات')).toBeInTheDocument()
  })
})
