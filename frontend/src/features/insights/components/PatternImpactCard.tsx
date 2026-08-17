import { Link } from 'react-router-dom'
import type { Pattern, PatternImpact, PatternImpactRef } from '@/data/types'

// Statuses that still read as "in progress" across the three ref lists (experiments/challenges use
// different vocabularies — `ExperimentStatus`/`ChallengeStatus` — so this stays a generic, honest
// open/closed split rather than importing either enum here).
const OPEN_STATUSES = new Set(['proposed', 'active', 'accepted'])

function openClosedCaption(refs: PatternImpactRef[]): string {
  const open = refs.filter((r) => OPEN_STATUSES.has(r.status)).length
  const closed = refs.length - open
  if (closed === 0) return `${open} aktív`
  if (open === 0) return `${closed} lezárva`
  return `${open} aktív · ${closed} lezárva`
}

function ImpactRow({ title, sub, to }: { title: string; sub: string; to: string }) {
  return (
    <Link
      to={to}
      className="row"
      style={{
        justifyContent: 'space-between', alignItems: 'center', gap: 10,
        padding: '10px 2px', borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none',
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ color: 'var(--lav-deep)', fontWeight: 700 }}>→</span>
    </Link>
  )
}

/**
 * „Mit kezd ezzel az app" (mezo-tk88.5, spec-mockup screen 2) — what the confirmed pattern has
 * already produced downstream: the promoted knowledge fact + grounded predictions/experiments/
 * challenges, each linking to its own surface. A pair that isn't judged-and-confirmed yet has
 * nothing downstream — a single honest future-tense row replaces the whole list.
 */
export function PatternImpactCard({ pattern, impact }: { pattern: Pattern | null; impact: PatternImpact }) {
  const judged = pattern?.status === 'confirmed'

  return (
    <div
      className="card"
      style={{
        padding: '15px 16px',
        ...(judged ? { background: 'var(--success-bg)', borderColor: 'var(--success-soft)' } : {}),
      }}
    >
      <span className="eyebrow" style={judged ? { color: 'var(--success-deep)' } : undefined}>
        Mit kezd ezzel az app
      </span>
      <div style={{ marginTop: 6 }}>
        {judged ? (
          <>
            {impact.fact && (
              <ImpactRow
                title="Tudástár-tény"
                sub={`×${impact.fact.reinforcementCount} megerősítve · ${impact.fact.includeInPrompt ? 'benne van a társ promptjában' : 'nincs a promptban'}`}
                to="/insights/knowledge"
              />
            )}
            {impact.predictions.length > 0 && (
              <ImpactRow
                title={`${impact.predictions.length} előrejelzés`}
                sub={`${impact.predictions.filter((p) => p.status === 'validated').length} bejött · ${impact.predictions.filter((p) => p.status === 'pending').length} még fut`}
                to="/insights/predictions"
              />
            )}
            {impact.experiments.length > 0 && (
              <ImpactRow
                title={`${impact.experiments.length} kísérlet`}
                sub={openClosedCaption(impact.experiments)}
                to="/insights/experiments"
              />
            )}
            {impact.challenges.length > 0 && (
              <ImpactRow
                title={`${impact.challenges.length} kihívás`}
                sub={openClosedCaption(impact.challenges)}
                to="/train"
              />
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Ha megerősíted: bekerül a Tudástárba és a társ fejébe, előrejelzés és kísérlet épülhet rá.
          </p>
        )}
      </div>
    </div>
  )
}
