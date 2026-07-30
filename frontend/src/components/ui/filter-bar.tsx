import * as React from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select'
import { NumberInput } from '@/components/ui/number-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { TextInput } from '@/components/ui/text-input'
import type { DataColumnFilter } from '@/components/ui/data-table/types'
import { cn } from '@/utils/cn'

export type FilterFieldType = 'text' | 'number' | 'date' | 'select' | 'multiSelect' | 'boolean'

export interface FilterFieldOption {
  value: string
  label: string
}

export interface FilterFieldDef {
  id: string
  label: string
  type: FilterFieldType
  options?: FilterFieldOption[]
  placeholder?: string
}

export interface FilterBarProps {
  fields: FilterFieldDef[]
  value: DataColumnFilter[]
  onChange: (next: DataColumnFilter[]) => void
  className?: string
}

function getFilterValue(filters: DataColumnFilter[], id: string): DataColumnFilter['value'] | undefined {
  return filters.find((f) => f.id === id)?.value
}

function upsert(
  filters: DataColumnFilter[],
  id: string,
  value: DataColumnFilter['value'] | undefined | null
): DataColumnFilter[] {
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  const without = filters.filter((f) => f.id !== id)
  if (empty) return without
  return [...without, { id, value }]
}

/** Parse FilterBar ISO date (`YYYY-MM-DD`) for DatePicker display. */
function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function toIsoDate(d: Date | null): string | undefined {
  if (!d) return undefined
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function FilterBar({ fields, value, onChange, className }: FilterBarProps): React.ReactElement {
  return (
    <div
      className={cn('flex flex-wrap items-end gap-3', className)}
      role="search"
      aria-label="شريط التصفية"
    >
      {fields.map((field) => {
        const current = getFilterValue(value, field.id)
        return (
          <div key={field.id} className="flex min-w-40 flex-col gap-1.5">
            <Label htmlFor={`filter-${field.id}`}>{field.label}</Label>
            {field.type === 'text' ? (
              <TextInput
                id={`filter-${field.id}`}
                value={typeof current === 'string' ? current : ''}
                placeholder={field.placeholder}
                onChange={(e) => onChange(upsert(value, field.id, e.target.value))}
              />
            ) : null}
            {field.type === 'number' ? (
              <NumberInput
                id={`filter-${field.id}`}
                value={current == null || current === '' ? '' : String(current)}
                placeholder={field.placeholder}
                onChange={(e) => {
                  const raw = e.target.value
                  onChange(upsert(value, field.id, raw === '' ? '' : Number(raw)))
                }}
              />
            ) : null}
            {field.type === 'date' ? (
              <DatePicker
                id={`filter-${field.id}`}
                aria-label={field.label}
                value={parseIsoDate(current)}
                onChange={(d) => onChange(upsert(value, field.id, toIsoDate(d)))}
              />
            ) : null}
            {field.type === 'select' ? (
              <Select
                value={typeof current === 'string' ? current : undefined}
                onValueChange={(v) => onChange(upsert(value, field.id, v))}
              >
                <SelectTrigger id={`filter-${field.id}`} aria-label={field.label}>
                  <SelectValue placeholder={field.placeholder ?? 'اختر'} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {field.type === 'multiSelect' ? (
              <MultiSelect
                options={(field.options ?? []) as MultiSelectOption[]}
                value={Array.isArray(current) ? (current as string[]) : []}
                onChange={(next) => onChange(upsert(value, field.id, next))}
                placeholder={field.placeholder ?? 'اختر'}
                aria-label={field.label}
              />
            ) : null}
            {field.type === 'boolean' ? (
              <div className="flex h-10 items-center gap-2">
                <Checkbox
                  id={`filter-${field.id}`}
                  checked={current === true}
                  onCheckedChange={(checked) =>
                    onChange(upsert(value, field.id, checked === true ? true : undefined))
                  }
                />
                <Label htmlFor={`filter-${field.id}`} className="font-normal">
                  {field.placeholder ?? 'نعم'}
                </Label>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
