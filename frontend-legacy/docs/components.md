# Juman Components

Design-system component catalog. Phase **2.1** documents **Icon** only. Primitives and composites land in Phases 2.2–2.7.

Related: [design-system.md](design-system.md) · [theme.md](theme.md)

---

## Primitives (Phase 2.2)

Primitives: [components/primitives.md](components/primitives.md)

Forms: [components/forms.md](components/forms.md)

Exports from `@/components/ui`: Button, IconButton, TextInput, PasswordInput, NumberInput, TextArea, Label, Checkbox, RadioGroup, RadioGroupItem, Switch, Badge, Chip, Avatar, Spinner, Progress, Divider, Tooltip*.

---

## Icon (Phase 2.1)

**Path:** `src/components/icons/Icon.tsx`
**Import:** `import { Icon } from '@/components/icons'`

Wraps **lucide-react**. All application icons must go through this wrapper.

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `name` | Lucide export name (`Search`, `ArrowLeft`, …) | required | Must exist on `lucide-react` |
| `size` | `'sm' \| 'md' \| 'lg' \| number` | `'md'` | sm=16, md=20, lg=24 |
| `rtlFlip` | `boolean` | `false` | Applies horizontal mirror for directional icons |
| `title` | `string` | — | When set, icon is meaningful (`role="img"`); otherwise decorative (`aria-hidden`) |
| `className` | `string` | — | Token-aware classes (e.g. `text-brand`) |

Also accepts standard Lucide SVG props (except conflicting `size` / `ref` handling via forwardRef).

### Examples

```tsx
import { Icon } from '@/components/icons'

// Decorative (default)
<Icon name="Search" />

// Meaningful + gold accent
<Icon name="Sparkles" className="text-brand" title="Emphasis" />

// Directional in RTL
<Icon name="ArrowLeft" rtlFlip title="Back" />
```

### Rules

- Do **not** `import { Search } from 'lucide-react'` in pages/features.
- Prefer token colors (`text-foreground`, `text-brand`, `text-muted-foreground`).
- Use `rtlFlip` only for arrows / chevrons that must reverse in RTL.

### Tests

`tests/unit/icon.test.tsx`

---

## Upcoming (not implemented yet)

### Phase 2.2 — Primitives

**Done.** See [primitives.md](components/primitives.md).

### Phase 2.3 — Forms

**Done.** See [forms.md](components/forms.md).

### Phase 2.4 — Layout

**Done.** See [layout.md](components/layout.md).

### Phase 2.5 — Data

**Done.** See [data.md](components/data.md).

### Phase 2.6 — Feedback

**Done.** See [feedback.md](components/feedback.md).

### Phase 2.7 — Shared business

**Done.** See [business.md](components/business.md).

---

## Existing foundation (pre–design-system)

| Component | Path | Note |
|---|---|---|
| `Button` | `src/components/ui/button.tsx` | Foundation shadcn Button; inherits new gold `--primary` tokens. Full variant redesign in **2.2**. |
| `PermissionGate` | `src/app/PermissionGate.tsx` | App-level UX gate — not a DS visual primitive yet (**2.7**). |
