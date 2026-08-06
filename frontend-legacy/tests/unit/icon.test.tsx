import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Icon } from '@/components/icons'
import { ICON_SIZE_PX } from '@/theme/tokens'

describe('Icon', () => {
  it('renders a Lucide SVG for a known name', () => {
    const { container } = render(<Icon name="Search" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes accessible name when title is set', () => {
    render(<Icon name="Search" title="search" />)
    expect(screen.getByRole('img', { name: 'search' })).toBeInTheDocument()
  })

  it('applies size tokens', () => {
    const { container, rerender } = render(<Icon name="Search" size="sm" />)
    expect(container.querySelector('svg')).toHaveAttribute(
      'width',
      String(ICON_SIZE_PX.sm)
    )
    rerender(<Icon name="Search" size="lg" />)
    expect(container.querySelector('svg')).toHaveAttribute(
      'width',
      String(ICON_SIZE_PX.lg)
    )
  })

  it('applies rtlFlip mirror class', () => {
    const { container } = render(<Icon name="ArrowLeft" rtlFlip />)
    expect(container.querySelector('svg')?.getAttribute('class')).toMatch(/-scale-x-100/)
  })
})
