// ============================================================
// Mezo · ScoreLedger — the contribution bar of a score breakdown (Logolás 2.1,
// mezo-zeeq; the Lighthouse "published weights" idea). One segment per dimension:
// its WIDTH is the dimension's weight, its FILL the sub-score — so the empty part
// of every segment is exactly the room "Lehetne jobb" can win back, and the Σ of
// the fills is the score itself. Purely presentational, reads only
// `weight` / `score` / `color`; nothing fabricated. Shared by MealScoreSheet and
// RecipeScoreSheet through ScoreBreakdownBody / ScoreLedgerSection.
//
// mezo-1f7b: the bar used to be followed by a comma-separated „22% · 10% · 14% …"
// run of weights — eight numbers, none of which said what the half-empty segment
// under them meant, and nothing but hue tying a number to its segment. It is now a
// two-column list of named rows: colour swatch + dimension + „megszerzett / elérhető"
// pont. Same data, said out loud.
// ============================================================
import type { MealDimension } from '@/data/types'
import { hu1 } from '@/shared/lib/huNum'

export function ScoreLedger({ dimensions }: { dimensions: MealDimension[] }) {
  // A degraded dimension (weight 0 — no input coverage) contributes nothing to the score and
  // has no room to "win back", so it neither draws a bar segment nor a row (both would
  // be lies: a 0-width segment and a "0%" nobody can act on). It is instead named, quietly, in
  // a "Nincs adat" line under the bar — honest absence, not silent disappearance (mezo-jcpt.1).
  const live = dimensions.filter(d => d.weight > 0)
  const degraded = dimensions.filter(d => d.weight === 0)
  const sum = live.reduce((s, d) => s + d.weight * d.score * 100, 0)
  return (
    <div className="sb-ledger" aria-label="Pontszám-összetétel">
      <div className="sb-ledger-bar">
        {live.map(d => (
          <span key={d.id} className="sb-ledger-seg" style={{ flexGrow: d.weight, flexBasis: 0 }}>
            {/* No rounding here: a 6%-weight segment is ~20px wide, where a rounded-to-integer
                fill is visibly off. The percentage keeps its full precision (mezo-1f7b). */}
            <i style={{ width: `${d.score * 100}%`, background: d.color }} />
          </span>
        ))}
      </div>
      <div className="sb-ledger-rows">
        {live.map(d => (
          <div key={d.id} className="sb-ledger-row" style={{ '--c': d.color } as React.CSSProperties}>
            <i aria-hidden="true" />
            <span>{d.label}</span>
            <b>{hu1(d.weight * d.score * 100)}</b>
            <em>/ {hu1(d.weight * 100)}</em>
          </div>
        ))}
      </div>
      <div className="sb-ledger-sum">
        <span>Súlyozott összeg</span>
        <span><b>{hu1(sum)}</b> / 100</span>
      </div>
      {degraded.length > 0 && (
        <div className="sb-ledger-mut">
          Nincs adat: {degraded.map(d => d.label).join(' · ')} — nem számít bele a pontba
        </div>
      )}
    </div>
  )
}
