import { timingProfileApi } from '@/data/train/timingProfileApi'
import { timingProfileMock } from '@/data/train/train'
import type { SessionTimingProfile } from '@/features/train/logic/sessionLength'
import { useDualQuery } from '@/data/useDualQuery'

/**
 * The calibrated pacing read (`GET /api/train/timing-profile`, Task 11). Dual-mode per
 * frontend_conventions.md §4: mock mode serves the seeded `timingProfileMock` (static seeds,
 * `samples` all 0) synchronously; real mode fetches and returns `null` — never the mock
 * seed — while unresolved, so a live user never sees the mock's numbers flash on screen.
 *
 * `data` is typed down to `SessionTimingProfile` (the four seconds fields `estimateSessionMinutes`
 * consumes) even though the wire response also carries `samples` — the extra field is harmless
 * structurally and no consumer of this hook needs it today.
 *
 * `isPending` matters as much as `data` here: a caller MUST gate its minutes render on it
 * (never fall back to the static estimate while pending) — otherwise a real-mode user watches
 * the static number swap to the calibrated one the instant the fetch lands. See
 * TrainTodayPage/MesoEditor callers.
 *
 * `realStaleTime` is generous (a timing profile only moves when a workout finishes, not on
 * every navigation) so a settled profile isn't refetched — and isn't briefly re-pended,
 * re-triggering the same swap-avoidance gate — on every mount.
 */
export function useTimingProfile(): { data: SessionTimingProfile | null; isPending: boolean } {
  return useDualQuery<SessionTimingProfile | null>({
    queryKey: ['train', 'timingProfile'],
    mockData: timingProfileMock,
    realFetch: () => timingProfileApi.get(),
    realEmpty: null,
    realStaleTime: 60_000,
  })
}
