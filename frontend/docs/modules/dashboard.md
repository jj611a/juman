# Operations Dashboard

Home route `/` after login (`OpsDashboardPage`).

## Data sources (no invented KPIs)

| Section | API / store | Permission |
|---|---|---|
| KPIs + Today work | `GET /reports/dashboard` via `useDashboardReport` | `reports.view` |
| Header company | `settings.get('company_name')` | `settings.view` |
| Connection | `system.health` | always (authenticated) |
| System status | health + version + backups list | `system.view` / `system.backup` |
| Recent activity | `audit.listLogs` limit 10 | `audit.view` |
| Quick actions | route links only | create/view perms per action |

Omitted (not on `DashboardReportDto`): returns due today, open settlements, revenue today.

## Layout

RTL three-column grid on `lg`: KPIs+Today | Actions+Activity | System.

Sections lazy-loaded with `React.lazy` + `Suspense`.

## Related

- Reports module still has `/reports/dashboard` (`DashboardReportPage`) as a report view.
- Shell nav `الرئيسية` → `/`.
