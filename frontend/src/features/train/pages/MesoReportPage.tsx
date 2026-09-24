// ============================================================
// Mezo · MesoReportPage (mezo-meyc.2) — the FROZEN end-of-mesocycle report of a
// closed run. Full-screen sibling route /train/mesocycles/:id/report (no Train
// sub-nav), reached from a Történet card tap, from MesoCloseSheet right after a
// close, and by an archived run's builder visit (which redirects here — a closed
// run has no builder). Shell mirrors MesoOverviewPage: sticky back breadcrumb,
// compact header, then the report's blocks.
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
// Train Titanium T10 Task 4 (mezo-88iwa.11) gave the page its two Titanium halves,
// ported from the prototype's `planLibraryClosed`
// (docs/design_2.0/prototypes/companion-titanium/plan-pages.js:519-566):
//   · the STAR HERO (`.pl-lhero.is-closed`) — the run's five clay stars over
//     `runStars(report.adherence.completionPct)` (the ceremony's own `starsFor`
//     scale, never a second rating rule), its one plain sentence, and the share
//     DRAWN as a numeral + bar (the `.ld-hero-pct`/`.ld-hero-bar` idiom the weekly
//     load hero already uses), labelled „A teljesített edzések aránya". It replaces
//     the DS `PageHero` only for a run that HAS a report; the loading/404/error
//     branches keep the plain hero, since there is no rating to draw yet.
//   · „A mostani tervedhez képest" (`.pl-versus`) — the closed run's PEAK weekly
//     sets against the ACTIVE plan's CURRENT-week target, one pair per muscle the
//     two share. The „most" number comes from the active run's volume arc — the
//     same source `MesoMusclePage` reads its versus rows from — so the two pages
//     can never disagree. The block exists ONLY when there is an active run AND at
//     least one shared muscle: no active plan, or no overlap, means no block at all
//     (never an empty shell, never a 0 standing in for "we don't know").
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
import { useState, type CSSProperties } from 'react'
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
import { muscleColor } from '@/features/train/logic/muscleColors'
import { MuscleChip } from '@/features/train/components/MuscleChip'
import { InfoButton } from '@/features/train/components/InfoButton'
import { ClayIcon } from '@/shared/ui/clay'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { runToTemplate } from '@/features/train/logic/runToTemplate'
import { StatStrip } from '@/shared/ui/StatStrip'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { CtaGhost } from '@/shared/ui/Cta'
import { Spinner } from '@/shared/ui/Spinner'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

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
 * Five clay stars, halves included — the prototype's `starRow` (plan-pages.js:330). It draws
 * three different glyphs; the clay set has one, so a half/empty star is the SAME glyph dimmed
 * and desaturated, exactly the way the workout ceremony draws its own row (`.cer-stars`).
 */
function StarRow({ stars }: { stars: number }) {
  return (
    <span className="pl-stars" role="img" aria-label={`${huStars(stars)} csillag az ötből`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={stars >= i + 1 ? 'is-lit' : stars >= i + 0.5 ? 'is-half' : undefined}>
          <ClayIcon name="i-termes" size={18} className="icon" />
        </i>
      ))}
    </span>
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
  const heroSub = report
    ? `${report.closedAt ? `Lezárva · ${day(report.closedAt)}` : 'Futam · riport'} · ${report.weeks} hét`
    : undefined
  // The run's rating — the ceremony's own star scale over the frozen completion share.
  const rating = report ? runStars(report.adherence.completionPct) : null
  const pairs = versusPairs(arcs, activeArc)
  const versusScale = Math.max(1, ...pairs.map((p) => Math.max(p.then, p.now)))
  // The run-window lifestyle rows (fix round, mezo-e1ii9) — absent only when the report
  // itself carries no context at all (async aggregation never ran, or the run predates it).
  const ctxRows = report?.context ? contextRows(report.context.totals, report.context.weeks ?? []) : []

  return (
    <MozaikPage tone="gold">
      <EntranceGroup>
        {report && rating ? (
          // The Titanium star hero. Only for a run that HAS a report: the rating, the
          // sentence and the drawn share all come from the frozen completion share, and
          // without one there is nothing honest to draw. The back pill is DOCKED INSIDE
          // it — the sibling pages' own rule (MesoKonyvtarPage/MesoTemplateStoryPage) —
          // not a separate PageHead floating above (fix round, mezo-88iwa.11).
          <header
            className="pl-dhero pl-lhero is-closed rise"
            style={{ '--mus-color': 'var(--tag-gym)', '--ld-accent': 'var(--tag-gym)', '--d': '40ms' } as CSSProperties}
          >
            <span className="pl-dhero-wash" aria-hidden="true" />
            <button type="button" className="mz-backbtn" aria-label="Vissza" onClick={goBack}>
              Vissza
            </button>
            <span className="pl-dhero-tag tr-eyebrow">
              {`Lezárt futam · ${day(report.startDate)}${report.endDate ? ` – ${day(report.endDate)}` : ''}`}
            </span>
            <h2>{title}</h2>
            <div className="pl-lhero-stars"><StarRow stars={rating.stars} /></div>
            <p className="pl-say">{rating.say}</p>
            {/* The share is DRAWN, not merely spelled out — the weekly load hero's own
                numeral + bar idiom (`.ld-hero-pct` / `.ld-hero-bar`). */}
            <div className="ld-hero-pct"><b>{report.adherence.completionPct}</b><em>%</em></div>
            <p className="ld-hero-sub">A teljesített edzések aránya</p>
            <div className="ld-hero-bar">
              <i style={{ '--w': `${Math.max(0, Math.min(100, report.adherence.completionPct))}%` } as CSSProperties} />
            </div>
            <div className="pl-poster-foot">
              <span>{`${report.weeks} hét`}</span>
              {report.closedAt && <span>{`Lezárva · ${day(report.closedAt)}`}</span>}
            </div>
          </header>
        ) : (
          <>
            <PageHead glass onBack={goBack} label="Vissza" />
            <PageHero icon="i-meso" name={`${title} · riport`} sub={heroSub} />
          </>
        )}
        <PageBody className="tv-report">
      {report?.templateId && (
        <div style={{ padding: '0 0 8px' }}>
          <button
            type="button"
            className="chip tapchip"
            onClick={() => navigate(`/train/mesocycles/templates/${report.templateId}`)}
          >
            <Icon name="chevron-right" size={10} /> Sablon megnyitása
          </button>
        </div>
      )}

      {/* Loading / no-report-yet states. An EXISTING report renders as soon as it lands — it
          is self-contained, so it never waits on the meso list. Only the no-report branch
          needs the run itself (to tell "closed but ungenerated" from "still running"), so
          that is the only branch gated on `workoutPending`. */}
      {pending ? (
        <div style={{ padding: '16px 0' }}>
          <GhostState lines={3} message="Riport betöltése…" />
        </div>
      ) : error ? (
        // A genuine read failure (the contract's 404 is `notFound` below, not this) —
        // a terminal state with a retry, never a blank page (§7a).
        <div style={{ padding: '16px 0' }}>
          <GhostState
            lines={2}
            message="Nem sikerült betölteni a riportot."
            ctaLabel="Újrapróbálás"
            onCta={refetch}
          />
        </div>
      ) : notFound ? (
        <div style={{ padding: '16px 0' }}>
          {workoutPending ? (
            <GhostState lines={3} message="Riport betöltése…" />
          ) : !meso ? (
            <GhostState lines={2} message="Ez a futam nem található." />
          ) : meso.status !== 'archived' ? (
            <GhostState
              lines={2}
              message="Ez a futam még fut — a riport a lezárás pillanatában készül el."
            />
          ) : (
            <GhostState
              lines={3}
              message={
                regenerating
                  ? 'Riport készül…'
                  : 'Ehhez a lezárt futamhoz még nincs riport — generáld le a rögzített adatokból.'
              }
              ctaLabel={regenerating ? undefined : 'Riport generálása'}
              onCta={regenerating ? undefined : fireRegenerate}
            />
          )}
        </div>
      ) : report ? (
        <>
          {/* Adherence — the "did the plan actually happen" glance. The completion SHARE is
              not repeated here: the hero above draws it (numeral + bar), and printing the
              same 88% twice on one screen reads as two different measurements. */}
          <div style={{ padding: '16px 0 8px' }}>
            <StatStrip
              cells={[
                {
                  label: 'Edzés',
                  value: `${report.adherence.completedSessions}/${report.adherence.plannedSessions}`,
                },
                {
                  label: 'Hét',
                  value: `${report.adherence.completedWeeks}/${report.adherence.plannedWeeks}`,
                },
              ]}
            />
          </div>

          {/* „Ezt akartad" — the wizard's freeform goal text, read back once the block is
              done, next to the one honest line the close captured (report.summary). Notes
              are the wizard step-0 goal text; a run without one (nothing typed, or a legacy
              run predating the field) simply has no quote to show. */}
          {meso?.notes && (
            <div className="card col gap-xs" style={{ padding: 'var(--sp-4)' }} data-testid="meso-report-quote">
              <Eyebrow>Ezt akartad</Eyebrow>
              <p style={{ fontSize: 14, lineHeight: 1.5, fontStyle: 'italic', color: 'var(--text-primary)' }}>
                {`„${meso.notes}"`}
              </p>
              {meso.summary && (
                <span className="text-secondary" style={{ fontSize: 12 }}>{`— és ez lett: ${meso.summary}`}</span>
              )}
            </div>
          )}

          {/* The muscle journeys — the prototype's „Izmaid ebben a futamban" in production
              words: where each muscle started, the loudest week it reached, and its ceiling.
              The week-by-week chart that used to sit above this said the same thing in
              MEV/MAV/MRV/Deload legend jargon, so it went (T-P1 Task 5, mezo-e1ii9). */}
          {arcs.length > 0 && (
            <>
              {/* The ⓘ's anchor here is the Eyebrow, not a heading — production
                  renamed this section (mezo-e1ii9). Its TITLE is „Hogyan olvasd?" and not
                  the prototype's „Mit mutat a sáv?" only until the surfaces slice
                  (mezo-fsz2r) brings the bars back; the COPY is verbatim (mezo-b516k). */}
              <div className="row" style={{ padding: '12px 0 0', alignItems: 'center', gap: 7 }}>
                <Eyebrow>Izmonként · indulás → elért csúcs / plafon</Eyebrow>
                <InfoButton
                  title="Hogyan olvasd?"
                  copy="Honnan indult és meddig jutott az izom heti szettszáma a futam alatt. A csúcs a pihenőhét előtti utolsó hét."
                />
              </div>
              <div className="card col" style={{ padding: '8px 12px' }} data-testid="meso-report-bands">
                {peakBands(arcs).map((r) => (
                  <div
                    key={r.muscle}
                    className="col"
                    style={{ padding: '7px 0', borderTop: '0.5px solid var(--border-subtle)' }}
                    data-testid="report-band-row"
                  >
                    <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                      <span className="chip">{r.label}</span>
                      <span style={{ flex: 1 }} />
                      <span className="label-mono" style={{ fontSize: 12, fontWeight: 700 }}>
                        {`${dash(r.start)} → ${fmt(r.peak)} / ${fmt(r.ceiling)}`}
                      </span>
                    </div>
                    <div style={{ height: 9, borderRadius: 5, background: 'var(--surface-1)', overflow: 'hidden', marginTop: 5 }}>
                      <div
                        style={{
                          width: `${r.ceiling > 0 ? Math.min(100, (r.peak / r.ceiling) * 100) : 0}%`,
                          height: '100%',
                          background: 'var(--sage-deep)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Strength — LOAD move and e1RM percentage labelled apart */}
          {report.strength.length > 0 && (
            <div className="col gap-sm" style={{ padding: '12px 0' }} data-testid="meso-report-strength">
              <Eyebrow>Erő · {report.strength.length} gyakorlat</Eyebrow>
              {report.strength.map((s) => (
                <div
                  key={`${s.catalogId ?? s.exerciseName}-${s.firstWeek}`}
                  className="card col gap-xs"
                  style={{ padding: 'var(--sp-4)' }}
                  data-testid="strength-row"
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{s.exerciseName}</span>
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                      {`W${s.firstWeek} → W${s.lastWeek}`}
                    </span>
                  </div>
                  <span className="text-secondary" style={{ fontSize: 13 }}>{movementLabel(s)}</span>
                  <div className="row gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* The LOAD delta — absent when nothing was loaded, hidden when flat. */}
                    {s.deltaKg != null && s.deltaKg !== 0 && (
                      <span className="chip" style={{ color: s.deltaKg > 0 ? 'var(--sage-deep)' : 'var(--error)' }}>
                        {`${signed(s.deltaKg)} kg`}
                      </span>
                    )}
                    {/* The e1RM delta — this is the one that credits extra reps at the same load.
                        Hidden at exactly 0 for the same reason the kg pill is: a flat lift has no
                        verdict to badge, and `0% e1RM` in a signal colour would invent one. */}
                    {s.deltaPct != null && s.deltaPct !== 0 && (
                      <span className="chip" style={{ color: s.deltaPct > 0 ? 'var(--sage-deep)' : 'var(--error)' }}>
                        {`${signed(s.deltaPct)}% e1RM`}
                      </span>
                    )}
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                      {MUSCLE_LABELS[s.muscle] ?? s.muscle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Records earned inside the run's window */}
          <div className="col gap-sm" style={{ padding: '12px 0' }} data-testid="meso-report-records">
            <Eyebrow>Rekordok · {report.records.medalCount} medál</Eyebrow>
            {report.records.top.length === 0 ? (
              <span className="text-secondary" style={{ fontSize: 13 }}>
                Ebben a futamban nem született rekord.
              </span>
            ) : (
              <div className="col gap-sm">
                {report.records.top.map((r) => (
                  <div key={`${r.exerciseName}-${r.kind}-${r.date}`} className="card row" style={{ padding: 'var(--sp-4)', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="col">
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{r.exerciseName}</span>
                      <span className="text-secondary" style={{ fontSize: 13 }}>
                        {MEDAL_TYPE_LABEL[r.kind as MedalType] ?? r.kind}
                      </span>
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end' }}>
                      {r.value != null && (
                        <span className="label-mono" style={{ fontSize: 11 }}>{fmt(r.value)}</span>
                      )}
                      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                        {day(r.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* The owner's own verdict, captured by MesoCloseSheet — read-only here */}
          {report.selfEval && (
            <div className="col gap-sm" style={{ padding: '12px 0' }}>
              <Eyebrow>Saját értékelés</Eyebrow>
              <div className="card" style={{ padding: 'var(--sp-4)' }}>
                <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>{report.selfEval}</p>
              </div>
            </div>
          )}

          {/* „A mostani tervedhez képest" (T10 Task 4) — the closed run's peak weekly sets
              against what the RUNNING plan gives the same muscle this week. No active plan,
              or no muscle in common, and the block is absent entirely. */}
          {pairs.length > 0 && (
            <div className="col gap-sm" style={{ padding: '12px 0' }} data-testid="meso-report-versus">
              <h3 className="pl-h3" style={{ margin: '0 0 2px' }}>A mostani tervedhez képest</h3>
              <p className="pl-foot-say" style={{ margin: 0 }}>
                Ugyanazok az izmok — mennyit bírtak akkor a csúcson, és mennyit kapnak most.
              </p>
              <div className="pl-versus pl-lib-versus">
                {pairs.map((p) => (
                  <div
                    key={p.muscle}
                    className="pl-versus-pair"
                    style={{ '--mus-color': muscleColor(p.muscle).rail } as CSSProperties}
                    data-testid="versus-pair"
                  >
                    <span className="pl-versus-name">
                      <MuscleChip token={p.muscle} size={20} />
                      {p.label}
                    </span>
                    <div className="pl-versus-row">
                      <span>akkor</span>
                      <span className="pl-versus-bar">
                        <i style={{ '--w': `${(p.then / versusScale) * 100}%` } as CSSProperties} />
                      </span>
                      <b>{fmt(p.then)}</b>
                    </div>
                    <div className="pl-versus-row is-now">
                      <span>most</span>
                      <span className="pl-versus-bar">
                        <i style={{ '--w': `${(p.now / versusScale) * 100}%` } as CSSProperties} />
                      </span>
                      <b>{fmt(p.now)}</b>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* The foot's one collapsed disclosure — a home for two things that both need a
              quiet place, not the story's main flow: the machine's own read of the run (a
              REAL backend feature the prototype's closed-run story has no counterpart for,
              T-P1 Task 5, mezo-e1ii9), and — since the fix round — the run-window lifestyle
              averages. Those averages have exactly one OTHER surface, `MesoComparePage`'s
              `contextDiff`, and that page is reachable only once a second closed run exists
              (`MesoFutamokPage` gates it behind `archived.length >= 2`); a first closed run,
              or any run reviewed alone, had no path to them at all until this fold-in. Either
              half can exist without the other (`aiEvalEnabled` off, or a report with no
              `context`), so the details block itself renders whenever EITHER has something to
              show — never an empty shell for a run with neither. `ready` with a null `aiEval`
              (should not happen server-side) deliberately falls through to the `failed`
              branch below — a defensive guard, not a fourth state. */}
          {(report.aiEvalEnabled || ctxRows.length > 0) && (
            <details
              className="card"
              data-testid="meso-report-ai"
              style={{ padding: '12px var(--sp-4)', margin: '4px 0 0' }}
            >
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {report.aiEvalEnabled ? 'Mit olvas ki ebből a gép?' : 'Életmód a futam alatt'}
              </summary>
              <div className="col gap-md" style={{ paddingTop: 10 }}>
                {/* The lifestyle rows — plain prose-and-number, no emoji pills (those were
                    the T-P1 Task 5 removal), no per-week table (the MEV/MAV/MRV spreadsheet
                    stays retired). A metric this run never measured shows '–', never 0; an
                    averaged or summed figure says so in its own description rather than
                    posing as a single measurement. */}
                {ctxRows.length > 0 && (
                  <div className="col gap-xs" data-testid="meso-report-context">
                    <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                      A futam napjainak összesítése — nem napi mérés, hanem a teljes ablak átlaga/összege.
                    </span>
                    {ctxRows.map((r) => (
                      <div
                        key={r.key}
                        className="row"
                        style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}
                        data-testid="context-row"
                      >
                        <span className="col" style={{ gap: 1, minWidth: 0 }}>
                          <span className="text-secondary" style={{ fontSize: 12.5, lineHeight: 1.4 }}>{r.descriptor}</span>
                          {/* The kcal row's target comparison — present ONLY when the run had
                              both a measured average and a real target (fix wave, mezo-e1ii9). */}
                          {r.note && (
                            <span style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-tertiary)' }} data-testid="context-row-note">
                              {r.note}
                            </span>
                          )}
                        </span>
                        <span className="label-mono" style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {report.aiEvalEnabled && (
                  <div className="col gap-sm">
                    <p className="text-secondary" style={{ fontSize: 11.5, lineHeight: 1.5, margin: 0, color: 'var(--text-tertiary)' }}>
                      A program írta a futam adataiból — vélemény és becslés, nem mérés. A fenti számok a biztosak.
                    </p>
                    {report.aiEvalStatus === 'ready' && report.aiEval ? (
                      <>
                        {report.aiEval.split(/\n\n+/).map((para, i) => (
                          <p key={i} className="text-secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>{para}</p>
                        ))}
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          {report.aiEvalGeneratedAt ? (
                            <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                              {`Generálva · ${day(report.aiEvalGeneratedAt)}`}
                            </span>
                          ) : (
                            <span />
                          )}
                          <CtaGhost onClick={fireRegenerate} disabled={regenerating} style={{ padding: '8px 14px' }}>
                            {regenerating ? 'Riport készül…' : 'Újragenerálás'}
                          </CtaGhost>
                        </div>
                      </>
                    ) : report.aiEvalStatus === 'pending' ? (
                      <div className="row gap-sm" style={{ alignItems: 'center' }}>
                        <Spinner size="sm" />
                        <span className="text-secondary" style={{ fontSize: 13 }}>Az értékelés készül…</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-secondary" style={{ fontSize: 13 }}>Nem sikerült az értékelés.</span>
                        <CtaGhost
                          onClick={fireRegenerate}
                          disabled={regenerating}
                          style={{ alignSelf: 'flex-start', padding: '8px 14px' }}
                        >
                          {regenerating ? 'Riport készül…' : 'Újrapróbálás'}
                        </CtaGhost>
                      </>
                    )}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Actions — a closed run's only live affordances */}
          <div className="col gap-sm" style={{ padding: '16px 0 32px' }}>
            <CtaGhost style={{ padding: 12 }} onClick={rerunMeso}>
              <Icon name="sparkle" size={14} /> Újrafuttatás
            </CtaGhost>
            {/* Only offered once the run itself resolved — the fork copies its DAY PLAN,
                which lives on the run, not in the frozen report. */}
            {meso && (
              <CtaGhost style={{ padding: 12 }} onClick={saveAsTemplate}>
                <Icon name="bookmark" size={14} /> Sablon mentése ebből a futamból
              </CtaGhost>
            )}
            <button
              type="button"
              className="chip tapchip"
              onClick={fireRegenerate}
              disabled={regenerating}
              style={{ alignSelf: 'center' }}
            >
              {regenerating ? 'Riport készül…' : 'Riport újragenerálása'}
            </button>
          </div>
        </>
      ) : null}
        </PageBody>
      </EntranceGroup>

      {startTemplate && (
        <MesoStartSheet
          templateId={startTemplate.id}
          title={startTemplate.title}
          onClose={() => setStartTemplate(null)}
        />
      )}
    </MozaikPage>
  )
}
