// ============================================================
// Mezo · NapKuldetesekPage — Napi küldetések detail page (mezo-d20.2.4)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html #page-quest
// (p-gold tone, hajtás spot hero, quest cards with XP pill + reroll
// affordance, quiet principle line). Absorbs the DailyQuestsSheet surface:
// the data layer (useDailyQuests/useQuestActions) and the smart-action
// dispatch are the hub's, verbatim — ADR 0010 keeps quests OFFERS: no
// failure state, no countdowns, nothing self-completes from the UI.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClayIcon, ClaySpot, type ClayIconName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody, PageHead } from '@/shared/ui/mozaik'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { useCheckins, useDailyQuests, useQuestActions, useWaterActions } from '@/data/hooks'
import { questAction } from '@/features/today/logic/questAction'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import type { DailyQuest, QuestSlot } from '@/data/types'

const SLOT_ICON: Record<QuestSlot, ClayIconName> = { BODY: 'i-edzes', FUELBIO: 'i-fuel', GROWTH: 'i-naplo' }

/** The card's quiet state line. Offered quests close themselves from real logs
 *  (derived evaluation) — the copy says so; terminal states reuse the sheet's
 *  established labels. Never a failure tone (ADR 0010). */
function stateLine(q: DailyQuest): { text: string; done?: boolean } {
  if (q.status === 'completed') return { text: `✓ kész · +${q.xp} XP jóváírva`, done: true }
  if (q.status === 'expired') return { text: 'Lejárt' }
  if (q.status === 'rerolled') return { text: 'Újrasorsolva' }
  return {
    text: q.metric === 'gym_session_done'
      ? 'folyamatban · az edzésből záródik magától'
      : 'folyamatban · a logjaidból záródik magától',
  }
}

export function NapKuldetesekPage() {
  const date = localDateString()
  const navigate = useNavigate()
  const { quests, rerollsLeft } = useDailyQuests(date)
  const { reroll, pending } = useQuestActions(date)
  const { logWater } = useWaterActions(date)
  const { checkins, saveCheckIn } = useCheckins()
  const [checkInIdx, setCheckInIdx] = useState<number | null>(null)

  const nextCheckInIdx = checkins.findIndex(isFillableSlot)
  const openCheckIn = () => { if (nextCheckInIdx >= 0) setCheckInIdx(nextCheckInIdx) }

  // Smart-action dispatch — NapHubPage's actQuest/questActionLabel, verbatim
  // (only the checkin branch differs: the sheet opens here, on this page).
  const actQuest = (quest: DailyQuest) => {
    const qa = questAction(quest)
    if (!qa) return
    if (qa.kind === 'water') return logWater(qa.amountMl)
    if (qa.kind === 'checkin') return openCheckIn()
    if (qa.kind === 'activity') return // the activity log lives behind the quick-log FAB
    return navigate(qa.to)
  }
  const questActionLabel = (quest: DailyQuest) => {
    const qa = questAction(quest)
    if (!qa || qa.kind === 'activity') return null
    if (qa.kind === 'checkin' && nextCheckInIdx < 0) return null
    return qa.label
  }

  const done = quests.filter((q) => q.status === 'completed').length

  return (
    <MozaikPage tone="gold" className="nap-quest-page">
      <PageHead label="‹ Ma" onBack={() => navigate(-1)} />
      <div className="mz-page-hero">
        <ClaySpot name="s-hajtas" size={71} />
        {quests.length > 0 && <div className="mz-bignum">{done}/{quests.length}</div>}
        <div className="mz-hero-nm">Napi küldetések</div>
        <div className="mz-hero-sb">ajánlatok a mai napra</div>
      </div>
      <PageBody principle="A küldetés ajánlat: ha kimarad, csendben lejár — bukás nincs. A Csere naponta egyszer ingyenes.">
        <EntranceGroup>
          {quests.length === 0 ? (
            <div className="mz-quest-empty">Ma nincs kisorsolt küldetés.</div>
          ) : quests.map((q, i) => {
            const st = stateLine(q)
            const offered = q.status === 'offered'
            const label = offered ? questActionLabel(q) : null
            return (
              <div key={q.id} className={cn('mz-qcard rise', q.status === 'completed' && 'done')}
                style={{ '--d': `${40 + i * 60}ms` } as React.CSSProperties}>
                <div className="mz-qrow">
                  <ClayIcon name={SLOT_ICON[q.slot]} size={31} />
                  <div className="mz-qgrow">
                    <div className="mz-qtitle">{q.title}</div>
                    <div className="mz-qwhy">{q.why}</div>
                  </div>
                  <span className="mz-qxp">+{q.xp} XP</span>
                </div>
                <div className="mz-qfoot">
                  <span className={cn('mz-qstate', st.done && 'f')}>{st.text}</span>
                  {label && (
                    <button type="button" className="mz-qbtn primary np-press" onClick={() => actQuest(q)}>
                      {label}
                    </button>
                  )}
                  {offered && rerollsLeft > 0 && (
                    <button type="button" className="mz-qbtn np-press" disabled={pending} onClick={() => reroll(q.id)}>
                      Csere · {rerollsLeft} maradt
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </EntranceGroup>
      </PageBody>
      {checkInIdx !== null && (
        <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx}
          onClose={() => setCheckInIdx(null)} onSave={(d) => saveCheckIn(checkInIdx, d)} />
      )}
    </MozaikPage>
  )
}
