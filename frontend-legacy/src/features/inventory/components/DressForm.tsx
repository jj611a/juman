import * as React from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
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
  MoneyInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput
} from '@/components/ui'
import { apiClient } from '@/services/apiClient'
import type { DressDto } from '@/services/domainTypes'
import { dressFormSchema, parseIsoDate, type DressFormValues } from '../schemas'

export interface DressFormProps {
  initial?: DressDto | null
  submitting?: boolean
  mode?: 'create' | 'edit'
  onSubmit: (values: DressFormValues) => void | Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function DressForm({
  initial,
  submitting,
  mode = 'create',
  onSubmit,
  onCancel,
  onDirtyChange
}: DressFormProps): React.ReactElement {
  const categories = useQuery({
    queryKey: ['categories', 'list', { limit: 200, active_only: true }],
    queryFn: () => apiClient.categories.list({ limit: 200, active_only: true })
  })

  const form = useForm<DressFormValues>({
    resolver: zodResolver(dressFormSchema),
    defaultValues: {
      category_id: initial?.category_id ?? '',
      name_ar: initial?.name_ar ?? '',
      name_en: initial?.name_en ?? '',
      purchase_price: initial?.purchase_price ?? 0,
      default_daily_rental_price: initial?.default_daily_rental_price ?? 0,
      default_sale_price: initial?.default_sale_price ?? 0,
      description: initial?.description ?? '',
      purchase_date: parseIsoDate(initial?.purchase_date),
      barcode: initial?.barcode ?? '',
      is_active: initial?.is_active ?? true,
      clear_purchase_date: false
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
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          const had = Boolean(initial?.purchase_date)
          const cleared = mode === 'edit' && had && !values.purchase_date
          await onSubmit({ ...values, clear_purchase_date: cleared })
        })}
      >
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الفئة *</FormLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر فئة" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(categories.data?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name_ar"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الاسم (عربي) *</FormLabel>
              <FormControl>
                <TextInput {...field} autoFocus />
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
                <TextInput {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ['purchase_price', 'سعر الشراء (دينار عراقي)'],
              ['default_daily_rental_price', 'إيجار يومي (دينار عراقي)'],
              ['default_sale_price', 'سعر البيع (دينار عراقي)']
            ] as const
          ).map(([name, label]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label} *</FormLabel>
                  <FormControl>
                    <MoneyInput
                      value={field.value}
                      onChange={(fils) => field.onChange(fils ?? 0)}
                      onBlur={field.onBlur}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <FormField
          control={form.control}
          name="purchase_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>تاريخ الشراء</FormLabel>
              <FormControl>
                <DatePicker value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {mode === 'create' ? (
          <FormField
            control={form.control}
            name="barcode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الباركود (اختياري)</FormLabel>
                <FormControl>
                  <TextInput {...field} placeholder="يُولَّد تلقائياً إن تُرك فارغاً" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>الوصف</FormLabel>
              <FormControl>
                <TextInput {...field} />
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
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
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
