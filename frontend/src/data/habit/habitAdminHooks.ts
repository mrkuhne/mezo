import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import {
  habitAdminApi,
  type HabitChainCreateInput,
  type HabitChainUpdateInput,
  type HabitDefCreateInput,
  type HabitDefUpdateInput,
} from '@/data/habit/habitAdminApi'
import { mockHabitCatalog } from '@/data/habit/habitMock'
import type { HabitCatalog, HabitChainInfo, HabitDefInfo } from '@/data/types'

export const HABIT_CATALOG_KEY = ['habitCatalog'] as const

/** The full editable habit catalog (routine editor, mezo-n5e9.2). Real mode re-reads on a
 *  1-minute staleTime — the editor is the write surface, so a moderate cache window is fine
 *  (unlike habitDay's staleTime:0 lazy-eval heartbeat). Never the seed while unresolved in
 *  real mode (useDualQuery's ghost-guard). */
export function useHabitCatalog() {
  const { data, isPending } = useDualQuery<HabitCatalog>({
    queryKey: HABIT_CATALOG_KEY,
    mockData: mockHabitCatalog,
    realFetch: habitAdminApi.catalog,
    realEmpty: { chains: [] },
    realStaleTime: 60_000,
  })
  return { catalog: data, isPending }
}

export function useHabitCatalogActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: HABIT_CATALOG_KEY })
    qc.invalidateQueries({ queryKey: ['habitDay'] })
    qc.invalidateQueries({ queryKey: ['habitSummary'] })
  }

  const createChainM = useMutation({
    mutationFn: async (input: HabitChainCreateInput) => {
      if (mock) {
        mockCreateChain(qc, input)
        return
      }
      await habitAdminApi.createChain(input)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const updateChainM = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: HabitChainUpdateInput }) => {
      if (mock) {
        mockUpdateChain(qc, id, input)
        return
      }
      await habitAdminApi.updateChain(id, input)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const deleteChainM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) {
        mockDeleteChain(qc, id)
        return
      }
      await habitAdminApi.deleteChain(id)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const reorderChainM = useMutation({
    mutationFn: async ({ id, defIds }: { id: string; defIds: string[] }) => {
      if (mock) {
        mockReorderChain(qc, id, defIds)
        return
      }
      await habitAdminApi.reorderChain(id, defIds)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const createDefM = useMutation({
    mutationFn: async (input: HabitDefCreateInput) => {
      if (mock) {
        mockCreateDef(qc, input)
        return
      }
      await habitAdminApi.createDef(input)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const updateDefM = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: HabitDefUpdateInput }) => {
      if (mock) {
        mockUpdateDef(qc, id, input)
        return
      }
      await habitAdminApi.updateDef(id, input)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })
  const deleteDefM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) {
        mockDeleteDef(qc, id)
        return
      }
      await habitAdminApi.deleteDef(id)
    },
    onSuccess: mock ? undefined : invalidateAll,
  })

  return {
    createChain: (input: HabitChainCreateInput) => createChainM.mutateAsync(input).then(() => undefined),
    updateChain: (id: string, input: HabitChainUpdateInput) =>
      updateChainM.mutateAsync({ id, input }).then(() => undefined),
    deleteChain: (id: string) => deleteChainM.mutateAsync(id).then(() => undefined),
    reorderChain: (id: string, defIds: string[]) =>
      reorderChainM.mutateAsync({ id, defIds }).then(() => undefined),
    createDef: (input: HabitDefCreateInput) => createDefM.mutateAsync(input).then(() => undefined),
    updateDef: (id: string, input: HabitDefUpdateInput) =>
      updateDefM.mutateAsync({ id, input }).then(() => undefined),
    deleteDef: (id: string) => deleteDefM.mutateAsync(id).then(() => undefined),
    pending:
      createChainM.isPending || updateChainM.isPending || deleteChainM.isPending
      || reorderChainM.isPending || createDefM.isPending || updateDefM.isPending || deleteDefM.isPending,
  }
}

// --- mock-mode cache mutators (the slotTemplateHooks.mockPut/mockDelete shape) — keep the
// offline editor interactive against the ['habitCatalog'] cache. Generated ids mirror the
// backend's HabitAdminService.generateKey convention (chain_/custom_ + first 8 hex chars).
function genKey(prefix: string): string {
  return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

function findDef(catalog: HabitCatalog, id: string): { chain: HabitChainInfo; def: HabitDefInfo } | undefined {
  for (const chain of catalog.chains) {
    const def = chain.defs.find((d) => d.id === id)
    if (def) return { chain, def }
  }
  return undefined
}

function mockCreateChain(qc: ReturnType<typeof useQueryClient>, input: HabitChainCreateInput) {
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, (prev) => {
    const base = prev ?? mockHabitCatalog
    const chain: HabitChainInfo = {
      id: crypto.randomUUID(),
      chainKey: genKey('chain_'),
      title: input.title,
      daypart: input.daypart,
      position: base.chains.length + 1,
      isActive: true,
      defs: [],
    }
    return { chains: [...base.chains, chain] }
  })
  return undefined
}

function mockUpdateChain(qc: ReturnType<typeof useQueryClient>, id: string, patch: HabitChainUpdateInput) {
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, (prev) => {
    const base = prev ?? mockHabitCatalog
    return { chains: base.chains.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
  })
  return undefined
}

function mockDeleteChain(qc: ReturnType<typeof useQueryClient>, id: string) {
  const base = qc.getQueryData<HabitCatalog>(HABIT_CATALOG_KEY) ?? mockHabitCatalog
  const chain = base.chains.find((c) => c.id === id)
  if (!chain) return undefined // unknown id — nothing to delete, no real-mode 404 mirrored here
  // Mirrors HabitAdminService.deleteChain's two 409 guards (seed-chain check BEFORE the
  // empty-chain check, same order as the backend): silently dropping either would let the
  // editor delete a chain the real API would reject outright.
  if (chain.chainKey === 'MORNING' || chain.chainKey === 'EVENING') {
    throw new Error('HABIT_CHAIN_SEED')
  }
  if (chain.defs.length > 0) {
    throw new Error('HABIT_CHAIN_NOT_EMPTY')
  }
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, { chains: base.chains.filter((c) => c.id !== id) })
  return undefined
}

function mockReorderChain(qc: ReturnType<typeof useQueryClient>, id: string, defIds: string[]) {
  const base = qc.getQueryData<HabitCatalog>(HABIT_CATALOG_KEY) ?? mockHabitCatalog
  const chain = base.chains.find((c) => c.id === id)
  if (!chain) return undefined // unknown chain id — no-op, no real-mode 404 mirrored here
  const liveIds = new Set(chain.defs.map((d) => d.id))
  const requestedIds = new Set(defIds)
  const isExactPermutation = defIds.length === liveIds.size && [...liveIds].every((defId) => requestedIds.has(defId))
  if (!isExactPermutation) {
    // Mirrors HabitAdminService.reorder's SystemMessage.error("HABIT_REORDER_MISMATCH") 400 — a
    // stale/partial defIds list (e.g. a def created/deleted since the list was read) must fail
    // the write, not silently drop the defs missing from the request.
    throw new Error('HABIT_REORDER_MISMATCH')
  }
  const byId = new Map(chain.defs.map((d) => [d.id, d]))
  const reordered = defIds.map((defId, i) => ({ ...byId.get(defId)!, position: i + 1 }))
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, {
    chains: base.chains.map((c) => (c.id === id ? { ...c, defs: reordered } : c)),
  })
  return undefined
}

function mockCreateDef(qc: ReturnType<typeof useQueryClient>, input: HabitDefCreateInput) {
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, (prev) => {
    const base = prev ?? mockHabitCatalog
    const chain = base.chains.find((c) => c.chainKey === input.chainKey)
    if (!chain) return base
    const def: HabitDefInfo = {
      id: crypto.randomUUID(),
      habitKey: genKey('custom_'),
      chainKey: input.chainKey,
      position: input.position ?? chain.defs.length + 1,
      title: input.title,
      why: input.why ?? null,
      anchorCopy: input.anchorCopy ?? null,
      mode: input.mode,
      metric: input.mode === 'MANUAL' ? 'manual' : (input.metric ?? 'manual'),
      skillKey: input.skillKey,
      xp: input.xp,
      linkUrl: input.linkUrl ?? null,
      isActive: true,
    }
    return {
      chains: base.chains.map((c) => (c.chainKey === input.chainKey ? { ...c, defs: [...c.defs, def] } : c)),
    }
  })
  return undefined
}

function mockUpdateDef(qc: ReturnType<typeof useQueryClient>, id: string, patch: HabitDefUpdateInput) {
  const base = qc.getQueryData<HabitCatalog>(HABIT_CATALOG_KEY) ?? mockHabitCatalog
  const found = findDef(base, id)
  if (!found) return undefined
  const { chain: fromChain, def } = found
  const updated: HabitDefInfo = { ...def, ...patch }
  const targetChainKey = patch.chainKey ?? fromChain.chainKey
  if (targetChainKey === fromChain.chainKey) {
    qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, {
      chains: base.chains.map((c) =>
        c.chainKey === fromChain.chainKey
          ? { ...c, defs: c.defs.map((d) => (d.id === id ? updated : d)) }
          : c),
    })
    return undefined
  }
  // Cross-chain move (updateDef with a new chainKey): pull the def out of its old chain and
  // append it to the target chain — mirrors HabitAdminService.updateDef's reassignment.
  const targetChain = base.chains.find((c) => c.chainKey === targetChainKey)
  if (!targetChain) {
    // Mirrors HabitAdminService.updateDef's SystemMessage.error("HABIT_DEF_UNKNOWN_CHAIN") 400 —
    // reassigning to a chainKey that doesn't exist must fail the write, not silently vanish the def.
    throw new Error('HABIT_DEF_UNKNOWN_CHAIN')
  }
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, {
    chains: base.chains.map((c) => {
      if (c.chainKey === fromChain.chainKey) return { ...c, defs: c.defs.filter((d) => d.id !== id) }
      if (c.chainKey === targetChainKey) {
        return {
          ...c,
          defs: [...c.defs, { ...updated, chainKey: targetChainKey, position: patch.position ?? c.defs.length + 1 }],
        }
      }
      return c
    }),
  })
  return undefined
}

function mockDeleteDef(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, (prev) => {
    const base = prev ?? mockHabitCatalog
    return { chains: base.chains.map((c) => ({ ...c, defs: c.defs.filter((d) => d.id !== id) })) }
  })
  return undefined
}
