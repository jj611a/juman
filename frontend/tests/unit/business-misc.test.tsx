import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchHighlight, CopyButton, ToastProvider } from '@/components/ui'

describe('SearchHighlight', () => {
  it('highlights query without HTML injection', () => {
    render(<SearchHighlight text="فستان سهرة" query="سهرة" />)
    expect(screen.getByText('سهرة').tagName).toBe('MARK')
  })
})

describe('CopyButton', () => {
  it('copies value and shows success toast', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <CopyButton value="ABC" />
      </ToastProvider>
    )
    await user.click(screen.getByRole('button', { name: 'نسخ' }))
    expect(await screen.findByText('تم النسخ')).toBeInTheDocument()
  })
})