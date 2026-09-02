// ============================================================
// Mezo · MaStrip (mezo-rmi0.1) — the Growth hub's "Ma" strip, prototype growth-tab.html
// `.mastrip`. Replaces the two legacy cards (DailyQuestsCard + ActivityLogCard) on Growth
// with one strip: head (`Ma · d/n küldetés` + today XP chip → /nap/kuldetesek) and a
// wrapping chip row — one chip per quest (done sage ✓ · open neutral · expired dashed
// "csendben lejárt", never terracotta), one ✎ chip per activity, and `＋ Tevékenység`
// that opens the real ActivityLogSheet in place. No explicit "done" exists in the domain:
// DERIVED quests close from the logs (an open chip just goes to the quest page), an
// ACTIVITY-mode chip opens the sheet with the quest — the DailyQuestList "Naplózz" path.
// The consume-once level-up toast moves here verbatim (DailyQuestsCard's effect).
// ============================================================
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActivities, useDailyQuests, useQuestActions } from '@/data/hooks'
import type { DailyQuest } from '@/data/types'
import { buildQuestRewardToast } from '@/features/progression/logic/rewardToast'
import { ActivityLogSheet } from '@/features/today/sheets/ActivityLogSheet'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'

const trim = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export function MaStrip() {
  const navigate = useNavigate()
  const date = localDateString()
  const { quests, levelUps } = useDailyQuests(date)
  const { consumeLevelUps } = useQuestActions(date)
  const { data: activities } = useActivities(date)
  const [sheet, setSheet] = useState<{ quest: DailyQuest | null } | null>(null)

  useEffect(() => {
    if (levelUps.length > 0) {
      const lu = levelUps[0]
      emitToast(buildQuestRewardToast({ title: lu.workoutLabel ?? 'Küldetés teljesítve', levelUp: lu }))
      consumeLevelUps()
    }
  }, [levelUps, consumeLevelUps])

  const done = quests.filter((q) => q.status === 'completed')
  const xp = done.reduce((s, q) => s + q.xp, 0) + activities.reduce((s, a) => s + a.xpAwarded, 0)
  const goQuests = () => navigate('/nap/kuldetesek')

  const questChip = (q: DailyQuest) => {
    if (q.status === 'completed') {
      return <span key={q.id} className="gr-chip done"><span className="gr-chip-mk" aria-hidden="true">✓</span>{trim(q.title)}</span>
    }
    if (q.status === 'expired' || q.status === 'rerolled') {
      return <span key={q.id} className="gr-chip gone" aria-disabled="true"><span className="gr-chip-mk" aria-hidden="true" />{trim(q.title, 20)} · csendben lejárt</span>
    }
    const onClick = q.completionMode === 'ACTIVITY' ? () => setSheet({ quest: q }) : goQuests
    return (
      <button key={q.id} type="button" className="gr-chip open" aria-label={q.title} onClick={onClick}>
        <span className="gr-chip-mk" aria-hidden="true" />{trim(q.title)}
      </button>
    )
  }

  return (
    <div className="gr-ma rise" style={{ '--d': '90ms' } as CSSProperties}>
      <button type="button" className="gr-ma-head" aria-label="Küldetések · a Nap fülön" onClick={goQuests}>
        <span className="mz-eyebrow">Ma · <span>{done.length}/{quests.length}</span> küldetés</span>
        <span className="gr-ma-xp">+{xp} XP</span>
        <span className="gr-ma-chev" aria-hidden="true">›</span>
      </button>
      {quests.length === 0 && (
        <div className="gr-ma-empty">Ma még nincs küldetés — <b>a reggeli briefinggel jön.</b> Tevékenységet közben is logolhatsz.</div>
      )}
      <div className="gr-chips">
        {quests.map(questChip)}
        {activities.map((a) => (
          <span key={a.id} className="gr-chip act"><span className="gr-chip-mk" aria-hidden="true">✎</span>{trim(a.text, 22)}{a.xpAwarded > 0 ? ` · +${a.xpAwarded}` : ''}</span>
        ))}
        <button type="button" className="gr-chip add" onClick={() => setSheet({ quest: null })}>＋ Tevékenység</button>
      </div>
      {sheet && <ActivityLogSheet quest={sheet.quest ?? undefined} onClose={() => setSheet(null)} />}
    </div>
  )
}
