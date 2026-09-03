// ============================================================
// Mezo · useDayFace — a napszak-feloldás EGYETLEN helye (mezo-atry). A shell fejléce
// (`app/AppHeader.tsx`) és a Nap oldal (`NapHubPage`) korábban külön-külön másolta ide az
// `isFace` őrt, a `dayFace(tick, sleepGoal)` hívást és a `?dp=`-vagy-óra szabályt; két
// másolat két igazságot jelent, ezért a szabály innen jön mindkettőnek.
//
// A szabály változatlan: a `?dp=` CSAK a `/nap` útvonalon jelent napszak-VÁLASZTÁST —
// máshol (és hiányzó/érvénytelen érték esetén) a valós, alvás-horgonyzott napszak látszik.
// A `nowFace` külön is kijön, mert a hívóknak tudniuk kell, hogy a megjelenített napszak
// eltér-e a valóstól (eltérés-pötty, `?dp=` elhagyása a jelenlegi napszak választásakor).
// ============================================================
import { useLocation, useSearchParams } from 'react-router-dom'
import { useSleepGoal } from '@/data/hooks'
import { DAY_FACES, dayFace, type DayFace } from '@/features/today/logic/dayFace'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'

export const isFace = (v: string | null): v is DayFace =>
  v !== null && (DAY_FACES as readonly string[]).includes(v)

export function useDayFace(): { face: DayFace; nowFace: DayFace } {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { goal: sleepGoal } = useSleepGoal()
  const nowFace = dayFace(useMinuteTick(), sleepGoal)
  const dpParam = params.get('dp')
  return { face: pathname === '/nap' && isFace(dpParam) ? dpParam : nowFace, nowFace }
}
