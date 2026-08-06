import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface ConfirmOptions {
  readonly title: string
  readonly message: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly tone?: 'default' | 'error'
}

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts)
    queueMicrotask(() => dialogRef.current?.showModal())
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = useCallback((result: boolean) => {
    dialogRef.current?.close()
    resolver.current?.(result)
    resolver.current = null
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <DialogContext.Provider value={value}>
      {children}
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box border border-base-content/10 bg-base-200">
          <h3 className="text-lg font-semibold">{options?.title}</h3>
          <p className="py-4 text-sm text-base-content/70">{options?.message}</p>
          <div className="modal-action">
            <button type="button" className="btn" onClick={() => close(false)}>
              {options?.cancelLabel ?? 'إلغاء'}
            </button>
            <button
              type="button"
              className={
                options?.tone === 'error' ? 'btn btn-error' : 'btn btn-primary'
              }
              onClick={() => close(true)}
            >
              {options?.confirmLabel ?? 'تأكيد'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" onClick={() => close(false)}>
            close
          </button>
        </form>
      </dialog>
    </DialogContext.Provider>
  )
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext)
  if (!ctx) throw new Error('useDialog requires DialogProvider')
  return ctx
}
