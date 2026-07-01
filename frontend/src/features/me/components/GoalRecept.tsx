import type { GoalResponse } from '@/data/me/goalApi'

// The G5 recept finale of the goal command-center: replaces G4b's static
// "G5 · hamarosan" placeholder. Renders the engine's GoalPrescription —
// a feasibility verdict banner, the per-segment recept (kcal/protein/sleep/rest +
// projected rate + rationale) and the guard-status pills (strength e1RM trend,
// muscle volume/rate, protein "Fuel-re vár"). When the goal has no prescription
// yet (real mode, not evaluated) it shows an "Értékeld a célt" CTA that fires the
// engine via `onEvaluate`. Pure presentational — consumes the raw contract shape.
// Inline-style + token idiom, matching GoalTimeline. (mezo-g1u)

type Prescription = NonNullable<GoalResponse['prescription']>
type Feasibility = Prescription['feasibility']
type Segment = Prescription['segments'][number]
type GuardStatus = Prescription['guardStatus']

interface GoalReceptProps {
  prescription: Prescription | null | undefined
  onEvaluate?: () => void
  evaluating?: boolean
}

// Verdict → HU label + tone color. feasible = calm/brand, with-warnings = warning,
// aggressive = error. The banner border/background derive from this one color.
const VERDICT: Record<Feasibility['verdict'], { label: string; color: string }> = {
  feasible: { label: 'Reális', color: 'var(--brand-glow)' },
  'feasible-with-warnings': { label: 'Reális, figyelmeztetésekkel', color: 'var(--warning)' },
  aggressive: { label: 'Agresszív', color: 'var(--error)' },
}

const signedRate = (v: number): string => `${v > 0 ? '+' : ''}${v.toFixed(2)}`

function SectionLabel({ tag }: { tag: string }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px' }}>
      <span className="eyebrow">Recept · szakaszonként</span>
      <span
        className="tag"
        style={{
          fontFamily: 'var(--ff-mono)',
          fontSize: 8,
          letterSpacing: '.06em',
          padding: '1px 6px',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)',
        }}
      >
        {tag}
      </span>
    </div>
  )
}

function VerdictBanner({ feasibility }: { feasibility: Feasibility }) {
  const { label, color } = VERDICT[feasibility.verdict]
  return (
    <div
      className="card notch-4"
      style={{
        padding: '9px 11px',
        background: `color-mix(in srgb, ${color} 7%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        marginBottom: 8,
      }}
    >
      <div className="row" style={{ alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 11, fontWeight: 700, color }}>{label}</span>
      </div>
      {feasibility.notes.length > 0 && (
        <ul style={{ margin: '6px 0 0', padding: '0 0 0 13px', listStyle: 'disc' }}>
          {feasibility.notes.map((note, i) => (
            <li key={i} style={{ fontSize: 10, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SegmentMetric({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="col" style={{ gap: 1 }}>
      <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
        {value}
        <span style={{ fontSize: 8, color: 'var(--text-tertiary)', marginLeft: 2 }}>{unit}</span>
      </span>
      <span className="label-mono" style={{ fontSize: 7, color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  )
}

function SegmentCard({ segment }: { segment: Segment }) {
  return (
    <div
      className="card notch-4"
      style={{ padding: '10px 11px', background: 'rgba(94, 234, 212, 0.03)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{segment.label}</span>
        <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>
          W{segment.fromWeek}–{segment.toWeek}
        </span>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
        <SegmentMetric value={String(segment.kcal)} unit="kcal" label="napi cél" />
        <SegmentMetric value={String(segment.proteinG)} unit="g" label="fehérje" />
        <SegmentMetric value={String(segment.sleepTargetH)} unit="h" label="alvás" />
        <SegmentMetric value={signedRate(segment.projectedRateKgPerWk)} unit="kg/hét" label="várt tempó" />
      </div>
      <p
        className="text-secondary"
        style={{ fontSize: 10, fontStyle: 'italic', lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}
      >
        {segment.rationale}
      </p>
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
        fontFamily: 'var(--ff-mono)',
        fontSize: 9,
        padding: '3px 8px',
        borderRadius: 3,
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
  const strengthColor = strength.breached ? 'var(--error)' : 'var(--brand-glow)'
  const muscleColor =
    muscle.belowMaintenanceMuscles.length > 0 || !muscle.rateWithinCap ? 'var(--warning)' : 'var(--brand-glow)'
  return (
    <div style={{ marginTop: 8 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
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
            <GuardPill color="var(--text-tertiary)">Fehérje: Fuel-re vár</GuardPill>
          </>
        )}
      </div>
      {/* Guard notes (e.g. a breach explanation) listed below the pills. */}
      {[...strength.notes, ...muscle.notes].length > 0 && (
        <ul style={{ margin: '6px 0 0', padding: '0 0 0 13px', listStyle: 'disc' }}>
          {[...strength.notes, ...muscle.notes].map((note, i) => (
            <li key={i} style={{ fontSize: 9, lineHeight: 1.5, color: 'var(--text-tertiary)' }}>
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
  if (!prescription) {
    return (
      <div>
        <SectionLabel tag="G5 · motor" />
        <div
          className="card notch-4"
          style={{ padding: '12px 13px', background: 'rgba(94, 234, 212, 0.04)' }}
        >
          <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            Még nincs recept — futtasd a motort, és a blokkhatárok mentén szakaszokra bontja a kalóriát, fehérjét és alvást.
          </p>
          <button
            type="button"
            className="chip"
            onClick={onEvaluate}
            disabled={evaluating}
            style={{ borderColor: 'var(--border-brand)', color: 'var(--brand-glow)' }}
          >
            {evaluating ? 'Számolás…' : '⚡ Értékeld a célt'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionLabel tag={prescription.basis === 'adaptive' ? 'adaptív' : 'formula'} />
      <VerdictBanner feasibility={prescription.feasibility} />
      <div className="col gap-sm">
        {prescription.segments.map((segment, i) => (
          <SegmentCard key={`${segment.fromWeek}-${segment.toWeek}-${i}`} segment={segment} />
        ))}
      </div>
      <GuardRow guardStatus={prescription.guardStatus} />
    </div>
  )
}
