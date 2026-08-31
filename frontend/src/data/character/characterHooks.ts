// Dual-mode hooks for the Karakter dossier (mezo-1gim.13). Reads follow the useDualQuery idiom
// (useBiometricProfile's 404->null precedent for the switch-off degraded state); the claim
// feedback + bootstrap mutations follow the usePatternActions/diagnosisHooks precedent for
// mock-mode cache patching and real-mode status mapping.
import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import { characterApi } from '@/data/character/characterApi'
import type {
  CharacterClaimDto,
  CharacterClaimFeedbackRequest,
  CharacterConferenceResponse,
  CharacterConferenceSummary,
  CharacterDimensionResponse,
  CharacterExpertDto,
  CharacterFeedItem,
  CharacterOverviewResponse,
  CharacterRunResponse,
  CharacterRunSummary,
} from '@/data/character/characterApi'
import {
  MOCK_BOOTSTRAP_CONFERENCE,
  MOCK_CONFERENCES,
  MOCK_CONFERENCE_DETAIL,
  MOCK_DIMENSIONS,
  MOCK_EXPERTS,
  MOCK_FEED,
  MOCK_OVERVIEW,
  MOCK_OVERVIEW_EMPTY,
  MOCK_RUNS,
  MOCK_RUN_DETAIL,
} from '@/data/character/characterMock'

const OVERVIEW_KEY = ['characterOverview']
const DIMENSION_KEY = ['characterDimension']
const FEED_KEY = ['characterFeed']

/** The dossier overview — 404 (character switch off) is the honest degraded state, never a
 *  crash (the useBiometricProfile idiom). Mock mode starts EMPTY (pre-bootstrap, spec §2); the
 *  bootstrap ceremony (useCharacterBootstrap) flips this cache entry to the seeded dossier. */
export function useCharacterOverview(): { overview: CharacterOverviewResponse | null; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterOverviewResponse | null>({
    queryKey: OVERVIEW_KEY,
    mockData: MOCK_OVERVIEW_EMPTY,
    realFetch: async () => {
      try {
        return await characterApi.overview()
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { overview: data, isLoading: isPending }
}

/** One dimension in full. 404 (no such key, or the switch is off) -> null. */
export function useCharacterDimension(key: string): { dimension: CharacterDimensionResponse | null; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterDimensionResponse | null>({
    queryKey: [...DIMENSION_KEY, key],
    mockData: MOCK_DIMENSIONS[key] ?? null,
    realFetch: async () => {
      try {
        return await characterApi.dimension(key)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { dimension: data, isLoading: isPending }
}

/** Recent expert observations + conference-change diffs. `[]` is the honest empty state. */
export function useCharacterFeed(limit?: number): { items: CharacterFeedItem[]; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterFeedItem[]>({
    queryKey: [...FEED_KEY, limit ?? null],
    mockData: limit != null ? MOCK_FEED.slice(0, limit) : MOCK_FEED,
    realFetch: () => characterApi.feed(limit),
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { items: data, isLoading: isPending }
}

/** The profiling team catalog — always available (a pure static read, character-switch only). */
export function useCharacterExperts(): { experts: CharacterExpertDto[]; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterExpertDto[]>({
    queryKey: ['characterExperts'],
    mockData: MOCK_EXPERTS,
    realFetch: async () => (await characterApi.experts()).experts,
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { experts: data, isLoading: isPending }
}

/** Konzílium summaries, newest first — possibly empty (no crash on a brand-new dossier). */
export function useCharacterConferences(): { conferences: CharacterConferenceSummary[]; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterConferenceSummary[]>({
    queryKey: ['characterConferences'],
    mockData: MOCK_CONFERENCES,
    realFetch: () => characterApi.conferences(),
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { conferences: data, isLoading: isPending }
}

/** One konzílium's full transcript. `id === null` (nothing selected yet) never fetches. */
export function useCharacterConference(id: string | null): { conference: CharacterConferenceResponse | null; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterConferenceResponse | null>({
    queryKey: ['characterConference', id ?? 'none'],
    mockData: id != null ? MOCK_CONFERENCE_DETAIL[id] ?? null : null,
    realFetch: async () => {
      if (id == null) return null
      try {
        return await characterApi.conference(id)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { conference: data, isLoading: isPending }
}

type FeedbackKind = CharacterClaimFeedbackRequest['kind']

/** In-memory log of "pontosítom" corrections a live server would persist against the claim
 *  (CharacterClaimDto carries no user-feedback field to echo back) — kept only so the mock
 *  demo/tests can observe that a correction was recorded. Not consumed by any hook return value. */
export const mockClaimFeedbackLog: { claimId: string; kind: FeedbackKind; text?: string; at: string }[] = []

/** Applies one feedback verdict to a claims array (mock-mode cache patch, S6 semantics):
 *  TALAL bumps confidence +0.05 capped at 0.85 (the word tier falls out of confidenceWord(),
 *  never hardcoded here); NEM_IGAZ retires the claim — the DTO has no status field to flip, so
 *  the closest honest mock behavior is dropping it from the dossier the same way a live server
 *  would stop surfacing a retired claim; PONTOSITOM leaves the claim's displayed fields as-is
 *  (the correction text is recorded in mockClaimFeedbackLog, not echoed on the claim). */
function applyFeedback(claims: CharacterClaimDto[], claimId: string, kind: FeedbackKind): CharacterClaimDto[] {
  if (kind === 'NEM_IGAZ') return claims.filter((c) => c.id !== claimId)
  if (kind === 'TALAL') {
    return claims.map((c) => (c.id === claimId ? { ...c, confidence: Math.min(0.85, c.confidence + 0.05) } : c))
  }
  return claims
}

/** Daniel's answer to one claim (talál / nem igaz / pontosítom, spec §7). Real mode POSTs and
 *  invalidates the three surfaces a claim can appear on; mock mode patches every cached
 *  dimension + the overview's topClaims in place, so the demo stays coherent without a reload. */
export function useClaimFeedback() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async ({ claimId, kind, text }: { claimId: string; kind: FeedbackKind; text?: string }) => {
      if (mock) {
        // M8 (final review): this in-memory log only exists for the mock demo/tests to observe
        // — a real backend persists the feedback itself, so logging it here too (unconditionally,
        // as it used to) fabricated a client-side record of every real-mode submission the app
        // never actually keeps.
        mockClaimFeedbackLog.push({ claimId, kind, text, at: new Date().toISOString() })
        qc.setQueriesData<CharacterDimensionResponse>({ queryKey: DIMENSION_KEY }, (current) => {
          if (!current) return current
          return { ...current, claims: applyFeedback(current.claims, claimId, kind) }
        })
        qc.setQueryData<CharacterOverviewResponse>(OVERVIEW_KEY, (current) => {
          if (!current) return current
          return {
            ...current,
            dimensions: current.dimensions.map((d) => ({ ...d, topClaims: applyFeedback(d.topClaims, claimId, kind) })),
          }
        })
        return
      }
      await characterApi.submitClaimFeedback(claimId, { kind, text })
    },
    onSuccess: mock
      ? undefined
      : () => {
          qc.invalidateQueries({ queryKey: DIMENSION_KEY })
          qc.invalidateQueries({ queryKey: OVERVIEW_KEY })
          qc.invalidateQueries({ queryKey: FEED_KEY })
        },
  })

  const submit = useCallback(
    (claimId: string, kind: FeedbackKind, text?: string) => mutation.mutateAsync({ claimId, kind, text }),
    [mutation],
  )
  return { submit, pending: mutation.isPending }
}

export type CharacterBootstrapResult = 'created' | 'empty' | 'conflict'

/** The one-time bootstrap ceremony (deep-read over existing history). Real mode maps
 *  200->'created', 204->'empty' (nothing to read yet), 409->'conflict' (already bootstrapped).
 *  Mock mode simulates the deep read with a short delay, then flips the cached overview from
 *  the empty pre-bootstrap seed to the full seeded dossier — the ceremony needs a real state
 *  change to reveal (mirrors the real backend's konzílium-then-refetch flow). */
export function useCharacterBootstrap(): { start: () => void; pending: boolean; result: CharacterBootstrapResult | null } {
  const qc = useQueryClient()
  const mock = isMockMode()

  const mutation = useMutation({
    mutationFn: async (): Promise<CharacterBootstrapResult> => {
      if (mock) {
        await new Promise((resolve) => setTimeout(resolve, 900))
        qc.setQueryData(OVERVIEW_KEY, MOCK_OVERVIEW)
        return 'created'
      }
      try {
        const conference = await characterApi.bootstrap()
        return conference === undefined ? 'empty' : 'created'
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) return 'conflict'
        throw e
      }
    },
    onSuccess: (result) => {
      if (!mock && result === 'created') {
        // M-fix (final review): a successful bootstrap also stands up the first konzílium and
        // seeds the feed — invalidating the overview alone left those two surfaces stuck on
        // their pre-bootstrap (empty) cache entries until some unrelated refetch happened to
        // land.
        qc.invalidateQueries({ queryKey: OVERVIEW_KEY })
        qc.invalidateQueries({ queryKey: ['characterConferences'] })
        qc.invalidateQueries({ queryKey: FEED_KEY })
      }
    },
  })

  return {
    start: () => mutation.mutate(),
    pending: mutation.isPending,
    result: mutation.data ?? null,
  }
}

// Re-exported so page components can reach the seeded bootstrap conference (e.g. to show what
// "just ran" after the mock ceremony) without importing the mock module directly.
export { MOCK_BOOTSTRAP_CONFERENCE }

// ---------------------------------------------------------------------------
// Gépterem (mezo-1gim.14) — the run-log timeline. Mock mode filters the full seeded set by the
// requested [fromIso, toIso] range client-side (mirroring the backend's day-range query); real
// mode passes the range straight through to the endpoint, which does the filtering server-side.
// ---------------------------------------------------------------------------

/** Run summaries whose `day` falls within [fromIso, toIso] (inclusive), newest day first. */
export function useCharacterRuns(fromIso: string, toIso: string): { runs: CharacterRunSummary[]; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterRunSummary[]>({
    queryKey: ['characterRuns', fromIso, toIso],
    mockData: MOCK_RUNS.filter((r) => r.day >= fromIso && r.day <= toIso),
    realFetch: () => characterApi.runs(fromIso, toIso),
    realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { runs: data, isLoading: isPending }
}

/** One run's full detail (summary + observations). `id === null` (nothing selected yet) never
 *  fetches — the useCharacterConference idiom. 404 (unknown/foreign run) -> null. */
export function useCharacterRun(id: string | null): { run: CharacterRunResponse | null; isLoading: boolean } {
  const { data, isPending } = useDualQuery<CharacterRunResponse | null>({
    queryKey: ['characterRun', id ?? 'none'],
    mockData: id != null ? MOCK_RUN_DETAIL[id] ?? null : null,
    realFetch: async () => {
      if (id == null) return null
      try {
        return await characterApi.run(id)
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null
        throw e
      }
    },
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { run: data, isLoading: isPending }
}
