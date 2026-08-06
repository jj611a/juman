import * as React from 'react'
import { useSyncExternalStore } from 'react'
import { LoadingOverlay } from '@/components/ui/loading-overlay'
import { globalLoading } from './loading-store'

export function GlobalLoadingHost(): React.ReactElement | null {
  const state = useSyncExternalStore(
    globalLoading.subscribe,
    globalLoading.getSnapshot,
    globalLoading.getSnapshot
  )
  if (!state.active) return null
  return <LoadingOverlay variant="fullscreen" message={state.label ?? 'جاري التحميل…'} />
}
