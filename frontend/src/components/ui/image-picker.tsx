import * as React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { FilePicker, type FilePickerProps } from '@/components/ui/file-picker'
import { cn } from '@/utils/cn'

export interface ImagePickerProps extends Omit<FilePickerProps, 'accept' | 'multiple'> {
  previewUrl?: string | null
}

export const ImagePicker = React.forwardRef<HTMLInputElement, ImagePickerProps>(
  ({ className, value, previewUrl, label = 'اختر صورة', ...props }, ref) => {
    const objectUrl = React.useMemo(() => {
      if (previewUrl) return previewUrl
      const file = value?.[0]
      if (!file) return null
      return URL.createObjectURL(file)
    }, [previewUrl, value])

    React.useEffect(() => {
      return () => {
        if (objectUrl && !previewUrl) URL.revokeObjectURL(objectUrl)
      }
    }, [objectUrl, previewUrl])

    return (
      <div className={cn('flex items-center gap-4', className)}>
        <Avatar className="size-16">
          {objectUrl ? <AvatarImage src={objectUrl} alt="" /> : null}
          <AvatarFallback>صورة</AvatarFallback>
        </Avatar>
        <FilePicker
          ref={ref}
          accept="image/*"
          value={value}
          label={label}
          {...props}
        />
      </div>
    )
  }
)
ImagePicker.displayName = 'ImagePicker'
