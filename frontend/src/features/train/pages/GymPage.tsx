// ============================================================
// Mezo · GymPage — retired (mezo-d20.3.2), kept as a thin alias (mezo-d20.9.1).
// The prototype's Heti page absorbed GYM entirely ("napi lista … és az izom-zóna
// kártya (régi Gym)" — edzes-body.html aside note): the muscle-zone meta card,
// the schedule editor and the Mezociklus-áttekintő chip all moved onto
// TrainWeekPage, and its per-day GymDayCard list was a true duplicate of Heti's
// own agenda list (both drive the same gymDayTarget direct-start/review logic).
//
// F8 cleanup kept the alias: the Train sub-nav shell it originally also served
// is gone, but `/train/gym` is still a LIVE navigation target for three callers
// — MesoStartSheet (post-start redirect), MesocyclePlannerPage (post-create
// redirect) and CustomWorkoutBuilderPage's useBackNav fallback — plus any PWA
// bookmark. Renders TrainWeekPage directly (no client navigate) so the URL is
// untouched while the content is unified with Heti: one page, two paths in.
// ============================================================
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'

export function GymPage() {
  return <TrainWeekPage />
}
