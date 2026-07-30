import * as React from 'react'
import type { DataRowSelectionState } from './types'

/**
 * Shift-range selection helper for controlled rowSelection state.
 * `rowIds` must be the visible row id list in display order.
 */
export function applyRangeSelection(params: {
  rowIds: string[]
  anchorId: string | null
  targetId: string
  shiftKey: boolean
  previous: DataRowSelectionState
  /** When shift is not held: toggle target only. */
  toggle?: boolean
}): { selection: DataRowSelectionState; anchorId: string } {
  const { rowIds, anchorId, targetId, shiftKey, previous, toggle = true } = params

  if (shiftKey && anchorId != null) {
    const a = rowIds.indexOf(anchorId)
    const b = rowIds.indexOf(targetId)
    if (a === -1 || b === -1) {
      return { selection: { ...previous, [targetId]: true }, anchorId: targetId }
    }
    const [start, end] = a < b ? [a, b] : [b, a]
    const next: DataRowSelectionState = { ...previous }
    for (let i = start; i <= end; i += 1) {
      next[rowIds[i]!] = true
    }
    return { selection: next, anchorId }
  }

  const next = { ...previous }
  if (toggle) {
    if (next[targetId]) delete next[targetId]
    else next[targetId] = true
  } else {
    next[targetId] = true
  }
  return { selection: next, anchorId: targetId }
}

/** Tracks the shift-select anchor id for controlled selection. */
export function useShiftSelectionAnchor(initial: string | null = null): {
  anchorId: string | null
  setAnchorId: (id: string | null) => void
  select: (
    args: Omit<Parameters<typeof applyRangeSelection>[0], 'anchorId'>
  ) => DataRowSelectionState
} {
  const [anchorId, setAnchorId] = React.useState<string | null>(initial)
  const select = React.useCallback(
    (args: Omit<Parameters<typeof applyRangeSelection>[0], 'anchorId'>) => {
      const result = applyRangeSelection({ ...args, anchorId })
      setAnchorId(result.anchorId)
      return result.selection
    },
    [anchorId]
  )
  return { anchorId, setAnchorId, select }
}
