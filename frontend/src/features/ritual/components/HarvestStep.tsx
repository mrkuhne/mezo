import { useMemo } from 'react'
import { useGamificationDay, useProgressionProfile } from '@/data/hooks'
import { CHIP_ICON_BY_SOURCE, skillDisplay } from '@/features/progression/logic/levelUpMeta'
import { harvestStages } from '@/features/ritual/logic/harvestStages'
import { CountUp } from '@/shared/ui/CountUp'
import { localDateString } from '@/shared/lib/dates'

type KnownSource = 'GYM' | 'RUN' | 'SPORT' | 'QUEST' | 'ACTIVITY' | 'HABIT'

// HU chip label per source — icons are reused from levelUpMeta's CHIP_ICON_BY_SOURCE (the
// same map the LevelUpScreen chip uses). GamificationDay.xpBySource[].source is the closed
// XpEventType union, but it has 5 members OTHER than the ones mapped here (MEAL/WEIGHT/
// SLEEP/CHECKIN/MEDICATION) — those are defensively skipped rather than rendered unlabelled.
const SOURCE_LABEL_HU: Record<KnownSource, string> = {
  QUEST: 'Küldetések',
  HABIT: 'Rutin',
  ACTIVITY: 'Napló',
  GYM: 'Edzés',
  RUN: 'Futás',
  SPORT: 'Sport',
}

function isKnownSource(source: string): source is KnownSource {
  return Object.prototype.hasOwnProperty.call(SOURCE_LABEL_HU, source)
}

const CONFETTI_LEFT = ['12%', '22%', '31%', '40%', '49%', '58%', '67%', '76%', '85%', '93%']
const CONFETTI_COLOR = ['var(--lav)', 'var(--amber)', 'var(--sage)', 'var(--coral)']

const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/**
 * Napzárás act 4 — A mai termés (mezo-ilsj, spec §4, Task 6). The choreography peak: an XP
 * count-up (the shared `CountUp` primitive), per-source + coin chips, an optional LIFE
 * skill highlight, the streak flame, and a one-shot confetti burst — all staggered via
 * `harvestStages()`'s fixed cadence, applied as inline `animationDelay`.
 *
 * Skill hint honesty: the spec's "még N XP a Lv M-ig" hint is DELIBERATELY DROPPED.
 * `SkillLevel` (the wire type) only carries `level` + `progressPct` (the within-level
 * fill) — no per-skill xp-to-next-level curve. `gamification/levelCurve.ts`'s `xpToNext`
 * is the ACCOUNT level curve (spec §5.2), not a per-skill one, and nowhere else in the FE
 * (SkillBandCard, GrowthPage) derives a skill "N XP to next level" figure either.
 * Fabricating N from progressPct alone would require an assumed xp-per-level that the FE
 * cannot honestly know — so this renders only the bar + `Lv N` (the honest-absence rule),
 * never a made-up count. The title-unlock beat is deferred too (see Task 8's doc note).
 *
 * Streak read: from `useGamificationDay(date)`, NOT `useGamification()`. `GamificationDay`
 * carries its own `streakDays`/`streakAlive` — its type doc comment ties them explicitly to
 * "the ritual Harvest read" — and the two mocks deliberately diverge (the day seed: 12/
 * alive vs. the account profile mock: 6/alive), so the Harvest act reports the day's own
 * snapshot, not the (potentially stale-relative-to-today) account-level read.
 */
export function HarvestStep({ onNext }: { onNext: () => void }) {
  const date = localDateString()
  const { data: day } = useGamificationDay(date)
  const { data: progression } = useProgressionProfile()

  const visibleSources = day.xpBySource.filter(
    (e): e is { source: KnownSource; xp: number } => isKnownSource(e.source),
  )

  // The LIFE skill with the highest within-level progress that hasn't already maxed out.
  const skill = useMemo(
    () => [...progression.life].filter((s) => s.progressPct < 100).sort((a, b) => b.progressPct - a.progressPct)[0] ?? null,
    [progression.life],
  )

  const stages = harvestStages({
    sources: visibleSources.length,
    coins: day.coinEvents.length,
    hasSkillHighlight: skill != null,
  })
  const xpStage = stages.find((s) => s.kind === 'xp-total')!
  const sourceStages = stages.filter((s) => s.kind === 'source')
  const coinStages = stages.filter((s) => s.kind === 'coin')
  const skillStage = stages.find((s) => s.kind === 'skill')
  const streakStage = stages.find((s) => s.kind === 'streak')!

  return (
    <div className="rz-act rz-harvest">
      {day.xpTotal > 0 && (
        <div className="rz-conf" aria-hidden="true">
          {CONFETTI_LEFT.map((left, i) => (
            <i
              key={left}
              style={{
                left,
                background: CONFETTI_COLOR[i % CONFETTI_COLOR.length],
                // Bursts around the finale (the streak beat), not at t=0 — the choreography's
                // last stage, not a literal copy of the pre-harvestStages() mockup timing.
                animationDelay: `${streakStage.delayMs + (i % 5) * 60}ms`,
              }}
            />
          ))}
        </div>
      )}

      {/* mezo-tr5v: the reward block centers vertically; the CTA below stays pinned to the bottom. */}
      <div className="rz-harvest-body">
      <div className="rz-xp-wrap np-anim" style={{ animationDelay: `${xpStage.delayMs}ms` }}>
        <div className="rz-story-eyebrow">A MAI TERMÉS</div>
        <CountUp to={day.xpTotal} className="rz-xp-num" />
        <div className="rz-xp-unit">XP ma</div>
      </div>

      {visibleSources.length > 0 && (
        <div className="rz-src-row">
          {visibleSources.map((s, i) => (
            <span
              key={s.source}
              className="rz-chip rz-pop"
              style={{ animationDelay: `${sourceStages[i].delayMs}ms` }}
            >
              {CHIP_ICON_BY_SOURCE[s.source]} {SOURCE_LABEL_HU[s.source]} +{s.xp}
            </span>
          ))}
        </div>
      )}

      {day.coinEvents.length > 0 && (
        <div className="rz-coin-row">
          {day.coinEvents.map((c, i) => (
            <span
              key={`${c.reason}-${i}`}
              className="rz-coin-chip rz-pop"
              style={{ animationDelay: `${coinStages[i].delayMs}ms` }}
            >
              🪙 +{c.amount}
            </span>
          ))}
        </div>
      )}

      {skill && skillStage && (() => {
        const meta = skillDisplay(skill.skillKey, 'LIFE')
        return (
          <div className="rz-skill-row np-anim" style={{ animationDelay: `${skillStage.delayMs}ms` }}>
            <span aria-hidden="true">{meta.icon}</span> {meta.name} — <span className="rz-skill-lv">Lv {skill.level}</span>
            <div className="rz-skill-bar">
              <i style={{ width: `${clampPct(skill.progressPct)}%` }} />
            </div>
          </div>
        )
      })()}

      <div
        className={day.streakAlive ? 'rz-streak np-anim' : 'rz-streak np-anim dim'}
        style={{ animationDelay: `${streakStage.delayMs}ms` }}
      >
        🔥 {day.streakDays} napos sorozat{day.streakAlive ? ' él' : ' — megszakadt'}
      </div>
      </div>

      <button className="rz-cta" onClick={onNext}>Tovább</button>
    </div>
  )
}
