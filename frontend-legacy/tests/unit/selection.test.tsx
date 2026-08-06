import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox, Label, RadioGroup, RadioGroupItem, Switch } from '@/components/ui'

describe('selection', () => {
  it('toggles Checkbox with keyboard', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <Checkbox id="c" aria-label="قبول" />
      </div>
    )
    const box = screen.getByRole('checkbox', { name: 'قبول' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    box.focus()
    await user.keyboard(' ')
    expect(box).toHaveAttribute('aria-checked', 'true')
  })

  it('supports RadioGroup', async () => {
    const user = userEvent.setup()
    render(
      <RadioGroup defaultValue="a" aria-label="خيارات">
        <div>
          <RadioGroupItem value="a" id="a" />
          <Label htmlFor="a">أ</Label>
        </div>
        <div>
          <RadioGroupItem value="b" id="b" />
          <Label htmlFor="b">ب</Label>
        </div>
      </RadioGroup>
    )
    expect(screen.getByRole('radiogroup', { name: 'خيارات' })).toBeInTheDocument()
    await user.click(screen.getByLabelText('ب'))
    expect(screen.getByLabelText('ب')).toBeChecked()
  })

  it('supports Switch disabled', () => {
    render(<Switch aria-label="وضع" disabled />)
    expect(screen.getByRole('switch', { name: 'وضع' })).toBeDisabled()
  })
})
