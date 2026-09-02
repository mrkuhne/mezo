import { apiFetch } from '@/data/_client/api'
import type { components } from '@/data/_client/api.gen'
import type { HabitCatalog, HabitChainInfo, HabitDaypart, HabitDefInfo, HabitFramework, HabitSuggestion } from '@/data/types'

type CatalogWire = components['schemas']['HabitCatalogResponse']
type ChainWire = components['schemas']['HabitChainAdmin']
type DefWire = components['schemas']['HabitDefAdmin']
type ChainCreateWire = components['schemas']['HabitChainCreateRequest']
type ChainUpdateWire = components['schemas']['HabitChainUpdateRequest']
type DefCreateWire = components['schemas']['HabitDefCreateRequest']
type DefUpdateWire = components['schemas']['HabitDefUpdateRequest']
type ReorderWire = components['schemas']['HabitReorderRequest']
type SuggestRequestWire = components['schemas']['HabitSuggestRequest']
type SuggestionWire = components['schemas']['HabitSuggestion']
type SuggestResponseWire = components['schemas']['HabitSuggestResponse']

export interface HabitChainCreateInput { title: string; daypart: HabitDaypart }
export interface HabitChainUpdateInput { title?: string; daypart?: HabitDaypart; position?: number; isActive?: boolean }
export interface HabitDefCreateInput {
  chainKey: string
  title: string
  why?: string | null
  anchorCopy?: string | null
  mode: HabitDefInfo['mode']
  /** Required for DERIVED; ignored (forced to "manual") for MANUAL — mirrors HabitDefCreateRequest. */
  metric?: string
  skillKey: string
  xp: number
  linkUrl?: string | null
  position?: number
  framework?: HabitFramework | null
  anchorHabitKey?: string | null
  cue?: string | null
  craving?: string | null
  reward?: string | null
  celebration?: string | null
  identity?: string | null
}
export interface HabitDefUpdateInput {
  title?: string
  why?: string | null
  anchorCopy?: string | null
  chainKey?: string
  position?: number
  xp?: number
  linkUrl?: string | null
  isActive?: boolean
  framework?: HabitFramework | null
  anchorHabitKey?: string | null
  cue?: string | null
  craving?: string | null
  reward?: string | null
  celebration?: string | null
  identity?: string | null
}
export interface HabitSuggestInput { chainKey?: string; hint?: string }

const toDefInfo = (w: DefWire): HabitDefInfo => ({
  id: w.id,
  habitKey: w.habitKey,
  chainKey: w.chainKey,
  position: w.position,
  title: w.title,
  why: w.why ?? null,
  anchorCopy: w.anchorCopy ?? null,
  mode: w.mode,
  metric: w.metric,
  skillKey: w.skillKey,
  xp: w.xp,
  linkUrl: w.linkUrl ?? null,
  isActive: w.isActive,
  framework: w.framework ?? null,
  anchorHabitKey: w.anchorHabitKey ?? null,
  cue: w.cue ?? null,
  craving: w.craving ?? null,
  reward: w.reward ?? null,
  celebration: w.celebration ?? null,
  identity: w.identity ?? null,
})

const toSuggestion = (w: SuggestionWire): HabitSuggestion => ({
  title: w.title,
  why: w.why,
  anchorCopy: w.anchorCopy,
  skillKey: w.skillKey,
  xp: w.xp,
  chainKey: w.chainKey,
  framework: w.framework ?? null,
  cue: w.cue ?? null,
  craving: w.craving ?? null,
  reward: w.reward ?? null,
  celebration: w.celebration ?? null,
})

const toChainInfo = (w: ChainWire): HabitChainInfo => ({
  id: w.id,
  chainKey: w.chainKey,
  title: w.title,
  daypart: w.daypart,
  position: w.position,
  isActive: w.isActive,
  defs: w.defs.map(toDefInfo),
})

export const habitAdminApi = {
  catalog: (): Promise<HabitCatalog> =>
    apiFetch<CatalogWire>('/api/habit/catalog').then((r) => ({ chains: r.chains.map(toChainInfo) })),

  createChain: (input: HabitChainCreateInput): Promise<HabitChainInfo> =>
    apiFetch<ChainWire>('/api/habit/chain', {
      method: 'POST',
      body: JSON.stringify({ title: input.title, daypart: input.daypart } satisfies ChainCreateWire),
    }).then(toChainInfo),

  updateChain: (id: string, input: HabitChainUpdateInput): Promise<HabitChainInfo> =>
    apiFetch<ChainWire>(`/api/habit/chain/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...input } satisfies ChainUpdateWire),
    }).then(toChainInfo),

  deleteChain: (id: string): Promise<void> =>
    apiFetch(`/api/habit/chain/${id}`, { method: 'DELETE' }).then(() => undefined),

  reorderChain: (id: string, defIds: string[]): Promise<HabitChainInfo> =>
    apiFetch<ChainWire>(`/api/habit/chain/${id}/order`, {
      method: 'PUT',
      body: JSON.stringify({ defIds } satisfies ReorderWire),
    }).then(toChainInfo),

  createDef: (input: HabitDefCreateInput): Promise<HabitDefInfo> =>
    apiFetch<DefWire>('/api/habit/def', {
      method: 'POST',
      body: JSON.stringify({ ...input } satisfies DefCreateWire),
    }).then(toDefInfo),

  updateDef: (id: string, input: HabitDefUpdateInput): Promise<HabitDefInfo> =>
    apiFetch<DefWire>(`/api/habit/def/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...input } satisfies DefUpdateWire),
    }).then(toDefInfo),

  deleteDef: (id: string): Promise<void> =>
    apiFetch(`/api/habit/def/${id}`, { method: 'DELETE' }).then(() => undefined),

  suggest: (input: HabitSuggestInput): Promise<HabitSuggestion[]> =>
    apiFetch<SuggestResponseWire>('/api/habit/ai/suggest', {
      method: 'POST',
      body: JSON.stringify({ chainKey: input.chainKey, hint: input.hint } satisfies SuggestRequestWire),
    }).then((r) => r.suggestions.map(toSuggestion)),
}
