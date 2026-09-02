import { useMutation } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { trainApi, type MesoPlanGenerateRequest, type MesoPlanGenerateResponse, type MesoTemplateUpsertRequest } from '@/data/train/trainApi'
import { exerciseLibrary } from '@/data/train/train'
import type { GymExercise, MesoDay } from '@/data/types'
import { seedDays } from '@/features/train/logic/mesoDays'
import { mockMesoPlan } from '@/data/train/mesoPlanMock'

export interface MesoPlanProposal {
  template: MesoTemplateUpsertRequest
  /** The template's days with client ids (seedDays) — what the editor mutates. */
  days: MesoDay[]
  rationale: string
  llmUsed: boolean
}

// Contract days/exercises carry no ids (a fresh generation, nothing persisted) — mint one
// per day/exercise so the proposal is immediately editable by MesoExercises-style state,
// then seedDays for its usual clone-so-edits-never-touch-the-source treatment.
function toProposal(r: MesoPlanGenerateResponse): MesoPlanProposal {
  const seeded: MesoDay[] = r.template.days.map((d) => ({
    id: crypto.randomUUID(),
    day: d.day,
    type: d.type,
    muscle: d.muscle ?? '',
    muscleAccent: d.muscleAccent,
    note: d.note,
    exerciseCount: d.exercises?.length ?? 0,
    exercises: (d.exercises ?? []).map((e): GymExercise => ({
      id: crypto.randomUUID(),
      name: e.name,
      muscle: e.muscle ?? '',
      warmupSets: e.warmupSets,
      workingSets: e.workingSets,
      repMin: e.repMin,
      repMax: e.repMax,
      targetRIR: e.targetRIR,
      anchorWeightKg: e.anchorWeightKg,
      type: e.type,
      warning: e.warning,
      catalogId: e.catalogId,
      countsTowardVolume: e.countsTowardVolume,
    })),
  }))
  return { template: r.template, days: seedDays(seeded), rationale: r.rationale, llmUsed: r.llmUsed }
}

/** Generate a hypertrophy plan proposal (nothing persisted). Mock = FE skeleton + mock library. */
export function useMesoPlanGenerate() {
  const mock = isMockMode()
  const m = useMutation({
    mutationFn: mock
      ? async (input: MesoPlanGenerateRequest) => toProposal(mockMesoPlan(input, exerciseLibrary))
      : (input: MesoPlanGenerateRequest) => trainApi.generateMesoPlan(input).then(toProposal),
  })
  return {
    generate: (input: MesoPlanGenerateRequest): Promise<MesoPlanProposal> => m.mutateAsync(input),
    generating: m.isPending,
    error: m.isError,
  }
}
