// ============================================================
// Mezo · ScoreLedger — the contribution bar of a score breakdown (Logolás 2.1,
// mezo-zeeq; the Lighthouse "published weights" idea). One segment per dimension:
// its WIDTH is the dimension's weight, its FILL the sub-score — so the empty part
// of every segment is exactly the room "Lehetne jobb" can win back, and the Σ of
// the fills is the score itself. Purely presentational, reads only
// `weight` / `score` / `color`; nothing fabricated. Shared by MealScoreSheet and
// RecipeScoreSheet through ScoreBreakdownBody.
// ============================================================
import type { MealDimension } from '@/data/types'
import { hu1 } from '@/shared/lib/huNum'

export function ScoreLedger({ dimensions }: { dimensions: MealDimension[] }) {
  // A degraded dimension (weight 0 — no input coverage) contributes nothing to the score and
  // has no room to "win back", so it neither draws a bar segment nor a %-row entry (both would
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
            <i style={{ width: `${Math.round(d.score * 100)}%`, background: d.color }} />
          </span>
        ))}
      </div>
      <div className="sb-ledger-sum">
        <span>
          {live.map((d, i) => (
            <span key={d.id}>
              {i > 0 && <em> · </em>}
              <b style={{ color: d.color }}>{Math.round(d.weight * 100)}%</b>
            </span>
          ))}
        </span>
        <span><em>Σ</em> <b>{hu1(sum)}</b> / 100</span>
      </div>
      {degraded.length > 0 && (
        <div className="sb-ledger-mut">
          Nincs adat: {degraded.map(d => d.label).join(' · ')} — nem számít bele a pontba
        </div>
      )}
    </div>
  )
}
