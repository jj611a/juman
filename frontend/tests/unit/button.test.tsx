import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, IconButton } from '@/components/ui'

describe('Button', () => {
  it('renders variants', () => {
    render(
      <div>
        <Button variant="primary">أساسي</Button>
        <Button variant="danger">خطر</Button>
      </div>
    )
    expect(screen.getByRole('button', { name: 'أساسي' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'خطر' })).toBeInTheDocument()
  })

  it('disables when loading', () => {
    render(<Button loading>حفظ</Button>)
    expect(screen.getByRole('button', { name: /حفظ/ })).toBeDisabled()
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  })

  it('supports keyboard activation', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>نقر</Button>)
    const btn = screen.getByRole('button', { name: 'نقر' })
    btn.focus()
    expect(btn).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('requires accessible name', () => {
    render(<IconButton icon="Search" aria-label="بحث" />)
    expect(screen.getByRole('button', { name: 'بحث' })).toBeInTheDocument()
  })
})
