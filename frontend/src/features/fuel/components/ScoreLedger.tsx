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
  const sum = dimensions.reduce((s, d) => s + d.weight * d.score * 100, 0)
  return (
    <div className="sb-ledger" aria-label="Pontszám-összetétel">
      <div className="sb-ledger-bar">
        {dimensions.map(d => (
          <span key={d.id} className="sb-ledger-seg" style={{ flexGrow: d.weight, flexBasis: 0 }}>
            <i style={{ width: `${Math.round(d.score * 100)}%`, background: d.color }} />
          </span>
        ))}
      </div>
      <div className="sb-ledger-sum">
        <span>
          {dimensions.map((d, i) => (
            <span key={d.id}>
              {i > 0 && <em> · </em>}
              <b style={{ color: d.color }}>{Math.round(d.weight * 100)}%</b>
            </span>
          ))}
        </span>
        <span><em>Σ</em> <b>{hu1(sum)}</b> / 100</span>
      </div>
    </div>
  )
}
