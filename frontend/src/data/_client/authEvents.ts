export type SignOutReason = 'expired' | 'disabled' | 'manual'

type Listener = (reason: SignOutReason) => void
const listeners = new Set<Listener>()

/** Module-level bus: apiFetch/apiSse announce a dead session, AuthGate listens. */
export const authEvents = {
  onSignedOut(cb: Listener): () => void {
    listeners.add(cb)
    return () => { listeners.delete(cb) }
  },
  emitSignedOut(reason: SignOutReason): void {
    listeners.forEach((l) => l(reason))
  },
}
