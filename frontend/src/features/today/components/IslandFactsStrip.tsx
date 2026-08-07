// ============================================================
// Mezo · IslandFactsStrip — the 1–2 contextual fact cells under an
// island hero (mezo-euze). The DS StatStrip idiom extended with a
// delta line (trend / goal distance / forecast). Ghosts on empty —
// strip philosophy: no source → no cell, never a `—` placeholder.
// ============================================================
import type { IslandFact } from '@/features/today/logic/islandFacts'

export function IslandFactsStrip({ facts }: { facts: IslandFact[] }) {
  if (facts.length === 0) return null
  return (
    <div className="isl-facts" style={{ gridTemplateColumns: `repeat(${facts.length}, 1fr)` }}>
      {facts.map((f) => (
        <div key={f.label} className="isl-fact">
          <div className="isl-fact-v">
            {f.value}
            {f.unit && <span className="isl-fact-u">{f.unit}</span>}
          </div>
          <div className="isl-fact-l">{f.label}</div>
          {f.delta && <div className={`isl-fact-d is-${f.delta.tone}`}>{f.delta.text}</div>}
        </div>
      ))}
    </div>
  )
}
