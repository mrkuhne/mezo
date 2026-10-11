// ============================================================
// Mezo · MesoDayPage — ONE day of a plan, read-only, on its own route
// (/train/mesocycles/:id/days/:day — the day token is URL-encoded, e.g. H%C3%A9t).
// Folyadék F3 (mezo-n4wf5.3), prototype vilagos/edzes.js `nap()`.
//
//   hero  — the body as a vessel (`BodyLiq`, the side most of the day's muscles show on,
//           each muscle filled by its planned sets), the verdict „{sets} szett, {n} gyakorlat.",
//           the calibrated minutes (`useTimingProfile` → `estimateSessionMinutes`) and the
//           day's share of the week as a level — never a bare percent. One button: the
//           day's editor (…/edit).
//   1 Mit terhel ez a nap — one row per muscle group (`daySessionBreakdown`): a level to
//           the shared eight-set marker. Both the scale and the marker come from
//           SESSION_MUSCLE_CAP (setBudget.ts) — neither number is written here.
//   2 A nap gyakorlatai — the read-only exercise blocks: index, muscle chip, name, the
//           working sets as capsules, and the four prescription cells (szett × ismétlés,
//           RIR, kg induló, bemelegítő). „＋ Gyakorlat hozzáadása" opens the editor with
//           `?add=1`, so the picker is up on arrival.
//
// Honest words, not placeholders: 0 kg reads „saját testsúly" and a plank-style hold
// (repMin AND repMax both 0) reads „tartás", never „0–0".
// The editing itself lives one route down (`MesoDayEditPage`). A real ROUTE, not page
// state: a day is a place you can link to, come back to and hit back out of.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain, useTimingProfile } from '@/data/hooks'
import { DAY_LABELS, MUSCLE_LABELS } from '@/data/train/train'
import { InfoButton } from '@/features/train/components/InfoButton'
import { BodyLiq, Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { DAY_BODY_FULL, bodyViewOf } from '@/features/train/components/MesoDayCard'
import { huKg } from '@/features/train/logic/mesoDates'
import { estimateSessionMinutes } from '@/features/train/logic/sessionLength'
import { SESSION_CAP_PIN_PCT, daySessionBreakdown, sessionBarPct } from '@/features/train/logic/setBudget'
import { dayTileData } from '@/features/train/wizard/dayTiles'
import {
  Acts, Btn, Caps, Card, EmptyTank, FrameBack, Hero, Legend, Level, LevelMarks, Lk, Page, Row, Section, Skel, useFrameTitle,
} from '@/shared/ui/folyadek'

/** Block heights in px of the loading face: hero · the muscle card · the exercise card. Real mode has no plan
 *  until the list query lands, and a ghost shown in that window would call every valid deep link a dead one. */
const DAY_SKELETON_BLOCKS = [250, 170, 330]

export function MesoDayPage() {
  const { id, day: dayParam } = useParams<{ id: string; day: string }>()
  const navigate = useNavigate()
  const { mesocycles, workoutPending } = useTrain()
  // Calibrated pacing (Task 12, mezo-dzbm) for the hero's minutes (fetched here — before any
  // early return below, since hooks must run unconditionally).
  const { data: timingProfile, isPending: timingProfilePending } = useTimingProfile()

  const meso = mesocycles.find((m) => m.id === id)
  const day = meso?.days?.find((d) => d.day === dayParam)
  const own = meso?.status !== 'planned'
  const context = day && meso
    ? `${DAY_LABELS[day.day] ?? day.day} · ${own ? `a terv ${meso.currentWeek}. hete` : 'tervezett terv'}`
    : 'A terved'
  useFrameTitle({ title: day ? `${day.type} nap` : 'A nap', eyebrow: context })

  const back = <FrameBack history fallback={`/train/mesocycles/${id}`} className="fo-backpill">‹ A terved</FrameBack>

  // Real mode: the plan list is still in flight — wait, do not accuse the link.
  if (workoutPending) return <Page className="ep-page">{back}<Skel blocks={DAY_SKELETON_BLOCKS} /></Page>

  // A RESOLVED plan without this day is a dead link, and says so instead of rendering an empty page.
  if (!meso || !day) {
    return (
      <Page className="ep-page">
        {back}
        <Card>
          <EmptyTank icon="t-other">{meso ? 'Ez a nap nincs a tervedben.' : 'Ez az edzésterv nem található.'}</EmptyTank>
        </Card>
      </Page>
    )
  }

  const tile = dayTileData(day)
  const muscleRows = daySessionBreakdown(day)
  // Held at 0 (the „no minutes yet" treatment) while the profile fetch is pending — never
  // the static fallback, which would render then swap under the user (MesoEditor's own rule).
  const minutes = timingProfilePending ? 0 : estimateSessionMinutes(day.exercises, timingProfile ?? undefined)
  const weekSets = (meso.days ?? []).reduce((a, d) => a + d.exercises.reduce((s, e) => s + e.workingSets, 0), 0)
  const share = weekSets > 0 ? Math.round((tile.sets / weekSets) * 100) : 0
  const view = bodyViewOf(muscleRows.map((r) => r.colorMuscle))
  const editRoute = `/train/mesocycles/${meso.id}/days/${encodeURIComponent(day.day)}/edit`

  return (
    <Page className="ep-page">
      {back}
      {/* The day, as a vessel: the body filled by the day's own muscles, one verdict. */}
      <Hero label={context} verdict={`${tile.sets} szett, ${day.exercises.length} gyakorlat.`}
        sub={`${minutes} perc · a heted ${share}%-a`}
        left={(
          <BodyLiq view={view} caption={view === 'back' ? 'hátulról' : 'elölről'}
            entries={muscleRows.map((r) => ({ muscle: r.colorMuscle, planned: r.sets / DAY_BODY_FULL }))}
            ariaLabel={`${day.type} nap — érintett izmok`} />
        )}
        actions={<Btn onClick={() => navigate(editRoute)}>A nap szerkesztése</Btn>}>
        <div className="ep-hero-level"><Level pct={Math.min(100, share)} height={20} label="a heted" value={`${share}%`} /></div>
      </Hero>

      {muscleRows.length > 0 && (
        <>
          <Section n={1} title="Mit terhel ez a nap" />
          <Card className="ep-dayload">
            {muscleRows.map((r) => (
              <Row key={r.group} left={<Mchp muscle={r.colorMuscle} sm />} title={r.label}
                value={<>{r.sets} <small>szett</small></>}
                more={<LevelMarks pct={sessionBarPct(r.sets)} color={deepMuscle(r.colorMuscle)} marks={[{ at: SESSION_CAP_PIN_PCT }]} />} />
            ))}
            <Legend items={[{ kind: 'line', label: 'nyolc szett: fölötte már nem hoz többet' }]} />
            <Acts>
              <InfoButton eyebrow="Mit terhel ez a nap" title="Miért nyolcnál a jelölés?"
                copy="Egy izomra egy edzésen belül nagyjából nyolc szett fölött már nem hoz többet a munka. Nem tiltás — csak egy jelölés, hogy lásd, hol jársz." />
            </Acts>
          </Card>
        </>
      )}

      {/* The exercise blocks — read-only, rendered from the SAME rows the day's editor edits. */}
      <Section n={muscleRows.length > 0 ? 2 : 1} title="A nap gyakorlatai" />
      <Card className="ep-dayex">
        {day.exercises.map((e, i) => {
          const isHold = e.repMin === 0 && e.repMax === 0
          const bodyweight = e.anchorWeightKg === 0
          return (
            <div key={e.id} className="ep-ex">
              <div className="eh">
                <span className="ix">{String(i + 1).padStart(2, '0')}</span>
                <Mchp muscle={e.muscle} sm />
                <strong>{e.name}<small>{MUSCLE_LABELS[e.muscle] ?? e.muscle}</small></strong>
                <Caps n={e.workingSets} color={deepMuscle(e.muscle)} />
              </div>
              <div className="eg">
                <span><b className="t">{e.workingSets} × {isHold ? 'tartás' : `${e.repMin}–${e.repMax}`}</b><small>szett × ismétlés</small></span>
                <span><b>{e.targetRIR}</b><small>RIR</small></span>
                <span><b>{bodyweight ? 'saját testsúly' : e.anchorWeightKg != null ? huKg(e.anchorWeightKg) : '—'}</b><small>kg induló</small></span>
                <span><b>{e.warmupSets || '—'}</b><small>bemelegítő</small></span>
              </div>
            </div>
          )
        })}
        {/* The end-of-card actions: the editing itself lives on its own route (MesoDayEditPage);
            `?add=1` opens the picker on arrival so this link still adds an exercise. */}
        <Acts>
          <Lk onClick={() => navigate(`${editRoute}?add=1`)}>＋ Gyakorlat hozzáadása</Lk>
          <InfoButton eyebrow="A nap gyakorlatai" title="Mikortól él a változtatás?"
            copy="Amit itt átírsz, a következő edzésedtől számít. A most futó edzésedet nem írja át — azt végigviszed úgy, ahogy elkezdted." />
        </Acts>
      </Card>
    </Page>
  )
}
