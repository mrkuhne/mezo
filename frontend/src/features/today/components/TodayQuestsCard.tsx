import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useActivities, useDailyQuests, useQuestActions, useWaterActions } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { growthTodaySummary } from '@/features/today/logic/growthToday'
import { questAction } from '@/features/today/logic/questAction'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { Icon } from '@/shared/ui/Icon'
import { localDateString } from '@/shared/lib/dates'
import type { DailyQuest } from '@/data/types'

const STATE_ICON: Record<DailyQuest['status'], string> = {
  offered: '◦',
  completed: '✓',
  expired: '—',
  rerolled: '—',
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

  return (
    <div className="card" style={{ margin: '8px 0', padding: '14px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 8 }}>
        <span className="eyebrow">⚡ Napi küldetések</span>
        <Link
          to="/me/growth"
          className="eyebrow text-tertiary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}
        >
          {done}/{total} · +{xp} XP <Icon name="chevron-right" size={12} />
        </Link>
      </div>
      {quests.map(q => {
        const action = q.status === 'offered' ? questAction(q) : null
        const showCta = action !== null && (action.kind !== 'checkin' || onCheckIn !== undefined)
        return (
          <div key={q.id} className="row" style={{ alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span
              aria-hidden
              style={{
                color: q.status === 'completed' ? 'var(--success)' : 'var(--coral)',
                opacity: q.status === 'expired' ? 0.4 : 1,
                width: 14, textAlign: 'center', flexShrink: 0,
              }}
            >
              {STATE_ICON[q.status]}
            </span>
            <div
              style={{
                flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600,
                opacity: q.status === 'expired' ? 0.5 : 1,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}
            >
              {q.title}
            </div>
            {q.status === 'completed' && (
              <span className="chip" style={{ whiteSpace: 'nowrap' }}>+{q.xp} XP</span>
            )}
            {showCta && (
              <button className="chip" onClick={() => run(q)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
