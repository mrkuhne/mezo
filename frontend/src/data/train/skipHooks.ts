import { useCallback } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery, DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
import { skipApi, type PlannedSkipRequest, type PlannedSkipResponse } from '@/data/train/skipApi'
import { findSkip, judge, skipWindow, type PlannedSkip, type PlannedSkipKey, type SkipReason } from '@/features/train/logic/plannedSkips'
// From the dependency-free `queryKeys.ts` leaf, NOT `trainHooks.ts`/`readinessHooks.ts` directly —
// `trainHooks.ts`'s own `useTrain()` calls `usePlannedSkips()` (this file), so importing the keys
// from either of those two would close a `trainHooks → skipHooks → trainHooks` cycle.
import { WORKOUT_TODAY_QUERY_KEY, READINESS_TODAY_QUERY_KEY } from '@/data/train/queryKeys'

/** Query-key PREFIX for planned skips — the ISO from-date is appended below (mirrors
 *  `sportSlotSkipsQueryKey`'s own week-in-the-key precedent) so a session left open across the
 *  window boundary invalidates into a fresh fetch instead of serving a stale window forever. */
export const PLANNED_SKIPS_QUERY_KEY = ['train', 'plannedSkips'] as const

/**
 * Real mode: everything a planned-skip (or kímélő mód, `recoveryHooks.ts`) write can change —
 * this list, today's workout/readiness (a GYM skip changes today's plan), and the server-side
 * reads that count skips (Kihagyás S1, Tasks 5–6): the week's workouts, the robustness streak
 * (progression profile), the meso close report's adherence, the daily quests and the Fuel day's
 * workout windows — all by prefix.
 */
/** The date-scoped planned-skips key for today's window (mock fuel derivation reads the same cache). */
export const plannedSkipsQueryKey = () => [...PLANNED_SKIPS_QUERY_KEY, skipWindow().fromIso] as const

export function invalidateAfterWrite(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: PLANNED_SKIPS_QUERY_KEY })
  void qc.invalidateQueries({ queryKey: WORKOUT_TODAY_QUERY_KEY })
  void qc.invalidateQueries({ queryKey: READINESS_TODAY_QUERY_KEY })
  void qc.invalidateQueries({ queryKey: ['train', 'weekWorkouts'] })
  void qc.invalidateQueries({ queryKey: ['train', 'mesoReport'] }) // `mesoReportQueryKey` prefix
  void qc.invalidateQueries({ queryKey: ['progressionProfile'] })
  void qc.invalidateQueries({ queryKey: ['dailyQuests'] })
  void qc.invalidateQueries({ queryKey: ['fuelDay'] })
}

function toPlannedSkip(r: PlannedSkipResponse): PlannedSkip {
  return {
    id: r.id,
    kind: r.kind,
    date: r.date,
    dayOfWeek: r.dayOfWeek ?? null,
    time: r.time ?? null,
    sessionKey: r.sessionKey ?? null,
    reasonCategory: r.reasonCategory,
    reasonText: r.reasonText ?? null,
    plannedKcal: r.plannedKcal ?? null,
    source: r.source,
    serious: r.serious,
    freePass: r.freePass,
    excused: r.excused,
  }
}

let mockIdCounter = 0
/** `crypto.randomUUID()` where available; a counter-based id otherwise (the resolution note's
 *  fallback for a test env without it) — mock-mode ids only, never sent to the server. */
function newMockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  mockIdCounter += 1
  return `mock-skip-${mockIdCounter}`
}

type UpsertVars = { target: PlannedSkipKey; reason: SkipReason; text?: string | null; plannedKcal?: number | null }

/** The stored free text, mirroring the backend: only for OTHER, trimmed, blank → null. */
function otherText(reason: SkipReason, text?: string | null): string | null {
  if (reason !== 'OTHER') return null
  const t = text?.trim()
  return t ? t : null
}

/** What the mock server would answer to an upsert: replaces the existing row for the same target
 *  (identity match, `findSkip`) or appends a new one, then re-judges the WHOLE list — a fresh
 *  free-pass race every time a row's reason (and so its seriousness) changes. */
function mockUpsert(prev: PlannedSkip[], vars: UpsertVars): PlannedSkip[] {
  const existing = findSkip(prev, vars.target)
  const row: PlannedSkip = {
    ...vars.target,
    id: existing?.id ?? newMockId(),
    reasonCategory: vars.reason,
    reasonText: otherText(vars.reason, vars.text),
    ...(vars.target.kind === 'MEAL' ? { plannedKcal: vars.plannedKcal ?? null } : {}),
    source: 'USER',
    serious: false,
    freePass: false,
    excused: false,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    // Giving a reason to a coach (ADVICE) skip keeps it excused (review I3, mirrors the server).
    ...(existing && (existing.source === 'ADVICE' || existing.adviceBacked) ? { adviceBacked: true } : {}),
  }
  const next = existing ? prev.map((s) => (s === existing ? row : s)) : [...prev, row]
  return judge(next)
}

/**
 * Planned skips (Kihagyás S1, mezo-q4xt2.1) — one-tap skip of a planned gym/sport/run occurrence,
 * dual-mode per `readinessHooks.ts`'s recipe. `useTrain()`'s own `plannedSkips` field reads the
 * SAME query (this hook), so the whole app shares one fetch of the skip window, never two.
 *
 * Mock mode: a client-owned cache, starting empty (no skip has ever happened) — writes edit it
 * directly and re-run `judge()` (the TS mirror of `PlannedSkipPolicy`), matching the server's
 * read-time counting rule. Real mode: the server's own verdicts are trusted verbatim; a write
 * invalidates this query plus today's workout/readiness reads, whose plan a GYM skip can change.
 */
export function usePlannedSkips() {
  const mock = isMockMode()
  const qc = useQueryClient()
  const { fromIso, toIso } = skipWindow()
  const queryKey = [...PLANNED_SKIPS_QUERY_KEY, fromIso] as const

  const { data, isPending } = useDualQuery<PlannedSkip[]>({
    queryKey,
    mockData: [],
    realFetch: () => skipApi.list(fromIso, toIso).then((rows) => rows.map(toPlannedSkip)),
    realEmpty: [],
    // Every `useTrain()` mount observes this query — the app default, not always-stale (mezo-5cmq).
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })

  const invalidate = useCallback(() => invalidateAfterWrite(qc), [qc])

  const upsertMutation = useMutation({
    mutationFn: async (vars: UpsertVars): Promise<{ list?: PlannedSkip[]; row: PlannedSkip }> => {
      // A DAY row is a kímélő-mód protected date (S2), owned by `recoveryHooks.ts` — never a skip write.
      if (vars.target.kind === 'DAY') throw new Error('a protected recovery day is not a planned skip')
      if (mock) {
        const prev = qc.getQueryData<PlannedSkip[]>(queryKey) ?? []
        const list = mockUpsert(prev, vars)
        const row = findSkip(list, vars.target)
        if (!row) throw new Error('planned skip upsert produced no matching row')
        return { list, row }
      }
      const req: PlannedSkipRequest = {
        date: vars.target.date,
        kind: vars.target.kind,
        dayOfWeek: vars.target.dayOfWeek ?? null,
        time: vars.target.time ?? null,
        sessionKey: vars.target.sessionKey ?? null,
        reasonCategory: vars.reason,
        reasonText: otherText(vars.reason, vars.text),
        // The slot's planned kcal snapshot — a MEAL skip only (Kihagyás S3).
        ...(vars.target.kind === 'MEAL' ? { plannedKcal: vars.plannedKcal ?? null } : {}),
      }
      return { row: toPlannedSkip(await skipApi.upsert(req)) }
    },
    onSuccess: ({ list }) => {
      if (list) qc.setQueryData(queryKey, list)
      else invalidate()
    },
  })

  const undoMutation = useMutation({
    mutationFn: async (id: string): Promise<{ list?: PlannedSkip[] }> => {
      if (mock) {
        const prev = qc.getQueryData<PlannedSkip[]>(queryKey) ?? []
        return { list: judge(prev.filter((s) => s.id !== id)) }
      }
      await skipApi.undo(id)
      return {}
    },
    onSuccess: ({ list }) => {
      if (list) qc.setQueryData(queryKey, list)
      else invalidate()
    },
  })

  const { mutate: upsertMutate } = upsertMutation
  const { mutate: undoMutate } = undoMutation

  // `onDone` runs only on success (a failure is toasted by the global mutation cache).
  const setReason = useCallback(
    (t: PlannedSkipKey, reason: SkipReason, text?: string | null, onDone?: (s: PlannedSkip) => void, plannedKcal?: number | null) =>
      upsertMutate({ target: t, reason, text, plannedKcal }, { onSuccess: ({ row }) => onDone?.(row) }),
    [upsertMutate],
  )
  const skip = useCallback(
    (t: PlannedSkipKey, onDone?: (s: PlannedSkip) => void, plannedKcal?: number | null) =>
      setReason(t, 'NONE', undefined, onDone, plannedKcal),
    [setReason],
  )
  const undo = useCallback(
    (id: string, onDone?: () => void) => undoMutate(id, { onSuccess: () => onDone?.() }),
    [undoMutate],
  )

  return {
    skips: data,
    isPending,
    saving: upsertMutation.isPending || undoMutation.isPending,
    skip,
    setReason,
    undo,
  }
}
