import * as React from 'react'
import { useSyncExternalStore } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { dialogHost } from './dialog-store'

export function DialogHost(): React.ReactElement | null {
  const state = useSyncExternalStore(dialogHost.subscribe, dialogHost.getSnapshot, dialogHost.getSnapshot)
  if (!state.open) return null
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) dialogHost.close()
        state.onOpenChange?.(open)
      }}
    >
      <DialogContent>
        {(state.title || state.description) && (
          <DialogHeader>
            {state.title ? <DialogTitle>{state.title}</DialogTitle> : null}
            {state.description ? <DialogDescription>{state.description}</DialogDescription> : null}
          </DialogHeader>
        )}
        {state.content}
      </DialogContent>
    </Dialog>
  )
}
