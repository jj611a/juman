import { z } from 'zod'
import { PhoneService } from '@/lib/phone/phoneService'

export const customerFormSchema = z.object({
  full_name: z.string().trim().min(1, 'الاسم مطلوب').max(200),
  phone: z
    .string()
    .trim()
    .min(1, 'الهاتف مطلوب')
    .refine((v) => PhoneService.validate(v), 'رقم هاتف عراقي غير صالح'),
  alternative_phone: z
    .string()
    .refine((v) => !v.trim() || PhoneService.validate(v), 'رقم هاتف بديل غير صالح'),
  address: z.string().max(2000),
  national_id: z.string().max(50),
  notes: z.string().max(5000),
  gender: z.string().max(20),
  birth_date: z.date().nullable(),
  clear_birth_date: z.boolean(),
  is_active: z.boolean()
})

export type CustomerFormValues = z.infer<typeof customerFormSchema>

export function toE164(phone: string): string {
  const result = PhoneService.normalize(phone)
  return result.ok ? result.e164 : phone.trim()
}

export function birthDateToIso(d: Date | null | undefined): string | null {
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseBirthDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}
