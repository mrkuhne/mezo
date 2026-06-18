import { useQuery } from '@tanstack/react-query'
import { goalApi, type GoalResponse } from '@/lib/goalApi'
import { isMockMode } from '@/lib/mode'
import { huMonthDay } from '@/lib/dates'
import { goal as mockGoal, linkedMesocycles } from './goals'
import type { Goal, GoalKind, WeightEntry } from './types'

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
    mesocycles: [], // populated by GoalPlanLink in slice G3
    identityFrame: res.identityFrame ?? '',
  }
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
  const goal: Goal = mock
    ? mockGoal
    : (() => {
        const active = (goals ?? []).find(g => g.status === 'active') ?? (goals ?? [])[0]
        return active ? toGoal(active, (weightLog as WeightEntry[]) ?? []) : mockGoal
      })()
  return { goal, linkedMesocycles }
}
