import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiClient } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'
import { ErrorState, Page, PageHeader, StatusBadge } from '@/components/ui'
import { BusyIndicator } from '@/components/ui/busy-indicator'
import { AppLogo } from '@/layouts/shell'

export default function FoundationHomePage(): React.ReactElement {
  const { t } = useTranslation()
  const session = useAuthStore((s) => s.session)

  const health = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => apiClient.system.health(),
    enabled: typeof window !== 'undefined' && Boolean(window.juman)
  })

  return (
    <Page size="md" as="main">
      <div className="mb-2 flex justify-center sm:justify-start">
        <AppLogo size="hero" />
      </div>
      <PageHeader description={t('app.foundationReady')} />

      <section className="space-y-2 rounded-md border border-border bg-panel px-4 py-3">
        <p className="text-caption text-muted-foreground">
          {session.authenticated ? t('session.authenticated') : t('session.unauthenticated')}
        </p>
        {session.user ? (
          <p className="text-body text-foreground">
            {t('session.user')}: {session.user.full_name || session.user.username}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-title text-foreground">حالة النظام</h2>
        {health.isLoading ? <BusyIndicator label={t('connection.checking')} /> : null}
        {health.isError ? (
          <ErrorState
            title={t('connection.fail')}
            onRetry={() => void health.refetch()}
          />
        ) : null}
        {health.data ? (
          <div className="space-y-3">
            <StatusBadge tone="success">{t('connection.ok')}</StatusBadge>
            <pre
              className="overflow-auto rounded-md border border-border bg-card/60 p-4 text-xs text-muted-foreground"
              dir="ltr"
            >
              {JSON.stringify(health.data, null, 2)}
            </pre>
          </div>
        ) : null}
      </section>
    </Page>
  )
}
