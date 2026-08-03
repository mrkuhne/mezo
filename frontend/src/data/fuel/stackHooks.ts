import { useCallback } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { fuelApi, type Intake, type ProtocolView } from '@/data/fuel/fuelApi'
import { usePantry } from '@/data/fuel/pantryHooks'
import { protocol as protocolSeed, protocolOccurrences, supplementsStash, mockPlaceOccurrence } from '@/data/fuel/fuel'
import type { Protocol, SupplementStashItem, ProtocolOccurrence, StackZoneKey } from '@/data/types'

const PROTOCOL_KEY = ['protocol'] as const
const intakeKey = (date: string) => ['fuelIntake', date] as const

// Real-mode "no protocol yet" ghost — honest-empty (version 0), NEVER the seed (the "no
// static fallback in real mode" invariant). useProtocol returns this while the query is
// unresolved AND when the backend reports no active protocol (ProtocolViewResponse.active absent).
const GHOST_PROTOCOL: Protocol = {
  version: 0, builtAt: '', source: '', status: 'none',
  itemCount: 0, confidence: 0, lastReplanReason: null, history: [],
}
const EMPTY_VIEW: ProtocolView = { protocol: null, occurrences: [], selectedIds: null }
// mock: the seed protocol + its 8 occurrence seed rows are active; selectedIds stays the
// deprecated null bridge (the page's default selection applies, Task 9 wires it further).
const mockView: ProtocolView = { protocol: protocolSeed, occurrences: protocolOccurrences, selectedIds: null }
// mock intake seed derives from the stash's taken flags so mock/real read the same shape
const mockIntakeSeed: Intake[] = supplementsStash
  .filter(s => s.taken)
  .map(s => ({ id: `intake-${s.id}`, pantryItemId: s.id, takenAt: '', dose: s.dose, slotKey: null }))

/**
 * Dual-mode active protocol + its occurrence list (Fuel "Stack" slice, mezo-vx9v). Mock seeds the
 * Phase-1 `protocol` + the 8-item occurrence seed synchronously via initialData; real fetches
 * `GET /api/fuel/protocol` and, while unresolved OR when there is no active protocol, returns the
 * version-0 ghost with `occurrences: []` — never the seed.
 *
 * `selectedIds` is a DEPRECATED bridge (distinct pantryItemIds derived from `occurrences`) kept
 * only for the still-live consumers of the old selection-based shape (FuelStackPage,
 * useFuelTimeline, NotificationsPage, useScheduleSnapshotWriter) — Task 8 retires it once they
 * move onto `occurrences`.
 */
export function useProtocol(): {
  protocol: Protocol
  occurrences: ProtocolOccurrence[]
  selectedIds: string[] | null
} {
  const { data } = useDualQuery<ProtocolView>({
    queryKey: PROTOCOL_KEY,
    mockData: mockView,
    realFetch: fuelApi.getProtocol,
    realEmpty: EMPTY_VIEW,
    realStaleTime: 0,
  })
  return { protocol: data.protocol ?? GHOST_PROTOCOL, occurrences: data.occurrences, selectedIds: data.selectedIds }
}

/** The day's supplement intakes — mock derives from the stash's taken flags; real fetches the date.
 *  Exported so the P5 planner (useFuelTimeline) can feed intakes into buildDayPlan. */
export function useIntakes(date: string): Intake[] {
  const { data } = useDualQuery<Intake[]>({
    queryKey: intakeKey(date),
    mockData: mockIntakeSeed,
    realFetch: () => fuelApi.listIntakes(date),
    realEmpty: [],
    realStaleTime: 0,
  })
  return data
}

/**
 * Dual-mode stack read — the pantry stash with each item's `taken` re-derived from the day's
 * intakes (mock/real share the shape). Keeps the pre-existing `{ stash }` return so the Stack
 * views + StackPickerSheet are untouched.
 */
export function useStack(): { stash: SupplementStashItem[] } {
  const { stash } = usePantry()
  const intakes = useIntakes(localDateString())
  const takenIds = new Set(intakes.map(i => i.pantryItemId))
  return { stash: stash.map(s => ({ ...s, taken: takenIds.has(s.id) })) }
}

/** Finds the day's intake row for `pantryItemId` matching `slotKey` exactly, falling back to a
 *  null-slotKey legacy row for that item — pre-occurrence rows, or a caller that omits `slotKey`
 *  entirely (which is treated as the legacy null key). */
function findIntakeRow(rows: Intake[], pantryItemId: string, slotKey?: StackZoneKey): Intake | undefined {
  const key = slotKey ?? null
  return rows.find(r => r.pantryItemId === pantryItemId && r.slotKey === key)
    ?? rows.find(r => r.pantryItemId === pantryItemId && r.slotKey === null)
}

/**
 * Log / undo a supplement intake for `date`, keyed by pantryItemId + zone slotKey (mezo-vx9v).
 * `slotKey` is optional for back-compat with the still-live per-item (not per-zone) caller
 * (FuelStackPage's tap-to-log, ported before occurrences existed) — an omitted slotKey behaves
 * exactly like before (matches/creates the item's one null-slotKey row).
 * Mock mutates the ['fuelIntake', date] cache via setQueryData; real POSTs / DELETEs then
 * invalidates ['fuelIntake', date] (→ useStack refetch).
 */
export function useStackActions(date: string = localDateString()) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => qc.invalidateQueries({ queryKey: intakeKey(date) })

  const logM = useMutation({
    mutationFn: mock
      ? async (input: { pantryItemId: string; slotKey?: StackZoneKey; dose?: string | null }) =>
          mockAddIntake(qc, date, input.pantryItemId, input.slotKey, input.dose)
      : async (input: { pantryItemId: string; slotKey?: StackZoneKey; dose?: string | null }) => {
          await fuelApi.logIntake({ pantryItemId: input.pantryItemId, slotKey: input.slotKey, dose: input.dose ?? undefined })
        },
    onSuccess: mock ? undefined : invalidate,
  })
  const undoM = useMutation({
    mutationFn: mock
      ? async (input: { pantryItemId: string; slotKey?: StackZoneKey }) =>
          mockRemoveIntake(qc, date, input.pantryItemId, input.slotKey)
      : async (input: { pantryItemId: string; slotKey?: StackZoneKey }) => {
          const row = findIntakeRow(qc.getQueryData<Intake[]>(intakeKey(date)) ?? [], input.pantryItemId, input.slotKey)
          if (row) await fuelApi.deleteIntake(row.id)
        },
    onSuccess: mock ? undefined : invalidate,
  })

  const logIntake = useCallback(
    (pantryItemId: string, slotKey?: StackZoneKey, dose?: string | null) => logM.mutate({ pantryItemId, slotKey, dose }),
    [logM],
  )
  const undoIntake = useCallback(
    (pantryItemId: string, slotKey?: StackZoneKey) => undoM.mutate({ pantryItemId, slotKey }),
    [undoM],
  )
  return { logIntake, undoIntake }
}

/**
 * The living-protocol occurrence actions (mezo-vx9v): add/move/re-dose/unpin/remove one
 * occurrence, or remove every occurrence for a pantry item. Real mode calls the matching
 * `fuelApi` endpoint then invalidates `['protocol']`; mock mode mutates the cache directly via
 * `setQueryData` mutators that mirror the backend's placement rules (`mockPlaceOccurrence`).
 *
 * `applyProtocol` (the pre-vx9v whole-selection activate — mock recomputes the ['protocol']
 * cache at version+1, real POSTs `selectedPantryItemIds` then writes the response into the cache)
 * stays alongside: FuelStackPage still calls it until Task 8 reworks the page onto these actions;
 * Task 10 removes the activate endpoint + this action entirely.
 */
export function useProtocolActions() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidateProtocol = () => qc.invalidateQueries({ queryKey: PROTOCOL_KEY })

  const applyM = useMutation({
    mutationFn: mock
      ? async (v: { selectedIds: string[]; reason?: string }) => mockActivate(qc, v.selectedIds)
      : async (v: { selectedIds: string[]; reason?: string }) => {
          const view = await fuelApi.activateProtocol(v.selectedIds, v.reason)
          qc.setQueryData(PROTOCOL_KEY, view)
          return view
        },
  })
  const applyProtocol = useCallback(
    (selectedIds: string[], reason?: string) => applyM.mutateAsync({ selectedIds, reason }),
    [applyM],
  )

  const addM = useMutation({
    mutationFn: async (input: { pantryItemId: string; slotKey?: StackZoneKey; dose?: string }) => {
      if (mock) { mockAddOccurrence(qc, input.pantryItemId, input.slotKey, input.dose); return }
      await fuelApi.addProtocolItem({ pantryItemId: input.pantryItemId, slotKey: input.slotKey, dose: input.dose })
    },
    onSuccess: mock ? undefined : invalidateProtocol,
  })
  const moveM = useMutation({
    mutationFn: async (input: { id: string; slotKey: StackZoneKey }) => {
      if (mock) { mockMoveOccurrence(qc, input.id, input.slotKey); return }
      await fuelApi.patchProtocolItem(input.id, { slotKey: input.slotKey })
    },
    onSuccess: mock ? undefined : invalidateProtocol,
  })
  const doseM = useMutation({
    mutationFn: async (input: { id: string; dose: string }) => {
      if (mock) { mockPatchOccurrence(qc, input.id, { dose: input.dose }); return }
      await fuelApi.patchProtocolItem(input.id, { dose: input.dose })
    },
    onSuccess: mock ? undefined : invalidateProtocol,
  })
  const unpinM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) { mockUnpinOccurrence(qc, id); return }
      await fuelApi.patchProtocolItem(id, { pinned: false })
    },
    onSuccess: mock ? undefined : invalidateProtocol,
  })
  const removeM = useMutation({
    mutationFn: async (id: string) => {
      if (mock) { mockRemoveOccurrence(qc, id); return }
      await fuelApi.deleteProtocolItem(id)
    },
    onSuccess: mock ? undefined : invalidateProtocol,
  })

  const addItem = useCallback(
    (pantryItemId: string, opts?: { slotKey?: StackZoneKey; dose?: string }) =>
      addM.mutateAsync({ pantryItemId, slotKey: opts?.slotKey, dose: opts?.dose }),
    [addM],
  )
  const moveItem = useCallback((id: string, slotKey: StackZoneKey) => moveM.mutateAsync({ id, slotKey }), [moveM])
  const setDose = useCallback((id: string, dose: string) => doseM.mutateAsync({ id, dose }), [doseM])
  const unpinItem = useCallback((id: string) => unpinM.mutateAsync(id), [unpinM])
  const removeItem = useCallback((id: string) => removeM.mutateAsync(id), [removeM])
  const removeAllFor = useCallback(async (pantryItemId: string) => {
    const cached = qc.getQueryData<ProtocolView>(PROTOCOL_KEY)
    const occurrences = cached?.occurrences ?? (mock ? mockView.occurrences : [])
    await Promise.all(occurrences.filter(o => o.pantryItemId === pantryItemId).map(o => removeItem(o.id)))
  }, [qc, mock, removeItem])

  return { applyProtocol, addItem, moveItem, setDose, unpinItem, removeItem, removeAllFor }
}

// --- mock-mode cache mutators: keep the offline app interactive ---
function mockAddIntake(qc: QueryClient, date: string, pantryItemId: string, slotKey?: StackZoneKey, dose?: string | null) {
  const key = slotKey ?? null
  qc.setQueryData<Intake[]>(intakeKey(date), (rows = []) =>
    rows.some(r => r.pantryItemId === pantryItemId && r.slotKey === key)
      ? rows
      : [...rows, {
          id: key ? `intake-${pantryItemId}-${key}` : `intake-${pantryItemId}`,
          pantryItemId, takenAt: '', dose: dose ?? null, slotKey: key,
        }])
}

function mockRemoveIntake(qc: QueryClient, date: string, pantryItemId: string, slotKey?: StackZoneKey) {
  qc.setQueryData<Intake[]>(intakeKey(date), (rows = []) => {
    const row = findIntakeRow(rows, pantryItemId, slotKey)
    return row ? rows.filter(r => r.id !== row.id) : rows
  })
}

function mockActivate(qc: QueryClient, selectedIds: string[]): ProtocolView {
  const prev = qc.getQueryData<ProtocolView>(PROTOCOL_KEY) ?? mockView
  const base = prev.protocol ?? GHOST_PROTOCOL
  const next: ProtocolView = {
    protocol: {
      ...base,
      version: base.version + 1,
      builtAt: 'most',
      source: 'Stack builder',
      status: 'active',
      itemCount: selectedIds.length,
      history: [{ v: base.version + 1, when: 'most', reason: 'Stack bekapcsolás' }, ...base.history],
    },
    occurrences: prev.occurrences, // untouched — the pre-vx9v activate path doesn't touch occurrences
    selectedIds,
  }
  qc.setQueryData(PROTOCOL_KEY, next)
  return next
}

/** Where a NEW occurrence lands: `opts.slotKey` wins (a manual/user placement, pinned); otherwise
 *  mirrors the backend's timing-hint pass via `mockPlaceOccurrence` (or the honest fallback zone
 *  when the pantry item can't be found — should not happen, protocol items only ever wrap owned
 *  pantry items). */
function resolvePlacement(
  pantryItemId: string,
  slotKey?: StackZoneKey,
): Pick<ProtocolOccurrence, 'slotKey' | 'placementSource' | 'placementReason'> {
  if (slotKey) return { slotKey, placementSource: 'user', placementReason: 'Kézzel ide helyezve.' }
  const item = supplementsStash.find(s => s.id === pantryItemId)
  return item ? mockPlaceOccurrence(item) : { slotKey: 'breakfast', placementSource: 'fallback', placementReason: null }
}

function mockAddOccurrence(qc: QueryClient, pantryItemId: string, slotKey?: StackZoneKey, dose?: string) {
  qc.setQueryData<ProtocolView>(PROTOCOL_KEY, (prev = mockView) => {
    const occurrences = prev.occurrences ?? []
    const placement = resolvePlacement(pantryItemId, slotKey)
    // Duplicate (item, zone) — mirrors the backend's rejectDuplicate: a silent no-op in mock
    // mode rather than a 409 (the mock has no error-surface convention for this).
    if (occurrences.some(o => o.pantryItemId === pantryItemId && o.slotKey === placement.slotKey)) return prev
    const next: ProtocolOccurrence = {
      id: `occ-${pantryItemId}-${placement.slotKey}`,
      pantryItemId,
      slotKey: placement.slotKey,
      dose: dose ?? null,
      pinned: slotKey != null,
      placementSource: placement.placementSource,
      placementReason: placement.placementReason,
      restDayFallback: null,
      dailyTotalHint: null,
    }
    return { ...prev, occurrences: [...occurrences, next] }
  })
}

function mockPatchOccurrence(qc: QueryClient, id: string, patch: Partial<ProtocolOccurrence>) {
  qc.setQueryData<ProtocolView>(PROTOCOL_KEY, (prev = mockView) => ({
    ...prev,
    occurrences: (prev.occurrences ?? []).map(o => (o.id === id ? { ...o, ...patch } : o)),
  }))
}

function mockMoveOccurrence(qc: QueryClient, id: string, slotKey: StackZoneKey) {
  mockPatchOccurrence(qc, id, {
    slotKey, pinned: true, placementSource: 'user', placementReason: 'Kézzel ide helyezve.', restDayFallback: null,
  })
}

/** Unpin → the engine re-places (mirrors ProtocolService.patchItem's unpin branch). Deliberately
 *  leaves `restDayFallback`/`dailyTotalHint` untouched — `mockPlaceOccurrence` only mirrors the
 *  timing-hint stage, which never carries a rest-day hint (that's the name-rule-table's domain). */
function mockUnpinOccurrence(qc: QueryClient, id: string) {
  const cached = qc.getQueryData<ProtocolView>(PROTOCOL_KEY) ?? mockView
  const occ = cached.occurrences.find(o => o.id === id)
  if (!occ) return
  const placement = resolvePlacement(occ.pantryItemId) // no slotKey → re-derive, never 'user'
  mockPatchOccurrence(qc, id, { ...placement, pinned: false })
}

function mockRemoveOccurrence(qc: QueryClient, id: string) {
  qc.setQueryData<ProtocolView>(PROTOCOL_KEY, (prev = mockView) => ({
    ...prev,
    occurrences: (prev.occurrences ?? []).filter(o => o.id !== id),
  }))
}
