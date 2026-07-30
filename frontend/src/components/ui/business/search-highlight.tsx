import * as React from 'react'
import { cn } from '@/utils/cn'

export interface SearchHighlightProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string
  query: string
}

/** Safe highlight — no HTML injection. */
export function SearchHighlight({
  text,
  query,
  className,
  ...props
}: SearchHighlightProps): React.ReactElement {
  const q = query.trim()
  if (!q) {
    return (
      <span className={className} {...props}>
        {text}
      </span>
    )
  }

  const parts: React.ReactNode[] = []
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  let cursor = 0
  let key = 0

  while (cursor < text.length) {
    const idx = lower.indexOf(needle, cursor)
    if (idx === -1) {
      parts.push(<React.Fragment key={key++}>{text.slice(cursor)}</React.Fragment>)
      break
    }
    if (idx > cursor) {
      parts.push(<React.Fragment key={key++}>{text.slice(cursor, idx)}</React.Fragment>)
    }
    parts.push(
      <mark key={key++} className="rounded-sm bg-brand-subtle text-brand">
        {text.slice(idx, idx + needle.length)}
      </mark>
    )
    cursor = idx + needle.length
  }

  return (
    <span className={cn(className)} {...props}>
      {parts}
    </span>
  )
}
