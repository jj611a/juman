import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ToastProvider,
  toast,
  notification,
  clearToasts,
  getToastSnapshot,
  TOAST_MAX_VISIBLE
} from '@/components/ui'

describe('toast', () => {
  beforeEach(() => {
    clearToasts()
  })
  afterEach(() => {
    clearToasts()
  })

  it('shows and dismisses a toast', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <ToastProvider>
          <button type="button" onClick={() => toast.success('تم')}>
            إطلاق
          </button>
        </ToastProvider>
      </div>
    )
    await user.click(screen.getByRole('button', { name: 'إطلاق' }))
    expect(await screen.findByText('تم')).toBeInTheDocument()
    await user.click(screen.getByLabelText('إغلاق'))
    expect(screen.queryByText('تم')).not.toBeInTheDocument()
  })

  it('queues beyond max visible', () => {
    for (let i = 0; i < TOAST_MAX_VISIBLE + 2; i += 1) {
      toast.info(`t-${i}`)
    }
    const snap = getToastSnapshot()
    expect(snap.visible).toHaveLength(TOAST_MAX_VISIBLE)
    expect(snap.queued).toBe(2)
  })

  it('runs action button', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <div dir="rtl">
        <ToastProvider>
          <button
            type="button"
            onClick={() => toast.info('إجراء', { action: { label: 'تراجع', onClick }, duration: 60_000 })}
          >
            إطلاق
          </button>
        </ToastProvider>
      </div>
    )
    await user.click(screen.getByRole('button', { name: 'إطلاق' }))
    await user.click(await screen.findByText('تراجع'))
    expect(onClick).toHaveBeenCalled()
  })

  it('notification alias shares the toast singleton', async () => {
    const user = userEvent.setup()
    render(
      <div dir="rtl">
        <ToastProvider>
          <button type="button" onClick={() => notification.error('فشل')}>
            إطلاق
          </button>
        </ToastProvider>
      </div>
    )
    expect(notification).toBe(toast)
    await user.click(screen.getByRole('button', { name: 'إطلاق' }))
    expect(await screen.findByText('فشل')).toBeInTheDocument()
  })
})
