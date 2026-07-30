import { describe, expect, it } from 'vitest'
import { applyRangeSelection } from '@/components/ui'

describe('applyRangeSelection', () => {
  const rowIds = ['a', 'b', 'c', 'd']

  it('toggles a single target without shift', () => {
    const first = applyRangeSelection({
      rowIds,
      anchorId: null,
      targetId: 'b',
      shiftKey: false,
      previous: {}
    })
    expect(first.selection).toEqual({ b: true })
    expect(first.anchorId).toBe('b')

    const second = applyRangeSelection({
      rowIds,
      anchorId: 'b',
      targetId: 'b',
      shiftKey: false,
      previous: first.selection
    })
    expect(second.selection).toEqual({})
  })

  it('selects a contiguous range with shift', () => {
    const result = applyRangeSelection({
      rowIds,
      anchorId: 'a',
      targetId: 'c',
      shiftKey: true,
      previous: { a: true }
    })
    expect(result.selection).toEqual({ a: true, b: true, c: true })
    expect(result.anchorId).toBe('a')
  })
})
