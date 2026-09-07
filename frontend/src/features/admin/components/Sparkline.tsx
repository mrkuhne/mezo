import type { CSSProperties } from 'react'
import type { PageTone } from '@/shared/ui/mozaik'

// Admin hub sparkline (mezo-d5iy.11) — pure inline SVG, no charting library (the codebase has
// none and the CSP-free build must stay that way). Ported from admin-body.html's sparkPath/
// sparkSvg: normalise `points` into a 0..1 band, draw a <polyline> plus a soft gradient-filled
// area <path>, `preserveAspectRatio="none"` so it fills the tile width exactly.
//
// The resting state is the FINAL state (full line, full dot, dashoffset 0) — the `.ad-spark`
// CSS (prototype.css §Admin hub graphics) only ANIMATES from there under a `.mz-play` ancestor
// (EntranceGroup); a sparkline rendered outside `.mz-play` (a tile that never plays its
// entrance, e.g. because the query resolved after mount, or a print view) still shows the full
// line — never an empty tile. See Sparkline.test.tsx / the page tests for the assertion.
const TONE_STROKE: Record<PageTone, string> = {
  coral: 'var(--mz-cell-coral-ink, #A84A26)',
  gold: 'var(--mz-qxp-ink, #A8801F)',
  lav: 'var(--mz-cell-lav-ink, #5D4FA0)',
  rose: 'var(--mz-cell-rose-ink, #8E3F6F)',
  sage: 'var(--mz-cell-sage-ink, #4E6B42)',
  sky: 'var(--mz-cell-sky-ink, #2E6E96)',
}

const W = 480
const H = 96
const PAD = 8

export function Sparkline({ points, tone, ariaLabel }: { points: number[]; tone: PageTone; ariaLabel: string }) {
  const color = TONE_STROKE[tone]
  if (points.length === 0) {
    return <svg className="ad-spark" viewBox={`0 0 ${W} ${H}`} height={H} role="img" aria-label={ariaLabel} />
  }
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const n = points.length
  const coords = points.map((v, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * W
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2)
    return [x, y] as const
  })
  const lineD = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const areaD = `${lineD} L${W} ${H} L0 ${H} Z`
  const [lastX, lastY] = coords[coords.length - 1]
  const gradId = `spark-${ariaLabel.replace(/[^a-zA-Z0-9]/g, '')}-${tone}`
  return (
    <svg
      className="ad-spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      height={H}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.26} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path className="fl" d={areaD} fill={`url(#${gradId})`} />
      <polyline
        className="ln"
        points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={color}
        style={{ '--len': 2000 } as CSSProperties}
      />
      <circle className="dot" cx={lastX} cy={lastY} r={4} fill={color} stroke="#fff" strokeWidth={2} />
    </svg>
  )
}
