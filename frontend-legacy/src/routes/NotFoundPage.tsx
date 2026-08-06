import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFoundPage(): React.ReactElement {
  const { t } = useTranslation()
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16">
      <EmptyState title={t('errors.notFound')} description="تحقق من الرابط أو عد إلى الرئيسية." />
      <Button asChild variant="secondary">
        <Link to="/">{t('actions.goHome')}</Link>
      </Button>
    </section>
  )
}
