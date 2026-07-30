import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  NumberInput,
  TextInput
} from '@/components/ui'
import type { CategoryDto } from '@/services/domainTypes'
import { categoryFormSchema, type CategoryFormValues } from '../schemas'

export interface CategoryFormProps {
  initial?: CategoryDto | null
  submitting?: boolean
  onSubmit: (values: CategoryFormValues) => void | Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function CategoryForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  onDirtyChange
}: CategoryFormProps): React.ReactElement {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name_ar: initial?.name_ar ?? '',
      name_en: initial?.name_en ?? '',
      description: initial?.description ?? '',
      display_order: initial?.display_order ?? 0,
      is_active: initial?.is_active ?? true
    }
  })

  const dirty = form.formState.isDirty
  React.useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          await onSubmit(values)
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="name_ar"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم (عربي) *</FormLabel>
              <FormControl>
                <TextInput {...field} autoFocus aria-required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name_en"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم (إنجليزي)</FormLabel>
              <FormControl>
                <TextInput {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الوصف</FormLabel>
              <FormControl>
                <TextInput {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="display_order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ترتيب العرض</FormLabel>
              <FormControl>
                <NumberInput
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value || 0))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              </FormControl>
              <FormLabel className="font-normal">نشط</FormLabel>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            إلغاء
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
