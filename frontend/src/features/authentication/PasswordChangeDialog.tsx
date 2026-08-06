import { useState, useMemo } from 'react'
import { useSession } from '@/app/providers/SessionProvider'
import { Eye, EyeOff, Check, X, ShieldAlert } from 'lucide-react'

interface PasswordChangeDialogProps {
  isOpen: boolean
  onClose: () => void
  forceChange?: boolean
}

export function PasswordChangeDialog({ isOpen, onClose, forceChange = false }: PasswordChangeDialogProps) {
  const { changePassword, logout } = useSession()
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Password rules validation
  const rules = useMemo(() => {
    return {
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    }
  }, [newPassword])

  const strength = useMemo(() => {
    const passed = Object.values(rules).filter(Boolean).length
    if (passed === 0) return { label: 'فارغ', color: 'bg-base-content/10', percentage: 0 }
    if (passed <= 2) return { label: 'ضعيف جداً', color: 'bg-error', percentage: 33 }
    if (passed <= 4) return { label: 'متوسط', color: 'bg-warning', percentage: 66 }
    return { label: 'قوي', color: 'bg-success', percentage: 100 }
  }, [rules])

  const isValid = useMemo(() => {
    return (
      currentPassword.length > 0 &&
      Object.values(rules).every(Boolean) &&
      newPassword === confirmPassword
    )
  }, [currentPassword, rules, newPassword, confirmPassword])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    
    setBusy(true)
    setError(null)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        onClose()
      }, 2000)
    } catch (err: any) {
      setError(err?.message ?? 'فشل تغيير كلمة المرور')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal modal-open modal-middle select-none" dir="rtl">
      <div className="modal-box border border-base-content/10 bg-base-200/95 backdrop-blur-md shadow-2xl max-w-md">
        {forceChange && (
          <div className="alert alert-warning text-sm mb-4">
            <ShieldAlert size={20} />
            <span>يجب تغيير كلمة المرور الافتراضية قبل المتابعة.</span>
          </div>
        )}

        <h3 className="text-lg font-bold mb-4">تغيير كلمة المرور</h3>

        {success ? (
          <div className="py-8 text-center flex flex-col items-center gap-4">
            <div className="h-16 w-16 bg-success/20 rounded-full flex items-center justify-center text-success animate-bounce">
              <Check size={36} />
            </div>
            <p className="text-lg font-bold text-success">تم تغيير كلمة المرور بنجاح!</p>
            <p className="text-xs text-base-content/60">يتم إغلاق النافذة...</p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {/* Current Password */}
            <div className="form-control w-full">
              <span className="label-text mb-1 text-xs">كلمة المرور الحالية</span>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className="input input-bordered w-full bg-base-300 pl-10"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-control w-full">
              <span className="label-text mb-1 text-xs">كلمة المرور الجديدة</span>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input input-bordered w-full bg-base-300 pl-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Strength indicator */}
            {newPassword.length > 0 && (
              <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-base-300/40 text-xs">
                <div className="flex justify-between items-center">
                  <span>قوة كلمة المرور: <span className="font-bold">{strength.label}</span></span>
                  <span>{strength.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-base-content/10 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.percentage}%` }}></div>
                </div>
                {/* Rules Checklist */}
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <span className={`flex items-center gap-1 ${rules.length ? 'text-success' : 'text-base-content/40'}`}>
                    {rules.length ? <Check size={12} /> : <X size={12} />} 8 أحرف على الأقل
                  </span>
                  <span className={`flex items-center gap-1 ${rules.uppercase ? 'text-success' : 'text-base-content/40'}`}>
                    {rules.uppercase ? <Check size={12} /> : <X size={12} />} حرف كبير (A-Z)
                  </span>
                  <span className={`flex items-center gap-1 ${rules.lowercase ? 'text-success' : 'text-base-content/40'}`}>
                    {rules.lowercase ? <Check size={12} /> : <X size={12} />} حرف صغير (a-z)
                  </span>
                  <span className={`flex items-center gap-1 ${rules.number ? 'text-success' : 'text-base-content/40'}`}>
                    {rules.number ? <Check size={12} /> : <X size={12} />} رقم (0-9)
                  </span>
                  <span className={`flex items-center gap-1 ${rules.special ? 'text-success' : 'text-base-content/40'}`}>
                    {rules.special ? <Check size={12} /> : <X size={12} />} رمز خاص (!@#$)
                  </span>
                </div>
              </div>
            )}

            {/* Confirm Password */}
            <div className="form-control w-full">
              <span className="label-text mb-1 text-xs">تأكيد كلمة المرور الجديدة</span>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className="input input-bordered w-full bg-base-300 pl-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <span className="text-[10px] text-error mt-1">كلمتا المرور غير متطابقتين.</span>
              )}
            </div>

            {error && (
              <div className="alert alert-error text-xs p-3">
                <span>{error}</span>
              </div>
            )}

            <div className="modal-action gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-primary btn-sm flex-1"
                disabled={!isValid || busy}
              >
                {busy ? <span className="loading loading-spinner loading-xs" /> : 'تغيير كلمة المرور'}
              </button>
              {!forceChange ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={onClose}
                  disabled={busy}
                >
                  إلغاء
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-outline btn-error btn-sm"
                  onClick={() => void logout()}
                  disabled={busy}
                >
                  تسجيل الخروج
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
