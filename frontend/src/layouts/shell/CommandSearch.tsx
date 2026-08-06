import { useId, useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useFilteredNav } from '@/navigation/useFilteredNav'
import { Clock } from 'lucide-react'

interface RecentSearchItem {
  id: string
  label: string
  to: string
  phase: string
}

export function CommandSearch({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const dialogRefId = useId()
  const [q, setQ] = useState('')
  const { allVisible } = useFilteredNav()
  const navigate = useNavigate()
  const [recents, setRecents] = useState<RecentSearchItem[]>([])

  // Load recent searches from localStorage on mount/open
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem('juman_recent_searches')
        if (stored) {
          setRecents(JSON.parse(stored) as RecentSearchItem[])
        }
      } catch {
        setRecents([])
      }
    }
  }, [open])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return allVisible.filter(
      (item) =>
        item.label.includes(q.trim()) ||
        item.keywords?.some((k) => k.toLowerCase().includes(needle)) ||
        item.to.includes(needle),
    )
  }, [allVisible, q])

  const saveRecent = (item: RecentSearchItem) => {
    const updated = [item, ...recents.filter((r) => r.to !== item.to)].slice(0, 5)
    setRecents(updated)
    localStorage.setItem('juman_recent_searches', JSON.stringify(updated))
  }

  if (!open) return null

  return (
    <dialog className="modal modal-open select-none" aria-labelledby={dialogRefId} dir="rtl">
      <div className="modal-box max-w-lg border border-base-content/10 bg-base-200 p-0 shadow-2xl">
        <div className="border-b border-base-content/10 p-3">
          <label className="input input-bordered flex w-full items-center gap-2">
            <span className="opacity-50">⌕</span>
            <input
              autoFocus
              className="grow"
              placeholder="بحث في الوحدات…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter' && results[0]) {
                  const matched = results[0]
                  saveRecent({ id: matched.id, label: matched.label, to: matched.to, phase: matched.phase })
                  navigate(matched.to)
                  onClose()
                }
              }}
            />
            <kbd className="kbd kbd-sm">Esc</kbd>
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {/* Query Results */}
          {q.trim() && (
            <ul className="menu w-full p-0">
              <li className="menu-title" id={dialogRefId}>
                نتائج البحث
              </li>
              {results.length === 0 ? (
                <li className="disabled">
                  <span className="text-xs text-base-content/40">لا توجد نتائج مطابقة</span>
                </li>
              ) : (
                results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        saveRecent({ id: item.id, label: item.label, to: item.to, phase: item.phase })
                        navigate(item.to)
                        onClose()
                      }}
                    >
                      <span className="font-semibold text-xs">{item.label}</span>
                      <span className="badge badge-ghost badge-xs opacity-50">{item.phase}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}

          {/* Recent Searches */}
          {!q.trim() && (
            <ul className="menu w-full p-0">
              <li className="menu-title flex items-center gap-1">
                <Clock size={12} />
                البحوث الأخيرة
              </li>
              {recents.length === 0 ? (
                <li className="disabled">
                  <span className="text-xs text-base-content/40 italic">لا توجد عمليات بحث أخيرة</span>
                </li>
              ) : (
                recents.map((item) => (
                  <li key={item.to}>
                    <button
                      type="button"
                      onClick={() => {
                        saveRecent(item)
                        navigate(item.to)
                        onClose()
                      }}
                    >
                      <span className="text-xs">{item.label}</span>
                      <span className="badge badge-ghost badge-xs opacity-50">{item.phase}</span>
                    </button>
                  </li>
                ))
              )}

              {/* Default Quick Navigation (if no search query and no recents) */}
              {recents.length === 0 && (
                <>
                  <li className="menu-title mt-2">الانتقال السريع</li>
                  {allVisible.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          saveRecent({ id: item.id, label: item.label, to: item.to, phase: item.phase })
                          navigate(item.to)
                          onClose()
                        }}
                      >
                        <span className="text-xs">{item.label}</span>
                        <span className="badge badge-ghost badge-xs opacity-50">{item.phase}</span>
                      </button>
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}
