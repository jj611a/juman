import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function UnauthenticatedPage(): React.ReactElement {
  const { t } = useTranslation()

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 py-16 text-center">
      <h1 className="text-3xl font-bold">{t('session.unauthenticated')}</h1>
      <p className="text-muted-foreground">{t('session.unauthenticatedHint')}</p>
      <div>
        <Button asChild variant="secondary">
          <Link to="/">{t('actions.goHome')}</Link>
        </Button>
      </div>
    </section>
  )
}
