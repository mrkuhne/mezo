import { useState, type CSSProperties, type ReactNode } from 'react'
import { perkHint } from '@/features/me/logic/perkMilestones'
import { clampPct } from '@/shared/lib/pct'
import { cn } from '@/shared/lib/cn'

export interface SkillRowVM { key: string; icon: ReactNode; name: string; level: number; progressPct: number; xp: number }
export type SkillBandWash = 'lav' | 'sage' | 'amber'
const BAR: Record<SkillBandWash, string> = { lav: 'lav', sage: 'sage', amber: 'gold' }

/**
 * One skill band (LIFE / Atlétikus / Izom) — Growth Skillek page (mezo-rmi0.1, prototype
 * growth-tab.html `band()`): washed card, eyebrow + tinted chip, rows sorted by the caller
 * (level desc, XP desc) as icon cell · name · animated meter · optional `→ perk Lv n` hint one
 * level before a milestone · `Lv n` plaque. The first `previewRows` show; the rest sit behind
 * `Mind a {n} ▸` (card-local `expanded`). No XP readout per row — the chip carries the band XP.
 */
export function SkillBandCard({ eyebrow, chip, chipTone, rows, footer, wash, delayMs, previewRows = 4 }: {
  eyebrow: string; chip: string; chipTone: 'ok' | 'warn' | 'lav'; rows: SkillRowVM[]
  footer?: ReactNode; wash: SkillBandWash; delayMs?: number; previewRows?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const d = delayMs ?? 0
  return (
    <div className={cn('gr-band', wash, 'rise', expanded && 'expanded')} style={{ '--d': `${d}ms` } as CSSProperties}>
      <div className="gr-band-top">
        <span className="mz-eyebrow">{eyebrow}</span>
        <span className={cn('gr-band-chip', chipTone)}>{chip}</span>
      </div>
      {rows.map((r, i) => {
        const hint = perkHint(r.level)
        return (
          <div key={r.key} className={cn('gr-skl', i >= previewRows && 'more')}>
            <span className="gr-skl-ic" aria-hidden="true">{r.icon}</span>
            <span className="gr-skl-nm">{r.name}</span>
            <div className="gr-tbar"><i className={BAR[wash]} style={{ '--w': `${clampPct(r.progressPct)}%`, '--d': `${d + 260 + i * 55}ms` } as CSSProperties} /></div>
            {hint != null && <span className="gr-skl-perk">→ perk Lv {hint}</span>}
            <span className="gr-skl-lv">Lv {r.level}</span>
          </div>
        )
      })}
      {rows.length > previewRows && (
        <button type="button" className="gr-expand" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Kevesebb ▴' : `Mind a ${rows.length} ▸`}
        </button>
      )}
      {footer && <div className="gr-band-foot">{footer}</div>}
    </div>
  )
}
