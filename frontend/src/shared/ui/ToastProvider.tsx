import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode,
} from 'react'
import {
  emitToast, isRewardToast, onToast, type RewardToast, type ToastKind, type ToastMessage,
} from '@/shared/lib/toastBus'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'

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
//
// Üveg (U10, mezo-me75u.10, `uveg-reteg` `uzenet()`): every toast is a `.glass` pill-card (no
// sheen) whose `--c` is its kind (success sage, error coral, info sky, reward gold), led by a 3D
// icon, the action a flat accent-tinted pill, the × last. CSS: `── uveg reteg lap (`.

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
              className={`toast glass uvl-tst is-${e.toast.kind}${e.leaving ? ' is-leaving' : ''}${reduced ? ' is-reduced' : ''}`}
            >
              <Icon3D name={toastIcon(e.toast)} size={28} className="uvl-tst-ico" />
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
              <button
                type="button"
                className="t-close"
                aria-label="Bezárás"
                onClick={() => dismiss(e.id)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                  strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M1 1l8 8M9 1L1 9" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/** The leading 3D icon: the meaning of a simple toast (success tick, error info, info bell), or
 *  the reward's source (habit harvest, quest, activity journal). */
const SIMPLE_ICON: Record<ToastKind, Icon3DName> = { success: 't-tick', error: 't-info', info: 't-bell' }
const REWARD_ICON: Record<NonNullable<RewardToast['source']>, Icon3DName> = {
  habit: 't-harvest', quest: 't-quest', activity: 't-journal',
}
function toastIcon(t: ToastMessage): Icon3DName {
  return isRewardToast(t) ? REWARD_ICON[t.source ?? 'quest'] : SIMPLE_ICON[t.kind]
}

/** The DS §Notification reward card, in üveg (U10, mezo-me75u.10): gold eyebrow · title (+ faint
 *  meta) · the user's own celebration line (upright, bible rule 23) · meter row (+N in gold) ·
 *  an optional LEVEL UP pill with the t-up icon. Every part below the title is optional — a
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
          <Icon3D name="t-up" size={16} />
          {`LEVEL UP · ${toast.levelUp.label} · Lv${toast.levelUp.from} → ${toast.levelUp.to}`}
        </span>
      )}
    </div>
  )
}
