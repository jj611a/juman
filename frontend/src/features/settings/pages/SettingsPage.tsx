import * as React from 'react'
import { Navigate } from 'react-router'
import {
  BusyIndicator,
  Button,
  Card,
  CardContent,
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  InlineMessage,
  Label,
  NumberInput,
  Page,
  PageActions,
  PageHeader,
  SearchBar,
  Section,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TextInput
} from '@/components/ui'
import { usePermission } from '@/hooks/usePermission'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import { toAppError } from '@/lib/errors/appError'
import type { SettingCategory, SettingDto } from '@/services/domainTypes'
import { useSaveSettingValues, useSettingsList } from '../hooks'
import {
  groupSystemSettings,
  SETTING_CATEGORIES,
  SYSTEM_SUBGROUP_LABELS,
  SYSTEM_SUBGROUP_ORDER,
  type SystemSettingSubgroup
} from '../settingsGroups'

function matchesSearch(setting: SettingDto, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = `${setting.key} ${setting.description ?? ''}`.toLowerCase()
  return haystack.includes(q)
}

function draftEntries(
  drafts: Record<string, string>,
  baseline: Map<string, string>
): { key: string; value: string }[] {
  return Object.entries(drafts)
    .filter(([key, value]) => baseline.get(key) !== value)
    .map(([key, value]) => ({ key, value }))
}

interface SettingValueFieldProps {
  setting: SettingDto
  value: string
  editable: boolean
  onChange: (next: string) => void
}

function SettingValueField({
  setting,
  value,
  editable,
  onChange
}: SettingValueFieldProps): React.ReactElement {
  if (!editable) {
    return (
      <p className="text-body text-foreground" dir="ltr">
        {value || '—'}
      </p>
    )
  }

  const valueType = setting.value_type.toLowerCase()

  if (valueType === 'boolean') {
    const checked = value === 'true' || value === '1'
    return (
      <Switch
        checked={checked}
        onCheckedChange={(next) => onChange(next ? 'true' : 'false')}
        aria-label={setting.key}
      />
    )
  }

  if (valueType === 'integer' || valueType === 'float') {
    const numeric = value === '' ? undefined : Number(value)
    return (
      <NumberInput
        value={Number.isFinite(numeric) ? numeric : undefined}
        onChange={(next) => onChange(next == null ? '' : String(next))}
        step={valueType === 'float' ? 0.01 : 1}
        className="max-w-xs"
        dir="ltr"
      />
    )
  }

  return (
    <TextInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-xl"
      dir={valueType === 'json' ? 'ltr' : undefined}
    />
  )
}

interface SettingRowProps {
  setting: SettingDto
  value: string
  editable: boolean
  onChange: (next: string) => void
}

function SettingRow({ setting, value, editable, onChange }: SettingRowProps): React.ReactElement {
  return (
    <Card className="border-border/80">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-caption text-muted-foreground" dir="ltr">
            {setting.key}
          </p>
          {setting.description ? (
            <p className="text-body text-foreground">{setting.description}</p>
          ) : null}
          {!setting.is_editable ? (
            <InlineMessage variant="info">للقراءة فقط</InlineMessage>
          ) : null}
        </div>
        <div className="flex w-full shrink-0 flex-col gap-1 sm:w-72">
          <Label className="text-caption text-muted-foreground">القيمة</Label>
          <SettingValueField
            setting={setting}
            value={value}
            editable={editable}
            onChange={onChange}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function SettingsListBody({
  items,
  baseline,
  drafts,
  canUpdate,
  onDraftChange
}: {
  items: SettingDto[]
  baseline: Map<string, string>
  drafts: Record<string, string>
  canUpdate: boolean
  onDraftChange: (key: string, value: string) => void
}): React.ReactElement {
  if (items.length === 0) {
    return <EmptyState title="لا إعدادات" description="لا توجد إعدادات مطابقة للبحث في هذه الفئة." />
  }

  return (
    <div className="space-y-3">
      {items.map((setting) => {
        const value = drafts[setting.key] ?? baseline.get(setting.key) ?? setting.value
        const editable = canUpdate && setting.is_editable
        return (
          <SettingRow
            key={setting.id}
            setting={setting}
            value={value}
            editable={editable}
            onChange={(next) => onDraftChange(setting.key, next)}
          />
        )
      })}
    </div>
  )
}

export default function SettingsPage(): React.ReactElement {
  const canView = usePermission('settings.view')
  const canUpdate = usePermission('settings.update')

  const [category, setCategory] = React.useState<SettingCategory>('company')
  const [search, setSearch] = React.useState('')
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [pendingCategory, setPendingCategory] = React.useState<SettingCategory | null>(null)
  const [categoryConfirmOpen, setCategoryConfirmOpen] = React.useState(false)

  const listQuery = useSettingsList(category)
  const saveMutation = useSaveSettingValues(category)

  const baseline = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const item of listQuery.data?.items ?? []) map.set(item.key, item.value)
    return map
  }, [listQuery.data?.items])

  const dirtyEntries = React.useMemo(
    () => draftEntries(drafts, baseline),
    [drafts, baseline]
  )
  const dirty = dirtyEntries.length > 0

  const { dialog: unsavedDialog } = useUnsavedChangesGuard(dirty)

  React.useEffect(() => {
    setDrafts({})
    setSaveError(null)
  }, [category, listQuery.dataUpdatedAt])

  const filteredItems = React.useMemo(
    () => (listQuery.data?.items ?? []).filter((item) => matchesSearch(item, search)),
    [listQuery.data?.items, search]
  )

  const requestCategoryChange = (next: SettingCategory): void => {
    if (next === category) return
    if (dirty) {
      setPendingCategory(next)
      setCategoryConfirmOpen(true)
      return
    }
    setCategory(next)
    setSearch('')
  }

  const confirmCategoryChange = (): void => {
    if (pendingCategory) {
      setCategory(pendingCategory)
      setDrafts({})
      setSearch('')
    }
    setPendingCategory(null)
    setCategoryConfirmOpen(false)
  }

  const handleDraftChange = (key: string, value: string): void => {
    setSaveError(null)
    setDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (): Promise<void> => {
    const entries = dirtyEntries
    if (entries.length === 0) return
    setSaveError(null)
    try {
      await saveMutation.mutateAsync(entries)
      setDrafts({})
    } catch (error) {
      setSaveError(toAppError(error).message)
    }
  }

  if (!canView) return <Navigate to="/forbidden" replace />

  const systemGroups =
    category === 'system' ? groupSystemSettings(filteredItems) : null

  return (
    <Page size="lg" as="main">
      <PageHeader
        title="الإعدادات"
        description="إدارة إعدادات النظام حسب الفئة"
        actions={
          canUpdate ? (
            <PageActions>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={!dirty || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'جاري الحفظ…' : 'حفظ التغييرات'}
              </Button>
            </PageActions>
          ) : null
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-col gap-3">
              <Tabs
                value={category}
                onValueChange={(v) => requestCategoryChange(v as SettingCategory)}
                className="hidden lg:block"
              >
                <TabsList className="h-auto max-w-full flex-wrap justify-start">
                  {SETTING_CATEGORIES.map((entry) => (
                    <TabsTrigger key={entry.value} value={entry.value}>
                      {entry.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Select value={category} onValueChange={(v) => requestCategoryChange(v as SettingCategory)}>
                <SelectTrigger className="w-full lg:hidden" aria-label="الفئة">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {SETTING_CATEGORIES.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SearchBar
              value={search}
              onValueChange={setSearch}
              placeholder="بحث بالمفتاح أو الوصف…"
            />
          </div>
        }
      />

      {saveError ? <InlineMessage variant="danger">{saveError}</InlineMessage> : null}

      {listQuery.isLoading ? (
        <BusyIndicator label="جاري تحميل الإعدادات…" />
      ) : listQuery.isError ? (
        <ErrorState title="تعذر تحميل الإعدادات" onRetry={() => void listQuery.refetch()} />
      ) : filteredItems.length === 0 ? (
        <EmptyState title="لا إعدادات" description="لا توجد إعدادات مطابقة للبحث في هذه الفئة." />
      ) : systemGroups ? (
        <div className="space-y-8">
          {SYSTEM_SUBGROUP_ORDER.map((subgroup: SystemSettingSubgroup) => {
            const items = systemGroups.get(subgroup) ?? []
            if (items.length === 0) return null
            return (
              <Section key={subgroup} title={SYSTEM_SUBGROUP_LABELS[subgroup]}>
                <SettingsListBody
                  items={items}
                  baseline={baseline}
                  drafts={drafts}
                  canUpdate={canUpdate}
                  onDraftChange={handleDraftChange}
                />
              </Section>
            )
          })}
        </div>
      ) : (
        <SettingsListBody
          items={filteredItems}
          baseline={baseline}
          drafts={drafts}
          canUpdate={canUpdate}
          onDraftChange={handleDraftChange}
        />
      )}

      {unsavedDialog}

      <ConfirmationDialog
        open={categoryConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCategory(null)
            setCategoryConfirmOpen(false)
          }
        }}
        title="تغييرات غير محفوظة"
        description="لديك تعديلات لم تُحفظ. هل تريد تغيير الفئة دون حفظ؟"
        confirmLabel="تغيير الفئة"
        cancelLabel="البقاء"
        tone="danger"
        onConfirm={confirmCategoryChange}
        onCancel={() => {
          setPendingCategory(null)
          setCategoryConfirmOpen(false)
        }}
      />
    </Page>
  )
}
