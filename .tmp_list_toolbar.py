# -*- coding: utf-8 -*-
"""Horizontal Search+Filter toolbars on common list pages (density polish)."""
from pathlib import Path

# Categories, Customers — simple SearchBar + FilterBar stack
pages = {
    Path(r"C:\Users\moham\Desktop\juman\frontend\src\features\categories\pages\CategoriesListPage.tsx"): (
        """        toolbar={
          <div className="flex w-full flex-col gap-3">
            <SearchBar value={q} onValueChange={setQ} placeholder="بحث في الفئات…" />
            <FilterBar fields={FILTER_FIELDS} value={filters} onChange={setFilters} />
          </div>
        }""",
        """        toolbar={
          <div className="flex w-full flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <SearchBar value={q} onValueChange={setQ} placeholder="بحث في الفئات…" />
            </div>
            <FilterBar fields={FILTER_FIELDS} value={filters} onChange={setFilters} />
          </div>
        }""",
    ),
}

# Customers - need to read first for exact string
cust = Path(r"C:\Users\moham\Desktop\juman\frontend\src\features\customers\pages\CustomersListPage.tsx")
ct = cust.read_text(encoding="utf-8")
old_c = """        toolbar={
          <div className="flex w-full flex-col gap-3">
            <SearchBar value={q} onValueChange={setQ} placeholder="بحث في العملاء…" />
            <FilterBar fields={FILTER_FIELDS} value={filters} onChange={setFilters} />
          </div>
        }"""
new_c = """        toolbar={
          <div className="flex w-full flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <SearchBar value={q} onValueChange={setQ} placeholder="بحث في العملاء…" />
            </div>
            <FilterBar fields={FILTER_FIELDS} value={filters} onChange={setFilters} />
          </div>
        }"""
if old_c in ct:
    cust.write_text(ct.replace(old_c, new_c), encoding="utf-8", newline="\n")
    print("customers ok")
else:
    print("customers pattern miss")

for path, (old, new) in pages.items():
    t = path.read_text(encoding="utf-8")
    if old not in t:
        print("miss", path.name)
        continue
    path.write_text(t.replace(old, new), encoding="utf-8", newline="\n")
    print("ok", path.name)
