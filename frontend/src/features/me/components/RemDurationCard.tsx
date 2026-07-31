import type { SleepEntry } from '@/data/types'
import { Eyebrow } from '@/shared/ui/Eyebrow'
import {
  type PhaseBreakdown, phaseBreakdown, remByDuration, SHORT_NIGHT_H,
} from '@/features/me/logic/sleepPhases'

const W = 400
const H = 128
const PAD_L = 26
const PAD_B = 18
const PAD_T = 6
const X_RANGE = [5.5, 8.5] as const
const Y_RANGE = [90, 190] as const

/**
 * Duration vs REM (mezo-fk9a) — the personal evidence that a short night cuts REM rather
 * than cutting proportionally. Owns its heading; returns null under the per-side floor.
 */
export function RemDurationCard({ entries }: { entries: SleepEntry[] }) {
  const stats = remByDuration(entries)
  // The copy below hardcodes the direction ("...kevesebb a REM-ed") — deltaMin is longAvg -
  // shortAvg and is otherwise unconstrained in sign, so a non-positive delta (noisy nights can
  // produce one) would render a nonsensical negative "kevesebb" or a claim-free "0 perccel
  // kevesebb". A card that cannot support its claim is simply absent, like the other four gates.
  if (!stats || stats.deltaMin <= 0) return null

  const points = entries
    .map(phaseBreakdown)
    .filter((b): b is PhaseBreakdown => b !== null)
    .map(b => ({ hours: b.asleep / 60, rem: b.rem }))

  const innerW = W - PAD_L
  const innerH = H - PAD_T - PAD_B
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  const px = (h: number) => PAD_L + ((clamp(h, X_RANGE[0], X_RANGE[1]) - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * innerW
  const py = (r: number) => PAD_T + innerH - ((clamp(r, Y_RANGE[0], Y_RANGE[1]) - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * innerH

  return (
    <div style={{ padding: '0 24px 16px' }}>
      <div style={{ marginBottom: 10 }}><Eyebrow>Ha rövidebb az éjszaka</Eyebrow></div>
      <div className="card" style={{ padding: 14 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
             role="img" aria-label="Alváshossz és REM összefüggése">
          {[120, 150, 180].map(g => (
            <g key={g}>
              <line x1={PAD_L} y1={py(g)} x2={W} y2={py(g)} stroke="var(--border-subtle)" strokeWidth="1" />
              <text x={0} y={py(g) + 3} fontSize="8.5" fontWeight="800" fill="var(--faint)">{g}p</text>
            </g>
          ))}
          <line x1={px(SHORT_NIGHT_H)} y1={PAD_T} x2={px(SHORT_NIGHT_H)} y2={PAD_T + innerH}
                stroke="var(--warning)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
          <text x={px(SHORT_NIGHT_H)} y={H - 5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--warning)">
            {SHORT_NIGHT_H}ó
          </text>
          {points.map((p, i) => (
            <circle key={i} cx={px(p.hours)} cy={py(p.rem)} r="3.4" fill="var(--ph-rem)"
                    opacity={p.hours < SHORT_NIGHT_H ? 0.5 : 0.95} />
          ))}
        </svg>
        <p style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          A {SHORT_NIGHT_H} óra alatti éjszakáidon átlagosan{' '}
          <b style={{ color: 'var(--text-primary)' }}>{stats.deltaMin} perccel</b> kevesebb a REM-ed.
          A rövid éjszaka nem arányosan vág — a hajnali REM-et veszi el.
        </p>
      </div>
    </div>
  )
}
