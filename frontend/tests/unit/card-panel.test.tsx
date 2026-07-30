import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardContent, CardTitle, Panel } from '@/components/ui'

describe('Card', () => {
  it('applies highlighted accent class', () => {
    const { container } = render(
      <div dir="rtl">
        <Card variant="highlighted">
          <CardTitle>مميز</CardTitle>
          <CardContent>محتوى</CardContent>
        </Card>
      </div>
    )
    expect(container.querySelector('.border-t-brand')).toBeTruthy()
    expect(screen.getByText('مميز')).toBeInTheDocument()
  })
})

describe('Panel', () => {
  it('shows loading state', () => {
    render(
      <div dir="rtl">
        <Panel title="لوحة" loading>
          مخفي
        </Panel>
      </div>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('مخفي')).not.toBeInTheDocument()
  })

  it('shows empty slot when no children', () => {
    render(
      <div dir="rtl">
        <Panel title="فارغ" empty={<span>لا بيانات</span>} />
      </div>
    )
    expect(screen.getByText('لا بيانات')).toBeInTheDocument()
  })
})
