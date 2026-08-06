import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, mapStatus } from '@/components/ui'

describe('StatusBadge', () => {
  it('renders tone variants', () => {
    render(
      <div dir="rtl">
        <StatusBadge tone="success">نشط</StatusBadge>
      </div>
    )
    expect(screen.getByText('نشط')).toBeInTheDocument()
  })

  it('mapStatus maps business status', () => {
    const mapped = mapStatus('RENTED', {
      RENTED: { tone: 'info', label: 'مؤجّر' },
      AVAILABLE: { tone: 'success', label: 'متاح' }
    })
    expect(mapped.tone).toBe('info')
    expect(mapped.label).toBe('مؤجّر')
  })
})
