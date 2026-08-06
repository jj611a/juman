import * as React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui'
import type { CalendarBlockDto } from '@/services/domainTypes'
import { BLOCK_TYPE_LABELS, blockClass } from '../blockColors'
import {
  eachDay,
  overlapsDay,
  type CalendarViewMode
} from '../dateRange'
import { cn } from '@/utils/cn'

const WEEKDAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function DressTimelineGrid({
  mode,
  from,
  to,
  blocks,
  onBlockClick
}: {
  mode: CalendarViewMode
  from: Date
  to: Date
  blocks: CalendarBlockDto[]
  onBlockClick: (block: CalendarBlockDto) => void
}): React.ReactElement {
  const days = eachDay(from, to)

  if (mode === 'day') {
    const day = days[0]
    const dayBlocks = day
      ? blocks.filter((b) => overlapsDay(b.start_at, b.end_at, day))
      : []
    return (
      <div className="space-y-2">
        <p className="text-caption text-muted-foreground">
          {day?.toLocaleDateString('ar-IQ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
        <BlockList blocks={dayBlocks} onBlockClick={onBlockClick} />
      </div>
    )
  }

  if (mode === 'week') {
    return (
      <div className="grid grid-cols-7 gap-2" dir="rtl">
        {days.map((day) => {
          const dayBlocks = blocks.filter((b) => overlapsDay(b.start_at, b.end_at, day))
          return (
            <div key={day.toISOString()} className="min-h-40 rounded-md border border-border p-2">
              <div className="mb-2 text-caption font-medium">
                {WEEKDAYS[day.getDay()]} {day.getDate()}
              </div>
              <BlockList blocks={dayBlocks} onBlockClick={onBlockClick} compact />
            </div>
          )
        })}
      </div>
    )
  }

  // month
  return (
    <div className="grid grid-cols-7 gap-1" dir="rtl">
      {WEEKDAYS.map((d) => (
        <div key={d} className="p-2 text-center text-caption text-muted-foreground">
          {d}
        </div>
      ))}
      {days.map((day) => {
        const inMonth = day.getMonth() === new Date(from.getTime() + 15 * 86400000).getMonth()
        const dayBlocks = blocks.filter((b) => overlapsDay(b.start_at, b.end_at, day))
        return (
          <div
            key={day.toISOString()}
            className={cn(
              'min-h-24 rounded-md border border-border/60 p-1.5',
              !inMonth && 'opacity-40'
            )}
          >
            <div className="mb-1 text-caption">{day.getDate()}</div>
            <BlockList blocks={dayBlocks} onBlockClick={onBlockClick} compact />
          </div>
        )
      })}
    </div>
  )
}

function BlockList({
  blocks,
  onBlockClick,
  compact
}: {
  blocks: CalendarBlockDto[]
  onBlockClick: (b: CalendarBlockDto) => void
  compact?: boolean
}): React.ReactElement {
  if (blocks.length === 0) {
    return <p className="text-caption text-muted-foreground">{compact ? '' : 'لا كتل'}</p>
  }
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        {blocks.map((b) => (
          <Tooltip key={b.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full truncate rounded border px-1.5 py-0.5 text-start text-caption',
                  blockClass(b.block_type)
                )}
                onClick={() => onBlockClick(b)}
              >
                {BLOCK_TYPE_LABELS[b.block_type] ?? b.block_type}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs space-y-1">
              <p>{BLOCK_TYPE_LABELS[b.block_type] ?? b.block_type}</p>
              <p dir="ltr" className="text-caption">
                {new Date(b.start_at).toLocaleString('ar-IQ')} →{' '}
                {new Date(b.end_at).toLocaleString('ar-IQ')}
              </p>
              {b.reference_module || b.reference_id ? (
                <p dir="ltr" className="text-caption">
                  {b.reference_module}/{b.reference_id}
                </p>
              ) : null}
              {b.notes ? <p>{b.notes}</p> : null}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
