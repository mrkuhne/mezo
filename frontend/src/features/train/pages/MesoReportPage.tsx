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
// strictly from what the report carries: no volume ⇒ no arc block, null
// selfEval ⇒ no note block, `aiEvalEnabled: false` (all of S2) ⇒ the AI block
// does not exist at all, null `context` ⇒ nothing (S3 fills it, mezo-meyc.3).
//
// Strength labelling is deliberately two-headed, mirroring the backend: `deltaKg`
// is the top-set LOAD difference while `deltaPct` is measured on e1RM — so "same
// weight, more reps" is 0 kg but a real percentage gain, and a weightless lift
// has neither (only its reps moved).
// ============================================================
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMesoReport, useMesoTemplates, useTrain } from '@/data/hooks'
import { useBackNav } from '@/shared/hooks/useBackNav'
import { huMonthDay } from '@/shared/lib/dates'
import { MUSCLE_LABELS } from '@/data/train/train'
import type { MesoStrengthDelta, MesocycleReportResponse } from '@/data/train/trainApi'
import type { MedalType } from '@/data/train/medalTypes'
import type { MuscleVolumeArc } from '@/data/types'
import { MEDAL_TYPE_LABEL } from '@/features/train/logic/medalLabels'
import { MuscleArcSwitch } from '@/features/train/components/MuscleArcSwitch'
import { MesoStartSheet } from '@/features/train/sheets/MesoStartSheet'
import { StatStrip } from '@/shared/ui/StatStrip'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import { GhostState } from '@/shared/ui/GhostState'
import { Icon } from '@/shared/ui/Icon'
import { CtaGhost } from '@/shared/ui/Cta'

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

export function MesoReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const goBack = useBackNav('/train/mesocycles')
  const { mesocycles, workoutPending } = useTrain()
  const { report, pending, notFound, error, refetch, regenerating, regenerate } = useMesoReport(id ?? null)
  const { rerun } = useMesoTemplates()
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

  const arcs = toMuscleArcs(report?.volume)

  return (
    // Inside AppLayout's .screen-content scroller — no nested wrapper (mirrors MesoOverviewPage).
    <div>
      {/* Breadcrumb — pinned below the status bar like native nav chrome */}
      <div className="sticky-top" style={{ padding: '8px 24px' }}>
        <button type="button" onClick={goBack} className="row gap-sm">
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>←</span>
          <span className="eyebrow">Vissza</span>
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: '6px 24px 0' }}>
        <Eyebrow>{report?.closedAt ? `Lezárva · ${day(report.closedAt)}` : 'Futam · riport'}</Eyebrow>
      </div>
      <div className="pghead-np">
        <div>
          <div className="over">Edzés · Futam-riport</div>
          <h1>{title}</h1>
        </div>
      </div>
      {report && (
        <div className="row gap-md" style={{ padding: '6px 24px 4px' }}>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            {`${day(report.startDate)}${report.endDate ? ` → ${day(report.endDate)}` : ''}`}
          </span>
          <span className="label-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            {`${report.weeks} hét`}
          </span>
        </div>
      )}
      {report?.templateId && (
        <div style={{ padding: '8px 24px 0' }}>
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
        <div style={{ padding: '16px 24px' }}>
          <GhostState lines={3} message="Riport betöltése…" />
        </div>
      ) : error ? (
        // A genuine read failure (the contract's 404 is `notFound` below, not this) —
        // a terminal state with a retry, never a blank page (§7a).
        <div style={{ padding: '16px 24px' }}>
          <GhostState
            lines={2}
            message="Nem sikerült betölteni a riportot."
            ctaLabel="Újrapróbálás"
            onCta={refetch}
          />
        </div>
      ) : notFound ? (
        <div style={{ padding: '16px 24px' }}>
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
          {/* Adherence — the "did the plan actually happen" glance */}
          <div style={{ padding: '16px 24px 8px' }}>
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
                { label: 'Teljesítés', value: fmt(report.adherence.completionPct), unit: '%' },
              ]}
            />
          </div>

          {/* Frozen volume arc — same switch as the live overview (MuscleArcSwitch) */}
          {arcs.length > 0 && (
            <>
              <div style={{ padding: '12px 24px 0' }}>
                <Eyebrow>Volumen-ív · zárás</Eyebrow>
              </div>
              <MuscleArcSwitch muscles={arcs} />
            </>
          )}

          {/* Strength — LOAD move and e1RM percentage labelled apart */}
          {report.strength.length > 0 && (
            <div className="col gap-sm" style={{ padding: '12px 24px' }} data-testid="meso-report-strength">
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
          <div className="col gap-sm" style={{ padding: '12px 24px' }} data-testid="meso-report-records">
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
            <div className="col gap-sm" style={{ padding: '12px 24px' }}>
              <Eyebrow>Saját értékelés</Eyebrow>
              <div className="card" style={{ padding: 'var(--sp-4)' }}>
                <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>{report.selfEval}</p>
              </div>
            </div>
          )}

          {/* AI narrative — S3 territory. While the feature is off the block does not exist. */}
          {report.aiEvalEnabled && (
            <div className="col gap-sm" style={{ padding: '12px 24px' }}>
              <Eyebrow brand>AI értékelés</Eyebrow>
              <div className="card" style={{ padding: 'var(--sp-4)' }}>
                {report.aiEvalStatus === 'ready' && report.aiEval ? (
                  <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>{report.aiEval}</p>
                ) : report.aiEvalStatus === 'failed' ? (
                  <span className="text-secondary" style={{ fontSize: 13 }}>
                    Az értékelés nem készült el — próbáld újra a generálást.
                  </span>
                ) : (
                  <span className="text-secondary" style={{ fontSize: 13 }}>Az értékelés készül…</span>
                )}
              </div>
            </div>
          )}

          {/* Actions — a closed run's only live affordances */}
          <div className="col gap-sm" style={{ padding: '16px 24px 32px' }}>
            <CtaGhost style={{ padding: 12 }} onClick={rerunMeso}>
              <Icon name="sparkle" size={14} /> Újrafuttatás
            </CtaGhost>
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

      {startTemplate && (
        <MesoStartSheet
          templateId={startTemplate.id}
          title={startTemplate.title}
          onClose={() => setStartTemplate(null)}
        />
      )}
    </div>
  )
}
