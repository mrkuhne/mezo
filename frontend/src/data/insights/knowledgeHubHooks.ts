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
import type { EffectSubject, KnowledgeFact } from '@/data/types'
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

export function useKnowledgeHubActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidateAll = () => Promise.all([
    qc.invalidateQueries({ queryKey: KNOWLEDGE_KEY }),
    qc.invalidateQueries({ queryKey: OBS_KEY }),
    qc.invalidateQueries({ queryKey: EFFECTS_KEY }),
    qc.invalidateQueries({ queryKey: ['person-effects'] }),
  ])

  const muteFactM = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      if (mock) {
        mockPatchFact(qc, id, on
          ? { active: false, mutedReason: 'user', mutedAt: new Date().toISOString() }
          : { active: true, mutedReason: null, mutedAt: null })
        return
      }
      await knowledgeApi.toggleFact(id, !on)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const editFactM = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      if (mock) { mockPatchFact(qc, id, { text }); return }
      await knowledgeHubApi.editFact(id, text)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const forgetFactM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) { mockRemoveFact(qc, id); return }
      await knowledgeHubApi.forgetFact(id)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const forgetObsM = useMutation({
    mutationFn: async (patternId: string) => {
      if (mock) { mockRemoveObservation(qc, patternId); return }
      await knowledgeHubApi.forgetObservation(patternId)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const effectM = useMutation({
    mutationFn: async (i: { kind: 'person' | 'event'; key: string; mode: 'muted' | 'forgotten' | 'on' }) => {
      if (mock) { mockPatchEffect(qc, i.kind, i.key, i.mode); return }
      if (i.mode === 'on') await knowledgeHubApi.unmuteEffect(i.kind, i.key)
      else await knowledgeHubApi.muteEffect(i.kind, i.key, i.mode)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })

  return {
    muteFact: (id: string, on: boolean) => muteFactM.mutate({ id, on }),
    editFact: (id: string, text: string) => editFactM.mutate({ id, text }),
    forgetFact: (id: string) => forgetFactM.mutateAsync(id),
    forgetObservation: (patternId: string) => forgetObsM.mutateAsync(patternId),
    muteEffect: (kind: 'person' | 'event', key: string, on: boolean) =>
      effectM.mutate({ kind, key, mode: on ? 'muted' : 'on' }),
    forgetEffect: (kind: 'person' | 'event', key: string) => effectM.mutateAsync({ kind, key, mode: 'forgotten' }),
  }
}

// --- mock-cache patchers (a knowledgeHooks.mockToggle idióma: setQueryData a base ?? seed párral) ---

function mockPatchFact(qc: QueryClient, id: string, patch: Partial<KnowledgeFact>) {
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
function mockRemoveFact(qc: QueryClient, id: string) {
  qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
    if (!old) return old
    return { ...old, facts: old.facts.filter((f) => f.id !== id) }
  })
  qc.setQueryData<Section<KnowledgeObservation[]>>(OBS_KEY, (old) => {
    if (!old) return old
    return { ...old, items: old.items.filter((o) => o.factId !== id) }
  })
}

/** Egy észrevétel elfelejtése — a belőle tanult tény is eltűnik (fordítottja a fentinek). */
function mockRemoveObservation(qc: QueryClient, patternId: string) {
  const before = qc.getQueryData<Section<KnowledgeObservation[]>>(OBS_KEY)
  const factId = before?.items.find((o) => o.patternId === patternId)?.factId ?? null
  qc.setQueryData<Section<KnowledgeObservation[]>>(OBS_KEY, (old) => {
    if (!old) return old
    return { ...old, items: old.items.filter((o) => o.patternId !== patternId) }
  })
  if (factId) {
    qc.setQueryData<KnowledgeBootstrap>(KNOWLEDGE_KEY, (old) => {
      if (!old) return old
      return { ...old, facts: old.facts.filter((f) => f.id !== factId) }
    })
  }
}

function mockPatchEffect(qc: QueryClient, kind: 'person' | 'event', key: string, mode: 'muted' | 'forgotten' | 'on') {
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
