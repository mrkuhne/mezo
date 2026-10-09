import { clamp, useSvgId } from './util'

const glass = (x: number) => (
  <>
    <rect x={x} y="12" width="62" height="86" rx="28" fill="none" stroke="rgba(10,42,60,.12)" strokeWidth="2" />
    <path d={`M${x + 11} 34 q2 -11 12 -13`} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".9" />
  </>
)

/** Two communicating vessels joined by a pipe: "this moves with that". */
export function Linked(p: { a: number; b: number; labelA: string; labelB: string; valueA?: string; valueB?: string }) {
  const id = useSvgId('folink')
  const ya = 96 - clamp(p.a) * 0.74, yb = 96 - clamp(p.b) * 0.74
  const liq = (x: number, y: number) => <path fill={`url(#${id})`} d={`M${x} ${y} q7.75 -4.5 15.5 0 t15.5 0 t15.5 0 t15.5 0 V112 H${x}Z`} />
  const num = { fontFamily: 'var(--ff-display)' }
  return (
    <svg className="fo-linked" viewBox="0 0 220 124" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--liq1)" /><stop offset="1" stopColor="var(--liq2)" /></linearGradient>
        <clipPath id={`${id}a`}><rect x="16" y="12" width="62" height="86" rx="28" /></clipPath>
        <clipPath id={`${id}b`}><rect x="142" y="12" width="62" height="86" rx="28" /></clipPath>
      </defs>
      <rect x="64" y="80" width="92" height="9" rx="4.5" fill="var(--liq2)" opacity=".35" />
      <rect x="16" y="12" width="62" height="86" rx="28" fill="#fff" />
      <rect x="142" y="12" width="62" height="86" rx="28" fill="#fff" />
      <g clipPath={`url(#${id}a)`}>{liq(16, ya)}</g>
      <g clipPath={`url(#${id}b)`}>{liq(142, yb)}</g>
      {glass(16)}{glass(142)}
      {p.valueA && <text x="47" y={Math.max(ya + 20, 60)} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" style={num}>{p.valueA}</text>}
      {p.valueB && <text x="173" y={Math.max(yb + 20, 60)} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" style={num}>{p.valueB}</text>}
      <text x="47" y="116" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--fo-ink)">{p.labelA}</text>
      <text x="173" y="116" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--fo-ink)">{p.labelB}</text>
    </svg>
  )
}
