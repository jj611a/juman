import * as React from 'react'
import { AppShellFrame, type ShellNavSection } from '@/layouts/shell'
import { Section, Stack, Button } from '@/components/ui'
import { dialogHost, drawerHost, globalLoading } from '@/app/hosts'
import { useAuthStore } from '@/stores/authStore'

const SECTIONS: ShellNavSection[] = [
  {
    id: 'main',
    label: 'القائمة',
    items: [
      { id: 'home', label: 'نظرة عامة', href: '/dev/shell', icon: 'Home' },
      { id: 'customers', label: 'العملاء', href: '/dev/shell', icon: 'Users', permission: 'demo.view', badge: 3 },
      { id: 'secret', label: 'مخفي', href: '/dev/shell', icon: 'Lock', permission: 'demo.hidden' }
    ]
  },
  {
    id: 'soon',
    label: 'قريبًا',
    items: [{ id: 'reports', label: 'التقارير', icon: 'FileText', disabled: true, badge: 'قريبًا' }]
  }
]

export default function ShellPage(): React.ReactElement {
  React.useEffect(() => {
    useAuthStore.getState().setSession({
      authenticated: true,
      permissions: ['demo.view'],
      mustChangePassword: false,
      user: {
        id: '1',
        username: 'demo',
        full_name: 'عرض الهيكل',
        role_id: 'r1',
        is_active: true
      }
    })
    useAuthStore.getState().setReady(true)
  }, [])

  return (
    <Stack gap={6}>
      <Section title="أساس الهيكل (Phase 3.1)">
        <p className="text-body text-muted-foreground">
          أيقونات، شارات، شريط حالة، اختصارات (Ctrl+B / Ctrl+K في التطبيق)، ومضيفي حوار/درج/تحميل.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              globalLoading.show('تحميل تجريبي…')
              window.setTimeout(() => globalLoading.hide(), 800)
            }}
          >
            Global loading
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              dialogHost.open({
                title: 'حوار تجريبي',
                description: 'DialogHost',
                content: <p className="text-body">محتوى الحوار</p>
              })
            }
          >
            Dialog host
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              drawerHost.open({
                title: 'درج تجريبي',
                content: <p className="text-body">محتوى الدرج</p>
              })
            }
          >
            Drawer host
          </Button>
        </div>
      </Section>
      <div className="h-[70vh] overflow-hidden rounded-md border border-border">
        <AppShellFrame
          sections={SECTIONS}
          title="معرض الهيكل"
          breadcrumbs={[
            { id: 'dev', label: 'تطوير' },
            { id: 'shell', label: 'الهيكل' }
          ]}
          showWindowControls={false}
          className="min-h-0 h-full"
          online
          appVersion="جمان"
          backendVersion="1.0.0"
        >
          <div className="p-6">
            <p className="text-body">مساحة العمل — لا صفحات أعمال هنا.</p>
          </div>
        </AppShellFrame>
      </div>
    </Stack>
  )
}
