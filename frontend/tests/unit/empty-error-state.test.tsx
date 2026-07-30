import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, EmptyState, ErrorState } from '@/components/ui'

describe('EmptyState', () => {
  it('renders actions', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(
      <div dir="rtl">
        <EmptyState
          title="فارغ"
          description="لا بيانات"
          primaryAction={
            <Button onClick={onAdd}>إضافة</Button>
          }
        />
      </div>
    )
    await user.click(screen.getByRole('button', { name: 'إضافة' }))
    expect(onAdd).toHaveBeenCalled()
  })
})

describe('ErrorState', () => {
  it('shows retry and gates details to DEV', () => {
    render(
      <div dir="rtl">
        <ErrorState
          message="فشل"
          errorCode="E1"
          details="secret-stack"
          onRetry={() => undefined}
        />
      </div>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('E1')).toBeInTheDocument()
    // vitest runs with DEV true typically — details may show
    if (import.meta.env.DEV) {
      expect(screen.getByText('secret-stack')).toBeInTheDocument()
    } else {
      expect(screen.queryByText('secret-stack')).not.toBeInTheDocument()
    }
  })

  it('hides technical details when DEV is false', () => {
    const prev = import.meta.env.DEV
    // @ts-expect-error test override
    import.meta.env.DEV = false
    try {
      render(
        <div dir="rtl">
          <ErrorState message="فشل" details="secret-stack" onRetry={() => undefined} />
        </div>
      )
      expect(screen.queryByText('secret-stack')).not.toBeInTheDocument()
    } finally {
      // @ts-expect-error restore
      import.meta.env.DEV = prev
    }
  })
})
