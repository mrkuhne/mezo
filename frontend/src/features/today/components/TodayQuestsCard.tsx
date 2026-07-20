import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useActivities, useDailyQuests, useQuestActions, useWaterActions } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { growthTodaySummary } from '@/features/today/logic/growthToday'
import { questAction } from '@/features/today/logic/questAction'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import type { DailyQuest, QuestSlot } from '@/data/types'

/** A row's two-token colour family — drives every tinted surface via inline custom props. */
type QuestFamily = { accent: string; text: string }

/** Domain hue per quest slot (offered rows). Completed → sage, expired → muted (below). */
const SLOT_FAMILY: Record<QuestSlot, QuestFamily> = {
  BODY: { accent: 'var(--coral)', text: 'var(--coral-deep)' },
  FUELBIO: { accent: 'var(--amber)', text: 'var(--amber-deep)' },
  GROWTH: { accent: 'var(--lav)', text: 'var(--lav-deep)' },
}
const DONE_FAMILY: QuestFamily = { accent: 'var(--sage)', text: 'var(--sage-deep)' }
const MUTED_FAMILY: QuestFamily = { accent: 'var(--faint)', text: 'var(--text-tertiary)' }

/** Completed reads as achieved (sage) regardless of domain; expired stays quiet (ADR 0010). */
function questFamily(q: DailyQuest): QuestFamily {
  if (q.status === 'completed') return DONE_FAMILY
  if (q.status === 'offered') return SLOT_FAMILY[q.slot] ?? SLOT_FAMILY.BODY
  return MUTED_FAMILY
}

interface TodayQuestsCardProps {
  /** Opens the next open check-in slot's sheet; undefined → the checkin CTA is hidden. */
  onCheckIn?: () => void
}

/**
 * Today's compact quest card (action-first re-composition, mezo-gj2y): the 3 daily quests
 * with ONE smart log-CTA per offered row (questAction mapping) — Today = act, Growth = manage
 * (reroll + why lines live on /me/growth's full DailyQuestsCard). The header carries the
 * retired GrowthTodayRow's job: done/total + combined quest+activity XP, linking to /me/growth.
 * ADR 0010: no CTA ever completes a quest — it opens/performs the underlying log.
 */
export function TodayQuestsCard({ onCheckIn }: TodayQuestsCardProps) {
  const date = localDateString()
  const { quests, levelUps } = useDailyQuests(date)
  const { data: entries } = useActivities(date)
  const { consumeLevelUps } = useQuestActions(date)
  const { logWater } = useWaterActions(date)
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()
  const [activityQuest, setActivityQuest] = useState<DailyQuest | null>(null)

  useEffect(() => {
    if (levelUps.length > 0) {
      showLevelUp(levelUps[0])
      consumeLevelUps() // clear from the cache — a remount must not replay the celebration
    }
  }, [levelUps, showLevelUp, consumeLevelUps])

  if (quests.length === 0) return null
  const { done, total, xp } = growthTodaySummary(quests, entries)

  const run = (q: DailyQuest) => {
    const action = questAction(q)
    if (!action) return
    if (action.kind === 'water') logWater(action.amountMl)
    else if (action.kind === 'checkin') onCheckIn?.()
    else if (action.kind === 'activity') setActivityQuest(q)
    else navigate(action.to)
  }

  const pct = Math.round((done / total) * 100)

  return (
    <div className="card" style={{ margin: '8px 0', padding: '14px 16px' }}>
      <div className="quests-head">
        <span className="eyebrow">⚡ Napi küldetések</span>
        <Link
          to="/me/growth"
          className="eyebrow text-tertiary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}
        >
          {done}/{total} · +{xp} XP <Icon name="chevron-right" size={12} />
        </Link>
      </div>
      <div className="quests-progress" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>
      {quests.map(q => {
        const action = q.status === 'offered' ? questAction(q) : null
        const showCta = action !== null && (action.kind !== 'checkin' || onCheckIn !== undefined)
        const fam = questFamily(q)
        const done_ = q.status === 'completed'
        return (
          <div
            key={q.id}
            className={cn('quest-row', q.status === 'expired' && 'is-expired')}
            style={{ '--q-accent': fam.accent, '--q-text': fam.text } as CSSProperties}
          >
            <span className={cn('quest-disc', done_ && 'is-done')} aria-hidden>
              {done_ ? '✓' : <i className="quest-pip" />}
            </span>
            <div className="quest-title">{q.title}</div>
            {done_ && <span className="quest-xp">+{q.xp} XP</span>}
            {showCta && (
              <button className="quest-cta" onClick={() => run(q)}>
                {action.label}
              </button>
            )}
          </div>
        )
      })}
      {activityQuest && <ActivityLogSheet quest={activityQuest} onClose={() => setActivityQuest(null)} />}
    </div>
  )
}
