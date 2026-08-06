import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BusyIndicator, LoadingOverlay, ProgressOverlay } from '@/components/ui'

describe('LoadingOverlay', () => {
  it('renders fullscreen and container', () => {
    const { rerender } = render(
      <div dir="rtl">
        <LoadingOverlay variant="fullscreen" message="تحميل كامل" />
      </div>
    )
    expect(screen.getByText('تحميل كامل')).toBeInTheDocument()
    rerender(
      <div dir="rtl" className="relative">
        <LoadingOverlay variant="container" message="تحميل حاوية" />
      </div>
    )
    expect(screen.getByText('تحميل حاوية')).toBeInTheDocument()
  })
})

describe('ProgressOverlay / BusyIndicator', () => {
  it('renders progress and busy', () => {
    render(
      <div dir="rtl">
        <ProgressOverlay value={40} message="40%" />
        <BusyIndicator label="مشغول" />
      </div>
    )
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('مشغول')).toBeInTheDocument()
  })
})
