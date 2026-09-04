import { ApiError } from '@/data/_client/api'
import type { MeResponse } from '@/data/auth/authApi'

export type AuthPhase = 'pending' | 'signedOut' | 'mustChangePassword' | 'onboarding' | 'ready' | 'failed'

/** Boot decision from a successful /api/auth/me. Password reset outranks onboarding (S2). */
export function deriveFromMe(me: MeResponse): AuthPhase {
  if (me.mustChangePassword) return 'mustChangePassword'
  if (!me.onboarded) return 'onboarding'
  return 'ready'
}

/** Boot decision from a failed /api/auth/me: dead session vs unreachable backend. */
export function deriveFromError(err: unknown): AuthPhase {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return 'signedOut'
  return 'failed'
}
