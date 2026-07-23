import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { trainApi, type CustomWorkoutResponse, type CustomWorkoutUpsertRequest } from '@/data/train/trainApi'
import { customWorkoutsMock } from '@/data/train/train'
import type { CustomWorkout } from '@/data/types'

// The contract exercises are structurally identical to the FE GymExercise (targetRIR
// et al.) — the boundary cast mirrors toMesocycle's idiom (trainHooks.ts).
function toCustomWorkout(r: CustomWorkoutResponse): CustomWorkout {
  return { id: r.id, name: r.name, exercises: r.exercises as CustomWorkout['exercises'] }
}

/** The owner's saved custom (saját) workout templates. Mock: static fixtures, synchronous. */
export function useCustomWorkouts() {
  const mock = isMockMode()
  const q = useQuery<CustomWorkout[]>({
    queryKey: ['train', 'customWorkouts'],
    queryFn: mock
      ? async () => customWorkoutsMock
      : () => trainApi.customWorkouts().then((rs) => rs.map(toCustomWorkout)),
    initialData: mock ? customWorkoutsMock : undefined,
  })
  return { customWorkouts: q.data ?? [], customPending: !mock && q.isPending }
}

type SaveCb = { onSuccess?: (r?: CustomWorkout) => void; onSettled?: () => void }

/** Custom-workout template CRUD. Mock mode no-ops every write (visual parity only). */
export function useCustomWorkoutActions() {
  const mock = isMockMode()
  const qc = useQueryClient()
  const invalidate = () => {
    if (!mock) qc.invalidateQueries({ queryKey: ['train', 'customWorkouts'] })
  }
  const createM = useMutation({
    mutationFn: mock
      ? async (_body: CustomWorkoutUpsertRequest) => undefined
      : (body: CustomWorkoutUpsertRequest) => trainApi.createCustomWorkout(body).then(toCustomWorkout),
    onSuccess: invalidate,
  })
  const updateM = useMutation({
    mutationFn: mock
      ? async (_args: { id: string; body: CustomWorkoutUpsertRequest }) => undefined
      : (args: { id: string; body: CustomWorkoutUpsertRequest }) =>
          trainApi.updateCustomWorkout(args.id, args.body).then(toCustomWorkout),
    onSuccess: invalidate,
  })
  const deleteM = useMutation({
    mutationFn: mock ? async (_id: string) => undefined : (id: string) => trainApi.deleteCustomWorkout(id),
    onSuccess: invalidate,
  })
  return {
    createCustomWorkout: (body: CustomWorkoutUpsertRequest, cb?: SaveCb) =>
      createM.mutate(body, { onSuccess: (r) => cb?.onSuccess?.(r ?? undefined), onSettled: cb?.onSettled }),
    updateCustomWorkout: (args: { id: string; body: CustomWorkoutUpsertRequest }, cb?: SaveCb) =>
      updateM.mutate(args, { onSuccess: (r) => cb?.onSuccess?.(r ?? undefined), onSettled: cb?.onSettled }),
    deleteCustomWorkout: (id: string, cb?: SaveCb) =>
      deleteM.mutate(id, { onSuccess: () => cb?.onSuccess?.(), onSettled: cb?.onSettled }),
    savePending: createM.isPending || updateM.isPending,
  }
}
