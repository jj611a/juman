# Juman Design System

**Phase:** Frontend 2.x
**Status:** Phase 2.1–2.6 (Tokens through Feedback) complete

Arabic-first, RTL-only, premium desktop design system for Juman. Built on Electron + React + TypeScript, Tailwind CSS v4, and CSS design tokens.

## Constitution alignment

- Arabic RTL UI; English for source, JSON keys, permissions, error codes.
- UI is not the authorization authority (`PermissionGate` is UX only).
- Renderer never imports Axios or holds JWTs — IPC only.
- Shared primitives live in `src/components/` — not under `src/features/`.
- Dark-only official theme: Premium Black / Dark / Gold.

## Design language

Premium · Elegant · Professional · Luxury · Modern desktop software.

Not gaming, not neon, not glossy. Gold is an accent only (~2% of UI).

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| **2.1** | Tokens, theme, typography/spacing/motion scales, Icon wrapper, docs | **Done** |
| **2.2** | Primitive components (Button, Inputs, Selection, Display, Feedback) | **Done** |
| **2.3** | Form components + RHF / Zod | **Done** |
| **2.4** | Layout (Container, Stack, Dialog, Drawer, …) | **Done** |
| **2.5** | Data (Table, Pagination, KPI, …) | **Done** |
| **2.6** | Feedback (Toast, Alert, Skeleton, …) | **Done** |
| **2.7** | Shared business (Money, Barcode, StatusChip, …) | Done |

## Folder conventions

```text
frontend/
├── docs/                 # Design-system documentation (this tree)
├── src/
│   ├── theme/            # ThemeProvider + typed token registry
│   ├── styles/           # tokens.css + globals.css
│   ├── components/
│   │   ├── icons/        # Lucide Icon wrapper (only icon entry)
│   │   └── ui/           # Primitives (shadcn-style; expand in 2.2+)
│   ├── routes/dev/       # DEV-only showcases (not product UI)
│   └── features/         # Business modules later — no DS primitives here
```

## Token + theme

See [theme.md](theme.md) for the full token tables and gold usage rules.

## Icons

Single entry: `import { Icon } from '@/components/icons'`.

Do not import `lucide-react` directly in feature or page code. See [components.md](components.md).

## Testing expectations (every DS milestone)

- Component / unit tests (Vitest + Testing Library)
- RTL verification (`dir="rtl"`, Arabic copy where applicable)
- Keyboard accessibility for interactive primitives (from 2.2+)
- Dark theme (`juman-dark`) verification

## Rules for contributors

1. No hardcoded hex / rgb in components — use tokens.
2. No inline styles for presentation — use token utility classes / CVA.
3. No light theme or theme switcher in v1.
4. No product screens (Login, Dashboard, business) inside Design System phases.
5. Dev showcases under `routes/dev/` and `import.meta.env.DEV` only.
