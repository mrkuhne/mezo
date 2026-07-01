import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  goalApi,
  type GoalResponse,
  type GoalUpsertRequest,
  type FeasibilityPreviewRequest,
  type FeasibilityPreviewResponse,
} from '@/lib/goalApi'
import { goalLinkApi, type GoalTimelineResponse, type GoalPlanAttachRequest } from '@/lib/goalLinkApi'
import { isMockMode } from '@/lib/mode'
import { huMonthDay } from '@/lib/dates'
import {
  goal as mockGoal,
  goalResponse as mockGoalResponse,
  linkedMesocycles as mockLinkedMesocycles,
  goalTimeline as mockTimeline,
  feasibilityPreview as mockFeasibilityPreview,
} from '@/data/goals'
import type { Goal, GoalKind, LinkedMeso, WeightEntry } from '@/data/types'

// GoalResponse (new contract) -> the thin back-compat Goal shape, kept for the
// consumers that still read flattened weights/identity (WeightView, FuelStackView,
// EditGoalSheet's rateTarget). currentWeight derives from the latest weight entry
// (falls back to startWeightKg when the cache is empty); trajectory 'maintain' maps
// to the existing 'maintenance' GoalKind. G4b (Decision C) retired the window
// (startDate/targetDate) + unit fields: the GoalsView hero now reads those — plus
// trajectory/guards — straight off the raw GoalResponse `useGoal` also exposes.
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
    // rateTarget = the goal's TARGET pace. The contract carries it as %BW/week
    // (rateTargetPctPerWeek), so the unit is '%/hét' — NOT the kg/hét the legacy
    // mock assumed, and NOT the observed kg/hét trend the hero shows. The arrow is
    // derived from the trajectory (bulk = up, cut/maintain = down). (mezo-5om)
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
  const { data: goals, isPending: goalPending } = useQuery({
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
    // Decision A (G4b): mock mode returns a static GoalTimelineResponse (not null)
    // so the GoalTimeline lane component renders the same lanes/gaps it would in
    // real mode. goalId tracks the mock goal so the attach/detach hub targets it.
    return {
      goal: mockGoal as Goal | null,
      goalResponse: mockGoalResponse as GoalResponse | null,
      linkedMesocycles: mockLinkedMesocycles,
      timeline: mockTimeline as GoalTimelineResponse | null,
      goalId: mockGoal.id as string | null,
      // Real-mode loading window only — mock seeds synchronously so this is always
      // false here; GoalsView branches on it to show the skeleton (mezo-f2z).
      pending: !mock && goalPending,
    }
  }

  // Real mode with no active goal: empty "set up a goal" state. (G1 used to fall
  // back to mockGoal here, which surfaced the demo placeholder to real users —
  // see mezo-72d.) GoalsView guards on `goal === null` and renders the setup CTA.
  if (!activeGoal) {
    return { goal: null, goalResponse: null, linkedMesocycles: {}, timeline: null, goalId: null, pending: !mock && goalPending }
  }

  const goal: Goal = toGoal(activeGoal, (weightLog as WeightEntry[]) ?? [])
  const linkedMesocycles = timeline ? toLinkedMesocycles(timeline) : {}
  goal.mesocycles = timeline ? timeline.links.map(l => l.planId) : []
  // Expose the raw GoalResponse (the G4b hero reads trajectory/guards/window/weights
  // straight off the contract — Decision C) + the raw timeline (the lane component
  // consumes timeline.links[] for lane positions — LinkedMeso can't drive lanes) +
  // goalId (attach/detach target).
  return { goal, goalResponse: activeGoal, linkedMesocycles, timeline: timeline ?? null, goalId: activeGoal.id, pending: !mock && goalPending }
}

// Goal-management mutations (slice G4b). Real mode runs the write, then in
// onSuccess invalidates ['goals'] (+ the goal's timeline for attach/detach so the
// lane re-renders). Mock mode no-ops and resolves so the command-center UI can
// fire-and-forget in Phase-1 parity. Each action returns the mutation promise so
// callers can await / chain navigation.
export function useGoalActions() {
  const qc = useQueryClient()
  const mock = isMockMode()

  const invalidateGoals = () => { if (!mock) qc.invalidateQueries({ queryKey: ['goals'] }) }
  const invalidateTimeline = (goalId: string) => {
    if (!mock) qc.invalidateQueries({ queryKey: ['goal', goalId, 'timeline'] })
  }

  const archiveM = useMutation({
    mutationFn: async (id: string) => { if (mock) return null; return goalApi.archive(id) },
    onSuccess: () => invalidateGoals(),
  })
  const removeM = useMutation({
    mutationFn: async (id: string) => { if (mock) return; await goalApi.remove(id) },
    onSuccess: () => invalidateGoals(),
  })
  const activateM = useMutation({
    mutationFn: async (id: string) => { if (mock) return null; return goalApi.activate(id) },
    onSuccess: () => invalidateGoals(),
  })
  const attachM = useMutation({
    mutationFn: async ({ goalId, body }: { goalId: string; body: GoalPlanAttachRequest }) => {
      if (mock) return null
      return goalLinkApi.attach(goalId, body)
    },
    onSuccess: (_data, { goalId }) => { invalidateGoals(); invalidateTimeline(goalId) },
  })
  const detachM = useMutation({
    mutationFn: async ({ goalId, linkId }: { goalId: string; linkId: string }) => {
      if (mock) return
      await goalLinkApi.detach(goalId, linkId)
    },
    onSuccess: (_data, { goalId }) => { invalidateGoals(); invalidateTimeline(goalId) },
  })
  // Run the G5 TDEE/recept engine on the goal. Real mode POSTs /evaluate then
  // invalidates ['goals'] (so the fresh prescription appears) + the goal's timeline
  // (segments derive from block boundaries). Mock no-ops (the static prescription
  // already renders). (mezo-g1u)
  const evaluateM = useMutation({
    mutationFn: async (id: string) => { if (mock) return null; return goalApi.evaluate(id) },
    onSuccess: (_data, id) => { invalidateGoals(); invalidateTimeline(id) },
  })

  const archive = useCallback((id: string) => archiveM.mutateAsync(id), [archiveM])
  const remove = useCallback((id: string) => removeM.mutateAsync(id), [removeM])
  const activate = useCallback((id: string) => activateM.mutateAsync(id), [activateM])
  const attachPlan = useCallback(
    (goalId: string, body: GoalPlanAttachRequest) => attachM.mutateAsync({ goalId, body }),
    [attachM],
  )
  const detachPlan = useCallback(
    (goalId: string, linkId: string) => detachM.mutateAsync({ goalId, linkId }),
    [detachM],
  )
  const evaluate = useCallback((id: string) => evaluateM.mutateAsync(id), [evaluateM])

  const pending =
    archiveM.isPending || removeM.isPending || activateM.isPending || attachM.isPending || detachM.isPending || evaluateM.isPending

  return { archive, remove, activate, attachPlan, detachPlan, evaluate, pending, evaluating: evaluateM.isPending }
}

// Goal-creation wizard save chain. Real mode creates the goal, optionally
// activates it, then invalidates ['goals']. Biometrics are no longer part of
// creation — they live on the Profile and are a precondition (the hard gate),
// not a wizard payload (G6, mezo-06n). Mock mode no-ops and resolves with null
// so the wizard's onSuccess(null) still fires and it navigates back (Phase-1
// parity with MesocyclePlanner).
export type GoalCreationInput = {
  goal: GoalUpsertRequest
  activate: boolean
}

export function useGoalCreation() {
  const qc = useQueryClient()
  const mock = isMockMode()
  const mutation = useMutation({
    mutationFn: async (input: GoalCreationInput): Promise<GoalResponse | null> => {
      if (mock) return null // Phase-1 no-op; the wizard just navigates back
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

// Live realism preview for the goal-wizard cél step (G6, mezo-06n). The backend
// (Task 2) owns the math — given a draft window + weights it returns the derived
// %BW/wk pace + a verdict (and a cap-paced realistic date when over the cap). The
// FE debounces the inputs (so dragging weight/date sliders doesn't spam the API)
// and feeds them into a TanStack Query keyed on the debounced draft. Real mode
// hits POST /api/goals/feasibility-preview; mock mode returns a static feasible
// preview so the panel renders offline. `enabled` lets the caller skip the call
// for incomplete drafts (e.g. maintain / no target weight / invalid window).
export function useFeasibilityPreview(
  draft: FeasibilityPreviewRequest | null,
  opts?: { enabled?: boolean; debounceMs?: number },
): FeasibilityPreviewResponse | undefined {
  const mock = isMockMode()
  const enabled = (opts?.enabled ?? true) && draft !== null
  const debounceMs = opts?.debounceMs ?? 400

  // Debounce the draft so rapid input edits collapse into a single query key.
  const [debounced, setDebounced] = useState<FeasibilityPreviewRequest | null>(draft)
  const key = draft ? JSON.stringify(draft) : null
  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(() => setDebounced(draft), debounceMs)
    return () => clearTimeout(t)
    // key captures every field of the draft; draft is read inside the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, debounceMs])

  const { data } = useQuery({
    queryKey: ['feasibilityPreview', mock ? 'mock' : 'real', debounced],
    queryFn: mock
      ? async () => mockFeasibilityPreview
      : () => goalApi.feasibilityPreview(debounced as FeasibilityPreviewRequest),
    enabled: enabled && debounced !== null,
    initialData: mock && enabled ? mockFeasibilityPreview : undefined,
  })
  return enabled ? data : undefined
}
