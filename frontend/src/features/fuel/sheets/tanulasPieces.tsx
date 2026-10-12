// Fuel · Tanulás (area D) — the small local pieces the learning page and its sheets share (Folyadék F5, mezo-n4wf5.5).
// Prototype: fuel.js `bandG`, `.fx-tot`, `.fu-eq3`. Styles: `styles/folyadek-fuel-tanulas.css` (`.ft-`).
import { Fragment, useId, type ReactNode } from 'react'

/** One catalog sentence with its emphasis: `*…*` marks the bold part, so the sentence stays ONE message. */
export function rich(text: string): ReactNode {
  return text.split('*').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))
}

/** A value inside its ± band on one horizontal vessel (`bandG`): the band is the liquid, the ring is the value, the dashed
 *  tick is what it is compared with (the formula, last week). The scale is centred on the value, wide enough for the band
 *  and the tick. */
export function BandG({ value, sd, valueLabel, tick, tickLabel, label }: {
  value: number; sd: number; valueLabel: string; tick?: number | null; tickLabel?: string; label: string
}) {
  const id = `ft-band-${useId().replace(/:/g, '')}`
  const half = Math.max(sd, tick != null ? Math.abs(tick - value) : 0, 20) * 1.87
  const lo = value - half
  const X = (v: number) => Math.min(308, Math.max(12, 12 + ((v - lo) / (2 * half)) * 296))
  const a = X(value - sd)
  const b = X(value + sd)
  const s = String(Math.round(sd))
  return (
    <svg className="ft-chart ft-band" viewBox="0 0 320 90" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--liq1)" /><stop offset="1" stopColor="var(--liq2)" /></linearGradient>
      </defs>
      <rect x="12" y="34" width="296" height="26" rx="13" fill="#fff" stroke="rgba(10,42,60,.12)" strokeWidth="1.5" />
      <rect x={a.toFixed(1)} y="34" width={(b - a).toFixed(1)} height="26" rx="13" fill={`url(#${id})`} opacity=".5" />
      {tick != null && (
        <>
          <path d={`M${X(tick).toFixed(1)} 28V66`} stroke="var(--fo-ink)" strokeWidth="1.5" strokeDasharray="3 3" opacity=".6" />
          <text x={X(tick).toFixed(1)} y="82" textAnchor="middle">{tickLabel}</text>
        </>
      )}
      <text x={a.toFixed(1)} y="27" textAnchor="middle">−{s}</text>
      <text x={b.toFixed(1)} y="27" textAnchor="middle">+{s}</text>
      <circle cx={X(value).toFixed(1)} cy="47" r="10" fill="#fff" stroke="var(--liq2)" strokeWidth="4.5" />
      <text className="big" x={X(value).toFixed(1)} y="15" textAnchor="middle">{valueLabel}</text>
    </svg>
  )
}

/** The tinted result line (`.fx-tot`): what it is on the left, the big number on the right. */
export function Tot({ label, sub, value, unit }: { label: ReactNode; sub?: ReactNode; value: ReactNode; unit?: ReactNode }) {
  return (
    <div className="ft-tot">
      <span>{label}{sub != null && <small>{sub}</small>}</span>
      <b>{value}{unit != null && <small>{unit}</small>}</b>
    </div>
  )
}

/** A small equation of tiles (`.fu-eq3`): terms joined by `op`, then (`=` or `→`) the result on the liquid. */
export function Eq3({ terms, op, result, arrow }: {
  terms: Array<[value: ReactNode, label: ReactNode]>; op?: string; result?: [value: ReactNode, label: ReactNode]; arrow?: string
}) {
  return (
    <div className="ft-eq3">
      {terms.map(([v, l], i) => (
        <Fragment key={i}>
          {i > 0 && <i>{op}</i>}
          <span><b>{v}</b><small>{l}</small></span>
        </Fragment>
      ))}
      {result && (
        <>
          {terms.length > 0 && <i>{arrow ?? '='}</i>}
          <span className="res"><b>{result[0]}</b><small>{result[1]}</small></span>
        </>
      )}
    </div>
  )
}
