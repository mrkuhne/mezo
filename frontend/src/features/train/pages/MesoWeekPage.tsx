// ============================================================
// Mezo · MesoWeekPage — „Heti vizsgálat": which muscle stands where this week
// (route /train/mesocycles/:id/week). Folyadék F3 (mezo-n4wf5.3), prototype
// vilagos/edzes.js `het()`.
//
//   hero  — the verdict „{n} izomcsoportot edzel ezen a héten.", how many are still
//           growing / at their ceiling / merely held plus the week-over-week delta, the
//           week's total as the one big numeral, and the body from both sides (`DuoBody`):
//           every muscle filled to where it stands against its own ceiling in this plan.
//   1 Hétfőtől változik — the one thing here that talks about the FUTURE: what Monday's
//           rollover does (`nextRolloverChips`).
//   2 Izmonként — one row per muscle, RANKED BY ROOM TO THE CEILING (the ones with
//           something still to give lead): the tier (Hangsúly · Építés · Tartás), a verdict
//           SENTENCE, and a vessel whose rim is the ceiling of this plan with the lower
//           threshold marked in it. A row opens the muscle's own page.
//
// The band / ceiling math is `muscleTiles` + `weekSummary` (logic/mesoWeek.ts) over the
// volume arc (`useMesocycleVolumeArc`). A FAILED arc is not „nincs még ív": the first is
// recoverable and says so, the second is a promise about the first session.
// Language: „felső érték", never „plafon"; „terv", never „blokk"; percent is never
// printed — the room is drawn as a level and said in sets.
// ============================================================
import { useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import type { MuscleTier } from '@/data/types'
import { DuoBody, Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { nextRolloverChips } from '@/features/train/logic/mesoBands'
import { muscleTiles, weekSummary, type MuscleWeekTile } from '@/features/train/logic/mesoWeek'
import { tierLabel } from '@/features/train/logic/tierLabel'
import {
  Big, Btn, Card, EmptyTank, FrameBack, Hero, Legend, LevelMarks, Note, Page, Row, Section, Skel, St, useFrameTitle,
} from '@/shared/ui/folyadek'

/** The tier pill's tone (prototype `TLK`): the emphasized muscle is the one that stands out. */
export const TIER_TONE: Record<MuscleTier, 'q' | 'plan' | 'ok'> = { maintain: 'q', grow: 'plan', emphasize: 'ok' }

/** The rollover forecast reads as a sentence, so it stops at FIVE muscles and says how many
 *  it left out — a 10-muscle plan turned the line into an unreadable wall. */
function rolloverLine(chips: { text: string }[]): string {
  const head = chips.slice(0, 5).map((c) => c.text)
  return chips.length > 5 ? [...head, `+${chips.length - 5}`].join(' · ') : head.join(' · ')
}

/** How many sets this muscle may still add inside THIS plan — the one quantity the page
 *  ranks and speaks by. A maintain muscle's ceiling IS its current number, so its room is
 *  0 and it never competes with a muscle that still has somewhere to go. */
const roomOf = (t: MuscleWeekTile) => t.ceiling - t.current

/** The verdict, in words. The page says what the number MEANS first (the owner's rule);
 *  the set count next to it is only the backing evidence. A held muscle (statusTone 'gold'
 *  with room still left — mesoWeek.ts's `grindHeldGroups`) gets its OWN sentence: it isn't
 *  at its ceiling, so „elérte a felső értéket" would be a claim the numbers don't back. */
function verdict(t: MuscleWeekTile): string {
  if (t.tier === 'maintain') return 'Ezt most szinten tartod.'
  const left = roomOf(t)
  if (t.statusTone === 'gold' && left > 0) return 'Most szinten tartod — múlt héten nehezen ment.'
  return left > 0 ? `Még ${left} szett fér bele.` : 'Elérte a felső értéket ebben a tervben.'
}

/** The hero's support line: how many muscles are in each of the three states. Counted off
 *  `statusTone` — never off room-to-ceiling directly: a held muscle still has room but reads
 *  as capped. Clauses are dropped when their count is 0. */
function stateLine(tiles: MuscleWeekTile[]): string {
  const growing = tiles.filter((t) => t.statusTone === 'sage').length
  const maxed = tiles.filter((t) => t.statusTone === 'gold').length
  const held = tiles.filter((t) => t.statusTone === 'mut').length
  const parts: string[] = []
  if (growing > 0) parts.push(`${growing} izomban van még hova nőni`)
  if (maxed > 0) parts.push(`${maxed} elérte a felső értéket`)
  if (held > 0) parts.push(`${held} izmot csak szinten tartasz`)
  return parts.length > 0 ? `${parts.join(', ')}. ` : ''
}

/** The delta line. „a múlt héthez képest" is the phrase the whole app uses for a
 *  week-over-week comparison — kept verbatim in every branch. */
function deltaSentence(delta: number): string {
  if (delta > 0) return `${delta} szettel több a múlt héthez képest.`
  if (delta < 0) return `${-delta} szettel kevesebb a múlt héthez képest.`
  return 'Pont annyi, mint a múlt héthez képest.'
}

/** Block heights in px of the loading face: the hero and five muscle rows. */
const WEEK_SKELETON_BLOCKS = [330, 74, 74, 74, 74, 74]

export function MesoWeekPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mesocycles, workoutPending } = useTrain()
  const { arc, pending: arcPending, error: arcError, refetch: refetchArc } = useMesocycleVolumeArc(id ?? null)
  const meso = mesocycles.find((m) => m.id === id)
  const loading = workoutPending || arcPending
  useFrameTitle({ title: 'Heti vizsgálat', eyebrow: !loading && meso && arc ? `${arc.currentWeek}. hét` : 'A terved' })

  const back = <FrameBack history fallback={`/train/mesocycles/${id}`} className="fo-backpill">‹ A terved</FrameBack>

  if (loading) return <Page className="ep-page">{back}<Skel blocks={WEEK_SKELETON_BLOCKS} /></Page>

  if (!meso) {
    return (
      <Page className="ep-page">
        {back}
        <Card><EmptyTank icon="t-other">Ez az edzésterv nem található.</EmptyTank></Card>
      </Page>
    )
  }
  if (!arc) {
    return (
      <Page className="ep-page">
        {back}
        <Card>
          {arcError ? (
            <EmptyTank icon="t-info" actions={<Btn sm onClick={() => void refetchArc()}>Újra</Btn>}>
              Nem sikerült betölteni a heti vizsgálatot — próbáld újra.
            </EmptyTank>
          ) : (
            <EmptyTank icon="t-muscle">A heti vizsgálat a terv első edzése után jelenik meg.</EmptyTank>
          )}
        </Card>
      </Page>
    )
  }

  // `muscleTiles` sorts by ceiling; the page RE-SORTS by room to the ceiling — the muscles
  // with something still to give are the ones worth looking at first. Ties fall back to the
  // bigger ceiling, so the emphasized muscle still leads a field where nothing has room left.
  const tiles = [...muscleTiles(arc, meso)].sort((a, b) => roomOf(b) - roomOf(a) || b.ceiling - a.ceiling)
  const summary = weekSummary(arc, tiles)
  const chips = nextRolloverChips(meso)

  let n = 0
  return (
    <Page className="ep-page">
      {back}
      <Hero label={`Heti vizsgálat · ${arc.currentWeek}. hét`}
        verdict={`${tiles.length} izomcsoportot edzel ezen a héten.`}
        sub={`${stateLine(tiles)}${summary.delta === null ? 'Ez a terv első hete — még nincs mihez mérni.' : deltaSentence(summary.delta)}`}>
        <Big className="ep-week-total" value={summary.total} unit="szett ezen a héten" />
        {/* Every muscle filled to where it stands against its own ceiling in this plan. */}
        <DuoBody size="md" ariaLabel="A heted izomtérképe"
          entries={tiles.map((t) => ({ muscle: t.group, done: t.ceiling > 0 ? Math.min(1, Math.max(0.12, t.current / t.ceiling)) : 0.12 }))} />
      </Hero>

      {chips.length > 0 && (
        <>
          <Section n={++n} title="Hétfőtől változik" />
          <Card>
            <Row icon="t-calendar" title="A következő heti váltás hétfő hajnalban" sub={rolloverLine(chips)} />
          </Card>
        </>
      )}

      <Section n={++n} title="Izmonként · ahol a legtöbb hely van, elöl" />
      <Card>
        <Legend className="ep-lgtop" items={[{ kind: 'line', label: 'ennyitől fejlődik' }, { kind: 'vessel', label: 'az edény széle: eddig mész el' }]} />
        {tiles.map((t) => (
          <Row key={t.group} className="ep-wrow" left={<Mchp muscle={t.group} sm />}
            title={<>{t.label} <St className="ep-st" tone={TIER_TONE[t.tier] ?? 'plan'}>{tierLabel(t.tier)}</St></>}
            sub={verdict(t)}
            more={(
              <LevelMarks height={16} color={deepMuscle(t.group)}
                pct={t.ceiling > 0 ? Math.min(100, Math.max(4, (t.current / t.ceiling) * 100)) : 0}
                marks={t.mev < t.ceiling && t.ceiling > 0 ? [{ at: (t.mev / t.ceiling) * 100 }] : []} />
            )}
            value={<>{t.current} <small>szett</small></>}
            aria-label={`${t.label} részletek`}
            onClick={() => navigate(`/train/mesocycles/${id}/week/${t.group}`)} />
        ))}
        <Note>
          A sáv azt mutatja, hol tartasz ahhoz képest, ameddig ebben a tervben elmész.
          Koppints egy izomra, ha érdekel, miért pont ennyi.
        </Note>
      </Card>
    </Page>
  )
}
