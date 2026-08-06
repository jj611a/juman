import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import { MediaThumbnail } from '@/components/ui/business/media-thumbnail'
import type { StoredFileMeta } from '@/components/ui/business/media-types'
import { IconButton } from '@/components/ui/icon-button'
import { cn } from '@/utils/cn'

export interface MediaGalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  files: StoredFileMeta[]
}

/** Viewer-only gallery. Never uploads or fetches. */
export function MediaGallery({ files, className, ...props }: MediaGalleryProps): React.ReactElement {
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const active = files.find((f) => f.id === activeId) ?? null
  const index = active ? files.findIndex((f) => f.id === active.id) : -1

  return (
    <div className={cn('flex flex-wrap gap-2', className)} {...props}>
      {files.map((file) => (
        <button
          key={file.id}
          type="button"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setActiveId(file.id)}
          aria-label={file.fileName ?? file.alt ?? 'عرض الوسائط'}
        >
          <MediaThumbnail file={file} size="md" />
        </button>
      ))}

      <Dialog open={activeId != null} onOpenChange={(open) => !open && setActiveId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{active?.fileName ?? 'وسائط'}</DialogTitle>
          <DialogDescription className="sr-only">عارض وسائط</DialogDescription>
          {active?.src ? (
            <img
              src={active.src}
              alt={active.alt ?? active.fileName ?? ''}
              className="max-h-[70vh] w-full object-contain"
            />
          ) : (
            <p className="text-muted-foreground">لا توجد معاينة</p>
          )}
          <div className="flex items-center justify-between gap-2">
            <IconButton
              icon="ChevronRight"
              aria-label="السابق"
              disabled={index <= 0}
              onClick={() => setActiveId(files[index - 1]?.id ?? null)}
            />
            <span className="text-caption text-muted-foreground">
              {index >= 0 ? `${index + 1} / ${files.length}` : null}
            </span>
            <IconButton
              icon="ChevronLeft"
              aria-label="التالي"
              disabled={index < 0 || index >= files.length - 1}
              onClick={() => setActiveId(files[index + 1]?.id ?? null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
