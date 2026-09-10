// ============================================================
// Mezo · TitanCompanion — Nap/Mai presence mark (mezo-mhum): a titanium-petal
// + gold-core companion form, its aura tinted by the FIRST THREE need colors
// (proportional to band — dimmer when the need is unmet, honest but calm).
// Tapping it opens the Életjelek surface. Pure display: no data fetching,
// all timing/animation lives in CSS (`.titan-*`, appended to prototype.css)
// so this stays a plain inline SVG + one <button>.
// ============================================================
import type { NeedState } from '@/features/today/logic/needs'
import { NEED_META } from '@/features/today/logic/needs'

const AURA_ALPHA: Record<NeedState['band'], number> = {
  green: 0.35,
  yellow: 0.22,
  red: 0.12,
  critical: 0.12,
}

function withAlpha(color: string, alpha: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}

export function TitanCompanion({ states, onOpenSignals }: { states: NeedState[]; onOpenSignals: () => void }) {
  const auraStates = states.slice(0, 3)
  const auraVars = Object.fromEntries(
    auraStates.map((s, i) => [`--aura-${i}`, withAlpha(NEED_META[s.key].color, AURA_ALPHA[s.band])]),
  ) as React.CSSProperties

  return (
    <button type="button" className="titan-companion" onClick={onOpenSignals} aria-label="Életjelek">
      <span className="titan-aura" style={auraVars} aria-hidden="true" />
      <svg className="titan-svg" viewBox="0 0 180 180" aria-hidden="true">
        <defs>
          <radialGradient id="titan-gold" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#fff6da" />
            <stop offset="55%" stopColor="#e7c467" />
            <stop offset="100%" stopColor="#a9803a" />
          </radialGradient>
          <linearGradient id="titan-metal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e4e1ec" />
            <stop offset="45%" stopColor="#b6b1c8" />
            <stop offset="100%" stopColor="#8b86a3" />
          </linearGradient>
          <radialGradient id="titan-planet" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#e3d3ff" />
            <stop offset="100%" stopColor="#8f6fd1" />
          </radialGradient>
        </defs>
        <g className="titan-form">
          <g className="titan-rings">
            <ellipse cx="90" cy="90" rx="76" ry="36" transform="rotate(-30 90 90)" fill="none" stroke="#9c8cbb" strokeWidth="1.4" />
            <ellipse cx="90" cy="90" rx="66" ry="30" transform="rotate(38 90 90)" fill="none" stroke="#c9bfe0" strokeWidth="1" />
            <circle className="titan-planet" cx="152" cy="59" r="6" fill="url(#titan-planet)" />
          </g>
          <g className="titan-petals" fill="url(#titan-metal)" stroke="#b6b1c8" strokeWidth="1">
            <path d="M84 20C22 31 25 107 62 124L73 90C48 70 61 47 84 20Z" />
            <path d="M84 20C22 31 25 107 62 124L73 90C48 70 61 47 84 20Z" transform="rotate(120 90 90)" />
            <path d="M84 20C22 31 25 107 62 124L73 90C48 70 61 47 84 20Z" transform="rotate(240 90 90)" />
          </g>
          <circle className="titan-core" cx="90" cy="90" r="24" fill="url(#titan-gold)" />
        </g>
      </svg>
    </button>
  )
}
