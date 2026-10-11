// ============================================================
// Mezo · MesoTervPage — the Terv tab's landing (route /train/mesocycles).
// Folyadék F3 (mezo-n4wf5.3), prototype vilagos/edzes.js `terv()`.
// The running plan IS the page (the T9 inversion, mezo-88iwa.10): the library lives
// behind the „Edzéstervek" row.
//
//   hero         — the weeks of the plan as vessels (`MesoTubes`): the past weeks full, this
//                  week ringed and reading „megvan / terv", the coming ones a dashed line, the
//                  pihenőhét hatched. The per-week set totals come from the volume arc
//                  (`useMesocycleVolumeArc`); this week's done sets from the week's completed
//                  instances (`useWeekMuscleLog` → `doneByDay`, the same read the day list
//                  makes). Before the first workout there is no arc: the tubes then stand at
//                  the plan's own phase curve and carry no numbers. One button → the plan's
//                  own page (/train/mesocycles/:id).
//   1 A heted    — `MesoWeekDays`: only today is a full day card, every other day a row.
//   2 Az izmaid  — „Melyik izmod hol tart" → …/week, with Monday's forecast.
//   3 Terveid    — „Edzéstervek" → …/konyvtar, and the close row → `MesoCloseSheet`.
//
// Derivations are the app's own: `phaseChip` / `runBands` / `nextRolloverChips`
// (logic/mesoBands.ts) — the same modules the plan page and the week page read.
// No running plan → the page says so in an empty vessel and keeps the „Edzéstervek" door.
// Language: plain Hungarian — „edzésterv", „pihenőhét", never „mesociklus" / „deload".
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import { useWeekMuscleLog } from '@/data/train/weekMuscleLogHooks'
import type { Mesocycle } from '@/data/types'
import { MesoWeekDays, trainingDay } from '@/features/train/components/MesoWeekDays'
import { MesoTubes, PHASE_WORD, arcWeekTotals } from '@/features/train/components/MesoTubes'
import { nextRolloverChips, runBands } from '@/features/train/logic/mesoBands'
import { huDate } from '@/features/train/logic/mesoDates'
import { doneByDay } from '@/features/train/logic/mesoWeekDone'
import { MesoCloseSheet } from '@/features/train/sheets/MesoCloseSheet'
import MesoTervSkeleton from '@/features/train/pages/MesoTervSkeleton'
import { Btn, Card, EmptyTank, Hero, Note, Page, Row, Section, useFrameTitle } from '@/shared/ui/folyadek'

const trainingDayCount = (meso: Mesocycle) => (meso.days ?? []).filter((d) => trainingDay(d) !== null).length

/** The hero's support line: what this week weighs, and when the pihenőhét lands. */
function weekLine(meso: Mesocycle): string {
  const sets = runBands(meso).reduce((sum, b) => sum + b.current, 0)
  const deloadIdx = meso.phaseCurve.indexOf('Deload')
  const toDeload = deloadIdx >= 0 ? deloadIdx + 1 - meso.currentWeek : -1
  const rest =
    toDeload === 0 ? ' — és ez a hét maga a pihenőhét'
      : toDeload === 1 ? ' — a jövő hét már pihenőhét'
        : toDeload > 1 ? ` — ${toDeload} hét múlva jön a pihenőhét`
          : ''
  return `${sets} szett, ${trainingDayCount(meso)} edzésnapra osztva${rest}.`
}

export function MesoTervPage() {
  const { mesocycles, workoutPending } = useTrain()
  const navigate = useNavigate()
  const [closing, setClosing] = useState(false)
  const meso = workoutPending ? null : (mesocycles.find((m) => m.status === 'active') ?? null)
  // The hero's numbers: the plan's volume arc and the week's completed instances. Both are
  // cached reads other Edzés pages make; neither blocks the page (no arc = the plain face).
  const { arc, pending: arcPending } = useMesocycleVolumeArc(meso?.id ?? null)
  const { details } = useWeekMuscleLog()
  const none = !workoutPending && !meso
  useFrameTitle({
    eyebrow: meso ? `${meso.currentWeek}. hét a ${meso.weeks}-ból`
      : none ? (mesocycles.length === 0 ? 'Még nincs terved' : 'Most nem fut terv') : undefined,
  })

  // Real-mode loading: show the layout-aware skeleton until the meso list resolves.
  // Mock seeds synchronously → no skeleton.
  if (workoutPending) return <MesoTervSkeleton />

  const openKonyvtar = () => navigate('/train/mesocycles/konyvtar')

  if (!meso) {
    const first = mesocycles.length === 0
    return (
      <Page className="ep-page">
        {/* The kalauz's stable home: this page carries the anchor in EVERY state. */}
        <Hero data-kalauz-anchor="mesociklus-mosaic" label="Terv"
          verdict={first ? 'Még nincs edzésterved.' : 'Most nem fut terv.'}
          sub={first ? 'Itt fognak élni a terveid.' : 'A terveid az Edzéstervek mögött várnak.'}
          actions={<Btn onClick={openKonyvtar}>Edzéstervek</Btn>}>
          <EmptyTank icon="t-peak">
            {first ? 'Még nincs edzésterved — itt fognak élni a terveid.' : 'Most nem fut terv — a terveid az Edzéstervek mögött várnak.'}
          </EmptyTank>
        </Hero>
      </Page>
    )
  }

  const hasArc = arc != null && arc.mesocycleId === meso.id
  const weekTotals = hasArc ? arcWeekTotals(arc) : null
  const doneSets = [...doneByDay(details).values()].reduce((sum, d) => sum + d.sets, 0)
  const climbing = nextRolloverChips(meso).filter((c) => c.tone === 'sage').length
  const days = trainingDayCount(meso)

  return (
    <Page className="ep-page">
      <Hero label={`${meso.title} · ${PHASE_WORD[meso.phaseCurve[meso.currentWeek - 1]] ?? PHASE_WORD.MEV}`}
        verdict={`A ${meso.weeks} hétből a ${meso.currentWeek}. héten jársz.`}
        sub={weekLine(meso)}
        actions={<Btn onClick={() => navigate(`/train/mesocycles/${meso.id}`)}>A terv oldala</Btn>}>
        <div className="fo-hero-g">
          <MesoTubes curve={meso.phaseCurve} values={weekTotals} now={meso.currentWeek} nowDone={weekTotals ? doneSets : null}
            ariaLabel={weekTotals ? 'A terv hetei: heti szettszám' : 'A terv hetei: a terv íve'} />
        </div>
        <div className="fo-ft">
          <span>{huDate(meso.startDate)}</span>
          <span>{weekTotals ? 'heti szettszám' : 'a terv íve'}</span>
          <span>{huDate(meso.endDate)}</span>
        </div>
        {!weekTotals && !arcPending && (
          <Note>A hetek szettszáma az első edzésed után jelenik meg — addig a terv íve látszik.</Note>
        )}
      </Hero>

      <Section n={1} title={`A heted · ${days} edzésnap`} />
      <MesoWeekDays meso={meso}
        onOpenDay={(token) => navigate(`/train/mesocycles/${meso.id}/days/${encodeURIComponent(token)}`)} />

      <Section n={2} title="Az izmaid" />
      <Card>
        <Row icon="t-muscle" title="Melyik izmod hol tart"
          sub={climbing > 0 ? `${climbing} izom kap többet hétfőtől` : 'Hétfőtől minden izom tart'}
          aria-label="Melyik izmod hol tart"
          onClick={() => navigate(`/train/mesocycles/${meso.id}/week`)} />
      </Card>

      <Section n={3} title="Terveid" />
      <Card data-kalauz-anchor="mesociklus-mosaic">
        <Row icon="t-stack" title="Edzéstervek" sub="Amiből indíthatsz" aria-label="Edzéstervek" onClick={openKonyvtar} />
        {/* The quiet close row — the SAME sheet the plan's own page opens (mezo-meyc.2). */}
        <Row icon="t-coin" title="Edzésterv lezárása" sub={`Ha ezt a ${meso.weeks} hetet végigcsináltad`}
          aria-label="Edzésterv lezárása" onClick={() => setClosing(true)} />
      </Card>

      {closing && <MesoCloseSheet mesoId={meso.id} title={meso.title} onClose={() => setClosing(false)} />}
    </Page>
  )
}
