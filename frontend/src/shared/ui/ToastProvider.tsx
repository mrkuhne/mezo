import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { emitToast, isRewardToast, onToast, type ToastKind, type ToastMessage } from '@/shared/lib/toastBus'

// Single global toast host (mounted once in AppLayout) + the useToast() imperative API.
// Components call useToast().show(...); non-React code (mutation cache) emits via the
// toastBus directly. One toast at a time — a new one replaces the current, auto-hides
// after AUTO_HIDE_MS. Purpose-built confirmations (FuelStackPage protocol card, MedalToast)
// stay feature-local by design; this host is for generic error/success/info feedback.

const AUTO_HIDE_MS = 3200

const KIND_BG: Record<ToastKind, string> = {
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
      {toast && !isRewardToast(toast) && (
        <div
          role="status"
          aria-live="polite"
          className="toast rad-20"
          data-kind={toast.kind}
          style={{ background: KIND_BG[toast.kind] }}
        >
          {/* DS caption floor: 14px for sentence-case feedback text */}
          <span style={{ fontSize: 14, fontWeight: 600 }}>{toast.text}</span>
        </div>
      )}
      {/* TODO(mezo-k5sa, Task 3): render the reward variant — ToastProvider is replaced wholesale then. */}
    </ToastContext.Provider>
  )
}
