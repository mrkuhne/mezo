import { useQuery } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { trainApi, type MesocycleVolumeArcResponse } from '@/data/train/trainApi'
import { mesoVolumeArcMock } from '@/data/train/train'
import type { MesoVolumeArc } from '@/data/types'

// Generated -> domain mapping mirrors toMesocycle's idiom (trainHooks.ts): the contract is
// structurally close to the domain shape, only `actual` needs coalescing to `null`.
function toMesoVolumeArc(r: MesocycleVolumeArcResponse): MesoVolumeArc {
  return {
    mesocycleId: r.mesocycleId,
    title: r.title,
    currentWeek: r.currentWeek,
    weeks: r.weeks,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status,
    phaseCurve: r.phaseCurve,
    muscles: r.muscles.map((m) => ({
      muscle: m.muscle,
      region: m.region,
      mrv: m.mrv,
      weeks: m.weeks.map((w) => ({
        week: w.week,
        phase: w.phase,
        planned: w.planned,
        actual: w.actual ?? null,
        isCurrent: w.isCurrent,
      })),
    })),
  }
}

/**
 * Whole-mesocycle volume arc for the meso overview screen (Phase B, Task B3). Mock mode
 * derives a fixture-backed arc from the active meso's `volumePerMuscle` synchronously (via
 * initialData); real mode fetches by id and has no static fallback (T0).
 */
export function useMesocycleVolumeArc(id: string | null) {
  const mock = isMockMode()
  const mockArc = mock ? mesoVolumeArcMock(id) : null
  const q = useQuery<MesoVolumeArc | null>({
    queryKey: ['train', 'mesoVolumeArc', id],
    queryFn: mock ? async () => mockArc : () => trainApi.mesocycleVolumeArc(id as string).then(toMesoVolumeArc),
    enabled: mock || !!id,
    initialData: mock ? mockArc : undefined,
    retry: false,
  })
  // `refetch` rides along so a failed arc fetch can offer a real retry (MesoWeekPage's
  // „Újra") instead of a dead-end message.
  return { arc: q.data ?? null, pending: !mock && q.isPending, error: !mock && q.isError, refetch: q.refetch }
}
