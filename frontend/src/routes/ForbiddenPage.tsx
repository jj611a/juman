import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'

export default function ForbiddenPage(): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 py-8">
      <ErrorState title={t('errors.forbidden')} message={t('auth.forbiddenHint')} />
      <div className="flex justify-center">
        <Button asChild variant="secondary">
          <Link to="/">{t('actions.goHome')}</Link>
        </Button>
      </div>
    </div>
  )
}
