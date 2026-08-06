import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar, AvatarFallback, Badge, Chip, Label } from '@/components/ui'

describe('display', () => {
  it('renders Badge variants and Label', () => {
    render(
      <div dir="rtl">
        <Label>تسمية</Label>
        <Badge variant="brand">ذهبي</Badge>
      </div>
    )
    expect(screen.getByText('تسمية')).toBeInTheDocument()
    expect(screen.getByText('ذهبي')).toBeInTheDocument()
  })

  it('dismisses Chip', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Chip onDismiss={onDismiss}>وسم</Chip>)
    await user.click(screen.getByRole('button', { name: 'إزالة' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('renders Avatar fallback', () => {
    render(
      <Avatar>
        <AvatarFallback>جم</AvatarFallback>
      </Avatar>
    )
    expect(screen.getByText('جم')).toBeInTheDocument()
  })
})
