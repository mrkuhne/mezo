// ============================================================
// Mezo · TodayStats — a napszak 1–2 kontextuális tény-cellája (mezo-e26w), az
// `IslandFactsStrip` utódja. Egyetlen dobozban ülnek, függőleges hajszálvonallal
// elválasztva — a mai kétdobozos strip helyett. A strip-filozófia változatlan:
// nincs forrás → NINCS cella, sosem `—` placeholder.
// ============================================================
import type { IslandFact } from '@/features/today/logic/islandFacts'

export function TodayStats({ facts }: { facts: IslandFact[] }) {
  if (facts.length === 0) return null
  return (
    <div className="td-stats" style={{ gridTemplateColumns: `repeat(${facts.length}, 1fr)` }}>
      {facts.map((f) => (
        <div key={f.label} className="td-stat">
          <div className="td-stat-v">
            {f.value}
            {f.unit && <small>{f.unit}</small>}
          </div>
          <div className="td-stat-l">{f.label}</div>
          {f.delta && <div className={`td-stat-d is-${f.delta.tone}`}>{f.delta.text}</div>}
        </div>
      ))}
    </div>
  )
}
