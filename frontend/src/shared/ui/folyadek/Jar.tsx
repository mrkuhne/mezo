import type { ReactNode } from 'react'
import { Fill } from './Fill'
import { clamp } from './util'

const JAR = 'M24 30Q14 34 14 47V100Q14 112 26 112H74Q86 112 86 100V47Q86 34 76 30V20H24Z'

/** The preserving jar: a day / a quest / an answer kept. `lid` = closed. The text turns white once the liquid reaches it. */
export function Jar(p: { pct: number; size?: number; text?: ReactNode; lid?: boolean; color?: string; color2?: string }) {
  const covered = p.pct >= 42
  return (
    <Fill d={JAR} viewBox="0 0 100 120" className="fo-jar" size={p.size ?? 92} pct={p.pct <= 0 ? 0 : (8 + clamp(p.pct) * 0.82) / 1.2}
      color={p.color} color2={p.color2 ?? p.color}>
      {p.lid
        ? <><rect x="17" y="7" width="66" height="16" rx="6" fill="var(--fo-ink)" /><rect x="24" y="11" width="30" height="3" rx="1.5" fill="rgba(255,255,255,.35)" /></>
        : <path d="M22 20H78" stroke="rgba(10,42,60,.2)" strokeWidth="3" strokeLinecap="round" />}
      {p.text != null && <text x="50" y={covered ? 90 : 74} textAnchor="middle" className="fo-jar-t" fill={covered ? '#fff' : 'var(--fo-ink)'}>{p.text}</text>}
    </Fill>
  )
}
