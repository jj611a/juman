import { useSession } from '@/app/providers/SessionProvider'
import { LogOut, Shield, KeyRound, User, CircleUser } from 'lucide-react'

interface UserProfileDialogProps {
  isOpen: boolean
  onClose: () => void
  onChangePasswordClick: () => void
}

export function UserProfileDialog({ isOpen, onClose, onChangePasswordClick }: UserProfileDialogProps) {
  const { session, logout } = useSession()

  if (!isOpen || !session?.user) return null

  const user = session.user
  const initial = (user.displayName || user.username || 'U').charAt(0).toUpperCase()

  return (
    <div className="modal modal-open modal-middle select-none" dir="rtl">
      <div className="modal-box border border-base-content/10 bg-base-200/95 backdrop-blur-md shadow-2xl max-w-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <User size={20} className="text-primary" />
          الملف الشخصي
        </h3>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Avatar Placeholder */}
          <div className="avatar placeholder">
            <div className="bg-primary/20 text-primary w-20 rounded-full border-2 border-primary/50 shadow-inner">
              <span className="text-3xl font-extrabold">{initial}</span>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold text-base-content">{user.displayName || user.username}</h2>
            <p className="text-xs text-base-content/50">@{user.username}</p>
          </div>

          {/* User Details */}
          <div className="w-full bg-base-300/40 rounded-xl p-4 flex flex-col gap-3 text-sm">
            <div className="flex justify-between items-center border-b border-base-content/5 pb-2">
              <span className="text-base-content/50 flex items-center gap-1.5"><Shield size={14} /> الدور الوظيفي</span>
              <span className="badge badge-primary font-semibold">{user.roles?.join(', ') || 'مستخدم'}</span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-base-content/50 flex items-center gap-1.5"><CircleUser size={14} /> الصلاحيات الممنوحة</span>
              <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto p-1.5 bg-base-300/50 rounded-lg">
                {user.permissions && user.permissions.length > 0 ? (
                  user.permissions.map((perm) => (
                    <span key={perm} className="text-[10px] bg-base-100 text-base-content/75 px-1.5 py-0.5 rounded font-mono">
                      {perm}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-base-content/40 italic">لا توجد صلاحيات محددة</span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full flex flex-col gap-2 mt-4">
            <button
              onClick={() => {
                onClose()
                onChangePasswordClick()
              }}
              className="btn btn-outline btn-sm flex items-center justify-center gap-2"
            >
              <KeyRound size={14} />
              تغيير كلمة المرور
            </button>

            <button
              onClick={() => {
                onClose()
                void logout()
              }}
              className="btn btn-error btn-sm flex items-center justify-center gap-2"
            >
              <LogOut size={14} />
              تسجيل الخروج
            </button>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}
