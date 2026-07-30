# Form Components (Phase 2.3)

Compose Phase 2.2 primitives with React Hook Form + Zod. Import from `@/components/ui`.

Related: [primitives.md](primitives.md) · [theme.md](../theme.md)

## Rules

- No hardcoded colors; tokens only.
- Features never import Radix — only `@/components/ui`.
- Do not duplicate field chrome — use `FormField` / primitives.

## React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, TextInput } from '@/components/ui'

const schema = z.object({ name: z.string().min(2) })

const form = useForm({ resolver: zodResolver(schema), defaultValues: { name: '' } })

<Form {...form}>
  <FormField
    control={form.control}
    name="name"
    render={({ field }) => (
      <FormItem>
        <FormLabel required>الاسم</FormLabel>
        <FormControl>
          <TextInput {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

### Form layer exports

| Export | Role |
|---|---|
| `Form` | `FormProvider` |
| `FormField` | RHF `Controller` |
| `FormItem` / `FormLabel` / `FormControl` / `FormDescription` / `FormMessage` | a11y wiring |
| `FormSection` | titled group |
| `RequiredMarker` / `HelpText` / `ValidationMessage` | chrome helpers |

## Domain inputs

### NumberInput

Existing primitive. LTR editing, Arabic-Indic → Western digits. See primitives.md.

### MoneyInput (IQD)

- **Form value:** `number | null` — **integer fils** (1000 fils = 1 IQD)
- Displays major IQD with 3 decimals while editing
- No floating-point storage

Utils: `@/lib/money/currency` (`filsToDisplay`, `displayToFils`, `formatMoney`)

### PhoneInput

- **Form value:** `string | null` — canonical **E.164** (`+964…`)
- Editing display: `+964 770 123 4567` (LTR digits)
- Iraq mobile only in v1

Utils: `@/lib/phone/phoneService` (`normalize`, `format`, `validate`)

### SearchInput

`TextInput` + Search icon + optional clear.

## Overlays

| Component | Notes |
|---|---|
| `Select` | Radix Select |
| `MultiSelect` | Popover + Checkbox; value `string[]` |
| `Autocomplete` | Popover listbox; ↑↓/Enter/Esc |
| `DatePicker` / `CalendarInput` | value `Date \| null`; Gregorian adapter |
| `FilePicker` / `ImagePicker` | native file input |
| `ColorPicker` | native color (admin) |

### Date architecture

- Public API does not expose Gregorian props.
- `CalendarAdapter` + `GregorianCalendarAdapter` (date-fns).
- Store/API boundary: ISO-8601 strings; form state uses `Date | null`.
- Week starts Saturday by default (`weekStartsOn={6}`).

## Accessibility

- Labels via `FormLabel` + `htmlFor`
- Errors: `role="alert"` on `FormMessage`
- Select / Popover / calendar keyboard support via Radix
- Numeric/phone: LTR digit utilities inside RTL forms

## Dev showcase

`#/dev/forms` — full RHF + Zod demo (DEV only).
