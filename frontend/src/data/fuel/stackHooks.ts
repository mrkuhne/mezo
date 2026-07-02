import { useCallback } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useDualQuery } from '@/data/useDualQuery'
import { isMockMode } from '@/data/_client/mode'
import { localDateString } from '@/shared/lib/dates'
import { fuelApi, type Intake, type ProtocolView } from '@/data/fuel/fuelApi'
import { usePantry } from '@/data/fuel/pantryHooks'
import { protocol as protocolSeed, supplementsStash } from '@/data/fuel/fuel'
import { user as userSeed } from '@/data/today/today'
import { linkedMesocycles as mesoSeed } from '@/data/me/goals'
import type { Protocol, SupplementStashItem } from '@/data/types'

const PROTOCOL_KEY = ['protocol'] as const
const intakeKey = (date: string) => ['fuelIntake', date] as const

// Real-mode "no protocol yet" ghost — honest-empty (version 0), NEVER the seed (the "no
// static fallback in real mode" invariant). useProtocol returns this while the query is
// unresolved AND when the backend reports no active protocol (ProtocolViewResponse.active absent).
const GHOST_PROTOCOL: Protocol = {
  version: 0, builtAt: '', source: '', status: 'none',
  itemCount: 0, confidence: 0, lastReplanReason: null, history: [],
}
const EMPTY_VIEW: ProtocolView = { protocol: null, selectedIds: null }
// mock: the seed protocol is active but carries no selection — the page's default applies
const mockView: ProtocolView = { protocol: protocolSeed, selectedIds: null }
// mock intake seed derives from the stash's taken flags so mock/real read the same shape
const mockIntakeSeed: Intake[] = supplementsStash
  .filter(s => s.taken)
  .map(s => ({ id: `intake-${s.id}`, pantryItemId: s.id, takenAt: '', dose: s.dose, slotKey: null }))

/**
 * Dual-mode active protocol (Fuel "Stack" slice). Mock seeds the Phase-1 `protocol` synchronously
 * via initialData (selectedIds null — the page's default selection applies, Task 9 wires it);
 * real fetches `GET /api/fuel/protocol` and, while unresolved OR when there is no active protocol,
 * returns the version-0 ghost — never the seed.
 */
export function useProtocol(): { protocol: Protocol; selectedIds: string[] | null } {
  const { data } = useDualQuery<ProtocolView>({
    queryKey: PROTOCOL_KEY,
    mockData: mockView,
    realFetch: fuelApi.getProtocol,
    realEmpty: EMPTY_VIEW,
    realStaleTime: 0,
  })
  return { protocol: data.protocol ?? GHOST_PROTOCOL, selectedIds: data.selectedIds }
}

// Active meso short title, first word — the same value the mock useGoal() produced for the Stack
// context cell (linkedMesocycles' active entry, e.g. "Hypertrophy 04" → "Hypertrophy").
const activeMesoShortTitle =
  Object.values(mesoSeed).find(m => m.status === 'active')?.shortTitle.split(' ')[0] ?? ''

/**
 * Static context labels for the Stack view's "Mit nézek most" cell (meso week + short title).
 * These are the exact values the mock useProfile()/useGoal() produced for this card; reading the
 * seed consts directly decouples the Stack render from the real /api/goals + profile fetches
 * (mezo-4nu) — nothing on this page needs the live goal timeline. P4/P8 wire these live later.
 */
export function useStackContext(): { weekInMeso: number; mesoTitle: string } {
  return { weekInMeso: userSeed.weekInMeso, mesoTitle: activeMesoShortTitle }
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
 * views + StackPickerSheet + SupplementItemRow are untouched.
 */
export function useStack(): { stash: SupplementStashItem[] } {
  const { stash } = usePantry()
  const intakes = useIntakes(localDateString())
  const takenIds = new Set(intakes.map(i => i.pantryItemId))
  return { stash: stash.map(s => ({ ...s, taken: takenIds.has(s.id) })) }
}

/** Log / undo a supplement intake for `date`. Mock mutates the ['fuelIntake', date] cache via
 *  setQueryData; real POSTs / DELETEs then invalidates ['fuelIntake', date] (→ useStack refetch). */
export function useStackActions(date: string = localDateString()) {
  const qc = useQueryClient()
  const mock = isMockMode()
  const invalidate = () => qc.invalidateQueries({ queryKey: intakeKey(date) })

  const logM = useMutation({
    mutationFn: mock
      ? async (pantryItemId: string) => mockAddIntake(qc, date, pantryItemId)
      : async (pantryItemId: string) => { await fuelApi.logIntake({ pantryItemId }) },
    onSuccess: mock ? undefined : invalidate,
  })
  const undoM = useMutation({
    mutationFn: mock
      ? async (pantryItemId: string) => mockRemoveIntake(qc, date, pantryItemId)
      : async (pantryItemId: string) => {
          const row = (qc.getQueryData<Intake[]>(intakeKey(date)) ?? []).find(i => i.pantryItemId === pantryItemId)
          if (row) await fuelApi.deleteIntake(row.id)
        },
    onSuccess: mock ? undefined : invalidate,
  })

  const logIntake = useCallback((pantryItemId: string) => logM.mutate(pantryItemId), [logM])
  const undoIntake = useCallback((pantryItemId: string) => undoM.mutate(pantryItemId), [undoM])
  return { logIntake, undoIntake }
}

/** Activate a protocol from a selection. Mock recomputes the ['protocol'] cache (version + 1);
 *  real POSTs `selectedPantryItemIds` then writes the response into the ['protocol'] cache. */
export function useProtocolActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

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
  return { applyProtocol }
}

// --- mock-mode cache mutators: keep the offline app interactive ---
function mockAddIntake(qc: QueryClient, date: string, pantryItemId: string) {
  qc.setQueryData<Intake[]>(intakeKey(date), (rows = []) =>
    rows.some(r => r.pantryItemId === pantryItemId)
      ? rows
      : [...rows, { id: `intake-${pantryItemId}`, pantryItemId, takenAt: '', dose: null, slotKey: null }])
}

function mockRemoveIntake(qc: QueryClient, date: string, pantryItemId: string) {
  qc.setQueryData<Intake[]>(intakeKey(date), (rows = []) => rows.filter(r => r.pantryItemId !== pantryItemId))
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
    selectedIds,
  }
  qc.setQueryData(PROTOCOL_KEY, next)
  return next
}
