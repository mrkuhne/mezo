import type { GoalResponse } from '@/data/me/goalApi'
import { Eyebrow } from '@/shared/ui/Eyebrow'

// The G5 recept finale of the goal command-center: renders the engine's
// GoalPrescription as the prototype's segment TILES (en-body #page-cel,
// mezo-d20.6.2) — a `.gc-lsec` verdict chip next to the "Recept ·
// szakaszonként" eyebrow, then one amber/sage `.gc-seg` tile per segment
// (kcal/protein/sleep/rest as white `.mz-mcells` + an italic rationale
// footer), then the guard-status pills (strength e1RM trend, muscle
// volume/rate, protein "Fuel-re vár"). When the goal has no prescription yet
// (real mode, not evaluated) it shows an "Értékeld a célt" CTA that fires the
// engine via `onEvaluate`. Pure presentational — consumes the raw contract
// shape. Segments render only when the engine provides them (honest states).

type Prescription = NonNullable<GoalResponse['prescription']>
type Feasibility = Prescription['feasibility']
type Segment = Prescription['segments'][number]
type GuardStatus = Prescription['guardStatus']

interface GoalReceptProps {
  prescription: Prescription | null | undefined
  onEvaluate?: () => void
  evaluating?: boolean
}

// Verdict → HU label + the .mzp-stch tone that carries it (pre-existing
// Előrejelzések status-chip family, mezo-d20.5.6 — ok=sage, prop=amber,
// act=coral; never a literal red, per the handoff §2 guardrail).
const VERDICT: Record<Feasibility['verdict'], { label: string; tone: 'ok' | 'prop' | 'act' }> = {
  feasible: { label: 'Reális', tone: 'ok' },
  'feasible-with-warnings': { label: 'Reális, figyelmeztetésekkel', tone: 'prop' },
  aggressive: { label: 'Agresszív', tone: 'act' },
}

const signedRate = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(2)}`

function MCell({ mw, md, value, unit, label }: { mw: string; md: string; value: string; unit: string; label: string }) {
  return (
    <span style={{ '--mw': mw, '--md': md } as React.CSSProperties}>
      <b>
        {value}
        <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.75, marginLeft: 1 }}>{unit}</span>
      </b>
      <small>{label}</small>
    </span>
  )
}

function SegmentCard({ segment, wash }: { segment: Segment; wash: 'amber' | 'sage' }) {
  return (
    <div className={`gc-seg ${wash}`}>
      <div className="gc-seg-head">
        <span className={`mzp-stch ${wash === 'amber' ? 'prop' : 'ok'}`}>
          W{segment.fromWeek}–{segment.toWeek}
        </span>
        <span className="gc-seg-title">{segment.label}</span>
      </div>
      <div className="mz-mcells">
        <MCell mw="var(--mz-wash-white)" md="var(--mz-cell-amber-ink)" value={String(segment.kcal)} unit="kcal" label="napi cél" />
        <MCell mw="var(--mz-wash-white)" md="var(--mz-cell-coral-ink)" value={String(segment.proteinG)} unit="g" label="fehérje" />
        <MCell mw="var(--mz-wash-white)" md="var(--mz-cell-lav-ink)" value={String(segment.sleepTargetH)} unit="h" label="alvás" />
        <MCell mw="var(--mz-wash-white)" md="var(--mz-cell-sage-ink)" value={signedRate(segment.projectedRateKgPerWk)} unit="kg/hét" label="várt tempó" />
      </div>
      <p className="gc-seg-foot">{segment.rationale}</p>
    </div>
  )
}

function GuardPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 9,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 7,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        color,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
      {children}
    </span>
  )
}

function GuardRow({ guardStatus }: { guardStatus: GuardStatus }) {
  const { strength, muscle } = guardStatus
  const strengthColor = strength.breached ? 'var(--error)' : 'var(--sage-deep)'
  const muscleColor =
    muscle.belowMaintenanceMuscles.length > 0 || !muscle.rateWithinCap ? 'var(--warning)' : 'var(--sage-deep)'
  const notes = [...strength.notes, ...muscle.notes]
  return (
    <div>
      <div className="gc-guardrow">
        {strength.active && (
          <GuardPill color={strengthColor}>
            Erő · e1RM {signedRate(strength.e1rmTrendPct)}%{strength.breached ? ' · sérülve' : ''}
          </GuardPill>
        )}
        {muscle.active && (
          <>
            <GuardPill color={muscleColor}>
              Izom · ≥{muscle.minWeeklySetsPerMuscle} szett/izom
              {muscle.belowMaintenanceMuscles.length > 0 ? ` · ${muscle.belowMaintenanceMuscles.length} alatt` : ''}
              {muscle.rateWithinCap ? '' : ' · tempó túl gyors'}
            </GuardPill>
            <span className="gc-mut">Fehérje: Fuel-re vár</span>
          </>
        )}
      </div>
      {notes.length > 0 && (
        <ul style={{ margin: '-4px 0 12px', padding: '0 0 0 13px', listStyle: 'disc' }}>
          {notes.map((note, i) => (
            <li key={i} style={{ fontSize: 9, lineHeight: 1.5, color: 'var(--mz-ink-soft)' }}>
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function GoalRecept({ prescription, onEvaluate, evaluating }: GoalReceptProps) {
  // Null prescription (real mode, goal not yet evaluated) → the evaluate CTA.
  // Honest state: no fabricated segments while the engine hasn't run yet.
  if (!prescription) {
    return (
      <div className="gc-seg sage">
        <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--mz-ink-soft)', margin: '0 0 10px' }}>
          Még nincs recept — futtasd a motort, és a blokkhatárok mentén szakaszokra bontja a kalóriát, fehérjét és alvást.
        </p>
        <button
          type="button"
          className="mzp-ghost"
          onClick={onEvaluate}
          disabled={evaluating}
          style={{ color: 'var(--mz-cell-sage-ink)' }}
        >
          {evaluating ? 'Számolás…' : '⚡ Értékeld a célt'}
        </button>
      </div>
    )
  }

  const verdict = VERDICT[prescription.feasibility.verdict]

  return (
    <div>
      <div className="gc-lsec">
        <Eyebrow>Recept · szakaszonként</Eyebrow>
        <span className={`mzp-stch ${verdict.tone}`}>{verdict.label}</span>
      </div>
      {prescription.feasibility.notes.length > 0 && (
        <ul style={{ margin: '-2px 0 9px', padding: '0 0 0 13px', listStyle: 'disc' }}>
          {prescription.feasibility.notes.map((note, i) => (
            <li key={i} style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--mz-ink-soft)' }}>
              {note}
            </li>
          ))}
        </ul>
      )}
      {prescription.segments.map((segment, i) => (
        <SegmentCard key={`${segment.fromWeek}-${segment.toWeek}-${i}`} segment={segment} wash={i % 2 === 0 ? 'amber' : 'sage'} />
      ))}
      <GuardRow guardStatus={prescription.guardStatus} />
    </div>
  )
}
