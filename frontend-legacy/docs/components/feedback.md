# Feedback components (Phase 2.6)

Reusable feedback kit. Import from `@/components/ui`. Features never import `@radix-ui/react-toast`.

## When to use what

| Need | Component |
|---|---|
| Transient global notice | `toast` / `ToastProvider` |
| Persistent in-page banner | `Alert` |
| Compact field/section hint | `InlineMessage` |
| Destructive / irreversible confirm | `ConfirmationDialog` (`tone="danger"`) |
| Blocking wait (page or panel) | `LoadingOverlay` / `ProgressOverlay` |
| Non-blocking inline wait | `BusyIndicator` |
| Placeholder while loading structure | `Skeleton` (+ compounds) |
| No data | `EmptyState` (also pass into `Panel`/`DataTable` `empty`) |
| Failed load / recoverable error UI | `ErrorState` (not a replacement for app `ErrorBoundary`) |

Do **not** fork DataTable/Panel loading — keep using their `loading` props; use overlays for route/page/container chrome.

## Toast / notification service

Mount `ToastProvider` once near the app root (already in [`AppProviders`](../../src/app/providers.tsx)). Features **never** mount toast containers.

```tsx
import { toast, notification } from '@/components/ui'

toast.success('تم الحفظ')
toast.error('فشل', { description: '…', duration: 8000 })
toast.info('تراجع؟', { action: { label: 'تراجع', onClick: () => undefined } })

// Alias — same singleton store
notification.warning('تحذير')
```

- Primary API: **`toast`**. **`notification` ≡ `toast`** (exported alias for checklist / service naming).
- Max **3** visible; overflow queues.
- Position: **bottom-start** (RTL logical).
- Manual dismiss + auto-dismiss (default 5s).

## ConfirmationDialog

Composes `Dialog`. Esc cancels. Enter confirms (unless focus is on cancel or `loading`). Danger mode autofocuses cancel.

```tsx
<ConfirmationDialog
  open={open}
  onOpenChange={setOpen}
  title="حذف؟"
  description="…"
  tone="danger"
  loading={busy}
  onConfirm={async () => { … }}
/>
```

## LoadingOverlay / ProgressOverlay / BusyIndicator

- `variant="fullscreen" | "container"` (container needs `position: relative` parent).
- `transparent` softens backdrop.
- **Indeterminate wait** → `LoadingOverlay` (+ optional `message`).
- **Determinate progress** → `ProgressOverlay` (required `value` 0–100). Split is intentional — do not fork a progress prop onto LoadingOverlay.
- Non-blocking inline wait → `BusyIndicator`.

## Skeleton

`variant`: text | card | table | avatar | list | image — plus `SkeletonText`, `SkeletonCard`, `SkeletonTable`, `SkeletonList`.

## EmptyState / ErrorState

- `ErrorState.details` renders **only** when `import.meta.env.DEV`.
- Optional `errorCode`, `onRetry`.

## Accessibility

- Toast / Busy / overlays: live regions (`polite`; toast errors use foreground type).
- Alert: `role="alert"`; danger uses assertive live.
- InlineMessage: `role="status"` + `aria-live` (`polite`; `assertive` for `error`).
- Confirmation: Radix focus trap; tested Esc/Enter; Enter ignored while `loading`.

## DEV showcase

`#/dev/feedback`
