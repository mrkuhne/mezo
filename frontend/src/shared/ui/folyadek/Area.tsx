import { useSvgId } from './util'

export interface AreaMark { i: number; label?: string
  /** now = where you stand (a dashed drop line and an ink point), pr = a record drop on the curve. */
  kind: 'now' | 'pr' }

/** A time series as a liquid surface: smoothed line, gradient body, optional raw dots and a target waterline.
 *  `marks` stand on the curve (prototype `areaM`); `min` / `max` fix the scale; `color` / `color2` re-tint one chart. */
export function Area(p: { values: number[]; dots?: (number | null)[]; target?: number; labels?: string[]; width?: number; height?: number
  marks?: AreaMark[]; min?: number; max?: number; color?: string; color2?: string }) {
  const id = useSvgId('foarea')
  const w = p.width ?? 320, h = p.height ?? 130, pad = 8
  const v = p.values.length ? p.values : [0]
  const dotVals = (p.dots ?? []).filter((d): d is number => d != null)
  const all = [...v, ...dotVals, ...(p.target != null ? [p.target] : [])]
  const lo = p.min ?? Math.min(...all), hi = p.max ?? Math.max(...all), r = hi - lo || 1
  const c1 = p.color ?? 'var(--liq1)', c2 = p.color2 ?? 'var(--liq2)'
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
          <stop offset="0" stopColor={c1} stopOpacity=".85" />
          <stop offset="1" stopColor={c2} stopOpacity=".18" />
        </linearGradient>
      </defs>
      <path d={`${line} L${X(v.length - 1)} ${floor} L${X(0)} ${floor}Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={c2} strokeWidth="2.5" strokeLinecap="round" />
      {p.target != null && <path d={`M${pad} ${Y(p.target)}H${w - pad}`} stroke="var(--fo-ink)" strokeWidth="1" strokeDasharray="3 4" opacity=".45" />}
      {p.dots?.map((y, i) => y == null ? null : <circle key={i} cx={X((i * (v.length - 1)) / dn)} cy={Y(y)} r="2" fill="var(--fo-faint)" />)}
      <circle cx={last[0]} cy={last[1]} r="5" fill="#fff" stroke={c2} strokeWidth="3" />
      {p.marks?.map((m, k) => {
        const pt = P[m.i]
        if (!pt) return null
        const [x, y] = pt
        return m.kind === 'now' ? (
          <g key={k} className="fo-area-now">
            <path d={`M${f(x)} ${f(y)}V${floor}`} stroke="var(--fo-ink)" strokeWidth="1.5" strokeDasharray="2 4" opacity=".55" />
            <circle cx={x} cy={y} r="6" fill="var(--fo-ink)" stroke="#fff" strokeWidth="3" />
            {m.label && <text x={x} y={Math.max(11, y - 12)} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--fo-ink)">{m.label}</text>}
          </g>
        ) : (
          <g key={k} className="fo-area-pr">
            <path d={`M${f(x)} ${f(y - 7)} c-5 -7 -7 -10 -7 -14 a7 7 0 0 1 14 0 c0 4 -2 7 -7 14Z`} fill="var(--fo-gold)" stroke="#fff" strokeWidth="1.5" />
            {m.label && <text x={x} y={Math.max(9, y - 31)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="var(--fo-ink)">{m.label}</text>}
          </g>
        )
      })}
      {p.labels?.map((l, i, a) => (
        <text key={i} x={pad + (i * (w - 2 * pad)) / Math.max(a.length - 1, 1)} y={h - 2}
          textAnchor={i ? (i === a.length - 1 ? 'end' : 'middle') : 'start'} fontSize="9.5" fill="var(--fo-sub)"
          style={{ fontFamily: 'var(--ff-mono)' }}>{l}</text>
      ))}
    </svg>
  )
}
