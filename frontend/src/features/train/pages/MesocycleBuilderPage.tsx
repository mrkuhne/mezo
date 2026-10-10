// ============================================================
// Mezo · MesocycleBuilderPage — a plan's own page (route /train/mesocycles/:id,
// a sub-page: back button, no top tabs). Folyadék F3 (mezo-n4wf5.3), prototype
// vilagos/edzes.js `run()` — three faces:
//
//   ACTIVE    hero „A terv íve": the plan's weekly set totals as a liquid surface
//             (`useMesocycleVolumeArc`, summed per week) with „most" and the peak marked;
//             before the first workout there is no arc, so the weeks stand as plain vessels
//             at the plan's own phase curve. One button → the week review.
//             1 Mezo jegyzete — why the volume moved (the latest recompute change), when
//               there is one.
//             2 Hol tartasz — „Heti vizsgálat" (→ the week page, with the five loudest
//               muscles as little vessels) and „Hétfőn jön" (a FORECAST, not a door: the
//               rollover runs on its own).
//             3 A heted — the SAME `MesoWeekDays` list the Terv landing draws.
//             4 Lezárás — opens `MesoCloseSheet`.
//   PLANNED   hero „Ez a terv még nem indult el." with the plain vessels and the dated
//             „Aktiválás · <date>" button; the week as rows (nothing is today yet).
//   NOT FOUND an empty vessel that says so.
// An ARCHIVED run has no page of its own and redirects to its frozen report (mezo-meyc.2).
// Language: „edzésterv", „emelkedik", „pihenőhét" — never mesociklus / rámpa / deload.
// ============================================================
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import type { Mesocycle } from '@/data/types'
import { nextRolloverChips, phaseChip, runBands, type Phase } from '@/features/train/logic/mesoBands'
import { huDate } from '@/features/train/logic/mesoDates'
import { isOffDay } from '@/features/train/logic/offDay'
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'
import { MesoWeekDays } from '@/features/train/components/MesoWeekDays'
import { MesoTubes, arcWeekTotals, azA } from '@/features/train/components/MesoTubes'
import { Mchp, deepMuscle } from '@/features/train/components/folyadek'
import { MesoCloseSheet } from '@/features/train/sheets/MesoCloseSheet'
import {
  Area, Btn, Card, Chev, EmptyTank, FrameBack, Hero, Msg, Note, Page, Row, Section, useFrameTitle,
} from '@/shared/ui/folyadek'
import type { CSSProperties } from 'react'

/** The phase in the owner's words (the engine's „Rámpa" / „Deload" never reach the screen). */
const PHASE_LABEL: Record<Phase, string> = { Rámpa: 'Emelkedés', Csúcs: 'Csúcshét', Deload: 'Pihenőhét' }

/** The mini vessels' denominator — THIS plan's own highest ceiling, so they stay comparable
 *  inside the row whatever the plan's landmarks are. */
function barCeiling(bands: { ceiling: number }[]): number {
  return Math.max(...bands.map((b) => b.ceiling), 1)
}

/** Mezo's one sentence about the latest volume change, in plain words (the same recompute
 *  row `deciderSentence` reads — logic/mesoBands.ts — reworded per the prototype). */
function mezoNote(meso: Mesocycle): string | null {
  const change = meso.volumeRecompute?.changes[0]
  if (!change) return null
  const label = BUDGET_GROUP_LABELS[change.muscle] ?? change.muscle
  const current = meso.volumePerMuscle?.[change.muscle]?.current
  switch (change.reason) {
    case 'tartás':
      return current === undefined
        ? `A ${label.toLowerCase()} a múlt héten nehezen ment, ezért most tartjuk a szettszámot — az emelés folytatódik, amint visszaáll a tempó.`
        : `A ${label.toLowerCase()} a múlt héten nehezen ment, ezért most tartjuk a ${current} szettet — az emelés folytatódik, amint visszaáll a tempó.`
    case 'cél teljesítve, nincs grind':
      return `Jól ment a hét: a ${label.toLowerCase()} 2 szettel többet kap.`
    case 'deload':
      return `Pihenőhét: a ${label.toLowerCase()} fele annyi szettel pihen.`
    default:
      return `${label}: ${change.change}.`
  }
}

/** „Az 5. hét a csúcs, a 6. a pihenőhét." — read off the plan's own phase curve. */
function arcVerdict(meso: Mesocycle): string {
  const peak = meso.phaseCurve.indexOf('MRV') + 1
  const deload = meso.phaseCurve.indexOf('Deload') + 1
  if (peak > 0 && deload > 0) return `${azA(peak, true)} ${peak}. hét a csúcs, ${azA(deload)} ${deload}. a pihenőhét.`
  if (peak > 0) return `${azA(peak, true)} ${peak}. hét a csúcs.`
  if (deload > 0) return `${azA(deload, true)} ${deload}. hét a pihenőhét.`
  return `${meso.weeks} hetes terv.`
}

/** The planned face's support line: when it starts, how long it runs, where its peak and rest fall. */
function plannedLine(meso: Mesocycle, startsOn: string | null): string {
  const peak = meso.phaseCurve.indexOf('MRV') + 1
  const deload = meso.phaseCurve.indexOf('Deload') + 1
  const head = startsOn ? `${startsOn} indul, és ${meso.weeks} hétig tart` : `${meso.weeks} hétig tart`
  if (deload === meso.weeks && peak === meso.weeks - 1) return `${head}: az utolsó előtti hét a csúcs, az utolsó a pihenőhét.`
  if (peak > 0 && deload > 0) return `${head}: ${azA(peak)} ${peak}. hét a csúcs, ${azA(deload)} ${deload}. a pihenőhét.`
  if (deload > 0) return `${head}: ${azA(deload)} ${deload}. hét a pihenőhét.`
  return `${head}.`
}

export function MesocycleBuilderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { mesocycles, activateMesocycle, mesoMutationPending } = useTrain()
  const [closing, setClosing] = useState(false)
  const meso = mesocycles.find((m) => m.id === id)
  const active = meso?.status === 'active'
  // The hero's surface: the plan's volume arc (a cached read the week page makes too). Only an
  // active run has one; without it the page draws the plain vessels.
  const { arc, pending: arcPending } = useMesocycleVolumeArc(active ? (id ?? null) : null)

  const phase = meso ? PHASE_LABEL[phaseChip(meso)] : null
  const endsOn = huDate(meso?.endDate)
  const startsOn = huDate(meso?.startDate)
  useFrameTitle(!meso || meso.status === 'archived'
    ? { title: 'Edzésterv', eyebrow: 'Terv' }
    : {
        title: meso.title,
        eyebrow: active
          ? [`Aktív · ${meso.currentWeek}/${meso.weeks} hét`, phase, endsOn && `vége ${endsOn}`].filter(Boolean).join(' · ')
          : [`Tervezett · ${meso.weeks} hét`, startsOn && `indul ${startsOn}`].filter(Boolean).join(' · '),
      })

  const backToLibrary = () => navigate('/train/mesocycles')

  // A closed run has no builder — its plan is history, and the thing worth opening is the
  // frozen report (mezo-meyc.2). Deep links / back-nav land here too, so redirect rather
  // than render a read-only page nobody can act on.
  if (meso?.status === 'archived') {
    return <Navigate to={`/train/mesocycles/${meso.id}/report`} replace />
  }

  const back = <FrameBack history fallback="/train/mesocycles" label="Edzésterv" className="ep-back">‹ Terv</FrameBack>

  if (!meso) {
    return (
      <Page className="ep-page">
        {back}
        <Card>
          <EmptyTank icon="t-other" actions={<Btn sm onClick={backToLibrary}>Edzéstervek</Btn>}>
            Ez az edzésterv nem található.
          </EmptyTank>
        </Card>
      </Page>
    )
  }

  const openDay = (token: string) => navigate(`/train/mesocycles/${meso.id}/days/${encodeURIComponent(token)}`)
  // Training days only — Rest and the sport/off days carry no plan to edit.
  const trainingDays = (meso.days ?? []).filter((d) => d.type !== 'Rest' && !isOffDay(d))

  if (!active) {
    return (
      <Page className="ep-page">
        {back}
        <Hero label={`Tervezett terv · ${meso.split}`} verdict="Ez a terv még nem indult el." sub={plannedLine(meso, startsOn)}
          actions={meso.status === 'planned' ? (
            <Btn onClick={() => activateMesocycle(meso.id)} disabled={mesoMutationPending}>
              Aktiválás · {startsOn ?? meso.startDate}
            </Btn>
          ) : undefined}>
          <div className="ep-hg">
            <MesoTubes curve={meso.phaseCurve} weeks={meso.weeks} now={0} height={92} ariaLabel="A terv hetei: a terv íve" />
          </div>
          <div className="ep-ft"><span>{startsOn}</span><span>a terv íve</span><span>{endsOn}</span></div>
        </Hero>
        {trainingDays.length > 0 && (
          <>
            <Section n={1} title="A heted · koppints egy napra a szerkesztéshez" />
            <MesoWeekDays meso={meso} upcoming onOpenDay={openDay} />
          </>
        )}
      </Page>
    )
  }

  const bands = runBands(meso)
  const totalSets = bands.reduce((a, b) => a + b.current, 0)
  const ramping = bands.filter((b) => b.step === 'up').length
  const holding = bands.length - ramping
  const note = mezoNote(meso)
  const rollover = nextRolloverChips(meso)
  const groupOf = new Map(bands.map((b) => [b.label, b.group]))

  const weekTotals = arc && arc.mesocycleId === meso.id ? arcWeekTotals(arc) : null
  const nowIdx = meso.currentWeek - 1
  const peakIdx = meso.phaseCurve.indexOf('MRV')

  let n = 0
  return (
    <Page className="ep-page">
      {back}
      <Hero label={`A terv íve · ${meso.split}`} verdict={arcVerdict(meso)}
        sub={weekTotals ? `Most ${azA(meso.currentWeek)} ${meso.currentWeek}. héten jársz: ${weekTotals[nowIdx] ?? totalSets} szett.` : `Most ${azA(meso.currentWeek)} ${meso.currentWeek}. héten jársz.`}
        actions={<Btn onClick={() => navigate(`/train/mesocycles/${meso.id}/week`)}>Heti vizsgálat</Btn>}>
        {weekTotals ? (
          <div className="ep-hg ar" role="img" aria-label={`A terv íve: heti szettszám, ${weekTotals.join(', ')}`}>
            <Area values={weekTotals} height={150}
              labels={weekTotals.map((_, i) => (i === weekTotals.length - 1 ? `${i + 1}. hét` : `${i + 1}.`))}
              min={Math.max(0, Math.round(Math.min(...weekTotals) / 2))} max={Math.max(...weekTotals) + 8}
              marks={[
                { i: nowIdx, label: `most · ${weekTotals[nowIdx]}`, kind: 'now' },
                ...(peakIdx >= 0 && peakIdx !== nowIdx ? [{ i: peakIdx, label: `csúcs · ${weekTotals[peakIdx]}`, kind: 'pr' as const }] : []),
              ]} />
          </div>
        ) : (
          <>
            <div className="ep-hg">
              <MesoTubes curve={meso.phaseCurve} weeks={meso.weeks} now={meso.currentWeek} ariaLabel="A terv hetei: a terv íve" />
            </div>
            {!arcPending && <Note>A hetek szettszáma az első edzésed után jelenik meg — addig a terv íve látszik.</Note>}
          </>
        )}
      </Hero>

      {note && (
        <>
          <Section n={++n} title="Mezo jegyzete" />
          <Card><Msg member="mezo">{note}</Msg></Card>
        </>
      )}

      <Section n={++n} title="Hol tartasz" />
      <Card>
        <Row icon="t-muscle" title="Heti vizsgálat" sub={`${totalSets} szett · ${ramping} emelkedik · ${holding} tart`}
          onClick={() => navigate(`/train/mesocycles/${meso.id}/week`)}
          right={(
            <span className="ep-rowchev">
              <span className="ep-mini" aria-hidden="true">
                {bands.slice(0, 5).map((b) => (
                  <i key={b.group} style={{ '--c': deepMuscle(b.group) } as CSSProperties}>
                    <b style={{ height: `${Math.min(100, Math.max(15, Math.round((b.current / barCeiling(bands)) * 100)))}%` }} />
                  </i>
                ))}
              </span>
              <Chev />
            </span>
          )} />
        {/* A FORECAST, not a destination — the rollover runs on its own, so this row has no onClick. */}
        <Row icon="t-calendar" title="Hétfőn jön" sub="A heti váltás hajnalban magától lefut." />
        {/* Five muscles, then a „+N" — the forecast reads at a glance; a ten-muscle plan wrapped
            into an unreadable wall of chips. */}
        {rollover.length > 0 && (
          <div className="ep-roll">
            {rollover.slice(0, 5).map((c) => (
              <span key={c.label}>
                <Mchp muscle={groupOf.get(c.label) ?? ''} size={24} />
                {c.tone === 'sage' ? <b>{c.text}</b> : c.text}
              </span>
            ))}
            {rollover.length > 5 && <span className="tx">{`+${rollover.length - 5}`}</span>}
          </div>
        )}
      </Card>

      {trainingDays.length > 0 && (
        <>
          <Section n={++n} title="A heted · koppints egy napra a szerkesztéshez" />
          {/* The SAME list the Terv landing draws — one week, one component. */}
          <MesoWeekDays meso={meso} onOpenDay={openDay} />
        </>
      )}

      <Section n={++n} title="Lezárás" />
      <Card>
        {/* Closing freezes a report — MesoCloseSheet owns the confirm + the optional self-eval
            note and lands on the report (mezo-meyc.2). */}
        <Row icon="t-coin" title="Edzésterv lezárása" sub="A lezáráskor riport készül róla" aria-label="Edzésterv lezárása"
          state={mesoMutationPending ? 'dim' : undefined}
          onClick={mesoMutationPending ? undefined : () => setClosing(true)} />
      </Card>

      {closing && <MesoCloseSheet mesoId={meso.id} title={meso.title} onClose={() => setClosing(false)} />}
    </Page>
  )
}
