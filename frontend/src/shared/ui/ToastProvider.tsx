import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { emitToast, onToast, type ToastMessage } from '@/shared/lib/toastBus'

// Single global toast host (mounted once in AppLayout) + the useToast() imperative API.
// Components call useToast().show(...); non-React code (mutation cache) emits via the
// toastBus directly. One toast at a time — a new one replaces the current, auto-hides
// after AUTO_HIDE_MS. Purpose-built confirmations (FuelStackPage protocol card, PRToast)
// stay feature-local by design; this host is for generic error/success/info feedback.

const AUTO_HIDE_MS = 3200

const KIND_BG: Record<ToastMessage['kind'], string> = {
  error: 'var(--error)',
  success: 'var(--success)',
  info: 'var(--coral)',
}

const ToastContext = createContext<{ show: (t: ToastMessage) => void }>({
  // Provider-less fallback (isolated tests): route through the bus, render nothing.
  show: emitToast,
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(
    () =>
      onToast((t) => {
        setToast(t)
        setNonce((n) => n + 1) // restart the auto-hide timer on replacement
      }),
    [],
  )

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), AUTO_HIDE_MS)
    return () => clearTimeout(id)
  }, [toast, nonce])

  const show = useCallback((t: ToastMessage) => emitToast(t), [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="toast rad-20"
          data-kind={toast.kind}
          style={{ background: KIND_BG[toast.kind] }}
        >
          <span style={{ fontSize: 12, fontWeight: 600 }}>{toast.text}</span>
        </div>
      )}
    </ToastContext.Provider>
  )
}
