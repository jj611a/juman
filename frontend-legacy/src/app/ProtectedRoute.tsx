import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore } from '@/stores/authStore'

export function ProtectedRoute(): React.ReactElement {
  const ready = useAuthStore((s) => s.ready)
  const authenticated = useAuthStore((s) => s.session.authenticated)
  const mustChangePassword = useAuthStore((s) => s.session.mustChangePassword)
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground" role="status">
        جاري التحميل…
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (mustChangePassword && location.pathname !== '/force-password-change') {
    return <Navigate to="/force-password-change" replace />
  }

  return <Outlet />
}
