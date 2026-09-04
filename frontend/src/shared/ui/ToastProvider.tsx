import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import {
  emitToast, isRewardToast, onToast, type RewardToast, type ToastMessage,
} from '@/shared/lib/toastBus'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

// Single global toast host (mounted once in AppLayout) + the useToast() imperative API.
// Components call useToast().show(...); non-React code (mutation cache, the mock award
// helpers) emits via the toastBus directly.
//
// Since mezo-k5sa this host STACKS (DS §Notification): toasts queue instead of replacing
// each other — the chain-completion celebration no longer wipes the last check's feedback.
// Max 3 are visible; older ones scale down and fade (CSS, keyed off data-idx). The queue
// itself caps at 20, oldest dropped on overflow.
// Purpose-built confirmations (FuelStackPage protocol card, MedalToast) stay feature-local
// by design; this host is for generic error/success/info feedback plus reward toasts.

const AUTO_HIDE_MS: Record<ToastMessage['kind'], number> = {
  reward: 4000,
  error: 6000,   // more time to read a failure
  success: 4000,
  info: 4000,
}
const EXIT_MS = 500       // keep the node mounted while the exit transition plays
const MAX_VISIBLE = 3
const QUEUE_CAP = 20

type Entry = { id: number; toast: ToastMessage; leaving: boolean }

const ToastContext = createContext<{ show: (t: ToastMessage) => void }>({
  // Provider-less fallback (isolated tests): route through the bus, render nothing.
  show: emitToast,
})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([])   // newest first
  const nextId = useRef(0)
  const reduced = useReducedMotion()

  // Every pending timer is tracked so unmount can clear them — a toast whose auto-hide
  // fires after the host is gone would setState on an unmounted tree.
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => { timers.current.delete(t); fn() }, ms)
    timers.current.add(t)
  }, [])

  const dismiss = useCallback((id: number) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, leaving: true } : e)))
    later(() => setEntries((prev) => prev.filter((e) => e.id !== id)), EXIT_MS)
  }, [later])

  useEffect(
    () =>
      onToast((toast) => {
        const id = nextId.current
        nextId.current += 1
        setEntries((prev) => [{ id, toast, leaving: false }, ...prev].slice(0, QUEUE_CAP))
        later(() => dismiss(id), AUTO_HIDE_MS[toast.kind])
      }),
    [dismiss, later],
  )

  useEffect(() => {
    const pending = timers.current
    return () => { pending.forEach(clearTimeout); pending.clear() }
  }, [])

  const show = useCallback((t: ToastMessage) => emitToast(t), [])

  const runAction = useCallback(async (entry: Entry) => {
    if (isRewardToast(entry.toast) || !entry.toast.action) return
    try {
      await entry.toast.action.onClick()
    } catch {
      // Mutation actions already report through the global MutationCache.
    } finally {
      dismiss(entry.id)
    }
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {entries.length > 0 && (
        <div className="toast-stack">
          {entries.map((e, idx) => (
            <div
              key={e.id}
              role="status"
              data-testid="toast-item"
              data-kind={e.toast.kind}
              data-idx={idx < MAX_VISIBLE ? String(idx) : 'hidden'}
              className={`toast${e.leaving ? ' is-leaving' : ''}${reduced ? ' is-reduced' : ''}`}
            >
              <button
                type="button"
                className="t-close"
                aria-label="Bezárás"
                onClick={() => dismiss(e.id)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              {isRewardToast(e.toast) ? <RewardBody toast={e.toast} /> : (
                <div className="t-pad">
                  <span className="t-simple-text">{e.toast.text}</span>
                  {e.toast.action && (
                    <button
                      type="button"
                      className="t-action"
                      onClick={() => { void runAction(e) }}
                    >
                      {e.toast.action.label}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/** The DS §Notification reward card: eyebrow · Fraunces title (+ italic meta) · meter row
 *  (+N in gold) · an optional LEVEL UP badge. Every part below the title is optional — a
 *  payload with no meter renders as eyebrow + title, never as an empty pill or `+undefined`. */
function RewardBody({ toast }: { toast: RewardToast }) {
  return (
    <div className="t-pad">
      <div className="t-eyebrow">{toast.eyebrow}</div>
      <div className="t-title">
        {toast.title}
        {toast.meta && <span className="t-meta"> · {toast.meta}</span>}
      </div>
      {toast.celebration && <div className="t-celebrate">{toast.celebration}</div>}
      {toast.meter && (
        <div className="t-meter">
          <span className="t-mdot" aria-hidden="true" />
          <span className="t-mlabel">{toast.meter.label}</span>
          <span className="t-mdelta">+{toast.meter.delta}</span>
        </div>
      )}
      {toast.levelUp && (
        <span className="t-lvup">
          <span aria-hidden="true">★</span>
          {` LEVEL UP · ${toast.levelUp.label} · Lv${toast.levelUp.from} → ${toast.levelUp.to}`}
        </span>
      )}
    </div>
  )
}
