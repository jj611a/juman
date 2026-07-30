import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InlineMessage } from '@/components/ui'

describe('InlineMessage', () => {
  it('renders variants', () => {
    render(
      <div dir="rtl">
        <InlineMessage variant="success">حسناً</InlineMessage>
        <InlineMessage variant="error">خطأ</InlineMessage>
      </div>
    )
    expect(screen.getByText('حسناً')).toBeInTheDocument()
    expect(screen.getByText('خطأ')).toBeInTheDocument()
  })

  it('sets aria-live polite for info and assertive for error', () => {
    render(
      <div dir="rtl">
        <InlineMessage variant="info">معلومة</InlineMessage>
        <InlineMessage variant="error">خطأ</InlineMessage>
      </div>
    )
    const statuses = screen.getAllByRole('status')
    expect(statuses[0]).toHaveAttribute('aria-live', 'polite')
    expect(statuses[1]).toHaveAttribute('aria-live', 'assertive')
  })
})
