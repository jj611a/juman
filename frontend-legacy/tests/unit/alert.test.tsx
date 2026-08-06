import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Alert } from '@/components/ui'

describe('Alert', () => {
  it('renders variants and dismisses', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <div dir="rtl">
        <Alert variant="danger" title="خطر" description="وصف" dismissible onDismiss={onDismiss} />
      </div>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('خطر')).toBeInTheDocument()
    await user.click(screen.getByLabelText('إغلاق'))
    expect(onDismiss).toHaveBeenCalled()
  })
})
