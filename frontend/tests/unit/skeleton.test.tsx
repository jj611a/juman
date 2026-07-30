import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Skeleton, SkeletonCard, SkeletonList, SkeletonTable, SkeletonText } from '@/components/ui'

describe('Skeleton', () => {
  it('renders variants', () => {
    const { container } = render(
      <div dir="rtl">
        <Skeleton variant="text" />
        <Skeleton variant="avatar" />
        <Skeleton variant="image" />
        <SkeletonText />
        <SkeletonCard />
        <SkeletonTable />
        <SkeletonList />
      </div>
    )
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(5)
  })
})
