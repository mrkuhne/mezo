import { useEffect } from 'react'
import { useDailyQuests, useQuestActions } from '@/data/hooks'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { localDateString } from '@/shared/lib/dates'
import type { DailyQuest } from '@/data/types'

const STATE_ICON: Record<DailyQuest['status'], string> = {
  offered: '◦',
  completed: '✓',
  expired: '—',
  rerolled: '—',
}

/**
 * Napi küldetések (gamified growth E1). Derived quests complete server-side — the card only
 * reads; a completion detected by this read carries a levelUp payload exactly once, which is
 * handed to the global overlay. Expired is quiet (ADR 0010 — no failure state).
 */
export function DailyQuestsCard() {
  const date = localDateString()
  const { quests, levelUps, rerollsLeft } = useDailyQuests(date)
  const { reroll, pending, consumeLevelUps } = useQuestActions(date)
  const { showLevelUp } = useLevelUp()

  useEffect(() => {
    if (levelUps.length > 0) {
      showLevelUp(levelUps[0])
      consumeLevelUps() // clear from the cache — a remount must not replay the celebration
    }
  }, [levelUps, showLevelUp, consumeLevelUps])

  if (quests.length === 0) return null
  const doneCount = quests.filter(q => q.status === 'completed').length

  return (
    <div className="card" style={{ margin: '8px 24px', padding: '14px 16px' }}>
      <div className="row" style={{ justifyContent: 'space-between', paddingBottom: 8 }}>
        <span className="eyebrow">Napi küldetések</span>
        <span className="eyebrow text-tertiary">{doneCount}/{quests.length} ma</span>
      </div>
      {quests.map(q => (
        <div key={q.id} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0' }}>
          <span style={{
            color: q.status === 'completed' ? 'var(--success)' : 'var(--brand-glow)',
            opacity: q.status === 'expired' ? 0.4 : 1,
            width: 14, textAlign: 'center',
          }}>
            {STATE_ICON[q.status]}
          </span>
          <div style={{ flex: 1, opacity: q.status === 'expired' ? 0.5 : 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{q.title}</div>
            <div className="text-tertiary" style={{ fontSize: 11, paddingTop: 2 }}>{q.why}</div>
          </div>
          <span className="chip notch-4" style={{ whiteSpace: 'nowrap' }}>+{q.xp} XP</span>
          {q.status === 'offered' && rerollsLeft > 0 && (
            <button
              className="chip notch-4"
              disabled={pending}
              onClick={() => reroll(q.id)}
              style={{ cursor: 'pointer' }}
            >
              Csere
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
