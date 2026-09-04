import type { GoalOverviewResponse } from '@/data/me/goalApi'

type CourseStatus = GoalOverviewResponse['courseStatus']

const REASON_BODY: Record<string, string> = {
  rate_on_track: 'A mért ütem a célodhoz beállított biztonságos sávban halad.',
  rate_off_track: 'A súlytrend biztos, de az ütem eltér a tervezettől.',
  rate_wrong_direction: 'A súlytrend most a céloddal ellentétes irányba mutat.',
  trend_missing: 'Még több súlymérés kell ahhoz, hogy biztos ütemet mutassak.',
  goal_invalid: 'A cél iránya, súlya vagy időablaka ellentmondásos. Előbb javítsd a beállítást.',
}

const STATUS_COPY: Record<CourseStatus, { eyebrow: string; heading: string; fallback: string }> = {
  on_track: { eyebrow: 'Jó pályán', heading: 'Jó úton haladsz', fallback: 'A jelenlegi ütem illeszkedik a célodhoz.' },
  watch: { eyebrow: 'Figyelmet kér', heading: 'Figyelmet kér', fallback: 'A jelenlegi ütem eltér a tervezettől.' },
  learning: { eyebrow: 'Adatot gyűjtök', heading: 'Még tanulom az ütemed', fallback: 'Még több súlymérés kell a biztos trendhez.' },
  invalid: { eyebrow: 'Céljavítás szükséges', heading: 'A cél beállítása hibás', fallback: 'Előbb javítsd a cél beállítását.' },
}

export function courseCopy(status: CourseStatus, reasonCode: string) {
  const copy = STATUS_COPY[status]
  return { eyebrow: copy.eyebrow, heading: copy.heading, body: REASON_BODY[reasonCode] ?? copy.fallback }
}

const DIET_EXPLANATION: Record<string, string> = {
  training_day_split: 'Ma edzésnap van: a heti keretből több energia jut az edzésnapok terheléséhez.',
  rest_day_split: 'Ma pihenőnap van: a heti átlagot alacsonyabb napi keret tartja egyensúlyban.',
  uniform_kcal: 'A Diet Plan minden napra egységes kalóriakeretet ad.',
  prescription_missing: 'Még nincs kiszámolt Diet Plan ehhez a célhoz.',
  goal_invalid: 'A kalóriakeret előtt a cél beállítását kell javítani.',
}

export function dietExplanation(code: string): string {
  return DIET_EXPLANATION[code] ?? 'A keretet a profilod, a célütem és a heti mozgásterv együtt adja.'
}
