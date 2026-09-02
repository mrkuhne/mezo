// ============================================================
// Mezo · MesoComparePage (mezo-meyc.4) — two closed runs side by side.
// Full-screen sibling route /train/mesocycles/compare?a=&b= (no Train sub-nav),
// reached from the library's Történet „Összevetés" selection mode. Shell mirrors
// MesoReportPage: sticky back breadcrumb → compact header → blocks.
//
// There is NO compare endpoint: the page runs TWO `useMesoReport` reads and the pure
// helpers in `logic/mesoCompare.ts` line the pair up client-side (spec §4 — a report is
// already a self-contained close-time snapshot, so a pairwise view needs no server state).
//
// Everything here inherits the report page's honesty rules: a hole is „–", never 0, and
// the two strength numbers stay labelled apart (kg = top-set LOAD, % = e1RM). The only
// signal colour is the sage token on the better side's percentage — deliberately NO red on
// the weaker side: this is a comparison of two finished blocks, not a verdict on one.
// ============================================================
import type { CSSProperties } from 'react'
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
} from '@/features/train/logic/mesoCompare'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { MozaikPage, PageHead, PageHero, PageBody } from '@/shared/ui/mozaik'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'

const fmt = (n: number): string => n.toLocaleString('hu-HU')
const signed = (n: number): string => `${n > 0 ? '+' : ''}${fmt(n)}`
/** 'Feb 12' from either an ISO date or an ISO date-time (closedAt). */
const day = (iso: string): string => huMonthDay(iso.slice(0, 10))
/** The table convention: an absent measurement is a dash, never a zero. */
const dash = (n: number | null): string => (n == null ? '–' : fmt(n))

const TWO_COL: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }
const CELL: CSSProperties = {
  padding: '6px 8px',
  textAlign: 'right',
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
}
const HEAD: CSSProperties = { ...CELL, color: 'var(--text-tertiary)', fontWeight: 600 }
const LABEL_MONO: CSSProperties = { fontSize: 9, color: 'var(--text-tertiary)' }

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

const TIER_CHIP_STYLE: Record<'emphasize' | 'maintain', CSSProperties> = {
  emphasize: { color: 'var(--coral)', background: 'color-mix(in srgb, var(--coral) 10%, transparent)' },
  maintain: { border: '1px dashed var(--text-tertiary)', color: 'var(--text-tertiary)', background: 'transparent' },
}
const LEGACY_CHIP_STYLE: CSSProperties = { border: '1px dashed var(--border-subtle)', color: 'var(--text-tertiary)', background: 'transparent' }

/** One run's `{kg, %}` pair inside a strength row — always both cells, so the two sides align. */
function SideDeltas({ kg, pct, better }: { kg: number | null; pct: number | null; better: boolean }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="label-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
        {kg == null ? '–' : `${signed(kg)} kg`}
      </span>
      <span
        {...(better ? { 'data-testid': 'compare-better' } : {})}
        style={{
          fontSize: 14,
          fontWeight: better ? 700 : 600,
          color: better ? 'var(--sage-deep)' : 'var(--text-secondary)',
        }}
      >
        {pct == null ? '–' : `${signed(pct)}%`}
      </span>
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
    <div className="card col gap-xs" style={{ padding: 'var(--sp-4)' }}>
      <span className="label-mono" style={LABEL_MONO}>{side}</span>
      {report ? (
        <>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 15, fontWeight: 600 }}>{report.title}</span>
          <span className="label-mono" style={LABEL_MONO}>
            {`${day(report.startDate)}${report.endDate ? ` → ${day(report.endDate)}` : ''}`}
          </span>
          <span className="label-mono" style={LABEL_MONO}>{`${report.weeks} hét`}</span>
        </>
      ) : error ? (
        <>
          <span className="text-secondary" style={{ fontSize: 13 }}>Nem sikerült betölteni.</span>
          <button type="button" className="chip tapchip" onClick={onRetry}>Újrapróbálás</button>
        </>
      ) : notFound ? (
        <>
          {/* A run with no frozen report cannot be compared — the fix is one tap away. */}
          <span className="text-secondary" style={{ fontSize: 13 }}>Előbb generálj riportot</span>
          <button type="button" className="chip tapchip" onClick={onOpenReport} data-run-id={id}>
            <Icon name="chevron-right" size={10} /> Riport megnyitása
          </button>
        </>
      ) : (
        <span className="text-secondary" style={{ fontSize: 13 }}>Riport betöltése…</span>
      )}
    </div>
  )
}

export function MesoComparePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/mesocycles')
  const aId = params.get('a')
  const bId = params.get('b')
  // A run compared with itself is a no-op, so it counts as an invalid link, not a state.
  const valid = !!aId && !!bId && aId !== bId
  // Both hooks run unconditionally (never behind a branch) — a null id keeps real mode from
  // firing a pointless request while the link is unusable.
  const A = useMesoReport(valid ? aId : null)
  const B = useMesoReport(valid ? bId : null)
  const { mesocycles } = useTrain()

  const a = A.report
  const b = B.report
  const both = a && b ? ({ a, b } as { a: MesocycleReportResponse; b: MesocycleReportResponse }) : null
  const peakRows = both ? peakVolumeRows(toVolumeArc(both.a.volume), toVolumeArc(both.b.volume)) : []
  const strengthRows = both ? sharedStrengthDeltas(both.a, both.b) : []
  const contextRows: CompareContextRow[] = both ? contextDiff(both.a, both.b) : []
  const focusA = focusDiff(mesocycles.find((m) => m.id === aId) ?? null)
  const focusB = focusDiff(mesocycles.find((m) => m.id === bId) ?? null)

  return (
    <MozaikPage tone="gold">
      <PageHead onBack={goBack} label="‹ Mezociklus" />
      <EntranceGroup>
        <PageHero icon="i-naplo" big={valid ? 'A · B' : undefined} name="Összevetés" sub="Két lezárt futam" />
        <PageBody>

      {!valid ? (
        // A hand-typed / stale link, or a selection that never got two runs.
        <div style={{ padding: '16px 0' }}>
          <GhostState
            lines={2}
            message={'Válassz két lezárt futamot az összevetéshez — a Történet szekció „Összevetés" módjában.'}
            ctaLabel="Történet megnyitása"
            onCta={() => navigate('/train/mesocycles')}
          />
        </div>
      ) : (
        <>
          {/* Both columns always render: a missing report is a per-column state, not a
              page-level dead end — the other run's identity stays on screen. */}
          <div data-testid="meso-compare-header" style={{ ...TWO_COL, padding: '0 0 8px' }}>
            <ColumnHead
              side="A"
              id={aId as string}
              report={a}
              notFound={A.notFound}
              error={A.error}
              onOpenReport={() => navigate(`/train/mesocycles/${aId}/report`)}
              onRetry={A.refetch}
            />
            <ColumnHead
              side="B"
              id={bId as string}
              report={b}
              notFound={B.notFound}
              error={B.error}
              onOpenReport={() => navigate(`/train/mesocycles/${bId}/report`)}
              onRetry={B.refetch}
            />
          </div>

          {both && (
            <>
              {/* Adherencia — the "did either plan actually happen" glance */}
              <div style={{ padding: '12px 0 0' }}>
                <Eyebrow>Adherencia</Eyebrow>
              </div>
              <div data-testid="meso-compare-adherence" style={{ ...TWO_COL, padding: '8px 0 0' }}>
                {([['A', both.a], ['B', both.b]] as const).map(([side, r]) => (
                  <div key={side} className="card col gap-xs" style={{ padding: 'var(--sp-4)' }}>
                    <span className="label-mono" style={LABEL_MONO}>{side}</span>
                    <span style={{ fontSize: 22, fontWeight: 700 }}>{`${fmt(r.adherence.completionPct)}%`}</span>
                    <span className="text-secondary" style={{ fontSize: 12 }}>
                      {`${r.adherence.completedSessions}/${r.adherence.plannedSessions} edzés`}
                    </span>
                    <span className="label-mono" style={LABEL_MONO}>
                      {`${r.adherence.completedWeeks}/${r.adherence.plannedWeeks} hét`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Fókusz-különbség — each run's non-Grow tiers, side by side (Grow is the
                  silent default, so it never earns a chip); a legacy run's own dashed label
                  makes clear its tiers are display-only, not band-model-generated. */}
              <div className="col gap-sm" style={{ padding: '16px 0 0' }} data-testid="meso-compare-focus">
                <Eyebrow>Fókusz-különbség</Eyebrow>
                <div className="card col" style={{ padding: '8px 10px' }}>
                  {([['A', focusA], ['B', focusB]] as const).map(([side, f], i) => (
                    <div
                      key={side}
                      className="row gap-xs"
                      style={{ alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', borderTop: i > 0 ? '0.5px solid var(--border-subtle)' : 'none' }}
                      data-testid="focus-row"
                    >
                      <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', width: 14 }}>{side}</span>
                      {f.chips.length === 0 && !f.legacy && (
                        <span className="text-secondary" style={{ fontSize: 12 }}>Minden izom Grow</span>
                      )}
                      {f.chips.map((c) => (
                        <span key={c.group} className="chip" style={TIER_CHIP_STYLE[c.tier as 'emphasize' | 'maintain']} data-testid="focus-chip">
                          {c.tier === 'emphasize' ? `${c.label} ★` : c.label}
                        </span>
                      ))}
                      {f.legacy && (
                        <span className="chip" style={LEGACY_CHIP_STYLE} data-testid="focus-legacy-chip">régi modell · címke</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Csúcs-volumen — the loudest week each run actually reached per muscle, next
                  to A's own MRV ceiling; B's ceiling is not shown (the table judges A's peak
                  against A's own plafon, not a cross-run ceiling comparison). */}
              {peakRows.length > 0 && (
                <div className="col gap-sm" style={{ padding: '16px 0 0' }} data-testid="meso-compare-peak-volume">
                  <Eyebrow>Csúcs-volumen · szet/hét</Eyebrow>
                  <div className="card" style={{ padding: '10px 4px 6px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ minWidth: 320, width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr>
                            {['Izom', 'A csúcs', 'A plafon', 'B csúcs'].map((h) => (
                              <th key={h} style={{ ...HEAD, textAlign: h === 'Izom' ? 'left' : 'right' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {peakRows.map((r) => (
                            <tr key={r.group} data-testid="peak-volume-row">
                              <td style={{ ...CELL, textAlign: 'left' }}>{r.label}</td>
                              <td style={CELL}>{dash(r.aPeak)}</td>
                              <td style={CELL}>{dash(r.aCeiling)}</td>
                              <td style={CELL}>{dash(r.bPeak)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Erő — the heart of the comparison: only the exercises BOTH runs trained */}
              <div className="col gap-sm" style={{ padding: '16px 0 0' }} data-testid="meso-compare-strength">
                <Eyebrow>Közös gyakorlatok · {strengthRows.length}</Eyebrow>
                {strengthRows.length === 0 ? (
                  <span className="text-secondary" style={{ fontSize: 13 }}>
                    A két futamban nincs közös gyakorlat — nincs mit egymás mellé tenni.
                  </span>
                ) : (
                  strengthRows.map((r) => {
                    const better = betterSide(r)
                    return (
                      <div
                        key={r.exerciseName}
                        className="card col gap-xs"
                        style={{ padding: 'var(--sp-4)' }}
                        data-testid="compare-strength-row"
                      >
                        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span data-testid="compare-exercise" style={{ fontSize: 15, fontWeight: 600 }}>
                            {r.exerciseName}
                          </span>
                          <span className="label-mono" style={LABEL_MONO}>
                            {MUSCLE_LABELS[r.muscle] ?? r.muscle}
                          </span>
                        </div>
                        <div style={TWO_COL}>
                          <div className="col" style={{ gap: 2 }}>
                            <span className="label-mono" style={LABEL_MONO}>A</span>
                            <SideDeltas kg={r.aDeltaKg} pct={r.aDeltaPct} better={better === 'a'} />
                          </div>
                          <div className="col" style={{ gap: 2 }}>
                            <span className="label-mono" style={LABEL_MONO}>B</span>
                            <SideDeltas kg={r.bDeltaKg} pct={r.bDeltaPct} better={better === 'b'} />
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <span className="label-mono" style={{ ...LABEL_MONO, padding: '0 2px' }}>
                  kg = csúcsszett terhelés-változás · % = e1RM-változás (ugyanaz a súly több
                  ismétléssel 0 kg, de valós %).
                </span>
              </div>

              {/* Kontextus — the run-level lifestyle averages, not the weekly buckets */}
              {contextRows.length > 0 && (
                <div className="col gap-sm" style={{ padding: '16px 0 0' }} data-testid="meso-compare-context">
                  <Eyebrow>Kontextus-átlagok</Eyebrow>
                  <div className="card" style={{ padding: '10px 4px 6px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ minWidth: 280, width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr>
                            {['Mutató', 'A', 'B'].map((h) => (
                              <th key={h} style={{ ...HEAD, textAlign: h === 'Mutató' ? 'left' : 'right' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {contextRows.map((r) => (
                            <tr key={r.label} data-testid="compare-context-row">
                              <td style={{ ...CELL, textAlign: 'left' }}>{r.label}</td>
                              <td style={CELL}>{contextCell(r.aValue, r.unit)}</td>
                              <td style={CELL}>{contextCell(r.bValue, r.unit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <span className="label-mono" style={{ ...LABEL_MONO, padding: '0 2px' }}>
                    Súlyváltozás (mért napok) — a mért, egymást követő napok deltáinak összege.
                  </span>
                </div>
              )}
            </>
          )}

          {/* Both reports open one tap away — the compare view is a lens, not a replacement. */}
          <div className="row gap-sm" style={{ padding: '20px 0 32px', justifyContent: 'center' }}>
            <button
              type="button"
              className="chip tapchip"
              onClick={() => navigate(`/train/mesocycles/${aId}/report`)}
            >
              A riportja
            </button>
            <button
              type="button"
              className="chip tapchip"
              onClick={() => navigate(`/train/mesocycles/${bId}/report`)}
            >
              B riportja
            </button>
          </div>
        </>
      )}
        </PageBody>
      </EntranceGroup>
    </MozaikPage>
  )
}
