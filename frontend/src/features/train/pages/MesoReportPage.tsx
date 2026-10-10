// ============================================================
// Mezo · MesoReportPage (mezo-meyc.2) — the FROZEN end-of-mesocycle report of a
// closed run. Full-screen sibling route /train/mesocycles/:id/report (no Train
// sub-nav), reached from a Történet card tap, from MesoCloseSheet right after a
// close, and by an archived run's builder visit (which redirects here — a closed
// run has no builder).
//
// Everything on the page is a SNAPSHOT taken at close time, not a live read —
// the only live things are the two actions (regenerate, rerun). Blocks render
// strictly from what the report carries: no volume ⇒ no muscle-journey block,
// null selfEval ⇒ no note block, `aiEvalEnabled: false` ⇒ the machine-evaluation
// disclosure does not exist at all.
//
// Strength labelling is deliberately two-headed, mirroring the backend: `deltaKg`
// is the top-set LOAD difference while `deltaPct` is measured on e1RM — so "same
// weight, more reps" is 0 kg but a real percentage gain, and a weightless lift
// has neither (only its reps moved).
//
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `riport()`), top to bottom:
//   hero — a cup filled to the completion share, the run's five stars over
//     `runStars(report.adherence.completionPct)` (the ceremony's own `starsFor` scale, never a
//     second rating rule) with the share beside them, its one plain sentence as the verdict;
//     „Újrafuttatás" and „Sablon megnyitása" on the liquid row.
//   1 · Hogy ment — the two adherence facts and the „Ezt akartad" quote.
//   2 · Izmonként — per muscle a vessel whose rim is the ceiling: the level is the peak, the
//     dashed waterline is where it started.
//   3 · Erő — a capsule per lift (the old top-set load as the dashed line) and both deltas.
//   4 · Rekordok — the run's medals.
//   5 · A futam után — the self-evaluation, „A mostani tervedhez képest" (the closed run's PEAK
//     weekly sets as a waterline in tubes filled to the ACTIVE plan's CURRENT-week target, one
//     tube per muscle the two share; the „most" number comes from the active run's volume arc —
//     the same source `MesoMusclePage` reads — and the block exists ONLY when there is an active
//     run AND at least one shared muscle), the collapsed context disclosure, and the two other
//     live actions (save as template, regenerate).
// Loading, read error (+ retry), not found, still running, no report (+ generate) and
// generating are each one empty vessel.
//
// Train parity P1 Task 5 (mezo-e1ii9) ended the page where the prototype's
// closed-run story ends. Three pre-Titanium leftovers went, each of them a SECOND
// surface for data that already has a first one: the `HETI SZETTEK · A BLOKK ÍVE`
// chart with its MEV/MAV/MRV/Deload legend (the muscle-journey card below states
// the same arc in plain words — start → peak / ceiling), the `ÉLETMÓD-KONTEXTUS`
// emoji totals row and its W1–W8 spreadsheet. NOT every metric in them was rehomed,
// and saying otherwise was the fix wave's own finding: the run-window TOTALS live on
// (in the collapsed block below, and on MesoComparePage via `contextDiff`), the daily
// readings live on the Me/Fuel surfaces — but the PER-WEEK granularity (`context.weeks[]`)
// and `gymRpeAvg` have no renderer anywhere in the app any more. Both are deliberate
// deaths, not oversights: the prototype's closed-run story has no week-by-week view.
// The backend still computes and ships them, so a later slice can surface them without
// touching the server — recorded in docs/features/train.md §9 and in the parity matrix.
// The AI evaluation is NOT a leftover — it is a real
// backend feature with no prototype counterpart — so it kept its place as a quiet,
// collapsed `details` at the foot of the story, labelled for what it is: an
// estimate written by the program, not a measurement.
//
// Fix round 1 (mezo-e1ii9): the claim that the run-window context averages "have their
// own home" on MesoComparePage was only true for a user with TWO OR MORE closed runs —
// `MesoFutamokPage` gates the compare entry behind `archived.length >= 2`, so a first
// closed run (or any run reviewed alone) had no path to those six numbers at all. Per the
// brief's own fallback ("fold a plain-language version into the collapsed section"), the
// same six `CONTEXT_METRICS` this page's `contextDiff` sibling draws now also render as
// plain prose-and-number rows inside the collapsed disclosure below — no emoji, no table,
// the MEV/MAV/MRV block stays retired. A metric the run never measured renders '–', never
// a fabricated 0, and an averaged/summed figure says so in words rather than posing as a
// single measurement.
//
// Fix wave (mezo-e1ii9): the block grew the three totals the shared six left stranded.
// `sportSessions` + `runSessions` are plain run-window counts exactly like the six, so they
// render as two more rows (`REPORT_ONLY_ROWS`, report-local — `CONTEXT_METRICS` is the
// compare page's contract and widening it would silently add two columns there). And the
// Kcal row finally has something to sit against: `kcalTargetMean` averages the weeks' own
// `kcalTargetAvg` (the totals carry no target) and `kcalTargetNote` turns it into one
// sentence — rendered ONLY when both the measured average AND a real target exist, because
// a fabricated target would read as a verdict about the owner's eating.
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMesoReport, useMesoTemplates, useTrain } from '@/data/hooks'
import { useMesocycleVolumeArc } from '@/data/train/mesoArcHooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { huMonthDay } from '@/shared/lib/dates'
import { MUSCLE_LABELS } from '@/data/train/train'
import { BUDGET_GROUP_LABELS } from '@/features/train/logic/setBudget'
import { CONTEXT_METRICS } from '@/features/train/logic/mesoCompare'
import type { MesoContextTotals, MesoStrengthDelta, MesocycleReportResponse } from '@/data/train/trainApi'
import type { MedalType } from '@/data/train/medalTypes'
import type { MesoVolumeArc, MuscleVolumeArc } from '@/data/types'
import { MEDAL_TYPE_LABEL } from '@/features/train/logic/medalLabels'
import { runStars } from '@/features/train/logic/libraryStory'
import { InfoButton } from '@/features/train/components/InfoButton'
import { Mchp, Rcap, deepMuscle } from '@/features/train/components/folyadek'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import {
  Acts, Btn, Bub, Card, Chev, EmptyTank, Facts, Fill, FrameBack, Hero, Lab, Legend, LevelMarks, Lk, Note, Page, Row,
  Section, Skel, Tags, Tubes, Txt, useFrameTitle,
} from '@/shared/ui/folyadek'

/** The cup of the hero (prototype `SH_CUP`, 0 0 100 100). */
const SH_CUP = 'M20 9 H80 V34 C80 55 67 67 55 70 V81 H70 V93 H30 V81 H45 V70 C33 67 20 55 20 34Z'

const fmt = (n: number): string => n.toLocaleString('hu-HU')
const signed = (n: number): string => `${n > 0 ? '+' : ''}${fmt(n)}`
/** 'Feb 12' from either an ISO date or an ISO date-time (closedAt). */
const day = (iso: string): string => huMonthDay(iso.slice(0, 10))

/**
 * How the top-set moved, in plain terms. A loaded lift names both ends of the load AND the
 * reps (the reps are what makes a flat load still count as progress); a weightless lift has
 * only reps to report.
 */
function movementLabel(s: MesoStrengthDelta): string {
  const reps = `${s.firstTopReps} → ${s.lastTopReps} rep`
  if (s.firstTopKg == null || s.lastTopKg == null) return reps
  return `${fmt(s.firstTopKg)} → ${fmt(s.lastTopKg)} kg · ${reps}`
}

/** Contract → domain arc: identical but for `actual`'s optionality (mesoArcHooks' idiom). */
function toMuscleArcs(volume: MesocycleReportResponse['volume']): MuscleVolumeArc[] {
  return (volume?.muscles ?? []).map((m) => ({
    muscle: m.muscle,
    region: m.region,
    mrv: m.mrv,
    weeks: m.weeks.map((w) => ({ ...w, actual: w.actual ?? null })),
  }))
}

interface PeakBandRow { muscle: string; label: string; start: number | null; peak: number; ceiling: number }

/**
 * The band language's frozen close-time read, per muscle: where W1 started, the loudest
 * planned week the run actually reached, and the arc's ceiling (MRV). Sorted by ceiling desc
 * — the same convention `runBands` uses on the live page — so Emphasize's MRV-bound muscles
 * lead. A muscle with no logged weeks at all cannot happen (a frozen arc always carries at
 * least W1), but the empty-array guard keeps `Math.max` from returning `-Infinity`. `start`
 * stays `null` (never a fabricated 0) when the arc genuinely has no W1 row to read.
 */
function peakBands(arcs: MuscleVolumeArc[]): PeakBandRow[] {
  return arcs
    .map((m) => ({
      muscle: m.muscle,
      label: BUDGET_GROUP_LABELS[m.muscle] ?? m.muscle,
      start: m.weeks[0]?.planned ?? null,
      peak: m.weeks.length > 0 ? Math.max(...m.weeks.map((w) => w.planned)) : 0,
      ceiling: m.mrv,
    }))
    .sort((a, b) => b.ceiling - a.ceiling)
}

// --- the star hero + then-vs-now (T10 Task 4, mezo-88iwa.11) ---

/** Hungarian decimal comma for the stars' screen-reader label (the ceremony's own idiom). */
const huStars = (stars: number): string => String(stars).replace('.', ',')

/**
 * Five stars, halves included — the full, half and empty star glyphs of the sprite
 * (prototype `stars5`), the same halves the workout ceremony's row draws.
 */
function StarRow({ stars }: { stars: number }) {
  return (
    <span className="er-stars" role="img" aria-label={`${huStars(stars)} csillag az ötből`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon3D key={i} name={stars >= i + 1 ? 't-star' : stars >= i + 0.5 ? 't-star-half' : 't-star-empty'} size={18} />
      ))}
    </span>
  )
}

/** A live action as a row: a real button, so it can be `disabled` while a mutation runs (the kit
 *  Row has no such state) — the kit row's own markup and classes. */
function ActRow(p: { icon: Icon3DName; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="fo-row er-act" disabled={p.disabled} onClick={p.onClick}>
      <span className="si"><Icon3D name={p.icon} size={26} /></span>
      <span className="g"><strong>{p.title}</strong></span>
      <Chev />
    </button>
  )
}

/** One muscle, twice: what it peaked at in the closed run, what the active plan gives it now. */
export interface VersusPair {
  muscle: string
  label: string
  /** The closed run's loudest planned week for this muscle (the frozen arc's max). */
  then: number
  /** The ACTIVE run's planned sets for its CURRENT week — the same number MesoMusclePage's
   *  „Most" row is built from (arc week === arc.currentWeek). */
  now: number
}

/**
 * The then-vs-now pairs: muscles the closed run's frozen arc and the ACTIVE run's live arc
 * BOTH carry. A muscle only one side trains has nothing to compare, so it is dropped rather
 * than paired against an invented 0; with no active arc at all (no running plan, or it has
 * not loaded) the list is empty and the caller draws no block. Sorted by the run's own peak,
 * descending — the muscles that carried the block lead.
 */
export function versusPairs(closed: MuscleVolumeArc[], activeArc: MesoVolumeArc | null): VersusPair[] {
  if (!activeArc) return []
  const out: VersusPair[] = []
  for (const m of closed) {
    if (m.weeks.length === 0) continue
    const nowMuscle = activeArc.muscles.find((a) => a.muscle === m.muscle)
    const now = nowMuscle?.weeks.find((w) => w.week === activeArc.currentWeek)?.planned
    if (now == null) continue
    out.push({
      muscle: m.muscle,
      label: BUDGET_GROUP_LABELS[m.muscle] ?? m.muscle,
      then: Math.max(...m.weeks.map((w) => w.planned)),
      now,
    })
  }
  return out.sort((a, b) => b.then - a.then || a.muscle.localeCompare(b.muscle))
}

/** '–' for a missing per-muscle start value — never a fabricated 0. */
const dash = (n: number | null | undefined, suffix = ''): string => (n == null ? '–' : `${fmt(n)}${suffix}`)

// --- run-window lifestyle context, folded into the collapsed section (fix round, mezo-e1ii9) ---

export interface ContextRow {
  key: string
  /** Plain-language description of what the number IS — an average, a total, an estimate —
   *  never bare enough to be mistaken for a single measurement. */
  descriptor: string
  /** '–' when this run never measured the metric — the honesty rule, never a fabricated 0. */
  value: string
  /** An optional second line under the descriptor — today only the kcal row's
   *  target comparison. Absent unless BOTH numbers it compares actually exist. */
  note?: string
}

/**
 * Same six fields `mesoCompare`'s `contextDiff` draws on `MesoComparePage`, reused here
 * (not re-declared) so the two surfaces can never quietly disagree about which metrics
 * exist. Each row spells out in words whether the number is an average over the run's days
 * or a total across it — `contextDiff` only ever shows two runs side by side, so it never
 * had to say this out loud; a lone run's row does.
 *
 * A metric NOT listed here is SKIPPED, not crashed on (fix wave, mezo-e1ii9): `CONTEXT_METRICS`
 * is the compare page's list, and a seventh field added there for THAT surface must never take
 * this one down — a report is a frozen artefact, and a blank screen is the worst possible way
 * to learn a new metric exists.
 */
const CONTEXT_ROW_COPY: Record<string, { descriptor: string; render: (n: number) => string }> = {
  Alvás: { descriptor: 'Átlagos alvásidő éjszakánként', render: (n) => `${fmt(n)} óra` },
  Kcal: { descriptor: 'Átlagos napi kalóriabevitel', render: (n) => `${fmt(Math.round(n))} kcal` },
  Energia: { descriptor: 'Energiaszint — a napi önértékelések átlaga', render: (n) => fmt(n) },
  Stressz: { descriptor: 'Stresszszint — a napi önértékelések átlaga', render: (n) => fmt(n) },
  Súlyváltozás: { descriptor: 'Testsúlyváltozás a futam alatt, összesítve a mért napokból', render: (n) => `${signed(n)} kg` },
  Sport: { descriptor: 'Sportra fordított idő összesen a futam alatt', render: (n) => `${fmt(n)} perc` },
}

/**
 * The two run-window COUNTS the compare page's six metrics leave out (fix wave, mezo-e1ii9).
 * `sportSessions`/`runSessions` sit on `MesoContextTotals` exactly like the six above — plain
 * totals over the same window — and until this round they had no renderer anywhere in the app
 * while the backend kept shipping them. They live HERE rather than in the shared
 * `CONTEXT_METRICS` because that list is the compare page's contract; widening it would add two
 * columns to a surface nobody asked to change.
 */
const REPORT_ONLY_ROWS: { key: string; descriptor: string; pick: (t: MesoContextTotals) => number | null; render: (n: number) => string }[] = [
  {
    key: 'Sportalkalom',
    descriptor: 'Sportalkalmak száma összesen a futam alatt',
    pick: (t) => t.sportSessions ?? null,
    render: (n) => `${fmt(n)} alkalom`,
  },
  {
    key: 'Futás',
    descriptor: 'Futások száma összesen a futam alatt',
    pick: (t) => t.runSessions ?? null,
    render: (n) => `${fmt(n)} futás`,
  },
]

/**
 * The run's average kcal TARGET — the number the average intake above has to sit against.
 * `MesoContextTotals` carries no target of its own, so the only honest source is the mean of
 * the weeks' own `kcalTargetAvg` over the weeks that actually HAD one. No such week ⇒ null,
 * and the comparison line simply does not render: a fabricated target would turn a missing
 * plan into a verdict about the owner's eating.
 */
export function kcalTargetMean(weeks: { kcalTargetAvg?: number | null }[]): number | null {
  const vals = weeks.map((w) => w.kcalTargetAvg).filter((v): v is number => v != null)
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0) / vals.length
}

/**
 * The kcal row's comparison sentence, or null. Needs BOTH the measured average AND a target;
 * either one missing means there is nothing to compare, and the row stays a bare average.
 */
export function kcalTargetNote(kcalAvg: number | null, target: number | null): string | null {
  if (kcalAvg == null || target == null) return null
  const diff = Math.round(kcalAvg) - Math.round(target)
  const tail = diff === 0 ? 'pont annyi, a célhoz képest' : `${signed(diff)} kcal a célhoz képest`
  return `A cél ${fmt(Math.round(target))} kcal volt — ${tail}.`
}

/** The plain-language context rows for a closed run's OWN report — absent metrics stay '–'. */
function contextRows(totals: MesoContextTotals, weeks: { kcalTargetAvg?: number | null }[]): ContextRow[] {
  const target = kcalTargetMean(weeks)
  const shared = CONTEXT_METRICS.flatMap((m) => {
    const copy = CONTEXT_ROW_COPY[m.label]
    // An unknown metric is skipped, never crashed on — see CONTEXT_ROW_COPY's note.
    if (!copy) return []
    const raw = m.pick(totals)
    const note = m.label === 'Kcal' ? kcalTargetNote(raw, target) : null
    return [{
      key: m.label,
      descriptor: copy.descriptor,
      value: raw == null ? '–' : copy.render(raw),
      ...(note ? { note } : {}),
    }]
  })
  const extras = REPORT_ONLY_ROWS.map((r) => {
    const raw = r.pick(totals)
    return { key: r.key, descriptor: r.descriptor, value: raw == null ? '–' : r.render(raw) }
  })
  return [...shared, ...extras]
}

export function MesoReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/mesocycles')
  const { mesocycles, workoutPending } = useTrain()
  const { report, pending, notFound, error, refetch, regenerating, regenerate } = useMesoReport(id ?? null)
  const { rerun, createTemplate } = useMesoTemplates()
  // The plan that is running NOW — the „most" half of the then-vs-now block. Its arc is the
  // same read MesoMusclePage's versus rows use; with no active run the hook is a no-op and
  // the block simply does not exist.
  const activeMeso = mesocycles.find((m) => m.status === 'active') ?? null
  const { arc: activeArc } = useMesocycleVolumeArc(activeMeso?.id ?? null)
  // The rerun's resolved template — opens the one shared start sheet (mezo-meyc.1).
  const [startTemplate, setStartTemplate] = useState<{ id: string; title?: string } | null>(null)

  const meso = mesocycles.find((m) => m.id === id)
  const title = report?.title ?? meso?.title ?? 'Futam'
  // Failed mutations are toasted globally (§7a) — the button handlers below have nothing
  // richer to add, so they swallow the rejection rather than leave it unhandled.
  const rerunMeso = () => {
    if (!id) return
    rerun(id)
      .then(({ templateId }) => setStartTemplate({ id: templateId, title }))
      .catch(() => {})
  }
  const fireRegenerate = () => {
    regenerate().catch(() => {})
  }
  // „Sablon mentése ebből a futamból" (mezo-tlwa) — forks this run's plan into a NEW
  // template and lands in its editor. Needs the RUN (the report DTO carries no day plan),
  // so it renders only once the meso list has resolved it; `Újrafuttatás` above is the
  // other direction — it reuses the run's originating template instead of forking.
  const saveAsTemplate = () => {
    if (!meso) return
    createTemplate(runToTemplate(meso))
      .then((created) => navigate(`/train/mesocycles/templates/${created.id}`))
      .catch(() => {})
  }

  const arcs = toMuscleArcs(report?.volume)
  // The run's rating — the ceremony's own star scale over the frozen completion share.
  const rating = report ? runStars(report.adherence.completionPct) : null
  const pairs = versusPairs(arcs, activeArc)
  const versusScale = Math.max(1, ...pairs.map((p) => Math.max(p.then, p.now)))
  // The run-window lifestyle rows (fix round, mezo-e1ii9) — absent only when the report
  // itself carries no context at all (async aggregation never ran, or the run predates it).
  const ctxRows = report?.context ? contextRows(report.context.totals, report.context.weeks ?? []) : []
  const span = report ? `${day(report.startDate)}${report.endDate ? ` – ${day(report.endDate)}` : ''}` : null

  useFrameTitle({ title, eyebrow: span ? `Lezárt futam · ${span}` : 'Lezárt futam' })
  const back = <FrameBack className="er-back" onBack={goBack}>Vissza</FrameBack>
  /** One empty vessel: every state without a report (prototype `ghost`). */
  const ghost = (icon: Icon3DName, text: string, action?: { label: string; onClick: () => void }) => (
    <Page className="er-page">
      {back}
      <Card>
        <EmptyTank icon={icon} actions={action ? <Btn sm onClick={action.onClick}>{action.label}</Btn> : undefined}>{text}</EmptyTank>
      </Card>
    </Page>
  )
  const loading = <Page className="er-page">{back}<Skel blocks={[300, 90, 200, 200]} label="Riport betöltése…" /></Page>

  // Loading / no-report-yet states. An EXISTING report renders as soon as it lands — it is
  // self-contained, so it never waits on the meso list. Only the no-report branch needs the run
  // itself (to tell "closed but ungenerated" from "still running"), so that is the only branch
  // gated on `workoutPending`.
  if (pending) return loading
  // A genuine read failure (the contract's 404 is `notFound` below, not this) — a terminal
  // state with a retry, never a blank page (§7a).
  if (error) return ghost('t-info', 'Nem sikerült betölteni a riportot.', { label: 'Újrapróbálás', onClick: refetch })
  if (notFound) {
    if (workoutPending) return loading
    if (!meso) return ghost('t-other', 'Ez a futam nem található.')
    if (meso.status !== 'archived') return ghost('t-clock', 'Ez a futam még fut — a riport a lezárás pillanatában készül el.')
    return regenerating
      ? ghost('t-flask', 'Riport készül…')
      : ghost('t-scroll', 'Ehhez a lezárt futamhoz még nincs riport — generáld le a rögzített adatokból.', { label: 'Riport generálása', onClick: fireRegenerate })
  }
  if (!report || !rating) return <Page className="er-page">{back}</Page>

  const pct = report.adherence.completionPct
  const heroTags = [`${report.weeks} hét`]
  if (report.closedAt) heroTags.push(`Lezárva · ${day(report.closedAt)}`)
  let n = 0

  return (
    <Page className="er-page er-cards">
      {back}
      {/* The share is DRAWN (the cup's level) and spelled once beside the stars — the facts
          below do not repeat it: the same 88% twice on one screen reads as two measurements. */}
      <Hero
        label={`Lezárt futam · ${span}`}
        verdict={rating.say}
        sub="A teljesített edzések aránya"
        left={<Fill d={SH_CUP} pct={Math.max(0, Math.min(100, pct)) * 0.9} size={86} color="#F9D06A" color2="#E9892B" />}
        actions={(
          <>
            <Btn onClick={rerunMeso}>Újrafuttatás</Btn>
            {report.templateId && (
              <Lk onClick={() => navigate(`/train/mesocycles/templates/${report.templateId}`)}>Sablon megnyitása</Lk>
            )}
          </>
        )}
      >
        <div className="er-ms"><StarRow stars={rating.stars} /><span>{pct}%</span></div>
        <Tags items={heroTags} />
      </Hero>

      {/* Adherence — the "did the plan actually happen" glance. */}
      <Section n={++n} title="Hogy ment" />
      <Card>
        <Facts items={[
          [`${report.adherence.completedSessions}/${report.adherence.plannedSessions}`, 'Edzés'],
          [`${report.adherence.completedWeeks}/${report.adherence.plannedWeeks}`, 'Hét'],
        ]} />
        {/* „Ezt akartad" — the wizard's freeform goal text, read back once the block is done,
            next to the one honest line the close captured (meso.summary). A run without notes
            (nothing typed, or a legacy run predating the field) simply has no quote to show. */}
        {meso?.notes && (
          <div className="er-quote" data-testid="meso-report-quote">
            <Lab>Ezt akartad</Lab>
            <Txt>{`„${meso.notes}”`}</Txt>
            {meso.summary && <Note>{`— és ez lett: ${meso.summary}`}</Note>}
          </div>
        )}
      </Card>

      {/* The muscle journeys: where each muscle started, the loudest week it reached, and its
          ceiling. */}
      {arcs.length > 0 && (
        <>
          <Section n={++n} title="Izmonként · indulás → elért csúcs / felső érték" />
          <Card data-testid="meso-report-bands">
            {peakBands(arcs).map((r) => (
              <Row
                key={r.muscle}
                data-testid="report-band-row"
                left={<Mchp muscle={r.muscle} sm />}
                title={r.label}
                more={(
                  <LevelMarks
                    pct={r.ceiling > 0 ? Math.min(100, (r.peak / r.ceiling) * 100) : 0}
                    color={deepMuscle(r.muscle)}
                    height={14}
                    marks={r.start != null && r.ceiling > 0 ? [{ at: (r.start / r.ceiling) * 100, dashed: true }] : []}
                  />
                )}
                value={`${dash(r.start)} → ${fmt(r.peak)} / ${fmt(r.ceiling)}`}
              />
            ))}
            <Legend items={[
              { label: 'innen indult', kind: 'dash' },
              { label: 'az edény széle a felső érték', kind: 'vessel' },
            ]} />
            <Acts>
              <InfoButton
                link
                eyebrow="Izmonként"
                title="Hogyan olvasd?"
                copy="Honnan indult és meddig jutott az izom heti szettszáma a futam alatt. A csúcs a pihenőhét előtti utolsó hét."
              />
            </Acts>
          </Card>
        </>
      )}

      {/* Strength — LOAD move and e1RM percentage labelled apart */}
      {report.strength.length > 0 && (
        <>
          <Section n={++n} title={`Erő · ${report.strength.length} gyakorlat`} />
          <Card data-testid="meso-report-strength">
            {report.strength.map((s) => {
              // The LOAD delta — absent when nothing was loaded, hidden when flat. The e1RM delta
              // is the one that credits extra reps at the same load; hidden at exactly 0 for the
              // same reason: a flat lift has no verdict to badge.
              const kgTxt = s.deltaKg != null && s.deltaKg !== 0 ? `${signed(s.deltaKg)} kg` : null
              const pctTxt = s.deltaPct != null && s.deltaPct !== 0 ? `${signed(s.deltaPct)}% becsült 1RM` : null
              const loaded = s.firstTopKg != null && s.lastTopKg != null && s.lastTopKg > 0
              return (
                <Row
                  key={`${s.catalogId ?? s.exerciseName}-${s.firstWeek}`}
                  data-testid="strength-row"
                  left={<Rcap prev={loaded ? (s.firstTopKg! / s.lastTopKg!) * 92 : null} color={deepMuscle(s.muscle)} />}
                  title={s.exerciseName}
                  sub={(
                    <>
                      {`${s.firstWeek}. hét → ${s.lastWeek}. hét · ${movementLabel(s)}`}
                      <br />
                      {[kgTxt, pctTxt, MUSCLE_LABELS[s.muscle] ?? s.muscle].filter(Boolean).join(' · ')}
                    </>
                  )}
                  value={kgTxt ?? (s.deltaPct != null && s.deltaPct !== 0 ? `${signed(s.deltaPct)}%` : undefined)}
                />
              )
            })}
          </Card>
        </>
      )}

      {/* Records earned inside the run's window */}
      <Section n={++n} title={`Rekordok · ${report.records.medalCount} medál`} />
      <Card data-testid="meso-report-records">
        {report.records.top.length === 0 ? (
          <Note className="er-none">Ebben a futamban nem született rekord.</Note>
        ) : report.records.top.map((r) => (
          <Row
            key={`${r.exerciseName}-${r.kind}-${r.date}`}
            left={<Rcap />}
            title={r.exerciseName}
            sub={`${MEDAL_TYPE_LABEL[r.kind as MedalType] ?? r.kind} · ${day(r.date)}`}
            value={r.value != null ? fmt(r.value) : undefined}
          />
        ))}
      </Card>

      <Section n={++n} title="A futam után" />
      <Card>
        {/* The owner's own verdict, captured by MesoCloseSheet — read-only here */}
        {report.selfEval && (
          <>
            <Lab>Saját értékelés</Lab>
            <Txt>{report.selfEval}</Txt>
          </>
        )}

        {/* „A mostani tervedhez képest" — the closed run's peak weekly sets against what the
            RUNNING plan gives the same muscle this week. No active plan, or no muscle in common,
            and the block is absent entirely. */}
        {pairs.length > 0 && (
          <div data-testid="meso-report-versus">
            <Lab>A mostani tervedhez képest</Lab>
            <Note className="er-none">Ugyanazok az izmok — mennyit bírtak akkor a csúcson, és mennyit kapnak most.</Note>
            <Tubes
              height={92}
              size="sm"
              gap={6}
              items={pairs.map((p) => ({
                node: <Mchp muscle={p.muscle} size={28} />,
                label: <span data-testid="versus-pair">{p.label}</span>,
                value: fmt(p.now),
                note: `akkor ${fmt(p.then)}`,
                pct: (p.now / versusScale) * 94,
                wl: (p.then / versusScale) * 94,
                color: deepMuscle(p.muscle),
              }))}
            />
          </div>
        )}

        {/* The one collapsed disclosure — a home for two things that both need a quiet place:
            the machine's own read of the run and the run-window lifestyle averages. Either half
            can exist without the other (`aiEvalEnabled` off, or a report with no `context`), so
            the block renders whenever EITHER has something to show — never an empty shell.
            `ready` with a null `aiEval` (should not happen server-side) deliberately falls
            through to the `failed` branch — a defensive guard, not a fourth state. */}
        {(report.aiEvalEnabled || ctxRows.length > 0) && (
          <details className="er-det" data-testid="meso-report-ai">
            <summary>
              <Bub icon="t-chat" size={30} />
              <span>{report.aiEvalEnabled ? 'Mit olvas ki ebből a gép?' : 'Életmód a futam alatt'}</span>
              <i aria-hidden="true">▾</i>
            </summary>
            {/* The lifestyle rows — plain prose-and-number. A metric this run never measured
                shows '–', never 0; an averaged or summed figure says so in its own description. */}
            {ctxRows.length > 0 && (
              <div data-testid="meso-report-context">
                <Note>A futam napjainak összesítése — nem napi mérés, hanem a teljes ablak átlaga/összege.</Note>
                {ctxRows.map((r) => (
                  <div key={r.key} className="er-kv" data-testid="context-row">
                    <span>
                      {r.descriptor}
                      {/* The kcal row's target comparison — present ONLY when the run had both a
                          measured average and a real target (fix wave, mezo-e1ii9). */}
                      {r.note && <small data-testid="context-row-note">{r.note}</small>}
                    </span>
                    <b>{r.value}</b>
                  </div>
                ))}
              </div>
            )}

            {report.aiEvalEnabled && (
              <>
                <Note>A program írta a futam adataiból — vélemény és becslés, nem mérés. A fenti számok a biztosak.</Note>
                {report.aiEvalStatus === 'ready' && report.aiEval ? (
                  <>
                    {report.aiEval.split(/\n\n+/).map((para, i) => <Txt key={i}>{para}</Txt>)}
                    <div className="er-in">
                      {report.aiEvalGeneratedAt && <span>{`Generálva · ${day(report.aiEvalGeneratedAt)}`}</span>}
                      <Lk onClick={fireRegenerate} disabled={regenerating}>
                        {regenerating ? 'Riport készül…' : 'Újragenerálás'}
                      </Lk>
                    </div>
                  </>
                ) : report.aiEvalStatus === 'pending' ? (
                  <div className="er-in"><span><Bub icon="t-flask" size={24} /> Az értékelés készül…</span></div>
                ) : (
                  <div className="er-in">
                    <span>Nem sikerült az értékelés.</span>
                    <Lk onClick={fireRegenerate} disabled={regenerating}>
                      {regenerating ? 'Riport készül…' : 'Újrapróbálás'}
                    </Lk>
                  </div>
                )}
              </>
            )}
          </details>
        )}

        {/* The closed run's other live affordances. The fork is only offered once the run itself
            resolved — it copies its DAY PLAN, which lives on the run, not in the frozen report. */}
        {meso && <ActRow icon="t-template" title="Sablon mentése ebből a futamból" onClick={saveAsTemplate} />}
        <ActRow
          icon="t-repeat"
          title={regenerating ? 'Riport készül…' : 'Riport újragenerálása'}
          disabled={regenerating}
          onClick={fireRegenerate}
        />
      </Card>

      {startTemplate && (
        <MesoStartSheet
          templateId={startTemplate.id}
          title={startTemplate.title}
          onClose={() => setStartTemplate(null)}
        />
      )}
    </Page>
  )
}
