import json, re
from pathlib import Path

transcript = Path(r"C:\Users\moham\.cursor\projects\c-Users-moham-Desktop-juman\agent-transcripts\9639e471-9f5d-437e-bfd6-396ce513dc8c\9639e471-9f5d-437e-bfd6-396ce513dc8c.jsonl")
lines = transcript.read_text(encoding="utf-8").splitlines()
obj = json.loads(lines[497])
cmd = None
for part in obj["message"]["content"]:
    if isinstance(part, dict) and isinstance(part.get("input"), dict) and "command" in part["input"]:
        cmd = part["input"]["command"]
        break
idxs = [m.start() for m in re.finditer(r"r'''", cmd)]
start = idxs[0] + 4
end = cmd.find("'''", start)
dress_blob = cmd[start:end].strip()
print("len", len(dress_blob), "Dress", "DressDto" in dress_blob, "Cal", "CalendarBlockDto" in dress_blob)

dt = Path(r"C:\Users\moham\Desktop\juman\frontend\src\services\domainTypes.ts")
text = dt.read_text(encoding="utf-8")
if "export interface DressDto" not in text:
    for anchor_name in ("export interface ReservationDto", "export interface RentalDto", "export type SaleOriginCode"):
        anchor = text.find(anchor_name)
        if anchor >= 0:
            text = text[:anchor] + dress_blob + "\n\n" + text[anchor:]
            dt.write_text(text, encoding="utf-8", newline="\n")
            print("inserted before", anchor_name)
            break
else:
    print("DressDto already present")

text = dt.read_text(encoding="utf-8")
print("DressDto", "export interface DressDto" in text)
print("CalendarBlockDto", "export interface CalendarBlockDto" in text)
print("CategoryDto", "export interface CategoryDto" in text)
print("UserDto", "export interface UserDto" in text)
