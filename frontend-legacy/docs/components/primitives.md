# Primitive Components (Phase 2.2)

Token-driven Juman UI primitives. Import only from `@/components/ui`.

**Theme:** `juman-dark` (see [theme.md](../theme.md)). Gold is an accent only.

**Rules:** no hardcoded colors, no inline presentation styles, no direct Radix imports in features.

## Accessibility

- Interactive selection / tooltip / progress built on **Radix** (keyboard + ARIA preserved).
- Focus rings use `--ring` (gold).
- IconButton requires `aria-label`.
- Application shell is RTL; `NumberInput` editing is LTR numeric.

## React Hook Form

All inputs/selection controls `forwardRef` and accept native `name`, `onChange`, `onBlur`, `value` / `defaultValue`, `id`, `aria-*`. Full Form wrappers: see [forms.md](forms.md) (Phase 2.3).

---

## Button

**File:** `button.tsx`

| Prop | Type | Notes |
|---|---|---|
| `variant` | `primary` \| `default` \| `secondary` \| `outline` \| `ghost` \| `danger` | `default` aliases `primary` (gold fill) |
| `size` | `sm` \| `md` \| `lg` \| `default` | |
| `loading` | `boolean` | Shows Spinner; disables |
| `leadingIcon` / `trailingIcon` | `IconName` | via `@/components/icons` |
| `asChild` | `boolean` | Radix Slot |
| `disabled` | `boolean` | |

```tsx
import { Button } from '@/components/ui'
<Button variant="primary" leadingIcon="Plus">إضافة</Button>
```

## IconButton

Requires `aria-label`. Variants: `primary` | `secondary` | `outline` | `ghost` | `danger`. Sizes `sm` | `md` | `lg`.

```tsx
<IconButton icon="Search" aria-label="بحث" />
```

## TextInput / PasswordInput / NumberInput / TextArea

Shared field props: `fieldSize` (`sm`|`md`|`lg`), `fieldState` (`default`|`error`|`success`), `errorMessage`, `hint`, icons (TextInput).

### NumberInput rules

- Class `.input-numeric`: `direction: ltr; unicode-bidi: plaintext; text-align: right`
- Accepts Arabic-Indic digits and `,` / `٫`; normalizes to Western digits + `.`
- No thousands formatting while editing

```tsx
<Label htmlFor="amt">المبلغ</Label>
<NumberInput id="amt" name="amount" />
```

## Checkbox / RadioGroup / Switch / Label

Radix-wrapped. Checked accents use brand gold on indicators; surfaces stay neutral.

```tsx
<div className="flex items-center gap-2">
  <Checkbox id="t" />
  <Label htmlFor="t">قبول</Label>
</div>
```

## Badge / Chip / Avatar

Badge variants: `default` | `brand` | `success` | `warning` | `danger` | `info` | `outline`.  
Chip optional `onDismiss`. Avatar: `Avatar` + `AvatarImage` + `AvatarFallback`.

## Spinner / Progress / Divider / Tooltip

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild><Button variant="outline">?</Button></TooltipTrigger>
    <TooltipContent>مساعدة</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

## Dev showcase

Development only (`import.meta.env.DEV`):

- `#/dev/all` — living style guide
- `#/dev/buttons` · `#/dev/inputs` · `#/dev/selection` · `#/dev/display` · `#/dev/feedback` · `#/dev/tokens`

Not linked from production navigation.
