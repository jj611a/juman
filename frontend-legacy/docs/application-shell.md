# Application shell (Phase 3.1)

Desktop-first, RTL-first chrome. Import from `@/layouts/shell`. Product entry: `@/layouts/AppShell`.

## Composition

`AppShellFrame` → `Sidebar` + `TopBar` + `Workspace` + `StatusBar`

- **Sidebar** — collapse / expand / resize, icons, badges, permission filtering, arrow-key nav within sections
- **TopBar** — page title, `BreadcrumbHost` (route `handle`), search / command / notification stubs, `UserMenu`, window controls
- **Workspace** — scrollable main; optional `loading` / `empty` / `error` slots
- **StatusBar** — online state, user, app/backend version

Also: `AppLogo`, `CompanySwitcher` (stub), `NavigationSection` / `NavigationItem`, `DEFAULT_SHELL_SECTIONS`.

**Brand:** store logo at `public/brand/juman-logo.png` — used by `AppLogo` (sidebar + auth), favicon, and Electron window icon when available.

## Hosts (global)

Mounted once in `AppProviders` (with existing `ToastProvider`):

- `GlobalLoadingHost` + `globalLoading.show/hide`
- `DialogHost` + `dialogHost.open/close`
- `DrawerHost` + `drawerHost.open/close`

## Shortcuts

`ShortcutProvider` + `useShortcut` / `shortcutRegistry`

- `Control+B` — toggle sidebar
- Search / command / notifications — TopBar icons **disabled** with «قريبًا» (no toast stubs)

## Page gutter contract

`AppShell` wraps `<Outlet />` in a single `p-6`. `Page` sizes (`md`/`lg`/`xl`/`full`) set **max-width only** — they must not add horizontal padding (avoids double gutters).

## Window title

`apiClient.desktop.window.setTitle` + `document.title` synced from route `handle.title`.

## Rules

- No business module pages in shell nav (placeholders only)
- Breadcrumbs informational; Sidebar is primary navigation
- Auth screens use chrome-less `AuthLayout` (not this shell)
- Toast remains a single provider

## Showcase

`#/dev/shell`
