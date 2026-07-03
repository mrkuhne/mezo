// React-free pub/sub bridge between non-React code (the QueryClient mutation cache,
// module-level helpers) and the ToastProvider host. Emitting without a mounted
// subscriber is a silent no-op — isolated component tests stay unaffected.
export type ToastKind = 'error' | 'success' | 'info'

export interface ToastMessage {
  kind: ToastKind
  text: string
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
