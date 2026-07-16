import { useId } from 'react'
import { pct } from '@/shared/lib/pct'

const ARC = Math.PI * 90 // ≈ 282.74, the semicircle path length (r=90)

/** Napív semicircle kcal gauge (spec §4.4) — sage→amber progress, capped at full arc. */
export function KcalGauge({ consumed, target }: { consumed: number; target: number }) {
  // pct is already capped to 100; calculate uncapped percentage for display
  const pCapped = pct(consumed, target)
  const pUncapped = target > 0 ? (consumed / target) * 100 : 0
  const filled = (pCapped / 100) * ARC
  // useId scopes the gradient id per instance (React 19) — two gauges on one page never collide.
  const gradId = useId()
  return (
    <div className="gauge">
      <svg width="230" height="124" viewBox="0 0 220 120" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--sage)" />
            <stop offset="1" stopColor="var(--amber)" />
          </linearGradient>
        </defs>
        <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="var(--warm)" strokeWidth="13" strokeLinecap="round" />
        <path
          className="gauge-p" d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke={`url(#${gradId})`}
          strokeWidth="13" strokeLinecap="round" strokeDasharray={`${filled.toFixed(1)} ${ARC.toFixed(1)}`}
        />
      </svg>
      <div className="big">
        <div className="n">{consumed}</div>
        <div className="u">/ {target} kcal · {pUncapped.toFixed(0)}%</div>
      </div>
    </div>
  )
}
