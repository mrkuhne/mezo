import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { trainApi, type WorkoutDetailResponse } from '@/data/train/trainApi'

/**
 * Write path for the workout-level closing note (mezo-d20.8.2.2) — the review page's `✎` and
 * its `＋ Jegyzet` counterpart. Last-write-wins; an empty note clears it.
 *
 * Mock mode has no server, so it writes the detail cache directly rather than no-oping: a note
 * the user just typed must not vanish on the next render while the UI pretends it saved.
 */
export function useWorkoutNote() {
  const mock = isMockMode()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: mock
      ? async (_v: { id: string; note: string | null }) => undefined
      : (v: { id: string; note: string | null }) => trainApi.saveWorkoutNote(v.id, v.note),
    onSuccess: (_r, v) => {
      const key = ['train', 'workoutDetail', v.id]
      if (mock) {
        qc.setQueryData<WorkoutDetailResponse>(key, (old) =>
          old ? { ...old, note: v.note ?? undefined } : old)
        return
      }
      void qc.invalidateQueries({ queryKey: key })
    },
  })

  const saveNote = useCallback(
    (workoutId: string, note: string) =>
      mutation.mutate({ id: workoutId, note: note.trim() ? note.trim() : null }),
    [mutation],
  )
  return { saveNote, pending: mutation.isPending }
}
