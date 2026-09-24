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
    <Link to={to} className="pdt-trow">
      <span className="pdt-trow-t"><b>{title}</b><small>{sub}</small></span>
      <span className="pdt-chev" aria-hidden="true">›</span>
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
    // Üvegben (mezo-me75u.13, uveg-uzenofal.html #minta/hetvege `.imp`): lapos panel — a
    // megítélt minta zsálya eyebrow-t kap, a sorok lapos „ajtók" chevronnal.
    <section className={`pdt-flat pdt-impact rise${judged ? ' is-judged' : ''}`}>
      <span className="pdt-impact-eb">Mit kezd ezzel az app</span>
      <div className="pdt-impact-rows">
        {judged ? (
          <>
            {impact.fact && (
              <ImpactRow
                title="Tudástár-tény"
                sub={`×${impact.fact.reinforcementCount} megerősítve · ${impact.fact.includeInPrompt ? 'benne van a társ promptjában' : 'nincs a promptban'}`}
                to="/mezo/knowledge"
              />
            )}
            {impact.predictions.length > 0 && (
              <ImpactRow
                title={`${impact.predictions.length} előrejelzés`}
                sub={`${impact.predictions.filter((p) => p.status === 'validated').length} bejött · ${impact.predictions.filter((p) => p.status === 'pending').length} még fut`}
                to="/mezo/predictions"
              />
            )}
            {impact.experiments.length > 0 && (
              <ImpactRow
                title={`${impact.experiments.length} kísérlet`}
                sub={openClosedCaption(impact.experiments)}
                to="/mezo/experiments"
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
          <p className="pdt-impact-future">
            Ha megerősíted: bekerül a Tudástárba és a társ fejébe, előrejelzés és kísérlet épülhet rá.
          </p>
        )}
      </div>
    </section>
  )
}
