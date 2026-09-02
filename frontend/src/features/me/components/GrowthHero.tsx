// ============================================================
// Mezo · GrowthHero (mezo-rmi0.1) — prototype growth-tab.html `.grhero` ×1.18.
// Title → clay i-growth + XP count-up (continues from the last shown value) → three
// labelled rows: Szint (gold bar, xpInLevel/xpForNext), Fegyelem (lav bar, %) and
// Ritmus (last-8-weeks dots). Honest states: a null discipline or a missing
// gamification level REMOVES its row (handoff §2) — never a "–" placeholder. ADR 0010:
// nothing here gates, counts down or rewards.
// ============================================================
import type { CSSProperties } from 'react'
import { ClayIcon } from '@/shared/ui/clay'
import { useContinuingCountUp } from '@/shared/ui/mozaik/motion'
import { huInt } from '@/shared/lib/huNum'

const WEEK_DOTS = 8

export function GrowthHero({ totalXp, level, disciplinePct, consistencyWeeks }: {
  totalXp: number
  level: { level: number; xpInLevel: number; xpForNext: number } | null
  disciplinePct: number | null
  consistencyWeeks: number
}) {
  const shown = useContinuingCountUp(totalXp)
  const levelPct = level && level.xpForNext > 0 ? Math.min(100, Math.round((level.xpInLevel / level.xpForNext) * 100)) : 0
  const filled = Math.min(WEEK_DOTS, Math.max(0, consistencyWeeks))
  return (
    <div className="gr-hero rise" style={{ '--d': '0ms' } as CSSProperties}>
      <div className="gr-hero-ttl">Growth</div>
      <div className="gr-hero-row">
        <ClayIcon name="i-growth" size={54} className="gr-hero-icon" />
        <div aria-label={`${huInt(totalXp)} XP`}>
          <span className="gr-hero-num">{huInt(shown)}</span>
          <span className="gr-hero-unit">XP</span>
        </div>
      </div>
      <div className="gr-traits">
        {level && (
          <div className="gr-trait">
            <span className="gr-trait-lb">Szint {level.level}</span>
            <div className="gr-tbar"><i className="gold" style={{ '--w': `${levelPct}%`, '--d': '250ms' } as CSSProperties} /></div>
            <span className="gr-trait-val">{huInt(level.xpInLevel)} <small>/ {huInt(level.xpForNext)}</small></span>
          </div>
        )}
        {disciplinePct != null && (
          <div className="gr-trait">
            <span className="gr-trait-lb">Fegyelem</span>
            <div className="gr-tbar"><i className="lav" style={{ '--w': `${Math.min(100, disciplinePct)}%`, '--d': '330ms' } as CSSProperties} /></div>
            <span className="gr-trait-val">{disciplinePct}%</span>
          </div>
        )}
        <div className="gr-trait">
          <span className="gr-trait-lb">Ritmus</span>
          <div className="gr-wdots" aria-hidden="true">
            {Array.from({ length: WEEK_DOTS }, (_, i) => {
              const on = i >= WEEK_DOTS - filled
              return <i key={i} className={[on ? 'on' : '', i === WEEK_DOTS - 1 ? 'now' : ''].join(' ').trim() || undefined}
                style={{ '--d': `${400 + i * 45}ms` } as CSSProperties} />
            })}
          </div>
          <span className="gr-trait-val">{consistencyWeeks} <small>hét</small></span>
        </div>
      </div>
    </div>
  )
}
