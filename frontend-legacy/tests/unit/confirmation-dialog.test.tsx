import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmationDialog } from '@/components/ui'

describe('ConfirmationDialog', () => {
  it('cancels with Escape', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <div dir="rtl">
        <ConfirmationDialog
          open
          onOpenChange={onOpenChange}
          title="تأكيد"
          description="وصف"
          onConfirm={() => undefined}
        />
      </div>
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('confirms with Enter', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <div dir="rtl">
        <ConfirmationDialog open onOpenChange={() => undefined} title="تأكيد" onConfirm={onConfirm} />
      </div>
    )
    await screen.findByRole('dialog')
    await user.keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalled()
  })

  it('disables actions while loading', async () => {
    render(
      <div dir="rtl">
        <ConfirmationDialog
          open
          onOpenChange={() => undefined}
          title="حذف"
          tone="danger"
          confirmLabel="حذف"
          loading
          onConfirm={() => undefined}
        />
      </div>
    )
    const confirm = await screen.findByRole('button', { name: 'حذف' })
    expect(confirm).toBeDisabled()
  })

  it('does not confirm with Enter while loading', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <div dir="rtl">
        <ConfirmationDialog
          open
          onOpenChange={() => undefined}
          title="تأكيد"
          loading
          onConfirm={onConfirm}
        />
      </div>
    )
    await screen.findByRole('dialog')
    await user.keyboard('{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
