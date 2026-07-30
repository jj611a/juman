import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Button,
  Checkbox,
  DatePicker,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  PhoneInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput
} from '@/components/ui'
import type { CustomerDto } from '@/services/domainTypes'
import {
  customerFormSchema,
  parseBirthDate,
  type CustomerFormValues
} from '../schemas'

export interface CustomerFormProps {
  initial?: CustomerDto | null
  submitting?: boolean
  onSubmit: (values: CustomerFormValues) => void | Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  /** When editing, expose clear_birth_date when date cleared. */
  mode?: 'create' | 'edit'
}

export function CustomerForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
  onDirtyChange,
  mode = 'create'
}: CustomerFormProps): React.ReactElement {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      full_name: initial?.full_name ?? '',
      phone: initial?.phone ?? '',
      alternative_phone: initial?.alternative_phone ?? '',
      address: initial?.address ?? '',
      national_id: initial?.national_id ?? '',
      notes: initial?.notes ?? '',
      gender: initial?.gender ?? '',
      birth_date: parseBirthDate(initial?.birth_date),
      clear_birth_date: false,
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
          const hadBirth = Boolean(initial?.birth_date)
          const cleared = mode === 'edit' && hadBirth && !values.birth_date
          await onSubmit({ ...values, clear_birth_date: cleared })
        })}
        noValidate
      >
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم الكامل *</FormLabel>
              <FormControl>
                <TextInput {...field} autoFocus aria-required />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الهاتف *</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? '')}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="alternative_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>هاتف بديل</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value ?? ''}
                  onChange={(v) => field.onChange(v ?? '')}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>العنوان</FormLabel>
              <FormControl>
                <TextInput {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="national_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الرقم الوطني</FormLabel>
              <FormControl>
                <TextInput {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الجنس</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(v) => field.onChange(v === '__none' ? '' : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  <SelectItem value="female">أنثى</SelectItem>
                  <SelectItem value="male">ذكر</SelectItem>
                  <SelectItem value="other">آخر</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="birth_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تاريخ الميلاد</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? null} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ملاحظات</FormLabel>
              <FormControl>
                <TextInput {...field} value={field.value ?? ''} />
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
