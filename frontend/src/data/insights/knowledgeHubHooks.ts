// ============================================================
// Mezo · knowledgeHubHooks — dual-mode olvasó/író hookok a Tudástár hubhoz (S6, mezo-d6ivw.6):
// megerősített észrevételek, alanyonkénti hatások, egy tény bizonyítéka, és a hub összes
// művelete (némítás/szerkesztés/felejtés a tényeken, észrevételeken és hatás-alanyokon).
// A "no static fallback in real mode" szabályt a `useDualQuery` + az `orDegraded` páros tartja:
// egy 404 (kapcsoló kikapcsolva) `degraded: true`-ra fordul, SOSEM hibára.
// ============================================================
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { ApiError } from '@/data/_client/api'
import { knowledgeHubApi, type KnowledgeObservation } from '@/data/insights/knowledgeHubApi'
import { knowledgeApi } from '@/data/insights/knowledgeApi'
import type { KnowledgeBootstrap } from '@/data/insights/knowledgeHooks'
import { MOCK_EFFECT_SUBJECTS, MOCK_FACT_EVIDENCE, MOCK_OBSERVATIONS } from '@/data/insights/knowledgeHub'
import { MOCK_PERSON_EFFECTS } from '@/data/me/people'
import type { EffectSubject, KnowledgeFact, PersonEffect } from '@/data/types'
import type { EvidenceItem } from '@/shared/ui/evidence/observationEvidence'

const OBS_KEY = ['knowledge-observations'] as const
const EFFECTS_KEY = ['effect-subjects'] as const
const KNOWLEDGE_KEY = ['knowledge'] as const

interface Section<T> { items: T; degraded: boolean }

/** Real-mode 404 (a companion/reflexió kapcsoló kikapcsolva) → `degraded`, SOSEM hiba. */
async function orDegraded<T>(fetch: () => Promise<T>, empty: T): Promise<Section<T>> {
  try {
    return { items: await fetch(), degraded: false }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { items: empty, degraded: true }
    throw err
  }
}

export function useKnowledgeObservations() {
  const { data, isPending, isError, refetch } = useDualQuery<Section<KnowledgeObservation[]>>({
    queryKey: OBS_KEY,
    mockData: { items: MOCK_OBSERVATIONS, degraded: false },
    realFetch: () => orDegraded(knowledgeHubApi.listObservations, []),
    realEmpty: { items: [], degraded: false },
  })
  return { observations: data.items, degraded: data.degraded, isPending, isError, refetch }
}

export function useEffectSubjects() {
  const { data, isPending, isError, refetch } = useDualQuery<Section<EffectSubject[]>>({
    queryKey: EFFECTS_KEY,
    mockData: { items: MOCK_EFFECT_SUBJECTS, degraded: false },
    realFetch: () => orDegraded(knowledgeHubApi.listEffects, []),
    realEmpty: { items: [], degraded: false },
  })
  return { subjects: data.items, degraded: data.degraded, isPending, isError, refetch }
}

export function useFactEvidence(factId: string | null) {
  const { data, isPending } = useDualQuery<Section<EvidenceItem[]>>({
    queryKey: ['fact-evidence', factId],
    mockData: { items: factId ? (MOCK_FACT_EVIDENCE[factId] ?? []) : [], degraded: false },
    realFetch: () => orDegraded(() => knowledgeHubApi.factEvidence(factId!), []),
    realEmpty: { items: [], degraded: false },
    enabled: !!factId,
  })
  return { evidence: data.items, isPending: !!factId && isPending, unavailable: data.degraded }
}

/** Every cache a hub write touches — snapshotted before the optimistic patch, restored on failure. */
const HUB_KEYS: readonly (readonly unknown[])[] = [KNOWLEDGE_KEY, OBS_KEY, EFFECTS_KEY, ['person-effects']]
type Snapshot = Array<[readonly unknown[], unknown]>

/**
 * S6 final review: every hub write patches the cache when it STARTS (both modes — in mock mode
 * the patch is the whole write), so a forgotten row never flashes back between the undo window
 * closing and the refetch. A failed real-mode write restores the snapshot; the returned promise
 * rejects, so the section can say it did not happen. Real mode refetches on settle either way.
 */
function useOptimisticHubWrite<V>(write: (v: V) => Promise<unknown>, patch: (qc: QueryClient, v: V) => void) {
  const qc = useQueryClient()
  const mock = isMockMode()
  return useMutation<unknown, Error, V, Snapshot>({
    mutationFn: async (v) => { if (!mock) await write(v) },
    onMutate: async (v) => {
      await Promise.all(HUB_KEYS.map((queryKey) => qc.cancelQueries({ queryKey })))
      const snap: Snapshot = qc.getQueriesData({ predicate: (q) => HUB_KEYS.some((k) => k.every((part, i) => q.queryKey[i] === part)) })
      patch(qc, v)
      return snap
    },
    onError: (_err, _v, snap) => { snap?.forEach(([key, data]) => qc.setQueryData(key, data)) },
    onSettled: mock ? undefined : () => Promise.all(HUB_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
}

type EffectInput = { kind: 'person' | 'event'; key: string; mode: 'muted' | 'forgotten' | 'on' }

export function useKnowledgeHubActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const muteFactM = useOptimisticHubWrite(
    ({ id, on }: { id: string; on: boolean }) => knowledgeApi.toggleFact(id, !on),
    (c, { id, on }) => patchFact(c, id, on
      ? { active: false, mutedReason: 'user', mutedAt: new Date().toISOString() }
      : { active: true, mutedReason: null, mutedAt: null }),
  )
  const editFactM = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      if (mock) { patchFact(qc, id, { text }); return }
      await knowledgeHubApi.editFact(id, text)
    },
    onSuccess: mock ? undefined : () => Promise.all(HUB_KEYS.map((queryKey) => qc.invalidateQueries({ queryKey }))),
  })
  const forgetFactM = useOptimisticHubWrite((id: string) => knowledgeHubApi.forgetFact(id), removeFact)
  const forgetObsM = useOptimisticHubWrite((patternId: string) => knowledgeHubApi.forgetObservation(patternId), removeObservation)
  const effectM = useOptimisticHubWrite(
    (i: EffectInput) => (i.mode === 'on'
      ? knowledgeHubApi.unmuteEffect(i.kind, i.key)
      : knowledgeHubApi.muteEffect(i.kind, i.key, i.mode)),
    (c, i) => patchEffect(c, i.kind, i.key, i.mode, mock),
  )

  return {
    /** Rejects when the write failed (the cache is already rolled back) — the caller says so. */
    muteFact: (id: string, on: boolean) => muteFactM.mutateAsync({ id, on }),
    editFact: (id: string, text: string) => editFactM.mutate({ id, text }),
    forgetFact: (id: string) => forgetFactM.mutateAsync(id),
    forgetObservation: (patternId: string) => forgetObsM.mutateAsync(patternId),
    muteEffect: (kind: 'person' | 'event', key: string, on: boolean) =>
      effectM.mutateAsync({ kind, key, mode: on ? 'muted' : 'on' }),
    forgetEffect: (kind: 'person' | 'event', key: string) => effectM.mutateAsync({ kind, key, mode: 'forgotten' }),
  }
}

// --- cache patchers: the whole write in mock mode, the optimistic half in real mode ---

function patchFact(qc: QueryClient, id: string, patch: Partial<KnowledgeFact>) {
  qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
    if (!old) return old
    return { ...old, facts: old.facts.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
  })
  // the observation the fact was learned from shows the same state (real mode refetches it)
  if ('active' in patch) {
    qc.setQueryData<Section<KnowledgeObservation[]>>(OBS_KEY, (old) => {
      if (!old) return old
      return {
        ...old,
        items: old.items.map((o) => (o.factId === id
          ? { ...o, factMutedReason: patch.mutedReason ?? null, factMutedAt: patch.mutedAt ?? null }
          : o)),
      }
    })
  }
}

/** Egy tény elfelejtése — a belőle tanult észrevétel is eltűnik: egy dolgot egyszer számolunk. */
function removeFact(qc: QueryClient, id: string) {
  qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
    if (!old) return old
    return { ...old, facts: old.facts.filter((f) => f.id !== id) }
  })
  const gone = qc.getQueryData<Section<KnowledgeObservation[]>>(OBS_KEY)?.items.filter((o) => o.factId === id) ?? []
  qc.setQueryData<Section<KnowledgeObservation[]>>(OBS_KEY, (old) => {
    if (!old) return old
    return { ...old, items: old.items.filter((o) => o.factId !== id) }
  })
  releaseReplaced(qc, gone)
}

/**
 * The backend's ForgetService.releaseSuperseded, mirrored: when the newer half of a drift pair is
 * forgotten, nothing replaces the older half any more — its "felülírta" link goes, and a fact
 * that was muted as superseded becomes the user's own mute (silent, one tap from Visszakapcsolom).
 */
function releaseReplaced(qc: QueryClient, gone: KnowledgeObservation[]) {
  const originals = new Set(gone.map((o) => o.replacesPatternId).filter((x): x is string => !!x))
  if (originals.size === 0) return
  const now = new Date().toISOString()
  const releasedFacts = new Set<string>()
  qc.setQueryData<Section<KnowledgeObservation[]>>(OBS_KEY, (old) => {
    if (!old) return old
    return {
      ...old,
      items: old.items.map((o) => {
        if (!originals.has(o.patternId)) return o
        if (o.factMutedReason !== 'superseded') return { ...o, replacedByPatternId: null }
        if (o.factId) releasedFacts.add(o.factId)
        return { ...o, replacedByPatternId: null, factMutedReason: 'user', factMutedAt: now }
      }),
    }
  })
  if (releasedFacts.size === 0) return
  qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
    if (!old) return old
    return {
      ...old,
      facts: old.facts.map((f) => (releasedFacts.has(f.id) && f.mutedReason === 'superseded'
        ? { ...f, mutedReason: 'user', mutedAt: now } : f)),
    }
  })
}

/** Egy észrevétel elfelejtése — a belőle tanult tény is eltűnik (fordítottja a fentinek). */
function removeObservation(qc: QueryClient, patternId: string) {
  const before = qc.getQueryData<Section<KnowledgeObservation[]>>(OBS_KEY)
  const gone = before?.items.filter((o) => o.patternId === patternId) ?? []
  const factId = gone[0]?.factId ?? null
  qc.setQueryData<Section<KnowledgeObservation[]>>(OBS_KEY, (old) => {
    if (!old) return old
    return { ...old, items: old.items.filter((o) => o.patternId !== patternId) }
  })
  releaseReplaced(qc, gone)
  if (factId) {
    qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
      if (!old) return old
      return { ...old, facts: old.facts.filter((f) => f.id !== factId) }
    })
  }
}

function patchEffect(qc: QueryClient, kind: 'person' | 'event', key: string, mode: 'muted' | 'forgotten' | 'on', mock: boolean) {
  // the person page hides a muted/forgotten subject; switching back on restores the mock seed
  // (real mode: the settle refetch brings the rows back)
  if (kind === 'person' && (mode !== 'on' || mock)) {
    qc.setQueryData<PersonEffect[]>(['person-effects', key], mode === 'on' ? (MOCK_PERSON_EFFECTS[key] ?? []) : [])
  }
  qc.setQueryData<Section<EffectSubject[]>>(EFFECTS_KEY, (old) => {
    if (!old) return old
    if (mode === 'forgotten') {
      return { ...old, items: old.items.filter((s) => !(s.kind === kind && s.key === key)) }
    }
    return {
      ...old,
      items: old.items.map((s) => (s.kind === kind && s.key === key ? { ...s, muted: mode === 'muted' } : s)),
    }
  })
}
