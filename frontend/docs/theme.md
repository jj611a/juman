# Juman Theme

**Phase:** Frontend 2.1  
**Official theme id:** `juman-dark`  
**Mode:** dark only (v1.0)

Juman ships a single premium theme: **Black / Dark / Gold**. Light and system modes are not supported.

## Principles

1. Surfaces stay neutral near-black / charcoal — never gold fills for backgrounds, cards, tables, sidebars, or dialogs.
2. Gold is a brand accent (~2% of UI): primary CTAs, focus rings, selected borders, active nav indicators, premium badges.
3. Approximate balance: **90%** neutral dark · **8%** warm white/gray text · **2%** gold.
4. Components must use CSS variables / Tailwind theme tokens — never hardcoded hex colors.
5. UI copy is Arabic RTL; English remains for source, JSON keys, and permission codes.

## Application

`ThemeProvider` (`src/theme/ThemeProvider.tsx`) always applies:

- `document.documentElement.lang = "ar"`
- `document.documentElement.dir = "rtl"`
- `data-theme="juman-dark"`
- `data-scale` from settings (`compact` | `comfortable` | `large`)

`useThemeStore` is immutable: `{ id: 'juman-dark', mode: 'dark', resolved: 'dark' }` with `apply()` only. No theme switcher UI.

## Brand (gold)

| Token | CSS variable | Value | Use |
|---|---|---|---|
| brand.primary | `--brand` | `#C6A75E` | CTA fill, indicators |
| brand.hover | `--brand-hover` | `#B8963E` | Primary hover |
| brand.active | `--brand-active` | `#9A7B2F` | Pressed |
| brand.subtle | `--brand-subtle` | `rgba(198,167,94,0.12)` | Soft highlight |
| brand.border | `--brand-border` | `#C6A75E` | Outline / selected border |
| brand.foreground | `--brand-foreground` | `#0A0A0B` | Text on gold |

Aliases: `--primary` → brand, `--primary-foreground` → brand foreground, `--ring` → gold focus.

### Use gold for

Primary buttons, active nav indicator, focus ring, selected row border, active tab, KPI highlights, premium badges, emphasis icons, progress accent.

### Do not use gold for

App / card / table / sidebar / dialog / form backgrounds or large filled surfaces.

## Surfaces

| Token | CSS variable | Value |
|---|---|---|
| background | `--background` | `#0A0A0B` |
| surface | `--surface` | `#121214` |
| card | `--card` | `#161618` |
| panel | `--panel` | `#141416` |
| sidebar | `--sidebar` | `#0E0E10` |
| header | `--header` | `#0E0E10` |
| dialog | `--dialog` | `#161618` |
| border | `--border` | `#2A2A30` |
| border.subtle | `--border-subtle` | `#1F1F24` |

Secondary fill: `--secondary` `#1E1E22` (neutral — not a second gold).

## Text

| Token | CSS variable | Value |
|---|---|---|
| primary | `--foreground` | `#F3EFE6` |
| secondary | `--foreground-secondary` | `#B8B2A6` |
| muted | `--muted-foreground` | `#8A8580` |
| disabled | `--foreground-disabled` | `#5C5854` |
| inverse | `--foreground-inverse` | `#0A0A0B` |

## Feedback

| Token | CSS variables | Approx |
|---|---|---|
| success | `--success` / `--success-foreground` | Emerald `#2F9B6E` |
| warning | `--warning` / `--warning-foreground` | Amber `#D4A017` |
| danger | `--destructive` / `--destructive-foreground` | Crimson `#C62828` |
| info | `--info` / `--info-foreground` | Blue `#3B7EA0` |

## Interaction

| Token | CSS variable | Behavior |
|---|---|---|
| hover | `--hover` | White 4% overlay |
| pressed | `--pressed` | White 7% overlay |
| focus | `--ring` | Gold ring |
| selection | `--selection` + `--selection-border` | Dark gold-tinted fill + gold border |
| disabled | `--disabled-opacity` | `0.45` |

## Typography

Font: **IBM Plex Sans Arabic** (`--font-sans`).

Utility classes: `.text-display`, `.text-h1`, `.text-h2`, `.text-h3`, `.text-title`, `.text-subtitle`, `.text-body`, `.text-caption`, `.text-label`, `.text-button`.

Scaled by `data-scale` root font size (14 / 16 / 18px).

## Spacing

4px base: `--space-0` … `--space-24` steps `0,1,2,3,4,5,6,8,10,12,16,20,24`.

## Radius

`--radius-sm` 4px · `--radius-md` 8px · `--radius-lg` 12px · `--radius-xl` 16px. No pill defaults.

## Shadow / elevation

`--shadow-sm|md|lg` and `--elevation-1|2|3` — soft dark ambient only (no neon glow).

## Motion

`--duration-fast` 150ms · `--duration-normal` 200ms · `--duration-slow` 300ms · `--ease-standard`.

## Z-index

| Layer | Variable | Value |
|---|---|---|
| dropdown | `--z-dropdown` | 1000 |
| sticky | `--z-sticky` | 1100 |
| overlay | `--z-overlay` | 1200 |
| modal | `--z-modal` | 1300 |
| toast | `--z-toast` | 1400 |
| tooltip | `--z-tooltip` | 1500 |

## Source files

| File | Role |
|---|---|
| `src/styles/tokens.css` | CSS variables + `@theme inline` + typography utilities |
| `src/styles/globals.css` | Tailwind/fonts import, RTL base, atmosphere |
| `src/theme/tokens.ts` | Typed registry for tests / docs drift |
| `src/theme/ThemeProvider.tsx` | Applies theme + RTL + scale |
| `src/stores/themeStore.ts` | Immutable theme state |

## Dev preview

In development: open `#/dev/design-tokens`.
