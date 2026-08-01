"""One-shot generator for Sales application layer (UTF-8 safe on Windows)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FILES: dict[str, str] = {}


def main() -> None:
    for rel, content in FILES.items():
        path = ROOT / rel.replace("/", "\\") if "\\" not in rel else ROOT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")
        print(f"Wrote {rel}")


if __name__ == "__main__":
    main()
