import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export default function ErrorPage(): React.ReactElement {
  const { t } = useTranslation()
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4 py-16 text-center">
      <h1 className="text-3xl font-bold">{t('errors.generic')}</h1>
      <Button asChild>
        <Link to="/">{t('actions.goHome')}</Link>
      </Button>
    </section>
  )
}
