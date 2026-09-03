// React-free pub/sub bridge between non-React code (the QueryClient mutation cache,
// module-level helpers) and the ToastProvider host. Emitting without a mounted
// subscriber is a silent no-op — isolated component tests stay unaffected.
//
// A ToastMessage is a discriminated union: the plain `SimpleToast` (unchanged shape —
// ten domains' mock award helpers and the mutation cache's error path emit it) and the
// DS §Notification `RewardToast` (habit/quest completion — mezo-k5sa).
export type ToastKind = 'error' | 'success' | 'info'

export interface SimpleToast {
  kind: ToastKind
  text: string
}

/** DS §Notification reward variant. Every field beyond eyebrow/title is optional —
 *  a payload with no meter renders as eyebrow + title, never as `+undefined`. */
export interface RewardToast {
  kind: 'reward'
  /** „Szokás · 2 / 3" · „Küldetés" — uppercase eyebrow above the title */
  eyebrow: string
  /** the habit/quest name — Fraunces title */
  title: string
  /** italic addendum beside the title: „2000 ml" */
  meta?: string
  /** a felhasználó saját ünneplés-mondata (FOGG `celebration`), a tett pillanatában
   *  visszajátszva — saját sor a cím alatt, NEM a `meta` addendum (mezo-3zue.5) */
  celebration?: string
  /** the meter row: the skill's display name (real mode) or 'XP' (mock) + the delta */
  meter?: { label: string; delta: number }
  /** only when levelAfter > levelBefore */
  levelUp?: { label: string; from: number; to: number }
}

export type ToastMessage = SimpleToast | RewardToast

export function isRewardToast(t: ToastMessage): t is RewardToast {
  return t.kind === 'reward'
}

type Listener = (t: ToastMessage) => void

const listeners = new Set<Listener>()

/** Subscribe to toast emissions; returns the unsubscribe function. */
export function onToast(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Emit a toast to every mounted host (normally the single app-level ToastProvider). */
export function emitToast(toast: ToastMessage): void {
  listeners.forEach((l) => l(toast))
}
