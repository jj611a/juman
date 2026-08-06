import json
import re
from pathlib import Path

transcript = Path(r"C:\Users\moham\.cursor\projects\c-Users-moham-Desktop-juman\agent-transcripts\9639e471-9f5d-437e-bfd6-396ce513dc8c\9639e471-9f5d-437e-bfd6-396ce513dc8c.jsonl")
lines = transcript.read_text(encoding="utf-8", errors="replace").splitlines()

def cmd_at(idx: int) -> str:
    obj = json.loads(lines[idx])
    for part in obj["message"]["content"]:
        if isinstance(part, dict) and (part.get("input") or {}).get("command"):
            return part["input"]["command"]
    raise KeyError(idx)

def extract_rstring_after(cmd: str, marker: str) -> str:
    i = cmd.find(marker)
    if i < 0:
        raise ValueError("marker missing " + marker)
    for quote in ("r'''", "'''", 'r"""', '"""'):
        q = cmd.find(quote, i)
        if q >= 0:
            start = q + len(quote)
            end = cmd.find(quote[-3:], start)
            if end > start:
                return cmd[start:end]
    m = re.search(r'\+ """(.*?)"""', cmd[i:], re.DOTALL)
    if m:
        return m.group(1)
    m = re.search(r"\+ '''(.*?)'''", cmd[i:], re.DOTALL)
    if m:
        return m.group(1)
    raise ValueError("no string")

parts = []
c497 = cmd_at(497)
d497 = extract_rstring_after(c497, "domainTypes.ts")
parts.append(d497.strip())
print("497", len(d497), "Category", "CategoryDto" in d497, "Dress", "DressDto" in d497)

c570 = cmd_at(570)
d570 = None
for marker in ("domainTypes.ts", "ReservationDto", "RentalDto"):
    try:
        d570 = extract_rstring_after(c570, marker)
        if "ReservationDto" in d570 or "RentalDto" in d570:
            break
    except Exception:
        d570 = None
print("570", None if d570 is None else len(d570))
if d570:
    parts.append(d570.strip())

c603 = cmd_at(603)
d603 = None
for marker in ("domainTypes.ts", "ReturnDto", "ProcessingBatchDto"):
    try:
        d603 = extract_rstring_after(c603, marker)
        if "ReturnDto" in d603:
            break
    except Exception:
        d603 = None
print("603", None if d603 is None else len(d603))
if d603:
    parts.append(d603.strip())

# Also try to find a later recovered full write in other transcripts
root = Path(r"C:\Users\moham\.cursor\projects\c-Users-moham-Desktop-juman\agent-transcripts")
best_full = None
best_len = 0
for jf in root.rglob("*.jsonl"):
    for line in jf.open(encoding="utf-8", errors="replace"):
        if "export interface CategoryDto" not in line or "export interface SaleDto" not in line:
            continue
        if "DashboardReportDto" not in line:
            continue
        # try extract large TS blob
        idx = line.find("export interface PaginationMeta")
        if idx < 0:
            idx = line.find("/** Shared domain")
        if idx < 0:
            continue
        # unescape
        chunk = line[idx:idx+50000]
        chunk = chunk.replace("\\n", "\n").replace("\\t", "\t").replace('\\"', '"')
        if "SaleDto" in chunk and "SettlementDto" in chunk and len(chunk) > best_len:
            best_len = len(chunk)
            best_full = chunk
            print("found fuller in", jf.name, best_len)

sale_block = r'''
export type SaleOriginCode = 'NORMAL_SALE' | 'MANDATORY_DAMAGE_PURCHASE'
export type SaleStatusCode = 'COMPLETED' | 'VOIDED'
export type PaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'

export interface SaleItemDto {
  id: string
  sale_id: string
  dress_id: string
  default_sale_price: number
  actual_sale_price: number
  inspection_item_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SalePaymentDto {
  id: string
  sale_id: string
  amount: number
  payment_method: PaymentMethodCode | string
  received_at: string
  received_by: string | null
  reference_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SaleDto {
  id: string
  sale_number: string
  origin: SaleOriginCode | string
  status: SaleStatusCode | string
  customer_id: string | null
  rental_id: string | null
  return_id: string | null
  inspection_id: string | null
  total_amount: number
  sold_at: string
  sold_by: string | null
  notes: string | null
  items: SaleItemDto[]
  payments: SalePaymentDto[]
  created_at: string
  updated_at: string
}

export interface SaleItemCreateInput {
  dress_id: string
  actual_sale_price?: number | null
  notes?: string | null
}

export interface SalePaymentCreateInput {
  amount: number
  payment_method: PaymentMethodCode | string
  reference_number?: string | null
  notes?: string | null
  received_at?: string | null
}

export interface SaleCreateBody {
  origin: SaleOriginCode | string
  customer_id?: string | null
  inspection_item_id?: string | null
  items: SaleItemCreateInput[]
  payment: SalePaymentCreateInput
  notes?: string | null
}

export interface SaleListParams {
  offset?: number
  limit?: number
  status?: string
  origin?: string
  customer_id?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}
'''

# Prefer reading from node_modules if it has good domainTypes - earlier it was also corrupted
# Use rebuilt parts + append sales/settlements/reports from a known good snapshot if we saved one
# Check agent tool results folder for recovered file

candidates = list(Path(r"C:\Users\moham\Desktop\juman").glob("**/*domainTypes*"))
for c in candidates:
    if "node_modules" in str(c):
        continue
    try:
        tt = c.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if "export interface CategoryDto" in tt and "export interface SaleDto" in tt and "export const apiClient" not in tt:
        print("CANDIDATE", c, len(tt))

if best_full and "export interface CategoryDto" in best_full:
    # trim at junk if any
    end = best_full.find("\\n---")
    if end > 0:
        best_full = best_full[:end]
    # stop at first non-TS after FinancialDaily
    # Keep until last export
    final = best_full
    # ensure ends cleanly
    if "export interface FinancialDailyReportDto" in final:
        # find end of that interface and keep rest of settlement/report if present
        pass
    Path(r"C:\Users\moham\Desktop\juman\.tmp_base_from_transcript.ts").write_text(final[: min(len(final), 120000)], encoding="utf-8", newline="\n")
    print("wrote transcript full snippet", min(len(final), 120000))

merged = "\n\n".join(parts)
if "SaleDto" not in merged:
    merged = merged.rstrip() + "\n" + sale_block

# If we still lack reports/settlements, we'll append from a generated block file next
Path(r"C:\Users\moham\Desktop\juman\.tmp_dt_partial.ts").write_text(merged, encoding="utf-8", newline="\n")
print("partial written", len(merged))
for n in ["CategoryDto","DressDto","RentalDto","ReturnDto","SaleDto","AuditLogDto","ListEnvelope"]:
    print(n, n in merged)
