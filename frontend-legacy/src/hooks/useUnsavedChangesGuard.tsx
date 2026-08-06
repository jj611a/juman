import * as React from 'react'
import { useBlocker } from 'react-router'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'

/**
 * Warn on browser unload and block in-app navigation when `dirty` is true.
 * Renders a ConfirmationDialog for router blockers.
 */
export function useUnsavedChangesGuard(dirty: boolean): {
  dialog: React.ReactElement | null
  confirmDiscard: () => void
  cancelDiscard: () => void
} {
  const blocker = useBlocker(dirty)

  React.useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const confirmDiscard = React.useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed()
  }, [blocker])

  const cancelDiscard = React.useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset()
  }, [blocker])

  const dialog =
    blocker.state === 'blocked' ? (
      <ConfirmationDialog
        open
        onOpenChange={(open) => {
          if (!open) cancelDiscard()
        }}
        title="تغييرات غير محفوظة"
        description="لديك تعديلات لم تُحفظ. هل تريد المغادرة دون حفظ؟"
        confirmLabel="مغادرة"
        cancelLabel="البقاء"
        tone="danger"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
    ) : null

  return { dialog, confirmDiscard, cancelDiscard }
}
