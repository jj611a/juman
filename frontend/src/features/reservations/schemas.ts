import { z } from 'zod'

export const reservationItemSchema = z.object({
  dress_id: z.string().uuid('اختر فستاناً'),
  reserved_daily_rental_price: z.coerce.number().int().nonnegative().nullable(),
  notes: z.string().max(1000)
})

export const reservationWizardSchema = z
  .object({
    customer_id: z.string().uuid('اختر عميلاً'),
    rental_start_at: z.date({ required_error: 'تاريخ بداية الإيجار مطلوب' }),
    expected_return_at: z.date({ required_error: 'تاريخ الإعادة المتوقع مطلوب' }),
    reservation_at: z.date().nullable(),
    notes: z.string().max(2000),
    items: z.array(reservationItemSchema).min(1, 'أضف فستاناً واحداً على الأقل')
  })
  .refine((v) => v.expected_return_at.getTime() > v.rental_start_at.getTime(), {
    message: 'تاريخ الإعادة يجب أن يكون بعد بداية الإيجار',
    path: ['expected_return_at']
  })

export type ReservationWizardValues = z.infer<typeof reservationWizardSchema>

export function emptyToNull(value: string): string | null {
  const t = value.trim()
  return t || null
}

export function toIsoDateTime(d: Date): string {
  return d.toISOString()
}
