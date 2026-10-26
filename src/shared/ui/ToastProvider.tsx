import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastMessage } from './toast-context'
import { Icon } from './Icon'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastMessage & { id: number }) | null>(null)
  const sequence = useRef(0)
  const notify = useCallback(
    (message: ToastMessage) => setToast({ ...message, id: ++sequence.current }),
    [],
  )
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])
  return (
    <ToastContext value={notify}>
      {children}
      <div className="toast-region" aria-label="알림">
        {toast && (
          <div key={toast.id} className="toast-message">
            <Icon name="check" size={18} className="shrink-0 text-brand" />
            <p role="status">{toast.message}</p>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick()
                  setToast(null)
                }}
                className="toast-action"
              >
                {toast.action.label}
              </button>
            )}
            <button aria-label="알림 닫기" onClick={() => setToast(null)} className="toast-close">
              <Icon name="close" size={15} />
            </button>
          </div>
        )}
      </div>
    </ToastContext>
  )
}
