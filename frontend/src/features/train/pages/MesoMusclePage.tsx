// ============================================================
// Mezo · MesoMusclePage — one muscle's whole story, reached from a week-review row
// (route /train/mesocycles/:id/week/:muscle). Folyadék F3 (mezo-n4wf5.3), prototype
// vilagos/edzes.js `izom()`.
//
//   hero  — the verdict „A {izom} hetente {n} szettet kap.", what that number means and what
//           Monday does to it; THE MEASURING CYLINDER (this page only, `Cyl` below): the
//           liquid is this week's sets, the solid line the ceiling of this plan („eddig mész
//           el"), the dashed line the lower threshold („ennyitől fejlődik"). Its scale is the
//           muscle's raw upper landmark, widened if this plan's own peak goes past it. A
//           muscle you only hold has both lines in the same place, so it gets ONE line and
//           ONE caption („ennyitől fejlődik — és itt tartod"). Beside it the body, with this
//           muscle filled. The liquid row carries the ⓘ link.
//   1 Hol tartasz — three plain facts: sessions a week, week-one sets, the most this plan asks.
//   2 A {n} hét   — the plan's ramp for this muscle as vessels (`MesoTubes`), in its colour.
//   3 Hol edzed   — one row per training day that works it, each a door to that day's page.
//   4 Honnan jön ez a szám — the four-layer provenance (`DerivationSteps`).
//   5 Az előző tervhez képest — then and now as two vessels on ONE ruler. NEVER red on a
//           down move: „Most" keeps the muscle's own colour whatever the delta, and the
//           sentence says a lower peak is a shift of focus, not a failure.
//
// Real-mode T0: a null arc is NOT an error — „couldn't load" and „no sessions yet" are told
// apart. Language: „felső érték" not „plafon", „terv" not „blokk", „pihenőhét" not „deload".
// ============================================================
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import { InfoButton } from '@/features/train/components/InfoButton'
import { DerivationSteps } from '@/features/train/components/DerivationSteps'
import { MesoTubes } from '@/features/train/components/MesoTubes'
import { bodyViewOf } from '@/features/train/components/MesoDayCard'
import { BodyLiq, DayNum, Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { muscleTiles, previousBlock, whereItWorks } from '@/features/train/logic/mesoWeek'
import { tierLabel } from '@/features/train/logic/tierLabel'
import {
  Card, EmptyTank, Facts, FrameBack, Hero, Note, Page, Row, Section, Skel, Tubes, Txt, Wave, useFrameTitle,
} from '@/shared/ui/folyadek'

/** Two captions closer than this (in points of the cylinder's 0–100 scale) would print on top of
 *  each other: a caption is up to two lines tall beside a 190px vessel. */
export const CAPTION_MIN_GAP = 16

/** When two landmarks sit close while their NUMBERS differ, both captions still render — so
 *  their anchors are pushed apart to exactly CAPTION_MIN_GAP around their own midpoint, then
 *  slid back inside the scale if that pushed an end off it. Only the CAPTIONS move; the lines
 *  keep their true positions, and a pair already far enough apart is returned untouched. */
export function spreadCaptions(lowPct: number, topPct: number): [number, number] {
  if (topPct - lowPct >= CAPTION_MIN_GAP) return [lowPct, topPct]
  const mid = (lowPct + topPct) / 2
  let lo = mid - CAPTION_MIN_GAP / 2
  let hi = mid + CAPTION_MIN_GAP / 2
  if (lo < 0) { hi -= lo; lo = 0 }
  if (hi > 100) { lo -= hi - 100; hi = 100 }
  return [lo, hi]
}

/** The liquid and the lines use 90% of the vessel's height (the prototype's `* .9`), and the
 *  vessel is 190px tall: one point of the scale is this many px. */
const CYL_PX_PER_POINT = 0.9 * 1.9

/** The standing measuring cylinder (prototype `.vs-cyl`). All positions are 0–100 on the page's scale. */
function Cyl({ value, nowPct, topPct, lowPct, ceiling, mev, merged, color, label }: {
  value: number; nowPct: number; topPct: number; lowPct: number; ceiling: number; mev: number
  /** The threshold IS the ceiling: one line, one caption. */
  merged: boolean
  color: string; label: string
}) {
  const [lowCap, topCap] = merged ? [lowPct, topPct] : spreadCaptions(lowPct, topPct)
  const dy = (cap: number, at: number) => ({ '--dy': `${((at - cap) * CYL_PX_PER_POINT).toFixed(1)}px` }) as CSSProperties
  return (
    <div className="ep-cyl" style={{ '--c': color } as CSSProperties} role="img" aria-label={label}>
      <span className="tb">
        <span className={nowPct < 28 ? 'l lo' : 'l'} data-level={nowPct.toFixed(1)}
          style={{ height: `${Math.min(90, Math.max(3, nowPct * 0.9))}%` }}>
          <Wave color={`color-mix(in srgb,${color} 70%,#fff)`} />
          <b>{value}</b>
        </span>
      </span>
      <i className="wl top" data-at={topPct.toFixed(1)} style={{ bottom: `${topPct * 0.9}%`, ...dy(topCap, topPct) }}>
        <em>{merged ? 'ennyitől fejlődik — és itt tartod' : 'eddig mész el'} · {ceiling}</em>
      </i>
      {!merged && (
        <i className="wl d low" data-at={lowPct.toFixed(1)} style={{ bottom: `${lowPct * 0.9}%`, ...dy(lowCap, lowPct) }}>
          <em>ennyitől fejlődik · {mev}</em>
        </i>
      )}
    </div>
  )
}

/** Block heights in px of the loading face: hero · facts · the weeks · three rows. */
const MUSCLE_SKELETON_BLOCKS = [330, 64, 120, 72, 72, 72]

export function MesoMusclePage() {
  const { id, muscle } = useParams<{ id: string; muscle: string }>()
  const navigate = useNavigate()
  const { mesocycles, workoutPending } = useTrain()
  const { arc, pending: arcPending, error: arcError } = useMesocycleVolumeArc(id ?? null)
  const meso = mesocycles.find((m) => m.id === id)
  const loading = workoutPending || arcPending
  const tile = !loading && meso && arc ? muscleTiles(arc, meso).find((t) => t.group === muscle) : undefined
  const profile = meso?.volumePerMuscle?.[muscle ?? '']
  useFrameTitle({ title: tile && profile ? tile.label : 'Izom', eyebrow: 'Heti vizsgálat' })

  const back = <FrameBack history fallback={`/train/mesocycles/${id}/week`} className="ep-back">‹ Heti vizsgálat</FrameBack>

  if (loading) return <Page className="ep-page">{back}<Skel blocks={MUSCLE_SKELETON_BLOCKS} /></Page>

  if (!meso || !arc) {
    // A FAILED arc fetch is not „nincs még ív" — the first says try again, the second says
    // wait for the first session.
    return (
      <Page className="ep-page">
        {back}
        <Card>
          {!meso ? <EmptyTank icon="t-other">Ez az edzésterv nem található.</EmptyTank>
            : arcError ? <EmptyTank icon="t-info">Nem sikerült betölteni a heti vizsgálatot — próbáld újra.</EmptyTank>
              : <EmptyTank icon="t-muscle">A heti vizsgálat a terv első edzése után jelenik meg.</EmptyTank>}
        </Card>
      </Page>
    )
  }

  if (!tile || !profile) {
    return (
      <Page className="ep-page">
        {back}
        <Card><EmptyTank icon="t-other">Ez az izom nincs a heti vizsgálatban.</EmptyTank></Card>
      </Page>
    )
  }

  const color = deepMuscle(tile.group)
  const rows = whereItWorks(meso, tile.group)
  const archived = mesocycles.filter((m) => m.status === 'archived')
  const prev = previousBlock(archived, tile.group)
  const name = tile.label.toLowerCase()
  const room = tile.ceiling - tile.current
  const weekOneValue = tile.series[0]?.planned ?? tile.mev
  const seriesToNow = tile.series.filter((s) => s.week <= arc.currentWeek)

  // The plan's own peak („a legtöbb lesz") — the MAX planned value over the non-pihenőhét
  // weeks, not merely the LAST one: a tapering plan whose highest week isn't its last working
  // week would under-report both this fact and the cylinder's scale.
  const nonDeloadPlanned = tile.series.filter((s) => !s.deload).map((s) => s.planned)
  const top = nonDeloadPlanned.length > 0 ? Math.max(...nonDeloadPlanned) : tile.current
  // One scale for the cylinder: the muscle's raw upper landmark, widened if this plan's own
  // peak goes past it.
  const scale = Math.max(tile.mrv, top) || 1
  // The two „then / now" vessels share their OWN ruler: an archived plan that peaked above
  // this plan's scale would otherwise fill both to the brim while their numbers still differ.
  const versusScale = Math.max(scale, prev?.peak ?? 0) || 1
  const pos = (v: number) => Math.min(100, Math.max(0, (v / scale) * 100))
  // ONE line and the merged caption only when the threshold IS the ceiling — a pair that
  // merely sits close keeps both lines and both captions (nudged apart), so the text never
  // says something the numbers don't back up.
  const merged = tile.mev === tile.ceiling

  const say =
    tile.tier === 'maintain'
      ? 'Ez így is marad: most máshol építesz — ez az izom közben megtartja, amit tud.'
      : room > 0
        ? `Még ${room} fér bele, aztán a terv végéig ${tile.ceiling} marad a felső érték.`
        : 'Ennél többet ez a terv már nem ad. A következő tervben indulsz majd magasabbról.'

  // What Monday does, read straight off the arc's NEXT week — never a promise the plan's own
  // series doesn't already carry. The PROMISE itself is clamped to `tile.step` (mesoWeek.ts),
  // not the raw arc delta: a held muscle's next planned week can still show +2 in the raw
  // series while the engine's own step is 0.
  const nextWeek = tile.series.find((s) => s.week === arc.currentWeek + 1)
  const next = !nextWeek
    ? 'Ez a terv utolsó hete — hétfőn már nem változik.'
    : nextWeek.deload
      ? `Hétfőtől pihenőhét: ${nextWeek.planned} szettre esik vissza.`
      : tile.step > 0
        ? `Hétfőn ${tile.step} szettel többet kapsz.`
        : 'Hétfőn nem változik.'

  const lastWeek = tile.series[tile.series.length - 1]
  const planned = tile.series.map((s) => s.planned)
  const view = bodyViewOf([tile.group])

  return (
    <Page className="ep-page">
      {back}
      <Hero label={`${arc.currentWeek}. hét · ${tierLabel(tile.tier)}`}
        verdict={`A ${name} hetente ${tile.current} szettet kap.`}
        sub={`${say} ${next}`}
        actions={(
          <InfoButton link eyebrow="Hol tartasz" title="Mit jelentenek a jelölések?"
            copy="Az alsó jelölés alatt nincs elég inger ahhoz, hogy ez az izom fejlődjön. A felső érték az, ameddig ebben a tervben elmész — ezt a fókuszod szabja meg." />
        )}>
        <div className="ep-cylw">
          <Cyl value={tile.current} nowPct={pos(tile.current)} topPct={pos(tile.ceiling)} lowPct={pos(tile.mev)}
            ceiling={tile.ceiling} mev={tile.mev} merged={merged} color={color}
            label={merged
              ? `${tile.label}: ${tile.current} szett hetente; ${tile.ceiling} szettől fejlődik, és itt tartod`
              : `${tile.label}: ${tile.current} szett hetente; ${tile.mev} szettől fejlődik, ${tile.ceiling} szettig mész el`} />
          <BodyLiq view={view} caption={view === 'back' ? 'hátulról' : 'elölről'}
            entries={[{ muscle: tile.group, done: tile.ceiling > 0 ? Math.min(1, Math.max(0.1, tile.current / tile.ceiling)) : 0.1 }]}
            ariaLabel={`${tile.label} a testtérképen`} />
        </div>
      </Hero>

      <Section n={1} title="Hol tartasz" />
      <Card>
        <Facts className="ep-mfacts" items={[[rows.length, 'edzés hetente'], [weekOneValue, 'szett az 1. héten'], [top, 'a legtöbb lesz']]} />
      </Card>

      {/* — the plan's ramp for this muscle, week by week — */}
      <Section n={2} title={`A ${arc.weeks} hét`} />
      <Card>
        <MesoTubes curve={arc.phaseCurve} values={planned} now={arc.currentWeek} height={84} max={Math.max(...planned, 1)} color={color}
          ariaLabel={`A ${name} heti szettszáma a terv ${arc.weeks} hetében`} />
        <Note>
          {lastWeek?.deload
            ? `Az utolsó hét pihenőhét — ott ${lastWeek.planned} szettre esik vissza, hogy kipihend a ${arc.weeks} hetet.`
            : `A terv ${arc.weeks} hete végig dolgoztatja ezt az izmot — nincs a végén pihenőhét.`}
        </Note>
      </Card>

      {/* — where it works: one door per training day — */}
      <Section n={3} title="Hol edzed" />
      <Card>
        {rows.length > 0 ? rows.map((r) => (
          <Row key={r.day} className="ep-where" left={<><DayNum>{r.day}</DayNum><Mchp muscle={tile.group} sm /></>}
            title={`${r.type} nap`} sub={r.exercises.map((e) => e.name).join(', ')}
            value={<>{r.sets} <small>szett</small></>}
            aria-label={`${r.day} · ${r.type} nap`}
            onClick={() => navigate(`/train/mesocycles/${id}/days/${encodeURIComponent(r.day)}`)} />
        )) : <Note className="ep-solo">Ezen a héten nincs olyan nap, amelyik ezt az izmot dolgoztatná.</Note>}
      </Card>

      {/* — the four-layer provenance — */}
      <Section n={4} title="Honnan jön ez a szám" />
      <Card className="ep-deriv">
        <DerivationSteps profile={profile} tier={tile.tier} ceiling={tile.ceiling} weekOneValue={weekOneValue}
          series={seriesToNow} step={tile.step} />
      </Card>

      {/* — this plan against the previous one. A lower peak is NEVER drawn red. — */}
      <Section n={5} title="Az előző tervhez képest" />
      <Card>
        {prev ? (
          <>
            <Txt>Előző terved: {prev.title}</Txt>
            <Tubes className="ep-vs" height={116} aria-label="Az előző terv és a mostani"
              items={[
                { label: 'Akkor', value: `${prev.start} → ${prev.peak}`, note: 'szett / hét', pct: (prev.peak / versusScale) * 94, color: 'var(--fo-faint)' },
                { label: 'Most', value: `${weekOneValue} → ${top}`, note: 'szett / hét', pct: (top / versusScale) * 94, color, wl: (prev.peak / versusScale) * 94 },
              ]} />
            <Note>
              {top > prev.peak
                ? `Ez a terv ${top - prev.peak} szettel visz magasabbra, mint az előző.`
                : top === prev.peak
                  ? 'Ez a terv ugyanoda visz, mint az előző — ez tartás, nem visszaesés.'
                  : 'Az előző terv magasabbra vitt — most más izom kapja a hangsúlyt.'}
            </Note>
          </>
        ) : (
          <Note className="ep-solo">Ehhez az izomhoz még nincs korábbi terved — ez az első, amiben számon tartjuk.</Note>
        )}
      </Card>
    </Page>
  )
}
