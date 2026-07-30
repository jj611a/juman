import * as React from 'react'
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  type GroupProps,
  type PanelProps,
  type SeparatorProps
} from 'react-resizable-panels'
import { cn } from '@/utils/cn'

export type ResizablePanelGroupProps = Omit<GroupProps, 'orientation'> & {
  className?: string
  orientation?: GroupProps['orientation']
  /** Persist layout sizes in localStorage under this id. */
  autoSaveId?: string
}

function ResizablePanelGroupBase({
  className,
  orientation = 'horizontal',
  ...props
}: Omit<ResizablePanelGroupProps, 'autoSaveId'>): React.ReactElement {
  return (
    <Group
      orientation={orientation}
      className={cn('flex h-full w-full', orientation === 'vertical' && 'flex-col', className)}
      {...props}
    />
  )
}

function ResizablePanelGroupPersisted({
  autoSaveId,
  defaultLayout: defaultLayoutProp,
  onLayoutChanged: onLayoutChangedProp,
  ...props
}: ResizablePanelGroupProps & { autoSaveId: string }): React.ReactElement {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: autoSaveId,
    storage: typeof window !== 'undefined' ? localStorage : undefined
  })

  return (
    <ResizablePanelGroupBase
      defaultLayout={defaultLayoutProp ?? defaultLayout}
      onLayoutChanged={(layout, meta) => {
        onLayoutChanged(layout, meta)
        onLayoutChangedProp?.(layout, meta)
      }}
      {...props}
    />
  )
}

export function ResizablePanelGroup(props: ResizablePanelGroupProps): React.ReactElement {
  if (props.autoSaveId) {
    return <ResizablePanelGroupPersisted {...props} autoSaveId={props.autoSaveId} />
  }
  const { autoSaveId: _id, ...rest } = props
  return <ResizablePanelGroupBase {...rest} />
}

export type ResizablePanelProps = PanelProps & {
  className?: string
}

export function ResizablePanel({ className, ...props }: ResizablePanelProps): React.ReactElement {
  return <Panel className={cn('min-h-0 min-w-0', className)} {...props} />
}

export type ResizableHandleProps = SeparatorProps & {
  className?: string
  withHandle?: boolean
}

export function ResizableHandle({
  className,
  withHandle = true,
  ...props
}: ResizableHandleProps): React.ReactElement {
  return (
    <Separator
      className={cn(
        'relative flex items-center justify-center bg-border transition-colors',
        // Horizontal group → vertical bar (aria-orientation=vertical)
        'w-px',
        // Vertical group → horizontal bar (aria-orientation=horizontal)
        'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'data-[separator=active]:bg-brand data-[separator=focus]:bg-brand/60',
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-border bg-border">
          <div className="h-2.5 w-0.5 rounded-full bg-muted-foreground" />
        </div>
      ) : null}
    </Separator>
  )
}
