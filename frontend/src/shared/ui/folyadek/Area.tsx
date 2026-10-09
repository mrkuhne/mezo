import { useSvgId } from './util'

/** A time series as a liquid surface: smoothed line, gradient body, optional raw dots and a target waterline. */
export function Area(p: { values: number[]; dots?: (number | null)[]; target?: number; labels?: string[]; width?: number; height?: number }) {
  const id = useSvgId('foarea')
  const w = p.width ?? 320, h = p.height ?? 130, pad = 8
  const v = p.values.length ? p.values : [0]
  const dotVals = (p.dots ?? []).filter((d): d is number => d != null)
  const all = [...v, ...dotVals, ...(p.target != null ? [p.target] : [])]
  const lo = Math.min(...all), hi = Math.max(...all), r = hi - lo || 1
  const n = Math.max(v.length - 1, 1)
  const X = (i: number) => pad + (i * (w - 2 * pad)) / n
  const Y = (y: number) => pad + (1 - (y - lo) / r) * (h - 2 * pad - (p.labels ? 14 : 0))
  const P = v.map((y, i) => [X(i), Y(y)] as const)
  const f = (k: number) => k.toFixed(1)
  const line = P.map((pt, i) => {
    if (!i) return `M${f(pt[0])} ${f(pt[1])}`
    const a = P[i - 2] ?? P[i - 1], b = P[i - 1], d = P[i + 1] ?? pt
    return `C${f(b[0] + (pt[0] - a[0]) / 6)} ${f(b[1] + (pt[1] - a[1]) / 6)} ${f(pt[0] - (d[0] - b[0]) / 6)} ${f(pt[1] - (d[1] - b[1]) / 6)} ${f(pt[0])} ${f(pt[1])}`
  }).join('')
  const floor = h - (p.labels ? 14 : 0)
  const last = P[P.length - 1]
  const dn = p.dots ? Math.max(p.dots.length - 1, 1) : 1
  return (
    <svg className="fo-area" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--liq1)" stopOpacity=".85" />
          <stop offset="1" stopColor="var(--liq2)" stopOpacity=".18" />
        </linearGradient>
      </defs>
      <path d={`${line} L${X(v.length - 1)} ${floor} L${X(0)} ${floor}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--liq2)" strokeWidth="2.5" strokeLinecap="round" />
      {p.target != null && <path d={`M${pad} ${Y(p.target)}H${w - pad}`} stroke="var(--fo-ink)" strokeWidth="1" strokeDasharray="3 4" opacity=".45" />}
      {p.dots?.map((y, i) => y == null ? null : <circle key={i} cx={X((i * (v.length - 1)) / dn)} cy={Y(y)} r="2" fill="var(--fo-faint)" />)}
      <circle cx={last[0]} cy={last[1]} r="5" fill="#fff" stroke="var(--liq2)" strokeWidth="3" />
      {p.labels?.map((l, i, a) => (
        <text key={i} x={pad + (i * (w - 2 * pad)) / Math.max(a.length - 1, 1)} y={h - 2}
          textAnchor={i ? (i === a.length - 1 ? 'end' : 'middle') : 'start'} fontSize="9.5" fill="var(--fo-sub)"
          style={{ fontFamily: 'var(--ff-mono)' }}>{l}</text>
      ))}
    </svg>
  )
}
