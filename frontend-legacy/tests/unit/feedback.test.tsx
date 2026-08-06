import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Divider, Progress, Spinner } from '@/components/ui'

describe('feedback', () => {
  it('renders Spinner with status', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders Progress value', () => {
    const { container } = render(<Progress value={40} />)
    expect(container.querySelector('[data-progress]') || container.querySelector('[role="progressbar"]')).toBeTruthy()
  })

  it('renders Divider', () => {
    const { container } = render(<Divider />)
    expect(container.querySelector('[data-orientation="horizontal"]')).toBeTruthy()
  })
})
