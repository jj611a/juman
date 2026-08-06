import * as React from 'react'
import {
  AuditTimeline,
  AvatarGroup,
  BarcodeDisplay,
  BarcodeScannerField,
  Button,
  CopyButton,
  CreatedUpdatedInfo,
  CurrencyBadge,
  DressThumbnail,
  EntityHeader,
  EntityMeta,
  MediaGallery,
  MoneyDisplay,
  PermissionGuard,
  RecordInfoPanel,
  SearchHighlight,
  Section,
  Stack,
  StatusChip,
  TagList,
  UserChip
} from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

const STATUS_MAP = {
  AVAILABLE: { tone: 'success' as const, label: 'متاح' },
  RENTED: { tone: 'info' as const, label: 'مؤجّر' }
}

export default function BusinessPage(): React.ReactElement {
  React.useEffect(() => {
    useAuthStore.getState().setSession({
      authenticated: true,
      permissions: ['demo.view', 'demo.edit'],
      user: {
        id: '1',
        username: 'demo',
        full_name: 'مستخدم تجريبي',
        role_id: 'r1',
        is_active: true
      }
    })
    useAuthStore.getState().setReady(true)
  }, [])

  return (
    <Stack gap={8}>
      <Section title="المال والحالة">
        <div className="flex flex-wrap items-center gap-4">
          <MoneyDisplay value={1_250_000} />
          <MoneyDisplay value={-500_000} />
          <MoneyDisplay value={0} />
          <MoneyDisplay value={1_000_000} compact />
          <CurrencyBadge />
          <StatusChip status="AVAILABLE" map={STATUS_MAP} icon="Check" />
          <StatusChip status="RENTED" map={STATUS_MAP} icon="Info" />
        </div>
      </Section>

      <Section title="الصلاحيات">
        <PermissionGuard permission="demo.edit">
          <Button type="button">ظاهر مع demo.edit</Button>
        </PermissionGuard>
        <PermissionGuard permission="demo.delete" mode="disable">
          <Button type="button">معطّل بدون demo.delete</Button>
        </PermissionGuard>
        <PermissionGuard anyOf={['demo.view', 'demo.admin']}>
          <span className="text-caption text-muted-foreground">anyOf view|admin</span>
        </PermissionGuard>
      </Section>

      <Section title="الكيان والوسائط">
        <EntityHeader
          title="فستان سهرة"
          description="عرض تقديمي فقط"
          status={{ status: 'AVAILABLE', map: STATUS_MAP }}
          leading={<DressThumbnail status={{ status: 'AVAILABLE', map: STATUS_MAP }} />}
          actions={<CopyButton value="DRS-0001" aria-label="نسخ الرمز" />}
        />
        <EntityMeta
          items={[
            { id: 'code', label: 'الرمز', value: 'DRS-0001' },
            { id: 'hl', label: 'بحث', value: <SearchHighlight text="فستان سهرة أزرق" query="سهرة" /> }
          ]}
        />
        <MediaGallery
          files={[
            { id: '1', fileName: 'front.png', src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160'%3E%3Crect fill='%23333' width='120' height='160'/%3E%3C/svg%3E" },
            { id: '2', fileName: 'side.png', src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='160'%3E%3Crect fill='%23333' width='120' height='160'/%3E%3C/svg%3E" }
          ]}
        />
      </Section>

      <Section title="باركود وهوية">
        <BarcodeDisplay value="7700123456789" label="SKU" />
        <BarcodeScannerField placeholder="أدخل الباركود" onScanRequest={() => undefined} />
        <AvatarGroup
          items={[
            { id: 'a', name: 'أحمد' },
            { id: 'b', name: 'سارة' },
            { id: 'c', name: 'نور' },
            { id: 'd', name: 'ليان' }
          ]}
          max={3}
        />
        <UserChip name="أحمد علي" meta="موظف" />
        <TagList tags={[{ id: '1', label: 'VIP' }, { id: '2', label: 'توصيل' }]} />
      </Section>

      <Section title="التدقيق والسجل">
        <RecordInfoPanel
          metaItems={[{ id: 'id', label: 'المعرّف', value: 'CUS-00000001' }]}
          createdUpdated={{
            createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
            updatedAt: new Date(Date.now() - 3600000).toISOString(),
            createdBy: 'النظام'
          }}
        />
        <CreatedUpdatedInfo createdAt={new Date().toISOString()} />
        <AuditTimeline
          items={[
            {
              id: '1',
              at: new Date().toISOString(),
              actor: 'أحمد',
              action: 'تحديث الحالة',
              detail: 'من متاح إلى مؤجّر'
            }
          ]}
        />
      </Section>
    </Stack>
  )
}
