// ============================================================
// Mezo · lifegoalHooks — dual-mode reads + mutations for life goals (mezo-iizd.1).
// Mock mode keeps an in-memory list in the QueryClient cache so the wizard/status flows work
// without a backend; real mode invalidates ['lifeGoals'] after every write.
// ============================================================
import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { DEFAULT_QUERY_STALE_TIME_MS, useDualQuery } from '@/data/useDualQuery'
import {
  lifegoalApi, type LifeGoalPillarInput, type LifeGoalProgressResponse, type LifeGoalProposeRequest,
  type LifeGoalProposeResponse, type LifeGoalResponse, type LifeGoalStatus, type LifeGoalTodayResponse,
  type LifeGoalUpsertRequest, type SignalCatalogEntry,
} from '@/data/lifegoal/lifegoalApi'
import { MOCK_LIFE_GOALS, MOCK_SIGNAL_CATALOG, mockPropose, mockProgress, mockToday } from '@/data/lifegoal/lifegoalMock'
import { addDays, localDateString } from '@/shared/lib/dates'

// Mirrors LifeGoalService.TRANSITIONS — keep in sync.
const MOCK_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived'], active: ['parked', 'done', 'archived'],
  parked: ['active', 'done', 'archived'], done: ['archived'], archived: [],
}

// Mirrors LifeGoalPillarService.validate's cap + catalog/kind gate (habit-source pillars skip the
// catalog check there too). Skill validation is NOT mirrored — the FE has no taxonomy mirror, and
// inventing one here would drift; the real backend remains the authority.
function mockValidatePillars(pillars: LifeGoalPillarInput[] | undefined) {
  const list = pillars ?? []
  if (list.length > 5) throw new Error('LIFE_GOAL_TOO_MANY_PILLARS')
  for (const p of list) {
    if (p.source.type === 'habit') continue
    // Twin of features/me/logic/pillarFromCatalog.ts's findCatalogEntry — layering forbids
    // data/ from importing features/me/, so this five-field match is duplicated rather than shared.
    const entry = MOCK_SIGNAL_CATALOG.find((e) =>
      e.source.type === p.source.type && e.source.key === p.source.key
      && e.source.skillKey === p.source.skillKey && e.source.measure === p.source.measure
      && e.source.ring === p.source.ring)
    if (!entry) throw new Error('LIFE_GOAL_UNKNOWN_SIGNAL')
    if (!entry.kinds.includes(p.kind)) throw new Error('LIFE_GOAL_KIND_NOT_ALLOWED')
  }
}

export const LIFE_GOALS_KEY = ['lifeGoals'] as const
export const SIGNAL_CATALOG_KEY = ['lifeGoalSignals'] as const
export const LIFE_GOAL_PROGRESS_KEY = (id: string) => ['lifeGoalProgress', id] as const
export const LIFE_GOAL_TODAY_KEY = ['lifeGoalToday'] as const

export function useLifeGoals() {
  const q = useDualQuery<LifeGoalResponse[]>({
    queryKey: LIFE_GOALS_KEY, mockData: MOCK_LIFE_GOALS, realFetch: lifegoalApi.list, realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { goals: q.data, isPending: q.isPending, isError: q.isError, refetch: q.refetch }
}

export function useLifeGoal(id: string | undefined) {
  const { goals, isPending, isError, refetch } = useLifeGoals()
  // `isError`/`refetch` are threaded out so the detail page can tell "the fetch failed" from
  // "there is no such goal" — a failed list read must never render as a not-found (house error
  // standard: the loading/empty/error triad is three distinct states, never two).
  return { goal: id ? goals.find((g) => g.id === id) ?? null : null, isPending, isError, refetch, goalCount: goals.length }
}

export function useSignalCatalog() {
  const q = useDualQuery<SignalCatalogEntry[]>({
    queryKey: SIGNAL_CATALOG_KEY, mockData: MOCK_SIGNAL_CATALOG,
    realFetch: async () => (await lifegoalApi.signals()).entries, realEmpty: [],
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  // `entries` is the established field name (PillarCatalogSheet/PillarCard already destructure
  // it); `isError`/`refetch` are added here for JelekPage's (mezo-iizd.7) loading/error/list
  // triad, the same idiom useLifeGoals/useLifeGoalToday already expose.
  return { entries: q.data, isPending: q.isPending, isError: q.isError, refetch: q.refetch }
}

/** 28 napos ablak: from = ma−27, to = ma (ISO yyyy-MM-dd). */
export function useLifeGoalProgress(id: string | undefined) {
  const to = localDateString()
  const from = addDays(to, -27)
  const q = useDualQuery<LifeGoalProgressResponse | null>({
    queryKey: LIFE_GOAL_PROGRESS_KEY(id ?? '_none'),
    mockData: id ? mockProgress(id) : null,
    realFetch: async () => (id ? lifegoalApi.progress(id, from, to) : null),
    realEmpty: null,
    realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { progress: q.data, isPending: q.isPending, isError: q.isError }
}

export function useLifeGoalToday() {
  const q = useDualQuery<LifeGoalTodayResponse>({
    queryKey: LIFE_GOAL_TODAY_KEY, mockData: mockToday(), realFetch: lifegoalApi.today,
    realEmpty: { goals: [] }, realStaleTime: DEFAULT_QUERY_STALE_TIME_MS,
  })
  return { today: q.data, isPending: q.isPending, isError: q.isError }
}

function mockId() { return `lg-${Math.random().toString(36).slice(2, 8)}` }

export function useLifeGoalMutations() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const patch = (fn: (list: LifeGoalResponse[]) => LifeGoalResponse[]) =>
    qc.setQueryData<LifeGoalResponse[]>(LIFE_GOALS_KEY, (cur) => fn(cur ?? MOCK_LIFE_GOALS))
  const invalidate = () => { if (!mock) void qc.invalidateQueries({ queryKey: LIFE_GOALS_KEY }) }

  const create = useMutation({
    mutationFn: async (req: LifeGoalUpsertRequest): Promise<LifeGoalResponse> => {
      if (mock) {
        mockValidatePillars(req.pillars)
        const g: LifeGoalResponse = {
          id: mockId(), title: req.title, whyText: req.whyText, frame: req.frame ?? 'unset',
          dimension: req.dimension, secondaryDimension: req.secondaryDimension, status: 'draft',
          startDate: req.startDate, targetDate: req.targetDate, obstacleText: req.obstacleText,
          ifThenPlans: req.ifThenPlans ?? [],
          pillars: (req.pillars ?? []).map((p, i) => ({ ...p, id: mockId(), position: i, weight: p.weight ?? 1, active: p.active ?? true })),
        }
        patch((l) => [g, ...l]); return g
      }
      const g = await lifegoalApi.create(req)
      // `useLifeGoal` derives the detail page from THIS list query, and `invalidateQueries` does
      // not refetch an inactive query — so the wizard's navigation to /me/goals/{id} would land
      // on a stale list without the new id and flash "Nincs ilyen cél.". Seed the created goal
      // into the cache before `onSuccess`'s invalidate reconciles it with the server.
      qc.setQueryData<LifeGoalResponse[]>(LIFE_GOALS_KEY, (cur) => [g, ...(cur ?? [])])
      return g
    },
    onSuccess: invalidate,
  })
  const changeStatus = useMutation({
    mutationFn: async (v: { id: string; status: LifeGoalStatus }) => {
      if (mock) {
        const cur = (qc.getQueryData<LifeGoalResponse[]>(LIFE_GOALS_KEY) ?? MOCK_LIFE_GOALS).find((g) => g.id === v.id)
        if (!cur) throw new Error('RESOURCE_NOT_FOUND')
        if (cur.status === v.status) return   // idempotent no-op, mirrors LifeGoalService
        if (!MOCK_TRANSITIONS[cur.status]?.includes(v.status)) throw new Error('LIFE_GOAL_INVALID_STATUS_TRANSITION')
        patch((l) => l.map((g) => (g.id === v.id ? { ...g, status: v.status,
          activatedAt: v.status === 'active' ? (g.activatedAt ?? new Date().toISOString()) : g.activatedAt,
          closedAt: (v.status === 'done' || v.status === 'archived') && !g.closedAt ? new Date().toISOString() : g.closedAt } : g)))
        return
      }
      await lifegoalApi.changeStatus(v.id, v.status)
    },
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: async (v: { id: string; req: LifeGoalUpsertRequest }) => {
      if (mock) {
        // Mirrors LifeGoalService.apply: full replace, not a partial patch — an omitted optional
        // (whyText/targetDate/obstacleText/frame) clears rather than survives from the old goal.
        patch((l) => l.map((g) => (g.id !== v.id ? g : {
          id: g.id, status: g.status, pillars: g.pillars, activatedAt: g.activatedAt, closedAt: g.closedAt,
          title: v.req.title, whyText: v.req.whyText, frame: v.req.frame ?? 'unset',
          dimension: v.req.dimension, secondaryDimension: v.req.secondaryDimension,
          startDate: v.req.startDate, targetDate: v.req.targetDate, obstacleText: v.req.obstacleText,
          ifThenPlans: v.req.ifThenPlans ?? [],
        })))
        return
      }
      await lifegoalApi.update(v.id, v.req)
    },
    onSuccess: invalidate,
  })
  const replacePillars = useMutation({
    mutationFn: async (v: { id: string; pillars: LifeGoalPillarInput[] }) => {
      if (mock) {
        mockValidatePillars(v.pillars)
        // Mirrors LifeGoalPillarService.replace (mezo-iizd.2): an echoed id keeps the pillar's
        // identity (and, in real mode, its evaluation history); only a new pillar gets a new id.
        patch((l) => l.map((g) => (g.id === v.id ? { ...g, pillars: v.pillars.map((p, i) => ({ ...p, id: p.id ?? mockId(), position: i, weight: p.weight ?? 1, active: p.active ?? true })) } : g)))
        return
      }
      await lifegoalApi.replacePillars(v.id, v.pillars)
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => { if (mock) { patch((l) => l.filter((g) => g.id !== id)); return } await lifegoalApi.remove(id) },
    onSuccess: invalidate,
  })

  return {
    create: useCallback((req: LifeGoalUpsertRequest, opts?: { onSuccess?: (g: LifeGoalResponse) => void; onError?: () => void }) =>
      create.mutate(req, { onSuccess: opts?.onSuccess, onError: opts?.onError }), [create]),
    update: useCallback((id: string, req: LifeGoalUpsertRequest) => update.mutate({ id, req }), [update]),
    changeStatus: useCallback((id: string, status: LifeGoalStatus, opts?: { onSuccess?: () => void; onError?: () => void }) =>
      changeStatus.mutate({ id, status }, { onSuccess: opts?.onSuccess, onError: opts?.onError }), [changeStatus]),
    replacePillars: useCallback((id: string, pillars: LifeGoalPillarInput[]) => replacePillars.mutate({ id, pillars }), [replacePillars]),
    remove: useCallback((id: string) => remove.mutate(id), [remove]),
    pending: create.isPending || update.isPending || changeStatus.isPending || replacePillars.isPending || remove.isPending,
  }
}

export function useLifeGoalPropose() {
  const mock = isMockMode()
  const m = useMutation({
    mutationFn: async (req: LifeGoalProposeRequest): Promise<LifeGoalProposeResponse> =>
      mock ? new Promise((r) => setTimeout(() => r(mockPropose(req)), 600)) : lifegoalApi.propose(req),
  })
  return { propose: useCallback((req: LifeGoalProposeRequest) => m.mutateAsync(req), [m]), pending: m.isPending }
}
