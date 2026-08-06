import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CurrencyBadge, MoneyDisplay, StatusChip, mapStatus } from '@/components/ui'

describe('MoneyDisplay', () => {
  it('formats positive, negative, and zero', () => {
    const { rerender } = render(<MoneyDisplay value={1_000} />)
    expect(screen.getByText(/1\.000 د\.ع/)).toBeInTheDocument()
    expect(screen.getByText(/1\.000 د\.ع/).getAttribute('data-sign')).toBe('positive')

    rerender(<MoneyDisplay value={-1_000} />)
    expect(screen.getByText(/-1\.000 د\.ع/).getAttribute('data-sign')).toBe('negative')

    rerender(<MoneyDisplay value={0} />)
    expect(screen.getByText(/0\.000 د\.ع/).getAttribute('data-sign')).toBe('zero')
  })

  it('supports compact mode', () => {
    render(<MoneyDisplay value={1_000_000} compact />)
    expect(screen.getByText('1000 د.ع')).toBeInTheDocument()
  })
})

describe('CurrencyBadge', () => {
  it('shows IQD by default', () => {
    render(<CurrencyBadge />)
    expect(screen.getByText('IQD')).toBeInTheDocument()
  })
})

describe('StatusChip', () => {
  it('maps status via mapStatus tones', () => {
    const map = {
      AVAILABLE: { tone: 'success' as const, label: 'متاح' }
    }
    render(<StatusChip status="AVAILABLE" map={map} icon="Check" />)
    expect(screen.getByText('متاح')).toBeInTheDocument()
    expect(screen.getByText('متاح').closest('[data-tone]')?.getAttribute('data-tone')).toBe('success')
    expect(mapStatus('AVAILABLE', map).tone).toBe('success')
  })
})
