# Juman UI Design System (Phase 9.0)

**Theme id:** `juman` (daisyUI custom theme; alias `juman-dark` still applies token CSS)  
**Stack:** Tailwind CSS v4 + **daisyUI 5** + Radix wrappers for controlled a11y  
**Direction:** Arabic RTL · Desktop-first · Gold on black branding preserved

## Principles

1. **One visual language** — daisyUI semantic classes (`btn`, `card`, `table`, `menu`, `stat`, `badge`, `alert`, `skeleton`, `navbar`, `fieldset`) composed inside `@/components/ui` wrappers.
2. **Backend is authoritative** — presentation never invents money, inventory, or permission rules.
3. **Brand first** — primary gold `#c6a75e` maps to daisyUI `primary`; surfaces use `base-100/200/300`.
4. **No mixed one-offs** — pages use wrappers; avoid raw hex and new parallel component kits.
5. **Desktop UX** — sticky table headers, dense IDE-like sidebar, keyboard focus rings (`juman-focus`).

## Color map (tokens ↔ daisyUI)

| Juman token | daisyUI | Hex |
|-------------|---------|-----|
| `--brand` / `--primary` | `primary` | `#c6a75e` |
| `--brand-foreground` | `primary-content` | `#0a0a0b` |
| `--background` | `base-100` | `#0a0a0b` |
| `--surface` | `base-200` | `#121214` |
| `--card` | `base-300` | `#161618` |
| `--foreground` | `base-content` | `#f3efe6` |
| `--sidebar` / `--header` | `neutral` | `#0e0e10` |
| `--success` | `success` | `#2f9b6e` |
| `--warning` | `warning` | `#d4a017` |
| `--destructive` | `error` | `#c62828` |
| `--info` | `info` | `#3b7ea0` |

Source: [`src/styles/globals.css`](../src/styles/globals.css) `@plugin "daisyui/theme"` + [`src/styles/tokens.css`](../src/styles/tokens.css).

## Spacing / type / elevation / motion

- **Spacing:** 4px base (`--space-*` in tokens).
- **Typography:** IBM Plex Sans Arabic via token utility classes (`.text-display` … `.text-button`).
- **Elevation:** `--elevation-1/2/3` + utility `juman-elevate`.
- **Motion:** `--duration-fast/normal/slow` + `animate-juman-in`; avoid decorative glow/purple.

## Component inventory (wrappers)

| Area | Path | daisyUI classes |
|------|------|-----------------|
| Button / IconButton | `components/ui/button.tsx`, `icon-button.tsx` | `btn`, sizes, colors |
| Card / Page | `card.tsx`, `page.tsx` | `card`, surfaces |
| Inputs | `input-base.ts` | `input`, `textarea` |
| Badge / Alert | `badge.tsx`, `alert.tsx` | `badge`, `alert` |
| Empty / Error / Skeleton | `empty-state`, `error-state`, `skeleton` | `skeleton`, `alert` |
| KPI | `kpi-card.tsx` | `stats` / `stat` |
| Forms | `form-section.tsx` | `fieldset` |
| Dialog | `dialog.tsx` | modal chrome (Radix) |
| DataTable | `data-table/data-table.tsx` | `table` |
| Shell | `layouts/shell/*` | `navbar`, `menu`, `status`, `badge` |

Radix remains for Dialog, Dropdown, Select, Toast, Checkbox, Tabs — **behavior** — while visuals align to daisyUI theme.

## Shell layout

- Sidebar: neutral rail, `menu` sections, gold inset active indicator.
- Top bar: `navbar` with breadcrumbs + actions.
- Status bar: `status` + version `badge`s.
- Workspace: `bg-base-200` scroll region.

## Accessibility

- Focus-visible rings via `juman-focus` / daisyUI focus.
- Error regions use `role="alert"`.
- Icon-only buttons require `aria-label`.
- RTL preserved on `documentElement`.

## Do not

- Remove `legacyBridge` or change Nest APIs.
- Introduce a second theme switcher in v1.
- Mix Tailwind palette colors (`red-500`) for chrome — use semantic daisyUI colors.
