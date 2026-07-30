import { z } from 'zod'

export const categoryFormSchema = z.object({
  name_ar: z.string().trim().min(1, 'الاسم بالعربية مطلوب').max(200),
  name_en: z.string().max(200),
  description: z.string().max(2000),
  display_order: z.coerce.number().int(),
  is_active: z.boolean()
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>

export function toCategoryPayload(values: CategoryFormValues): {
  name_ar: string
  name_en: string | null
  description: string | null
  display_order: number
  is_active: boolean
} {
  return {
    name_ar: values.name_ar.trim(),
    name_en: values.name_en.trim() || null,
    description: values.description.trim() || null,
    display_order: values.display_order,
    is_active: values.is_active
  }
}
