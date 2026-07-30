# Juman Operator Manual — v1.0.0

Day-to-day store operations for جمان. Canonical install/service procedures live under `deployment/`; this manual focuses on product use.

## Audience

Cashiers, floor supervisors, and store managers using the desktop client after a successful install.

## Start of day

1. Confirm the PC is on and you can open **Juman** from Desktop or Start Menu.
2. If login fails with connection errors, ask an administrator to check PostgreSQL and `JumanApi` services (see Administrator Manual).
3. Sign in with your username/password. Change password when prompted on first use.

## Core workflows

| Task | Where |
|------|-------|
| Ops overview | Home `/` (Ops Dashboard) |
| Categories | Categories module |
| Customers | Customers |
| Dresses / inventory | Inventory |
| Availability | Calendar |
| Reservations | Reservations |
| Checkout / rentals | Rentals |
| Returns | Returns |
| Inspection / processing | Inspection, Processing |
| Sales | Sales |
| Settlements / payments | Settlements |
| Reports | Reports |

Follow on-screen Arabic labels; required fields show validation messages before save.

## Hardware (station)

1. Open **Hardware** settings and **Hardware diagnostics**.
2. Scan a barcode into a scanner field (or type manually).
3. Test USB or network receipt print; open cash drawer if configured.
4. Capture photos where the form offers camera capture.

If a device fails, record the model and diagnostic row; escalate to admin — do not invent workarounds that bypass permissions.

## Backup awareness

Operators typically do **not** run restore. Creating a backup may be available under System Administration if your role allows it. Prefer admin-owned backup schedules.

## Sign-out

Use the user menu → **تسجيل الخروج**. Do not leave an unlocked session unattended.

## Known «قريبًا» items

Search, command palette, notifications bell, company switcher, and some exports are intentionally deferred. They are not defects for v1.0.0.

## Help

- Version: user menu → **حول جمان**
- Installation / repair: Administrator Manual + `deployment/` guides