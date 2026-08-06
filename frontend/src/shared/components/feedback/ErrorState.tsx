export function ErrorState({
  title = 'حدث خطأ',
  message,
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="alert alert-error">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {message ? <p className="text-sm opacity-80">{message}</p> : null}
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          إعادة المحاولة
        </button>
      ) : null}
    </div>
  )
}
