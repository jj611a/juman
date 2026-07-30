import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { TextInput } from '@/components/ui/text-input'
import { PasswordInput } from '@/components/ui/password-input'
import { InlineMessage } from '@/components/ui/inline-message'
import { apiClient } from '@/services/apiClient'
import { settingsApi } from '@/features/settings/api'

type Step = 'company' | 'database' | 'admin' | 'storage' | 'app' | 'done'

export type FirstRunWizardProps = {
  onCompleted: () => void
}

/**
 * Production first-run — persist company/admin/storage/timezone/language then firstrun.done.
 */
export function FirstRunWizard({ onCompleted }: FirstRunWizardProps): React.ReactElement {
  const [step, setStep] = React.useState<Step>('company')
  const [company, setCompany] = React.useState('جمان')
  const [timezone, setTimezone] = React.useState('Asia/Baghdad')
  const [storagePath, setStoragePath] = React.useState('')
  const [adminUser, setAdminUser] = React.useState('admin')
  const [bootstrapPass, setBootstrapPass] = React.useState('')
  const [adminPass, setAdminPass] = React.useState('')
  const [dbOk, setDbOk] = React.useState<boolean | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    void (async () => {
      try {
        const env = await apiClient.appExtras.readEnv()
        if (env.MEDIA_STORAGE_ROOT) setStoragePath(env.MEDIA_STORAGE_ROOT)
        if (env.JUMAN_COMPANY_NAME) setCompany(env.JUMAN_COMPANY_NAME)
        if (env.JUMAN_TIMEZONE) setTimezone(env.JUMAN_TIMEZONE)
        if (env.IDENTITY_BOOTSTRAP_USERNAME) setAdminUser(env.IDENTITY_BOOTSTRAP_USERNAME)
      } catch {
        /* install env may be absent in DEV */
      }
    })()
  }, [])

  async function verifyDb(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await apiClient.system.health()
      setDbOk(true)
      setStep('admin')
    } catch (err) {
      setDbOk(false)
      setError(
        err instanceof Error
          ? err.message
          : 'الخادم غير متاح — تحقق من خدمة JumanApi وPostgreSQL'
      )
    } finally {
      setBusy(false)
    }
  }

  async function finish(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      if (!bootstrapPass.trim()) {
        throw new Error('أدخل كلمة مرور المثبت الحالية (IDENTITY_BOOTSTRAP)')
      }
      if (!adminPass.trim() || adminPass.trim().length < 8) {
        throw new Error('كلمة مرور المسؤول الجديدة يجب ألا تقل عن 8 أحرف')
      }

      await apiClient.auth.login({
        username: adminUser.trim(),
        password: bootstrapPass.trim()
      })

      try {
        await apiClient.auth.changePassword({
          currentPassword: bootstrapPass.trim(),
          newPassword: adminPass.trim()
        })
      } catch (err) {
        throw new Error(
          err instanceof Error
            ? `تعذر تغيير كلمة المرور: ${err.message}`
            : 'تعذر تغيير كلمة المرور'
        )
      }

      try {
        await settingsApi.patchValue('company_name', { value: company.trim() || 'جمان' })
      } catch {
        /* settings.view may be missing until roles settle — still persist env */
      }

      const storage = storagePath.trim()
      const envPatch: Record<string, string> = {
        JUMAN_COMPANY_NAME: company.trim() || 'Juman',
        JUMAN_TIMEZONE: timezone.trim() || 'Asia/Baghdad',
        JUMAN_LANGUAGE: 'ar'
      }
      if (storage) {
        envPatch.MEDIA_STORAGE_ROOT = storage.replace(/\\/g, '/')
      }
      await apiClient.appExtras.patchEnv(envPatch)
      if (storage) {
        await apiClient.hardware.restartBackend().catch(() => undefined)
      }

      await apiClient.appExtras.completeFirstRun()
      onCompleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إكمال الإعداد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-display text-foreground">إعداد جمان لأول مرة</h1>
        <p className="mt-2 text-body text-muted-foreground">
          الشركة، قاعدة البيانات، حساب المسؤول، ومسارات التخزين
        </p>
      </div>

      {error ? <InlineMessage variant="error">{error}</InlineMessage> : null}

      {step === 'company' ? (
        <section className="space-y-3">
          <Label htmlFor="company">اسم الشركة</Label>
          <TextInput
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <Label htmlFor="tz">المنطقة الزمنية</Label>
          <TextInput
            id="tz"
            dir="ltr"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
          <Button type="button" onClick={() => setStep('database')}>
            التالي
          </Button>
        </section>
      ) : null}

      {step === 'database' ? (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            يتحقق التطبيق من اتصال الواجهة الخلفية فقط — لا يشغّل PostgreSQL بنفسه.
          </p>
          {dbOk === true ? (
            <InlineMessage variant="success">الاتصال ناجح</InlineMessage>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void verifyDb()}>
              اختبار الاتصال
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('company')}>
              رجوع
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void apiClient.hardware.startBackend()}
            >
              تشغيل خدمة API
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'admin' ? (
        <section className="space-y-3">
          <p className="text-caption text-muted-foreground">
            سجّل الدخول بكلمة مرور المثبت ثم عيّن كلمة مرور المسؤول الجديدة (تُحفظ عبر API).
          </p>
          <Label htmlFor="admin-user">اسم المستخدم</Label>
          <TextInput
            id="admin-user"
            dir="ltr"
            value={adminUser}
            onChange={(e) => setAdminUser(e.target.value)}
          />
          <Label htmlFor="boot-pass">كلمة مرور المثبت الحالية</Label>
          <PasswordInput
            id="boot-pass"
            value={bootstrapPass}
            onChange={(e) => setBootstrapPass(e.target.value)}
          />
          <Label htmlFor="admin-pass">كلمة مرور المسؤول الجديدة</Label>
          <PasswordInput
            id="admin-pass"
            value={adminPass}
            onChange={(e) => setAdminPass(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep('storage')}>
              التالي
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('database')}>
              رجوع
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'storage' ? (
        <section className="space-y-3">
          <Label htmlFor="storage">مسار التخزين</Label>
          <TextInput
            id="storage"
            dir="ltr"
            value={storagePath}
            onChange={(e) => setStoragePath(e.target.value)}
            placeholder="C:\Program Files\Juman\storage"
          />
          <div className="flex gap-2">
            <Button type="button" onClick={() => setStep('app')}>
              التالي
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('admin')}>
              رجوع
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'app' ? (
        <section className="space-y-3">
          <InlineMessage variant="info">
            اللغة: العربية — الاتجاه: RTL — API: http://127.0.0.1:8000/api/v1
          </InlineMessage>
          <p className="text-sm text-muted-foreground">
            الشركة: {company || '—'} — المنطقة: {timezone}
          </p>
          <div className="flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void finish()}>
              إنهاء الإعداد
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('storage')}>
              رجوع
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}