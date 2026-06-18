import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { goalApi, type GoalResponse, type GoalUpsertRequest } from '@/lib/goalApi'
import { goalLinkApi, type GoalTimelineResponse } from '@/lib/goalLinkApi'
import { biometricProfileApi, type BiometricProfileUpsertRequest } from '@/lib/biometricProfileApi'
import { isMockMode } from '@/lib/mode'
import { huMonthDay } from '@/lib/dates'
import { goal as mockGoal, linkedMesocycles as mockLinkedMesocycles } from './goals'
import type { Goal, GoalKind, LinkedMeso, WeightEntry } from './types'

// GoalResponse (new contract) -> existing Goal domain shape, so GoalsView is
// untouched (its full restructure is slice G4). currentWeight derives from the
// latest weight entry (falls back to startWeightKg when the cache is empty);
// trajectory 'maintain' maps to the existing 'maintenance' GoalKind.
function toGoal(res: GoalResponse, weightLog: WeightEntry[]): Goal {
  const latest = weightLog.length ? weightLog[weightLog.length - 1].value : Number(res.startWeightKg)
  const kind: GoalKind = res.trajectory === 'maintain' ? 'maintenance' : res.trajectory
  return {
    id: res.id,
    title: res.title,
    kind,
    status: res.status,
    startWeight: Number(res.startWeightKg),
    currentWeight: latest,
    targetWeight: Number(res.targetWeightKg ?? res.startWeightKg),
    unit: 'kg',
    startDate: huMonthDay(res.startDate),
    targetDate: huMonthDay(res.targetDate),
    // rateTarget: the contract carries a %/week magnitude; the legacy mock used
    // kg/hét. Keep the raw % value with a '%/hét' unit and derive the arrow from
    // the trajectory (bulk = up, cut/maintain = down) — G4 reworks this panel.
    rateTarget: { value: Number(res.rateTargetPctPerWeek), unit: '%/hét', direction: res.trajectory === 'bulk' ? 'up' : 'down' },
    mesocycles: [], // populated from the goal timeline (G3) — see useGoal
    identityFrame: res.identityFrame ?? '',
  }
}

// GoalTimelineResponse.links -> the legacy LinkedMeso map the goal hero renders.
// Each link's `plan` (GoalPlanRef) carries the display fields; ISO dates are
// formatted to the HU month-day labels the UI expects (matches the mock shape).
function toLinkedMesocycles(timeline: GoalTimelineResponse): Record<string, LinkedMeso> {
  const map: Record<string, LinkedMeso> = {}
  for (const link of timeline.links) {
    map[link.planId] = {
      id: link.planId,
      shortTitle: link.plan.title,
      status: link.plan.status,
      startDate: huMonthDay(link.plan.startDate),
      endDate: huMonthDay(link.plan.endDate),
      weeks: link.plan.weeks,
    }
  }
  return map
}

export function useGoal() {
  const mock = isMockMode()
  const { data: weightLog = [] } = useQuery({
    queryKey: ['weightLog'], // shares the cache with useWeight (same key); no queryFn — read-only
    enabled: !mock,
  })
  const { data: goals } = useQuery({
    queryKey: ['goals'],
    queryFn: mock ? async () => null : goalApi.list,
    initialData: mock ? null : undefined,
  })
  const activeGoal = mock ? null : (goals ?? []).find(g => g.status === 'active') ?? (goals ?? [])[0] ?? null
  const goalId = activeGoal?.id

  // Real mode: fetch the active goal's plan timeline and build the linked plans
  // from its links. Mock mode keeps the static linkedMesocycles + mockGoal.mesocycles.
  const { data: timeline } = useQuery({
    queryKey: ['goal', goalId, 'timeline'],
    queryFn: () => goalLinkApi.timeline(goalId as string),
    enabled: !mock && !!goalId,
  })

  if (mock) {
    return { goal: mockGoal as Goal | null, linkedMesocycles: mockLinkedMesocycles }
  }

  // Real mode with no active goal: empty "set up a goal" state. (G1 used to fall
  // back to mockGoal here, which surfaced the demo placeholder to real users —
  // see mezo-72d.) GoalsView guards on `goal === null` and renders the setup CTA.
  if (!activeGoal) {
    return { goal: null, linkedMesocycles: {} }
  }

  const goal: Goal = toGoal(activeGoal, (weightLog as WeightEntry[]) ?? [])
  const linkedMesocycles = timeline ? toLinkedMesocycles(timeline) : {}
  goal.mesocycles = timeline ? timeline.links.map(l => l.planId) : []
  return { goal, linkedMesocycles }
}

// Goal-creation wizard (slice G4a) save chain. Real mode runs the writes in
// order: upsert the biometric profile, create the goal, optionally activate it,
// then invalidate ['goals']. Mock mode no-ops and resolves with null so the
// wizard's onSuccess(null) still fires and it navigates back (Phase-1 parity
// with MesocyclePlanner).
export type GoalCreationInput = {
  profile: BiometricProfileUpsertRequest
  goal: GoalUpsertRequest
  activate: boolean
}

export function useGoalCreation() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (input: GoalCreationInput): Promise<GoalResponse | null> => {
      if (mock) return null // Phase-1 no-op; the wizard just navigates back
      await biometricProfileApi.upsert(input.profile)
      const created = await goalApi.create(input.goal)
      if (input.activate) await goalApi.activate(created.id)
      return created
    },
    onSuccess: () => {
      if (!mock) qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })
  const submit = useCallback(
    (input: GoalCreationInput, opts?: { onSuccess?: (goal: GoalResponse | null) => void }) =>
      mutation.mutate(input, { onSuccess: opts?.onSuccess }),
    [mutation],
  )
  return { submit, pending: mutation.isPending }
}
