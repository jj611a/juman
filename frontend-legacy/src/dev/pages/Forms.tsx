import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  Autocomplete,
  Button,
  ColorPicker,
  DatePicker,
  Divider,
  FilePicker,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSection,
  ImagePicker,
  MoneyInput,
  MultiSelect,
  NumberInput,
  PhoneInput,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput
} from '@/components/ui'
import { PhoneService } from '@/lib/phone/phoneService'
import { formatMoney } from '@/lib/money/currency'

const schema = z.object({
  name: z.string().min(2, 'الاسم قصير جداً'),
  search: z.string().optional(),
  amountFils: z.number({ required_error: 'المبلغ مطلوب' }).int().nonnegative(),
  qty: z.string().min(1, 'الكمية مطلوبة'),
  phone: z
    .string({ required_error: 'الهاتف مطلوب' })
    .refine((v) => PhoneService.validate(v), 'رقم هاتف عراقي غير صالح'),
  city: z.string().min(1, 'اختر مدينة'),
  tags: z.array(z.string()).min(1, 'اختر وسمة واحدة على الأقل'),
  product: z.string().nullable(),
  birthDate: z.date({ required_error: 'التاريخ مطلوب' }).nullable(),
  color: z.string().optional(),
  file: z.any().optional(),
  image: z.any().optional()
})

type FormValues = z.infer<typeof schema>

const CITY_OPTIONS = [
  { value: 'bgd', label: 'بغداد' },
  { value: 'bsr', label: 'البصرة' },
  { value: 'erbil', label: 'أربيل' }
]

const TAG_OPTIONS = [
  { value: 'vip', label: 'VIP' },
  { value: 'new', label: 'جديد' },
  { value: 'regular', label: 'منتظم' }
]

const PRODUCT_OPTIONS = [
  { value: 'dress-a', label: 'فستان سهرة أ' },
  { value: 'dress-b', label: 'فستان سهرة ب' },
  { value: 'abaya', label: 'عباية' }
]

export default function FormsPage(): React.ReactElement {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      search: '',
      amountFils: null as unknown as number,
      qty: '',
      phone: null as unknown as string,
      city: '',
      tags: [],
      product: null,
      birthDate: null,
      color: '#c6a75e'
    }
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8" dir="rtl">
      <header>
        <h2 className="text-h2 text-foreground">النماذج</h2>
        <p className="text-body text-muted-foreground">
          React Hook Form + Zod · حالات خطأ / تعطيل · عرض المال بالفلس
        </p>
      </header>

      <Form {...form}>
        <form
          className="flex flex-col gap-8"
          onSubmit={form.handleSubmit((values) => {
            console.info('demo submit', values)
          })}
        >
          <FormSection title="حقول أساسية" description="نص · بحث · رقم · مال · هاتف">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>الاسم</FormLabel>
                  <FormControl>
                    <TextInput placeholder="الاسم الكامل" {...field} />
                  </FormControl>
                  <FormDescription>حد أدنى حرفان</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="search"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>بحث</FormLabel>
                  <FormControl>
                    <SearchInput
                      placeholder="ابحث…"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onClear={() => field.onChange('')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>الكمية</FormLabel>
                  <FormControl>
                    <NumberInput {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amountFils"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>المبلغ (IQD)</FormLabel>
                  <FormControl>
                    <MoneyInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    داخلياً بالفلس:{' '}
                    {typeof field.value === 'number' ? formatMoney(field.value) : '—'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>الهاتف</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value ?? null}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder="07xxxxxxxxx"
                    />
                  </FormControl>
                  <FormDescription>يُخزَّن بتنسيق E.164</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <Divider />

          <FormSection title="اختيار وتاريخ">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>المدينة</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger aria-label="المدينة">
                        <SelectValue placeholder="اختر مدينة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
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
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>وسوم</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={TAG_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      aria-label="وسوم"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>منتج (إكمال تلقائي)</FormLabel>
                  <FormControl>
                    <Autocomplete
                      options={PRODUCT_OPTIONS}
                      value={field.value}
                      onChange={field.onChange}
                      aria-label="منتج"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="birthDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>التاريخ</FormLabel>
                  <FormControl>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      aria-label="التاريخ"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormSection>

          <Divider />

          <FormSection title="ملفات وألوان (داخلي)">
            <FormField
              control={form.control}
              name="file"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملف</FormLabel>
                  <FormControl>
                    <FilePicker value={field.value ?? null} onChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>صورة</FormLabel>
                  <FormControl>
                    <ImagePicker value={field.value ?? null} onChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>لون</FormLabel>
                  <FormControl>
                    <ColorPicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </FormSection>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">حفظ</Button>
            <Button type="button" variant="secondary" onClick={() => form.reset()}>
              إعادة ضبط
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void form.trigger()
              }}
            >
              إظهار الأخطاء
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
