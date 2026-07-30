import * as React from 'react'
import { useSyncExternalStore } from 'react'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { drawerHost } from './drawer-store'

export function DrawerHost(): React.ReactElement | null {
  const state = useSyncExternalStore(drawerHost.subscribe, drawerHost.getSnapshot, drawerHost.getSnapshot)
  if (!state.open) return null
  return (
    <Drawer
      open={state.open}
      onOpenChange={(open) => {
        if (!open) drawerHost.close()
        state.onOpenChange?.(open)
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          {state.title ? <DrawerTitle>{state.title}</DrawerTitle> : null}
          {state.description ? <DrawerDescription>{state.description}</DrawerDescription> : null}
        </DrawerHeader>
        <DrawerBody>{state.content}</DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
