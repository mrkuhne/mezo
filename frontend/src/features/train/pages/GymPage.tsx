// ============================================================
// Mezo · GymPage — retired (mezo-d20.3.2). The prototype's Heti page absorbs
// GYM entirely ("napi lista … és az izom-zóna kártya (régi Gym)" — edzes-body
// .html aside note): the muscle-zone meta card, the schedule editor and the
// Mezociklus-áttekintő chip all moved onto TrainWeekPage, and its per-day
// GymDayCard list was a true duplicate of Heti's own agenda list (both drive
// the same gymDayTarget direct-start/review logic). `/train/gym` stays live
// as a thin alias — renders TrainWeekPage directly (no client navigate) so
// the URL/route itself is untouched (hub-agent territory: TrainSection's
// SubNavDropdown highlights by pathname, and MesocyclePlannerPage's post-start
// redirect still lands on `/train/gym`) while the content is unified with
// Heti — one page, two paths in.
// ============================================================
import { TrainWeekPage } from '@/features/train/pages/TrainWeekPage'

export function GymPage() {
  return <TrainWeekPage />
}
