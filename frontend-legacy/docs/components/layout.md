# Layout components (Phase 2.4)

Reusable layout kit for feature modules. Import only from `@/components/ui`.

## Page layout primitives

Every feature page must use these primitives. Desktop-first, RTL-first, spacing via tokens only.

### Preferred composition

```tsx
import {
  Page,
  PageHeader,
  PageTitle,
  PageSubtitle,
  PageActions,
  PageToolbar,
  PageContent,
  PageFooter,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbCurrent,
  BreadcrumbSeparator,
  Button
} from '@/components/ui'

export function ExamplePage() {
  return (
    <Page size="lg" as="main">
      <PageHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#/" icon="House">الرئيسية</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#/inventory">المخزون</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbCurrent>التفاصيل</BreadcrumbCurrent>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            <PageTitle>عنوان الصفحة</PageTitle>
            <PageSubtitle>وصف قصير</PageSubtitle>
          </div>
          <PageActions>
            <Button>حفظ</Button>
          </PageActions>
        </div>
      </PageHeader>
      <PageToolbar>{/* SearchBar · FilterBar · bulk */}</PageToolbar>
      <PageContent>{/* primary body — wrap ScrollArea if needed */}</PageContent>
      <PageFooter>{/* Pagination · totals · Save/Cancel */}</PageFooter>
    </Page>
  )
}
```

### Prop-driven PageHeader (still supported)

```tsx
<PageHeader
  title="عنوان"
  description="وصف"
  breadcrumbs={<Breadcrumb>…</Breadcrumb>}
  actions={<PageActions>…</PageActions>}
  toolbar={<PageToolbar>…</PageToolbar>}
/>
```

When `children` are passed to `PageHeader`, they win over `title` / `description` / `breadcrumbs` / `actions` for the header body. `toolbar` prop still renders below.

| Export | Role |
|---|---|
| `Page` | Surface + `size` (`md`/`lg`/`xl`/`full`) max-width + padding; `as` section\|main\|div; scroll-friendly flex column |
| `PageHeader` | Dual API — props or composition |
| `PageTitle` | Single `h1` per page |
| `PageSubtitle` | Supporting text under title |
| `PageActions` | End-aligned actions (`justify-end`, RTL-aware) |
| `PageToolbar` | Search / filters / bulk / view options (`role="toolbar"`) |
| `PageContent` | Primary region; optional `loading` / `empty` |
| `PageFooter` | Optional footer; `sticky` for pinned chrome |

**Scroll:** Prefer one scroll owner — usually the app shell or `ScrollArea` inside `PageContent`. Do not nest competing full-page scroll roots.

**Loading/empty:** `PageContent loading` uses `BusyIndicator`; `empty` accepts `EmptyState` (or any node). Do not fork DataTable/Panel loading APIs.

## Breadcrumb (module hierarchy — informational)

**Not primary navigation.** Sidebar remains the application navigator. Breadcrumbs only communicate location within the current module.

| Export | Notes |
|---|---|
| `Breadcrumb` / `List` / `Item` / `Link` / `Current` / `Separator` / `Ellipsis` | ARIA `nav` landmark |
| `buildBreadcrumbTrail` | Collapse helper for router-driven lists (`maxItems`) |

Typical trail: الرئيسية → وحدة → فرعي → الصفحة الحالية.

- Optional Home via first `BreadcrumbLink` (`icon="House"`).
- Custom separators via `BreadcrumbSeparator` children.
- Long paths: `BreadcrumbList truncate` and/or `buildBreadcrumbTrail({ maxItems })` + `BreadcrumbEllipsis`.
- Links: muted → gold hover; current: primary text (`BreadcrumbCurrent`).
- Compose router `Link` with `BreadcrumbLink asChild`.
- `BreadcrumbPage` is a deprecated alias of `BreadcrumbCurrent`.
- Features never import underlying libs for breadcrumbs.

## Layout primitives

| Export | Notes |
|---|---|
| `Container` | `size`: sm \| md \| lg \| xl \| full + horizontal padding |
| `Section` | Optional title + description + body gap |
| `Stack` | `direction` row/column; `gap` 0–8; `align` / `justify` |
| `Grid` | `cols` + `gap` (desktop-first) |
| `Card` | `default` \| `outlined` \| `elevated` \| `interactive` \| `highlighted` (gold top border only) |
| `Panel` | `title`, `subtitle`, `toolbar`, `actions`, `loading`, `empty` |
| `Divider` | Existing |
| `ScrollArea` | Existing Radix scrollbar (themed thumb) |

## Overlays (Radix Dialog)

| Export | Notes |
|---|---|
| `Dialog` (+ Header/Footer/Title/Description/Content/Trigger/Close) | Centered modal; ESC; focus trap; overlay |
| `Modal` | Alias of Dialog |
| `Drawer` | Default `side="right"`; sizes sm–full via `--drawer-*` tokens; close control at top-start in RTL |
| `Sheet` | Alias of Drawer |

### Drawer placement guidelines

- Default: **right** edge (logical `end` in LTR / physical end in RTL layout tokens via `end-0`).
- Prefer `sm`/`md` for detail editors; `lg`/`xl` for dense inspectors; `full` sparingly.
- Modal by default (Radix Dialog). Configure overlay dismiss via Root `onOpenChange` / `modal`.
- Do not use Drawer for ordinary short confirms — use `Dialog`.

## Disclosure / nav

### Tabs (page/panel workspace — not app chrome)

| Export | Package |
|---|---|
| `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` | `@radix-ui/react-tabs` |

- Local to a page or `Panel` — **do not** replace Sidebar / main navigation.
- Controlled (`value` + `onValueChange`) and uncontrolled (`defaultValue`).
- `TabsTrigger`: `icon`, `badge`, `disabled`; `closable` + `onClose` future-ready (off by default).
- `TabsContent`: `lazy` (default `true` = unmount inactive); `lazy={false}` keeps mounted via `forceMount`.
- Active tab: gold bottom border accent only. Features never import Radix Tabs.

Also: `Accordion`, `Collapsible` (Radix-wrapped).

## Resizable

```tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui'

<ResizablePanelGroup orientation="horizontal" autoSaveId="reports-split">
  <ResizablePanel defaultSize="40%" minSize="20%">…</ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize="60%" minSize="20%">…</ResizablePanel>
</ResizablePanelGroup>
```

### Usage guidelines

- Use for **reports**, **inventory browsers**, **media inspectors** — split views that benefit from user-tuned widths.
- Do **not** use Resizable for ordinary forms or single-column CRUD screens.
- Features never import `react-resizable-panels` directly.
- `autoSaveId` persists sizes in `localStorage` via `useDefaultLayout`.
- Handle shows gold accent while dragging (`data-separator=active`).

## Accessibility

- Prefer one `PageTitle` (`h1`) per page; use `Page as="main"` for the primary landmark when appropriate.
- `PageHeader` / `PageFooter` map to `header` / `footer`.
- `PageToolbar` exposes `role="toolbar"`.
- Breadcrumb: `nav` landmark + `aria-current="page"` on current item; links keyboard-focusable.
- Dialog / Drawer: focus trap, ESC (Radix).
- Tabs: arrow-key activation (Radix).
- Accordion / Collapsible: button semantics + Enter/Space.
- ResizableHandle: `role="separator"` with keyboard resize support from the library.

## Media contract (future — not in 2.4)

File/image upload UI will follow:

MediaClient → Electron Main → `POST /api/v1/media/files` → forms store **StoredFile UUID only**.

No MediaClient, IPC upload, or upload screens ship in Phase 2.4.

## DEV showcase

`#/dev/layout` — Page shell, Breadcrumb (Home / ellipsis), Toolbar, Footer, Cards, Dialog/Drawer, Tabs, Resizable.
