import { z } from 'zod'
import { DRESS_COLOURS, DRESS_SIZES } from './statusMap'

export const dressFormSchema = z.object({
  category_id: z.string().uuid('اختر فئة'),
  name_ar: z.string().trim().min(1, 'الاسم بالعربية مطلوب').max(200),
  name_en: z.string().max(200),
  brand: z.string().max(200),
  size: z.enum(DRESS_SIZES as unknown as [string, ...string[]], {
    required_error: 'المقاس مطلوب'
  }),
  colour: z.enum(DRESS_COLOURS as unknown as [string, ...string[]], {
    required_error: 'اللون مطلوب'
  }),
  purchase_price: z.coerce.number().int().nonnegative('سعر الشراء غير صالح'),
  default_daily_rental_price: z.coerce.number().int().nonnegative('سعر الإيجار غير صالح'),
  default_sale_price: z.coerce.number().int().nonnegative('سعر البيع غير صالح'),
  description: z.string().max(10000),
  purchase_date: z.date().nullable(),
  barcode: z.string().max(64),
  is_active: z.boolean(),
  clear_purchase_date: z.boolean()
})

export type DressFormValues = z.infer<typeof dressFormSchema>

export function emptyToNull(value: string): string | null {
  const t = value.trim()
  return t || null
}

export function dateToIso(d: Date | null | undefined): string | null {
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}
