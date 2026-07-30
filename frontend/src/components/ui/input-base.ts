import { cva, type VariantProps } from 'class-variance-authority'

export const fieldVariants = cva(
  'flex w-full rounded-md border bg-card text-foreground text-body transition-colors duration-[var(--duration-fast)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)]',
  {
    variants: {
      fieldSize: {
        sm: 'h-8 px-2.5 text-caption',
        md: 'h-10 px-3',
        lg: 'h-11 px-4'
      },
      fieldState: {
        default: 'border-border',
        error: 'border-destructive focus-visible:ring-destructive',
        success: 'border-success focus-visible:ring-success'
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
  'flex min-h-20 w-full rounded-md border bg-card px-3 py-2 text-foreground text-body transition-colors duration-[var(--duration-fast)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-[var(--disabled-opacity)] resize-y',
  {
    variants: {
      fieldState: {
        default: 'border-border',
        error: 'border-destructive focus-visible:ring-destructive',
        success: 'border-success focus-visible:ring-success'
      }
    },
    defaultVariants: {
      fieldState: 'default'
    }
  }
)
