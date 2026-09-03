import { ApiError } from '@/data/_client/api'
import type { MeResponse } from '@/data/auth/authApi'

export type AuthPhase = 'pending' | 'signedOut' | 'mustChangePassword' | 'ready' | 'failed'

/** Boot decision from a successful /api/auth/me. */
export function deriveFromMe(me: MeResponse): AuthPhase {
  if (me.mustChangePassword) return 'mustChangePassword'
  return 'ready'
}

/** Boot decision from a failed /api/auth/me: dead session vs unreachable backend. */
export function deriveFromError(err: unknown): AuthPhase {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return 'signedOut'
  return 'failed'
}
