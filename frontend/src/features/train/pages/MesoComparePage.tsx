// ============================================================
// Mezo · MesoComparePage (mezo-meyc.4) — two closed runs side by side.
// Full-screen sibling route /train/mesocycles/compare?a=&b= (no Train sub-nav),
// reached from the Lezárt futamaid page's „Összevetés" selection mode.
//
// There is NO compare endpoint: the page runs TWO `useMesoReport` reads and the pure
// helpers in `logic/mesoCompare.ts` line the pair up client-side (spec §4 — a report is
// already a self-contained close-time snapshot, so a pairwise view needs no server state).
//
// Everything here inherits the report page's honesty rules: a hole is „–", never 0, and
// the two strength numbers stay labelled apart (kg = top-set LOAD, % = e1RM). The only
// signal colour is the sage token on the better side's percentage — deliberately NO red on
// the weaker side: this is a comparison of two finished blocks, not a verdict on one.
//
// Folyadék (mezo-n4wf5.3, prototype vilagos/edzes.js `osszevetes()`): the hero says which run
// got more of its plan done and stands the two shares side by side as two vessels (A in the
// domain liquid, B in blue), with each run's identity under them — or, per column, why that
// column has nothing to show. Then 1 · Fókusz-különbség, 2 · Csúcs-volumen, 3 · Közös
// gyakorlatok (the better side's percentage in green), 4 · Kontextus-átlagok.
// ============================================================
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMesoReport, useTrain } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { huMonthDay } from '@/shared/lib/dates'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { MesocycleReportResponse } from '@/data/train/trainApi'
import type { MesoVolumeArc } from '@/data/types'
import {
  betterSide,
  contextDiff,
  focusDiff,
  peakVolumeRows,
  sharedStrengthDeltas,
  type CompareContextRow,
  type FocusDiff,
} from '@/features/train/logic/mesoCompare'
import {
  Btn, Card, EmptyTank, FrameBack, Hero, Lk, Note, Page, Section, Skel, Tags, Tubes, useFrameTitle, type TagItem,
} from '@/shared/ui/folyadek'

const fmt = (n: number): string => n.toLocaleString('hu-HU')
const signed = (n: number): string => `${n > 0 ? '+' : ''}${fmt(n)}`
/** 'Feb 12' from either an ISO date or an ISO date-time (closedAt). */
const day = (iso: string): string => huMonthDay(iso.slice(0, 10))
/** The table convention: an absent measurement is a dash, never a zero. */
const dash = (n: number | null): string => (n == null ? '–' : fmt(n))
/** „A" / „Az" before a run's title, by its first sound. */
const article = (title: string): string => (/^[aáeéiíoóöőuúüű]/i.test(title.trim()) ? 'Az' : 'A')

/** A context cell: unit-suffixed, signed for the one delta metric (kg), „–" when unmeasured. */
function contextCell(v: number | null, unit: string): string {
  if (v == null) return '–'
  if (unit === 'kg') return `${signed(v)} kg`
  return unit ? `${fmt(v)} ${unit}` : fmt(v)
}

/** Contract → domain arc: identical but for `actual`'s optionality (MesoReportPage's idiom). */
function toVolumeArc(volume: MesocycleReportResponse['volume']): MesoVolumeArc | null {
  if (!volume) return null
  return { ...volume, muscles: volume.muscles.map((m) => ({ ...m, weeks: m.weeks.map((w) => ({ ...w, actual: w.actual ?? null })) })) }
}

/** One run's `{kg, %}` pair inside a strength row — always both cells, so the two sides align. */
function SideDeltas({ side, kg, pct, better }: { side: 'A' | 'B'; kg: number | null; pct: number | null; better: boolean }) {
  return (
    <div>
      <small>{side}</small>
      <span>{kg == null ? '–' : `${signed(kg)} kg`}</span>
      <b className={better ? 'win' : undefined} {...(better ? { 'data-testid': 'compare-better' } : {})}>
        {pct == null ? '–' : `${signed(pct)}%`}
      </b>
    </div>
  )
}

/** One column of the two-column header — or the reason that column has nothing to show. */
function ColumnHead({
  side,
  id,
  report,
  notFound,
  error,
  onOpenReport,
  onRetry,
}: {
  side: 'A' | 'B'
  id: string
  report: MesocycleReportResponse | null
  notFound: boolean
  error: boolean
  onOpenReport: () => void
  onRetry: () => void
}) {
  return (
    <div>
      <small>{side}</small>
      {report ? (
        <>
          <b>{report.title}</b>
          <span>{`${day(report.startDate)}${report.endDate ? ` → ${day(report.endDate)}` : ''}`}</span>
          <span>{`${report.weeks} hét`}</span>
        </>
      ) : error ? (
        <>
          <span>Nem sikerült betölteni.</span>
          <Lk onClick={onRetry}>Újrapróbálás</Lk>
        </>
      ) : notFound ? (
        <>
          {/* A run with no frozen report cannot be compared — the fix is one tap away. */}
          <span>Előbb generálj riportot</span>
          <Lk onClick={onOpenReport} data-run-id={id}>Riport megnyitása</Lk>
        </>
      ) : (
        <span>Riport betöltése…</span>
      )}
    </div>
  )
}

/** One run's focus as tags: a ★ for a muscle in focus, a dashed tag for one only maintained. */
function FocusTags({ focus }: { focus: FocusDiff | null }): ReactNode {
  // No run on this side at all — „—", never „Minden izom Építés" (that would be a claim about
  // a run we do not have).
  if (focus === null) return <span>—</span>
  if (focus.chips.length === 0 && !focus.legacy) return <span>Minden izom Építés</span>
  const items: TagItem[] = focus.chips.map((c) => ({
    label: c.tier === 'emphasize'
      ? <b data-testid="focus-chip">{`${c.label} ★`}</b>
      : <span className="add" data-testid="focus-chip">{c.label}</span>,
  }))
  if (focus.legacy) items.push({ label: <span className="add" data-testid="focus-legacy-chip">régi modell · címke</span> })
  return <Tags items={items} />
}

export function MesoComparePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/mesocycles/futamok')
  const aId = params.get('a')
  const bId = params.get('b')
  // A run compared with itself is a no-op, so it counts as an invalid link, not a state.
  const valid = !!aId && !!bId && aId !== bId
  // Both hooks run unconditionally (never behind a branch) — a null id keeps real mode from
  // firing a pointless request while the link is unusable.
  const A = useMesoReport(valid ? aId : null)
  const B = useMesoReport(valid ? bId : null)
  const { mesocycles } = useTrain()
  useFrameTitle({ title: 'Összevetés', eyebrow: 'Két lezárt futam' })
  const back = <FrameBack className="fo-backpill" onBack={goBack}>‹ Mezociklus</FrameBack>

  if (!valid) {
    // A hand-typed / stale link, or a selection that never got two runs.
    return (
      <Page className="er-page">
        {back}
        <Card>
          <EmptyTank
            icon="t-compare"
            actions={<Btn sm onClick={() => navigate('/train/mesocycles/futamok')}>Lezárt futamaid megnyitása</Btn>}
          >
            Válassz két lezárt futamot az összevetéshez — a Lezárt futamaid oldal „Összevetés” módjában.
          </EmptyTank>
        </Card>
      </Page>
    )
  }

  const a = A.report
  const b = B.report
  const both = a && b ? ({ a, b } as { a: MesocycleReportResponse; b: MesocycleReportResponse }) : null
  const peakRows = both ? peakVolumeRows(toVolumeArc(both.a.volume), toVolumeArc(both.b.volume)) : []
  const strengthRows = both ? sharedStrengthDeltas(both.a, both.b) : []
  const contextRows: CompareContextRow[] = both ? contextDiff(both.a, both.b) : []
  const focusA = focusDiff(mesocycles.find((m) => m.id === aId) ?? null)
  const focusB = focusDiff(mesocycles.find((m) => m.id === bId) ?? null)
  const openA = () => navigate(`/train/mesocycles/${aId}/report`)
  const openB = () => navigate(`/train/mesocycles/${bId}/report`)

  // Nothing has answered yet on either side: the page-shaped loading face.
  const waiting = (r: typeof A) => !r.report && !r.error && !r.notFound
  if (waiting(A) && waiting(B)) return <Page className="er-page">{back}<Skel blocks={[260, 110, 170, 200]} /></Page>

  // Both columns always render: a missing report is a per-column state, not a page-level dead
  // end — the other run's identity stays on screen.
  const columns = (
    <div className="er-ab" data-testid="meso-compare-header">
      <ColumnHead side="A" id={aId as string} report={a} notFound={A.notFound} error={A.error} onOpenReport={openA} onRetry={A.refetch} />
      <ColumnHead side="B" id={bId as string} report={b} notFound={B.notFound} error={B.error} onOpenReport={openB} onRetry={B.refetch} />
    </div>
  )
  // Both reports open one tap away — the compare view is a lens, not a replacement.
  const actions = (
    <>
      <Btn onClick={openA}>A riportja</Btn>
      <Lk onClick={openB}>B riportja</Lk>
    </>
  )

  if (!both) {
    const failed = A.error || B.error
    const missing = A.notFound || B.notFound
    return (
      <Page className="er-page">
        {back}
        <Hero
          label="A · B"
          verdict={failed ? 'Az egyik riportot nem sikerült betölteni.' : missing ? 'Az egyik futamnak még nincs riportja.' : 'A másik riport még töltődik.'}
          sub="A másik futam közben a helyén marad."
          actions={actions}
        >
          {columns}
        </Hero>
      </Page>
    )
  }

  const pa = both.a.adherence
  const pb = both.b.adherence
  const tie = pa.completionPct === pb.completionPct
  const win = pa.completionPct >= pb.completionPct ? both.a : both.b
  const los = win === both.a ? both.b : both.a

  return (
    <Page className="er-page er-cards">
      {back}
      {/* The "did either plan actually happen" glance — the two shares as two vessels. */}
      <Hero
        label="A · B"
        verdict={tie
          ? `A két futamból ugyanannyit csináltál meg: ${fmt(pa.completionPct)}%.`
          : `${article(win.title)} ${win.title} futamból csináltál meg többet: ${fmt(win.adherence.completionPct)}% a ${fmt(los.adherence.completionPct)}% mellett.`}
        sub="A betervezett edzések mekkora részét csináltad meg."
        actions={actions}
      >
        <div className="er-vs" data-testid="meso-compare-adherence">
          <Tubes
            height={132}
            items={([['A', both.a, 'var(--dom)', openA], ['B', both.b, '#1877F2', openB]] as const).map(([side, r, color, open]) => ({
              label: `${side} · ${r.title}`,
              value: `${fmt(r.adherence.completionPct)}%`,
              note: `${r.adherence.completedSessions}/${r.adherence.plannedSessions} edzés · ${r.adherence.completedWeeks}/${r.adherence.plannedWeeks} hét`,
              pct: Math.max(0, Math.min(100, r.adherence.completionPct)) * 0.94,
              color,
              onClick: open,
              ariaLabel: `${side} · ${r.title}: ${fmt(r.adherence.completionPct)}%, ${r.adherence.completedSessions}/${r.adherence.plannedSessions} edzés, ${r.adherence.completedWeeks}/${r.adherence.plannedWeeks} hét — a riport megnyitása`,
            }))}
          />
        </div>
        {columns}
      </Hero>

      {/* Fókusz-különbség — each run's non-default tiers, side by side (Építés is the silent
          default, so it never earns a tag); a legacy run's own dashed label makes clear its
          tiers are display-only, not band-model-generated. */}
      <Section n={1} title="Fókusz-különbség" />
      <Card data-testid="meso-compare-focus">
        {([['A', focusA], ['B', focusB]] as const).map(([side, f]) => (
          <div key={side} className="er-kv" data-testid="focus-row">
            <span>{side}</span>
            <FocusTags focus={f} />
          </div>
        ))}
        <Note>★ = hangsúlyos izom · szaggatott = csak szinten tartott. Ha nincs jelölés: minden izom Építés.</Note>
      </Card>

      {/* Csúcs-volumen — the loudest week each run actually reached per muscle, next to A's own
          ceiling; B's ceiling is not shown (the table judges A's peak against A's own ceiling,
          not a cross-run ceiling comparison). */}
      {peakRows.length > 0 && (
        <>
          <Section n={2} title="Csúcs-volumen · szett/hét" />
          <Card data-testid="meso-compare-peak-volume">
            <table className="er-cmp c4">
              <thead>
                <tr><th scope="col">Izom</th><th scope="col">A csúcs</th><th scope="col">A felső érték</th><th scope="col">B csúcs</th></tr>
              </thead>
              <tbody>
                {peakRows.map((r) => (
                  <tr key={r.group} data-testid="peak-volume-row">
                    <td>{r.label}</td>
                    <td>{dash(r.aPeak)}</td>
                    <td>{dash(r.aCeiling)}</td>
                    <td>{dash(r.bPeak)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* Erő — the heart of the comparison: only the exercises BOTH runs trained */}
      <Section n={peakRows.length > 0 ? 3 : 2} title={`Közös gyakorlatok · ${strengthRows.length}`} />
      <Card data-testid="meso-compare-strength">
        {strengthRows.length === 0 ? (
          <Note className="er-none">A két futamban nincs közös gyakorlat — nincs mit egymás mellé tenni.</Note>
        ) : (
          <>
            {strengthRows.map((r) => {
              const better = betterSide(r)
              return (
                <div key={r.exerciseName} className="fo-log" data-testid="compare-strength-row">
                  <span className="er-log-h">
                    <b data-testid="compare-exercise">{r.exerciseName}</b>
                    <small>{MUSCLE_LABELS[r.muscle] ?? r.muscle}</small>
                  </span>
                  <div className="er-ab sd">
                    <SideDeltas side="A" kg={r.aDeltaKg} pct={r.aDeltaPct} better={better === 'a'} />
                    <SideDeltas side="B" kg={r.bDeltaKg} pct={r.bDeltaPct} better={better === 'b'} />
                  </div>
                </div>
              )
            })}
            <Note>
              kg = a csúcsszett terhelésének változása · % = a becsült 1RM változása (ugyanaz a súly több
              ismétléssel 0 kg, de valós %). A jobbik oldal zölddel áll.
            </Note>
          </>
        )}
      </Card>

      {/* Kontextus — the run-level lifestyle averages, not the weekly buckets */}
      {contextRows.length > 0 && (
        <>
          <Section n={peakRows.length > 0 ? 4 : 3} title="Kontextus-átlagok" />
          <Card data-testid="meso-compare-context">
            <table className="er-cmp">
              <thead>
                <tr><th scope="col">Mutató</th><th scope="col">A</th><th scope="col">B</th></tr>
              </thead>
              <tbody>
                {contextRows.map((r) => (
                  <tr key={r.label} data-testid="compare-context-row">
                    <td>{r.label}</td>
                    <td>{contextCell(r.aValue, r.unit)}</td>
                    <td>{contextCell(r.bValue, r.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Note>
              Súlyváltozás (mért napok) — a mért, egymást követő napok változásainak összege. Ahol nincs adat, „–” áll, sosem 0.
            </Note>
          </Card>
        </>
      )}
    </Page>
  )
}
