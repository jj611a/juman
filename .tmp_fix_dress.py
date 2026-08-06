import json, re
from pathlib import Path

transcript = Path(r"C:\Users\moham\.cursor\projects\c-Users-moham-Desktop-juman\agent-transcripts\9639e471-9f5d-437e-bfd6-396ce513dc8c\9639e471-9f5d-437e-bfd6-396ce513dc8c.jsonl")
lines = transcript.read_text(encoding="utf-8").splitlines()
obj = json.loads(lines[497])
cmd = None
for part in obj["message"]["content"]:
    if isinstance(part, dict) and part.get("input", {}).get("command"):
        cmd = part["input"]["command"]
print("cmd len", len(cmd))
print("DressDto count", cmd.count("DressDto"))
print("Shared count", cmd.count("Shared domain"))
# find all r''' positions
idxs = [m.start() for m in re.finditer(r"r'''", cmd)]
print("r''' count", len(idxs), idxs[:10])
for i, start in enumerate(idxs):
    end = cmd.find("'''", start + 4)
    blob = cmd[start+4:end]
    print(i, "len", len(blob), "Category", "CategoryDto" in blob, "Dress", "DressDto" in blob, "head", blob[:50].replace("\n"," "))
    if "DressDto" in blob and "CategoryDto" in blob:
        Path(r"C:\Users\moham\Desktop\juman\.tmp_dress_base.ts").write_text(blob, encoding="utf-8", newline="\n")
        print("WROTE dress base")
