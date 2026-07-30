import * as React from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { InlineMessage } from '@/components/ui/inline-message'
import { AppLogo } from '@/layouts/shell'
import { apiClient } from '@/services/apiClient'
import { useAuthStore } from '@/stores/authStore'

export default function ForcePasswordChangePage(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const ready = useAuthStore((s) => s.ready)
  const authenticated = useAuthStore((s) => s.session.authenticated)

  const [currentPassword, setCurrent] = React.useState('')
  const [newPassword, setNew] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (ready && !authenticated) {
    return <Navigate to="/login" replace />
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!currentPassword || !newPassword) {
      setError(t('auth.validationRequired'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('auth.passwordTooShort'))
      return
    }
    if (newPassword !== confirm) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setPending(true)
    try {
      const session = await apiClient.auth.changePassword({
        currentPassword,
        newPassword
      })
      setSession(session)
      navigate('/', { replace: true })
    } catch (err) {
      const message =
        typeof err === 'object' && err && 'message' in err
          ? String((err as { message: string }).message)
          : t('auth.changePasswordFailed')
      setError(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-panel p-6 shadow-md">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <AppLogo size="hero" />
        <div className="space-y-1">
          <h1 className="text-h2 text-foreground">{t('auth.forcePasswordTitle')}</h1>
          <p className="text-caption text-muted-foreground">{t('auth.forcePasswordHint')}</p>
        </div>
      </div>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <div className="space-y-2">
          <Label htmlFor="current-pw">{t('auth.currentPassword')}</Label>
          <PasswordInput
            id="current-pw"
            value={currentPassword}
            disabled={pending}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-pw">{t('auth.newPassword')}</Label>
          <PasswordInput
            id="new-pw"
            value={newPassword}
            disabled={pending}
            onChange={(e) => setNew(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pw">{t('auth.confirmPassword')}</Label>
          <PasswordInput
            id="confirm-pw"
            value={confirm}
            disabled={pending}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error ? <InlineMessage variant="error">{error}</InlineMessage> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('auth.saving') : t('auth.changePassword')}
        </Button>
      </form>
    </div>
  )
}
