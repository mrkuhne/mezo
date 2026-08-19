import { DailyQuestList } from '@/features/today/components/DailyQuestList'
import { questAction } from '@/features/today/logic/questAction'
import { Sheet } from '@/shared/ui/Sheet'
import type { DailyQuest } from '@/data/types'

export function DailyQuestsSheet({
  quests, rerollsLeft, pending, actionLabel, onQuestAction, onReroll, onClose,
}: {
  quests: DailyQuest[]
  rerollsLeft: number
  pending: boolean
  actionLabel?: (quest: DailyQuest) => string | null
  onQuestAction: (quest: DailyQuest) => void
  onReroll: (questId: string) => void
  onClose: () => void
}) {
  const done = quests.filter((quest) => quest.status === 'completed').length
  const xp = quests
    .filter((quest) => quest.status === 'completed')
    .reduce((sum, quest) => sum + quest.xp, 0)
  const progress = quests.length === 0 ? 0 : Math.round((done / quests.length) * 100)

  return (
    <Sheet className="td-quest-sheet" onClose={onClose} labelledBy="daily-quests-title">
      {(close) => (
        <>
          <div className="td-sheet-h">
            <h2 id="daily-quests-title">Napi küldetések</h2>
            <button type="button" onClick={close}>Kész</button>
          </div>
          {quests.length === 0 ? (
            <div className="td-quest-empty">Ma nincs kisorsolt küldetés.</div>
          ) : (
            <>
              <div className="td-quest-summary">
                <span>{done}/{quests.length} teljesítve</span>
                <span>+{xp} XP ma</span>
              </div>
              <div
                className="td-quest-progress"
                role="progressbar"
                aria-label="Küldetések készültsége"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <DailyQuestList
                quests={quests}
                rerollsLeft={rerollsLeft}
                pending={pending}
                actionLabel={actionLabel ?? ((quest) => questAction(quest)?.label ?? null)}
                onAction={onQuestAction}
                onReroll={onReroll}
              />
              <div className="td-quest-foot">
                {rerollsLeft > 0
                  ? `Még ${rerollsLeft} újrasorsolásod maradt mára`
                  : 'A mai újrasorsolást felhasználtad'}
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
