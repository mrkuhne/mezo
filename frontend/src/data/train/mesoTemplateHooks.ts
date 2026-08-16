import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { useDualQuery } from '@/data/useDualQuery'
import { addDays, huMonthDay } from '@/shared/lib/dates'
import {
  trainApi,
  type MesoDayInput,
  type MesoTemplateResponse,
  type MesoTemplateUpsertRequest,
  type MesoTemplateStartRequest,
  type MesoRerunResponse,
} from '@/data/train/trainApi'
import { toMesocycle } from '@/data/train/trainHooks'
import { mesoTemplatesMock, mesocycles } from '@/data/train/train'
import type { GymExercise, Mesocycle, MesoDay, MesoTemplate } from '@/data/types'

const TEMPLATES_KEY = ['train', 'mesoTemplates']
const MESOS_KEY = ['train', 'mesocycles']

// Contract -> domain: structurally close (id/title/weeks/days line up 1:1); only the
// optional string fields need coalescing to `null` (mirrors toMesocycle's idiom).
function toMesoTemplate(r: MesoTemplateResponse): MesoTemplate {
  return {
    id: r.id,
    title: r.title,
    shortTitle: r.shortTitle ?? null,
    goal: r.goal ?? null,
    weeks: r.weeks,
    split: r.split ?? null,
    style: r.style ?? null,
    phaseCurve: r.phaseCurve,
    notes: r.notes ?? null,
    volumePerMuscle: r.volumePerMuscle ?? null,
    days: r.days as MesoDay[],
    runCount: r.runCount,
  }
}

/**
 * Reusable mesocycle templates (mezo-meyc): the wizard saves a template, then starts a run
 * from it. Reads dual-mode (`useDualQuery`, mock `initialData` from `mesoTemplatesMock`).
 * Writes no-op against the backend in mock mode but edit the client-owned cache via
 * `setQueryData` (the pantry/customWorkout idiom) so the offline demo stays interactive.
 */
export function useMesoTemplates() {
  const mock = isMockMode()
  const qc = useQueryClient()
  const { data, isPending } = useDualQuery<MesoTemplate[]>({
    queryKey: TEMPLATES_KEY,
    mockData: mesoTemplatesMock,
    realFetch: () => trainApi.mesoTemplates().then((rs) => rs.map(toMesoTemplate)),
    realEmpty: [],
  })

  // A saved/started/rerun template touches both caches: the template list (runCount bump)
  // and the mesocycle list (a new run appears). Mock already wrote both directly via
  // setQueryData inside the mutationFn — invalidating there would refetch the frozen
  // static seed and undo the optimistic edit (the sportEvents/gymSchedule idiom).
  const invalidate = () => {
    if (!mock) {
      qc.invalidateQueries({ queryKey: MESOS_KEY })
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY })
    }
  }

  const createM = useMutation({
    mutationFn: mock
      ? async (input: MesoTemplateUpsertRequest) => mockCreate(qc, input)
      : (input: MesoTemplateUpsertRequest) => trainApi.createMesoTemplate(input).then(toMesoTemplate),
    onSuccess: invalidate,
  })
  const updateM = useMutation({
    mutationFn: mock
      ? async (args: { id: string; input: MesoTemplateUpsertRequest }) => mockUpdate(qc, args.id, args.input)
      : (args: { id: string; input: MesoTemplateUpsertRequest }) =>
          trainApi.updateMesoTemplate(args.id, args.input).then(toMesoTemplate),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({
    mutationFn: mock
      ? async (id: string) => mockDelete(qc, id)
      : (id: string) => trainApi.deleteMesoTemplate(id),
    onSuccess: invalidate,
  })
  const startM = useMutation({
    mutationFn: mock
      ? async (args: { id: string; body: MesoTemplateStartRequest }) => mockStart(qc, args.id, args.body)
      : (args: { id: string; body: MesoTemplateStartRequest }) =>
          trainApi.startMesoTemplate(args.id, args.body).then(toMesocycle),
    onSuccess: invalidate,
  })
  const rerunM = useMutation({
    mutationFn: mock
      ? async (mesoId: string) => mockRerun(qc, mesoId)
      : (mesoId: string) => trainApi.rerunMesocycle(mesoId),
    onSuccess: invalidate,
  })

  return {
    templates: data,
    pending: !mock && isPending,
    createTemplate: (input: MesoTemplateUpsertRequest): Promise<MesoTemplate> => createM.mutateAsync(input),
    updateTemplate: (id: string, input: MesoTemplateUpsertRequest): Promise<MesoTemplate> =>
      updateM.mutateAsync({ id, input }),
    deleteTemplate: (id: string): Promise<void> => deleteM.mutateAsync(id),
    startTemplate: (id: string, body: MesoTemplateStartRequest): Promise<Mesocycle> =>
      startM.mutateAsync({ id, body }),
    rerun: (mesoId: string): Promise<MesoRerunResponse> => rerunM.mutateAsync(mesoId),
  }
}

// --- mock-mode cache mutators: keep the offline app interactive (pantryHooks idiom) ---

// MesoDayInput/GymExerciseInput carry no ids (a create/update body never addresses an
// existing exercise row) — mock mirrors the backend's "every exercise gets a fresh id,
// regenerated on each full update" rule via crypto.randomUUID(), and defaults `muscle`
// to '' (never undefined) so rest days match the real contract's invariant.
function toMockDays(days: MesoDayInput[]): MesoDay[] {
  return days.map((d) => ({
    day: d.day,
    type: d.type,
    muscle: d.muscle ?? '',
    muscleAccent: d.muscleAccent,
    note: d.note,
    exerciseCount: d.exercises?.length ?? 0,
    exercises: (d.exercises ?? []).map(
      (e): GymExercise => ({
        id: crypto.randomUUID(),
        name: e.name,
        muscle: e.muscle ?? '',
        warmupSets: e.warmupSets,
        workingSets: e.workingSets,
        repMin: e.repMin,
        repMax: e.repMax,
        targetRIR: e.targetRIR,
        anchorWeightKg: e.anchorWeightKg ?? null,
        type: e.type,
        warning: e.warning,
        catalogId: e.catalogId,
      }),
    ),
  }))
}

function mockCreate(qc: QueryClient, input: MesoTemplateUpsertRequest): MesoTemplate {
  const created: MesoTemplate = {
    id: crypto.randomUUID(),
    title: input.title,
    shortTitle: input.shortTitle ?? null,
    goal: input.goal ?? null,
    weeks: input.weeks,
    split: input.split ?? null,
    style: input.style ?? null,
    phaseCurve: input.phaseCurve,
    notes: input.notes ?? null,
    volumePerMuscle: input.volumePerMuscle ?? null,
    days: toMockDays(input.days),
    runCount: 0,
  }
  qc.setQueryData<MesoTemplate[]>(TEMPLATES_KEY, (prev) => [...(prev ?? mesoTemplatesMock), created])
  return created
}

function mockUpdate(qc: QueryClient, id: string, input: MesoTemplateUpsertRequest): MesoTemplate {
  const existing = (qc.getQueryData<MesoTemplate[]>(TEMPLATES_KEY) ?? mesoTemplatesMock).find((t) => t.id === id)
  const updated: MesoTemplate = {
    id,
    title: input.title,
    shortTitle: input.shortTitle ?? null,
    goal: input.goal ?? null,
    weeks: input.weeks,
    split: input.split ?? null,
    style: input.style ?? null,
    phaseCurve: input.phaseCurve,
    notes: input.notes ?? null,
    volumePerMuscle: input.volumePerMuscle ?? null,
    days: toMockDays(input.days),
    runCount: existing?.runCount ?? 0,
  }
  qc.setQueryData<MesoTemplate[]>(TEMPLATES_KEY, (prev) =>
    (prev ?? mesoTemplatesMock).map((t) => (t.id === id ? updated : t)))
  return updated
}

function mockDelete(qc: QueryClient, id: string): void {
  qc.setQueryData<MesoTemplate[]>(TEMPLATES_KEY, (prev) => (prev ?? mesoTemplatesMock).filter((t) => t.id !== id))
}

function mockStart(qc: QueryClient, id: string, body: MesoTemplateStartRequest): Mesocycle {
  const tpl = (qc.getQueryData<MesoTemplate[]>(TEMPLATES_KEY) ?? mesoTemplatesMock).find((t) => t.id === id)
  const weeks = tpl?.weeks ?? 1
  const started: Mesocycle = {
    id: crypto.randomUUID(),
    templateId: id,
    status: body.status,
    title: tpl?.title ?? 'Mesociklus',
    shortTitle: tpl?.shortTitle ?? tpl?.title ?? 'Mesociklus',
    goal: tpl?.goal ?? '',
    startDate: huMonthDay(body.startDate),
    endDate: huMonthDay(addDays(body.startDate, weeks * 7 - 1)),
    weeks,
    currentWeek: body.status === 'active' ? 1 : 0,
    split: tpl?.split ?? '',
    style: tpl?.style ?? '',
    phaseCurve: tpl?.phaseCurve ?? [],
    days: tpl?.days,
  }
  qc.setQueryData<Mesocycle[]>(MESOS_KEY, (prev) => [...(prev ?? mesocycles), started])
  qc.setQueryData<MesoTemplate[]>(TEMPLATES_KEY, (prev) =>
    (prev ?? mesoTemplatesMock).map((t) => (t.id === id ? { ...t, runCount: t.runCount + 1 } : t)))
  return started
}

// Mirrors backend rerun semantics (mezo-meyc.1 fix round 1): a meso started FROM a
// template already carries that `templateId` — just return it. A legacy/direct run (no
// `templateId`, e.g. `meso-rec-03`) has never had one, so the backend materializes a
// fresh template from the run's own fields on first rerun; mock does the same — insert
// a new template built from the meso's title/shortTitle/goal/weeks/split/style/phaseCurve
// (days: [] — a legacy run's per-day recipe isn't reconstructable from the domain
// Mesocycle shape in mock), then stamp the meso with the new id so a second rerun of the
// SAME meso reuses it instead of materializing again.
function mockRerun(qc: QueryClient, mesoId: string): MesoRerunResponse {
  const mesos = qc.getQueryData<Mesocycle[]>(MESOS_KEY) ?? mesocycles
  const meso = mesos.find((m) => m.id === mesoId)
  if (meso?.templateId) {
    return { templateId: meso.templateId }
  }
  const materialized: MesoTemplate = {
    id: crypto.randomUUID(),
    title: meso?.title ?? 'Mesociklus',
    shortTitle: meso?.shortTitle ?? null,
    goal: meso?.goal ?? null,
    weeks: meso?.weeks ?? 1,
    split: meso?.split ?? null,
    style: meso?.style ?? null,
    phaseCurve: meso?.phaseCurve ?? [],
    notes: null,
    volumePerMuscle: null,
    days: [],
    runCount: 1,
  }
  qc.setQueryData<MesoTemplate[]>(TEMPLATES_KEY, (prev) => [...(prev ?? mesoTemplatesMock), materialized])
  qc.setQueryData<Mesocycle[]>(MESOS_KEY, (prev) =>
    (prev ?? mesocycles).map((m) => (m.id === mesoId ? { ...m, templateId: materialized.id } : m)))
  return { templateId: materialized.id }
}
