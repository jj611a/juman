from pathlib import Path

# Use reports/settlements extract + rebuild core from known good structures in features
# Prefer extracting CategoryDto..Processing from current CORRUPTED domainTypes if embedded after apiClient

corrupted = Path(r"C:\Users\moham\Desktop\juman\frontend\src\services\domainTypes.ts").read_text(encoding="utf-8")
reports = Path(r"C:\Users\moham\Desktop\juman\.tmp_reports_settlements.ts").read_text(encoding="utf-8")

# Find where types start in corrupted (after apiClient object ends)
# Look for first "export interface CategoryDto" OR first settlement after desktop block
idx_cat = corrupted.find("export interface CategoryDto")
idx_stl = corrupted.find("export interface SettlementChargeDto")
idx_pag = corrupted.find("export interface PaginationMeta")
print("cat", idx_cat, "stl", idx_stl, "pag", idx_pag)

# Also search transcript line 397 for clean categories base (smaller)
import json, re
transcript = Path(r"C:\Users\moham\.cursor\projects\c-Users-moham-Desktop-juman\agent-transcripts\9639e471-9f5d-437e-bfd6-396ce513dc8c\9639e471-9f5d-437e-bfd6-396ce513dc8c.jsonl")
lines = transcript.read_text(encoding="utf-8").splitlines()

def get_cmd(i):
    obj = json.loads(lines[i])
    for part in obj["message"]["content"]:
        if isinstance(part, dict) and part.get("input", {}).get("command"):
            return part["input"]["command"]
    return ""

def extract_between(cmd, start_marker, end_marker=None):
    s = cmd.find(start_marker)
    if s < 0:
        return None
    # start at Shared or Pagination
    for q in ("r'''", "'''"):
        qs = cmd.find(q, s - 50 if s > 50 else 0)
        if qs >= 0 and qs < s + 20:
            start = qs + len(q)
            end = cmd.find(q[-3:], start)
            return cmd[start:end]
    return None

base = None
for i in (397, 497):
    cmd = get_cmd(i)
    # Find Shared domain DTO content
    m = re.search(r"/\*\* Shared domain DTO shapes.*?\*/\r?\n\r?\n(.*)", cmd, re.DOTALL)
    if not m:
        continue
    # take until ''' 
    blob = m.group(0)
    # The command uses r''' ... '''
    a = cmd.find("/** Shared domain DTO")
    if a < 0:
        continue
    b = cmd.find("'''", a + 10)
    if b < 0:
        continue
    base = cmd[a:b]
    print("base from line", i, len(base), "Category", "CategoryDto" in base, "Dress", "DressDto" in base, "starts", base[:40])
    if "DressDto" in base:
        break

if not base or "CategoryDto" not in base:
    raise SystemExit("failed to get base")

# Appends from 570 and 603
def extract_append(line_idx, needle):
    cmd = get_cmd(line_idx)
    # pattern: text = text.rstrip() + """..."""
    for pat in [r'\+ """(.*?)"""', r"\+ '''(.*?)'''", r'rstrip\(\) \+ """(.*?)"""']:
        m = re.search(pat, cmd, re.DOTALL)
        if m and needle in m.group(1):
            return m.group(1)
    # or write_text with r'''
    a = cmd.find(needle)
    if a < 0:
        return None
    # find nearest opening quote before needle
    for q in ('"""', "'''"):
        qs = cmd.rfind(q, 0, a)
        if qs >= 0:
            qe = cmd.find(q, a)
            if qe > qs:
                return cmd[qs+len(q):qe]
    return None

a570 = extract_append(570, "ReservationDto")
a603 = extract_append(603, "ReturnDto")
print("570", None if not a570 else len(a570))
print("603", None if not a603 else len(a603))

sale = Path(r"C:\Users\moham\Desktop\juman\.tmp_dt_partial.ts").read_text(encoding="utf-8")
# extract sale types only from end of partial
si = sale.find("export type SaleOriginCode")
sale_block = sale[si:] if si >= 0 else ""

admin = r'''
// --- Admin / Identity / RBAC / Settings / System ---

export interface ItemsEnvelope<T> {
  success: boolean
  total: number
  items: T[]
}

export interface UserDto {
  id: string
  username: string
  full_name: string
  phone: string | null
  email: string | null
  role_id: string
  is_active: boolean
  is_locked: boolean
  must_change_password: boolean
  failed_login_attempts: number
  last_login_at: string | null
  password_changed_at: string | null
  created_at: string
  updated_at: string
}

export interface UserCreateBody {
  username: string
  password: string
  full_name: string
  role_id: string
  phone?: string | null
  email?: string | null
  must_change_password?: boolean
}

export interface UserUpdateBody {
  full_name?: string | null
  phone?: string | null
  email?: string | null
  role_id?: string | null
}

export interface UserListParams {
  offset?: number
  limit?: number
}

export interface AdminResetPasswordBody {
  user_id: string
  new_password: string
}

export interface LoginHistoryDto {
  id: string
  user_id: string | null
  username: string | null
  success: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: string
  [key: string]: unknown
}

export interface LoginHistoryListParams {
  offset?: number
  limit?: number
  user_id?: string
  username?: string
  success?: boolean
}

export interface PermissionDto {
  id: string
  key: string
  display_name: string
  description: string | null
  module: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface PermissionCreateBody {
  key: string
  display_name: string
  description?: string | null
  module?: string | null
}

export interface PermissionUpdateBody {
  display_name?: string | null
  description?: string | null
  module?: string | null
}

export interface RoleDto {
  id: string
  name: string
  description: string | null
  is_system: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  permissions: PermissionDto[]
}

export interface RoleCreateBody {
  name: string
  description?: string | null
  is_active?: boolean
  permission_keys?: string[]
}

export interface RoleUpdateBody {
  name?: string | null
  description?: string | null
  is_active?: boolean
}

export interface RolePermissionsAssignBody {
  permission_keys: string[]
}

export type SettingCategory =
  | 'company'
  | 'financial'
  | 'processing'
  | 'inventory'
  | 'customers'
  | 'reservations'
  | 'sales'
  | 'rentals'
  | 'returns'
  | 'inspection'
  | 'system'

export interface SettingDto {
  id: string
  key: string
  value: string
  parsed_value: unknown
  value_type: string
  category: SettingCategory | string
  description: string | null
  is_editable: boolean
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface SettingUpdateBody {
  value: string
  description?: string | null
}

export interface SettingValueBody {
  value: string
}

export interface HealthDto {
  status: string
  database: string
  redis: string
  app?: string
  environment?: string
  version?: string
  [key: string]: unknown
}

export interface VersionDto {
  name: string
  name_ar: string
  version: string
  api: string
  environment: string
}

export interface SystemInfoDto {
  [key: string]: unknown
}

export interface SystemDiagnosticsDto {
  status?: string
  overall?: string
  checks?: Record<string, unknown>
  [key: string]: unknown
}

export interface SystemMetricsDto {
  [key: string]: unknown
}

export interface MaintenanceTaskDto {
  key: string
  name?: string
  description?: string | null
  [key: string]: unknown
}

export interface MaintenanceExecuteBody {
  confirm?: boolean
  dry_run?: boolean
}

export interface MaintenanceRunDto {
  id: string
  task_key: string
  status: string
  started_at?: string | null
  finished_at?: string | null
  [key: string]: unknown
}

export interface MaintenanceHistoryParams {
  offset?: number
  limit?: number
  task_key?: string
  status?: string
  executed_by_user_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface SystemBackupDto {
  id: string
  filename?: string
  status: string
  compressed_size_bytes?: number | null
  checksum_sha256?: string | null
  include_media?: boolean
  notes?: string | null
  created_at: string
  [key: string]: unknown
}

export interface SystemBackupCreateBody {
  include_media?: boolean
  notes?: string | null
}

export interface SystemBackupListParams {
  offset?: number
  limit?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface RestoreValidateBody {
  backup_id?: string | null
  expected_checksum?: string | null
}

export interface RestoreExecuteBody {
  confirm: boolean
  confirm_checksum: string
  backup_id?: string | null
  notes?: string | null
}

export interface RestoreHistoryDto {
  id: string
  status: string
  started_at?: string | null
  finished_at?: string | null
  [key: string]: unknown
}

export interface RestoreHistoryParams {
  offset?: number
  limit?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}
'''

# Ensure envelope + audit types exist in base
envelope = r'''
export interface PaginationMeta {
  offset: number
  limit: number
  total: number
}

export interface ListEnvelope<T> {
  success: boolean
  data: T[]
  meta: PaginationMeta
}

export interface ItemEnvelope<T> {
  success: boolean
  data: T
}

export interface MessageEnvelope {
  success: boolean
  message?: string
}

export interface PageListEnvelope<T> {
  success: boolean
  data: T[]
  meta: { page: number; page_size: number; total: number; [key: string]: unknown }
}

export interface AuditLogDto {
  id: string
  module: string
  entity_type: string
  entity_id: string | null
  action: string
  old_values: unknown
  new_values: unknown
  user_id: string | null
  username: string | null
  ip_address: string | null
  metadata: unknown
  message: string | null
  created_at: string
}

export interface AuditLogListParams {
  offset?: number
  limit?: number
  module?: string
  entity_type?: string
  entity_id?: string
  action?: string
  user_id?: string
  username?: string
  q?: string
  created_from?: string
  created_to?: string
}
'''

# Strip envelope from base if duplicated later
core = base
# If base already has PaginationMeta, skip adding envelope at top - check
if "export interface ListEnvelope" not in core:
    # insert after header comment
    if core.startswith("/**"):
        endc = core.find("*/")
        core = core[: endc + 2] + "\n\n" + envelope + core[endc + 2 :]
    else:
        core = envelope + "\n" + core

chunks = [core]
if a570:
    chunks.append(a570.strip())
if a603:
    chunks.append(a603.strip())
if sale_block:
    chunks.append(sale_block.strip())
chunks.append(reports.strip())
chunks.append(admin.strip())

merged = "\n\n".join(chunks) + "\n"

# Deduplicate PaginationMeta / ListEnvelope / AuditLogDto - keep first
def dedupe_exports(text: str, names: list[str]) -> str:
    for name in names:
        pattern = f"export interface {name}"
        first = text.find(pattern)
        if first < 0:
            continue
        while True:
            second = text.find(pattern, first + 1)
            if second < 0:
                break
            # skip interface block
            depth = 0
            i = second
            started = False
            while i < len(text):
                if text[i] == "{":
                    depth += 1
                    started = True
                elif text[i] == "}":
                    depth -= 1
                    if started and depth <= 0:
                        i += 1
                        # skip trailing newline
                        if i < len(text) and text[i] == "\n":
                            i += 1
                        break
                i += 1
            text = text[:second] + text[i:]
    return text

merged = dedupe_exports(
    merged,
    [
        "PaginationMeta",
        "ListEnvelope",
        "ItemEnvelope",
        "MessageEnvelope",
        "PageListEnvelope",
        "AuditLogDto",
        "AuditLogListParams",
        "SettlementDto",
        "SettlementChargeDto",
        "SettlementPaymentDto",
        "SettlementAdjustmentDto",
        "SettlementListParams",
        "SettlementCreateBody",
        "SettlementPaymentCreateBody",
        "SettlementAdjustmentCreateBody",
    ],
)

out = Path(r"C:\Users\moham\Desktop\juman\frontend\src\services\domainTypes.ts")
out.write_text(merged, encoding="utf-8", newline="\n")
print("WROTE", out, "len", len(merged))
for n in [
    "CategoryDto",
    "DressDto",
    "RentalDto",
    "ReturnDto",
    "SaleDto",
    "SettlementDto",
    "DashboardReportDto",
    "UserDto",
    "RoleDto",
    "SettingDto",
    "SystemBackupDto",
    "ListEnvelope",
    "AuditLogDto",
    "apiClient",
]:
    print(n, ("BAD" if n == "apiClient" else "") , n in merged if n != "apiClient" else ("export const apiClient" in merged))
