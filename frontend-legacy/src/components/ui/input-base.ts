import { cva, type VariantProps } from 'class-variance-authority'

export const fieldVariants = cva(
  'input input-bordered w-full bg-base-200 text-base-content juman-focus placeholder:text-base-content/40',
  {
    variants: {
      fieldSize: {
        sm: 'input-sm',
        md: 'input-md',
        lg: 'input-lg'
      },
      fieldState: {
        default: '',
        error: 'input-error',
        success: 'input-success'
      }
    },
    defaultVariants: {
      fieldSize: 'md',
      fieldState: 'default'
    }
  }
)

export type FieldVariantProps = VariantProps<typeof fieldVariants>

export const textareaVariants = cva(
  'textarea textarea-bordered w-full min-h-20 bg-base-200 text-base-content juman-focus placeholder:text-base-content/40 resize-y',
  {
    variants: {
      fieldState: {
        default: '',
        error: 'textarea-error',
        success: 'textarea-success'
      }
    },
    defaultVariants: {
      fieldState: 'default'
    }
  }
)
