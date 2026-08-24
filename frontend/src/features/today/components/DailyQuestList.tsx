import type { DailyQuest } from '@/data/types'

const STATE_ICON: Record<DailyQuest['status'], string> = {
  offered: '◦',
  completed: '✓',
  expired: '—',
  rerolled: '—',
}

const STATE_LABEL: Record<DailyQuest['status'], string> = {
  offered: 'Elérhető',
  completed: 'Teljesítve',
  expired: 'Lejárt',
  rerolled: 'Újrasorsolva',
}

export function DailyQuestList({
  quests, rerollsLeft, pending, actionLabel, onAction, onReroll,
}: {
  quests: DailyQuest[]
  rerollsLeft: number
  pending: boolean
  actionLabel: (quest: DailyQuest) => string | null
  onAction: (quest: DailyQuest) => void
  onReroll: (questId: string) => void
}) {
  return (
    <div className="td-quest-list">
      {quests.map((quest) => {
        const offered = quest.status === 'offered'
        const label = offered ? actionLabel(quest) : null
        return (
          <div key={quest.id} className={`td-quest-row is-${quest.status}`}>
            <span className="td-quest-state" aria-hidden="true">{STATE_ICON[quest.status]}</span>
            <div className="td-quest-copy">
              <span className="sr-only">{STATE_LABEL[quest.status]}</span>
              <b>{quest.title}</b>
              <span>{quest.why}</span>
              {(label || (offered && rerollsLeft > 0)) && (
                <div className="td-quest-actions">
                  {label && (
                    <button type="button" className="is-primary np-press" onClick={() => onAction(quest)}>
                      {label}
                    </button>
                  )}
                  {offered && rerollsLeft > 0 && (
                    <button type="button" className="np-press" disabled={pending} onClick={() => onReroll(quest.id)}>
                      Csere
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="td-quest-xp">+{quest.xp} XP</span>
          </div>
        )
      })}
    </div>
  )
}
