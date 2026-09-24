import { useState, type CSSProperties, type ReactNode } from 'react'
import { perkHint } from '@/features/me/logic/perkMilestones'
import type { GoalChip } from '@/features/me/logic/goalSkillChips'
import { DIMENSIONS } from '@/features/me/logic/lifegoalLabels'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { clampPct } from '@/shared/lib/pct'
import { cn } from '@/shared/lib/cn'

export interface SkillRowVM { key: string; icon: ReactNode; name: string; level: number; progressPct: number; xp: number }
export type SkillBandWash = 'lav' | 'sage' | 'amber'
const BAR: Record<SkillBandWash, string> = { lav: 'lav', sage: 'sage', amber: 'gold' }
/** The band's ONE glass accent (üveg bible §2, U7 prototype `skillek()`): LIFE lav, Atlétikus sage, Izom gold. */
const ACCENT: Record<SkillBandWash, string> = { lav: 'var(--dv-lav)', sage: 'var(--dv-sage)', amber: 'var(--dv-amber)' }

/**
 * One skill band (LIFE / Atlétikus / Izom) — Growth Skillek page (mezo-rmi0.1; üveg re-dress
 * mezo-me75u.7, prototype uveg-en2.html `skillek()`): a glass card in the band's accent, a title
 * row (3D art · name · flat chip), rows sorted by the caller (level desc, XP desc) as icon or
 * monogram well · name + glowing meter + optional `→ perk Lv n` hint one level before a milestone
 * · `Lv n` plaque. The first `previewRows` show; the rest sit behind `Mind a {n} ▸` (card-local
 * `expanded`). No XP readout per row — the chip carries the band XP.
 */
export function SkillBandCard({ eyebrow, chip, chipTone, rows, footer, wash, delayMs, previewRows = 4, goalChips, art }: {
  eyebrow: string; chip: string; chipTone: 'ok' | 'warn' | 'lav'; rows: SkillRowVM[]
  footer?: ReactNode; wash: SkillBandWash; delayMs?: number; previewRows?: number
  /** `skillKey → chip` (mezo-iizd.12). Csak akkor kap sor chipet, ha aktív cél pillére rá mutat. */
  goalChips?: Map<string, GoalChip>
  /** The band's 3D title art (üveg). */
  art?: Icon3DName
}) {
  const [expanded, setExpanded] = useState(false)
  const d = delayMs ?? 0
  return (
    <div className={cn('gr-band', wash, 'glass', 'rise', expanded && 'expanded')}
      style={{ '--d': `${d}ms`, '--c': ACCENT[wash] } as CSSProperties}>
      <div className="gr-band-top">
        {art && <Icon3D name={art} size={34} className="gr-band-art" />}
        <span className="gr-band-ttl">{eyebrow}</span>
        <span className={cn('gr-band-chip', chipTone)}>{chip}</span>
      </div>
      {rows.map((r, i) => {
        const hint = perkHint(r.level)
        return (
          <div key={r.key} className={cn('gr-skl', i >= previewRows && 'more')}>
            <span className={cn('gr-skl-ic', typeof r.icon === 'string' && 'mono')} aria-hidden="true">{r.icon}</span>
            <div className="gr-skl-grow">
              <span className="gr-skl-nm">{r.name}</span>
              <div className="gr-tbar"><i className={BAR[wash]} style={{ '--w': `${clampPct(r.progressPct)}%`, '--d': `${d + 260 + i * 55}ms` } as CSSProperties} /></div>
              {hint != null && <span className="gr-skl-perk">→ perk Lv {hint}</span>}
              {/* .lg-goalchip: a sor által NEM hordozott felét nevezi meg — itt CÉL CÍME, mert egy
                  skill-sor nem hordoz cél-identitást. Szabály a prototype.css-ben, a token
                  definíciójánál (mezo-9r85). */}
              {goalChips?.get(r.key) && (
                <span className={`lg-goalchip ${DIMENSIONS[goalChips.get(r.key)!.dimension].cls}`}>
                  <i />{goalChips.get(r.key)!.title}
                </span>
              )}
            </div>
            <span className="gr-skl-lv">Lv {r.level}</span>
          </div>
        )
      })}
      {rows.length > previewRows && (
        <button type="button" className="gr-expand" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Kevesebb ▴' : `Mind a ${rows.length} ▸`}
        </button>
      )}
      {footer && <div className="gr-band-foot">{footer}</div>}
    </div>
  )
}
