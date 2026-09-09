import { apiFetch } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'

// Draft outcome signals (AiDrafts, mezo-76f6) — silent, fire-and-forget acceptance telemetry
// for the two big AI generators (meal draft, meso plan). Global Constraints: USER-facing
// additions must be tiny and signals must be silent (no dialogs, no toasts, no error surfacing).
//
// Unlike telemetryClient (screen-event ingest), this DOES go through `apiFetch`: the ruling
// (spec 2026-09-09 §Rulings) is explicit that this is a normal OWNED endpoint, not a best-effort
// ingest channel — a genuinely-expired session firing a 401 here should still sign the user out
// exactly like it would on any other owned call (apiFetch's handleAuthFailure already does that).
// What must NOT happen is the call itself throwing on top of that and crashing whatever component
// fired it — a composer closing on unmount, a planner navigating away mid-flight, the sign-out
// race itself. So every failure (network error, 4xx/5xx ApiError, a 401 racing a concurrent
// sign-out) is swallowed here; the auth side-effect still runs inside apiFetch before the throw
// we catch.

export type DraftOutcome = 'accepted' | 'edited' | 'discarded'

/**
 * Reports this user's outcome signal for one backend-minted AI draft id. No-op in mock mode
 * (there is no backend to write to, and a demo session must never look different because of an
 * outcome signal) and a no-op when `draftId` is falsy (nothing to report against).
 */
export function reportDraftOutcome(draftId: string, feature: string, outcome: DraftOutcome): void {
  if (isMockMode()) return
  if (!draftId) return
  void apiFetch<void>(`/api/ai-drafts/${encodeURIComponent(draftId)}/outcome`, {
    method: 'POST',
    body: JSON.stringify({ feature, outcome }),
  }).catch(() => undefined)
}
