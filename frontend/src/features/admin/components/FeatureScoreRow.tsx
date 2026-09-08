import { Link } from 'react-router-dom'
import type { AdminFeatureRow } from '@/data/admin/adminInsightsApi'
import { featureLabel } from '@/features/admin/lib/labels'
import { Sparkline } from '@/features/admin/components/Sparkline'
import { hu1, huInt, usd } from '@/shared/lib/huNum'

// One row of the Funkciók scorecard (mezo-kxnn Task 1) — a dense-but-graphic list row: HU name
// (+missing marker), kind chip, unique users, a 12-week mini sparkline, habit share as a small
// bar, honest "helped" counts (▲/▼ glyphs — NO emojis, per the plan's Global Constraints), cost +
// cost-per-use, and a reliability dot (sage/gold/coral/grey) carrying p90 latency in its title
// tooltip. The whole row is a Link to the (Task 3) detail page — the row itself is the click
// target, matching TopListTile's per-row Link precedent (TopListTile.tsx).

const MISSING_MARK = ' (nincs címke)'

// Exported: the feature detail page's head (mezo-kxnn Task 3) reuses the same kind vocabulary
// for its chip rather than re-deriving a second copy.
export const KIND_LABEL: Record<AdminFeatureRow['kind'], string> = {
  ai: 'AI',
  domain: 'napló',
  both: 'AI + napló',
  system: 'rendszer',
}

// Reuses the shared `.ad-tag` tone vocabulary (prototype.css) rather than inventing new colors
// for a fourth axis of meaning.
export const KIND_TAG_TONE: Record<AdminFeatureRow['kind'], string> = {
  ai: 'bg',
  domain: 'ok',
  both: 'warn',
  system: 'mut',
}

/** sage <5% error, gold <20%, coral >=20%, grey when the backend has no error-rate signal at
 *  all (domain/system rows with no LLM calls) — the plan's honesty ruling for `errorPct: null`. */
function reliabilityTone(errorPct: number | null): 'sage' | 'gold' | 'coral' | 'grey' {
  if (errorPct === null) return 'grey'
  if (errorPct < 5) return 'sage'
  if (errorPct < 20) return 'gold'
  return 'coral'
}

export function FeatureScoreRow({ row }: { row: AdminFeatureRow }) {
  const label = featureLabel(row.key)
  const tone = reliabilityTone(row.errorPct)
  const habitPct = Math.round(row.habitUserShare * 100)
  const title = row.p90LatencyMs !== null ? `p90: ${huInt(row.p90LatencyMs)} ms` : 'p90: nincs adat'

  return (
    <Link to={`/admin/features/${row.key}`} className="ad-scorerow" aria-label={label.label}>
      <div className="name">
        <span className="lb">{label.label}{label.missing && MISSING_MARK}</span>
        <span className={`ad-tag ${KIND_TAG_TONE[row.kind]}`}>{KIND_LABEL[row.kind]}</span>
      </div>
      <span className="num users">{huInt(row.uniqueUsers)}</span>
      <span className="spark">
        <Sparkline points={row.usesPerWeek} tone="lav" ariaLabel={`${label.label} · 12 hét`} />
      </span>
      <div className="habit">
        <div className="ad-bar" style={{ width: 56 }}>
          <i style={{ width: `${habitPct}%`, background: '#5D4FA0' }} />
        </div>
        <span className="pct">{habitPct}%</span>
      </div>
      <span className="helped">
        {row.helped === null ? (
          <span className="ad-mut">nincs visszajelzés-forrás</span>
        ) : (
          <>
            <span className="up">▲ {huInt(row.helped.up)}</span>
            <span className="down">▼ {huInt(row.helped.down)}</span>
          </>
        )}
      </span>
      <div className="cost">
        <span className="v">{usd(row.costUsd)}</span>
        <span className="ad-mut per">{row.costPerUse === null ? '–' : `${usd(row.costPerUse)}/haszn.`}</span>
      </div>
      <span
        className={`ad-reliability-dot ${tone}`}
        title={title}
        aria-label={row.errorPct === null ? 'megbízhatóság: nincs adat' : `hibaarány ${hu1(row.errorPct)}%`}
      />
    </Link>
  )
}
