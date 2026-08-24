import { useEffect, useState } from 'react'
import { useDailyQuests, useQuestActions } from '@/data/hooks'
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { DailyQuestList } from '@/features/today/components/DailyQuestList'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'
import type { DailyQuest } from '@/data/types'

/**
 * Napi küldetések (gamified growth E1). Derived quests complete server-side — the card only
 * reads; a completion detected by this read carries a levelUp payload exactly once, which is
 * celebrated in a DS reward toast (mezo-k5sa), never the full-screen overlay. Expired is quiet
 * (ADR 0010 — no failure state).
 */
export function DailyQuestsCard() {
  const date = localDateString()
  const { quests, levelUps, rerollsLeft } = useDailyQuests(date)
  const { reroll, pending, consumeLevelUps } = useQuestActions(date)
  const [activityQuest, setActivityQuest] = useState<DailyQuest | null>(null)

  useEffect(() => {
    if (levelUps.length > 0) {
      const lu = levelUps[0]
      emitToast(buildQuestRewardToast({ title: lu.workoutLabel ?? 'Küldetés teljesítve', levelUp: lu }))
      consumeLevelUps() // clear from the cache — a remount must not replay the celebration
    }
  }, [levelUps, consumeLevelUps])

  if (quests.length === 0) return null
  const doneCount = quests.filter(q => q.status === 'completed').length

  return (
    <div className="card daily-quests-card" style={{ margin: '8px 0', padding: '14px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 8 }}>
        <span className="eyebrow">Napi küldetések</span>
        <span className="eyebrow text-tertiary">{doneCount}/{quests.length} ma</span>
      </div>
      <DailyQuestList
        quests={quests}
        rerollsLeft={rerollsLeft}
        pending={pending}
        actionLabel={(quest) => quest.completionMode === 'ACTIVITY' ? 'Naplózz' : null}
        onAction={setActivityQuest}
        onReroll={reroll}
      />
      {activityQuest && <ActivityLogSheet quest={activityQuest} onClose={() => setActivityQuest(null)} />}
    </div>
  )
}
