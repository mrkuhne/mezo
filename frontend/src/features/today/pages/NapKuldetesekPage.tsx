// ============================================================
// Mezo · NapKuldetesekPage — Napi küldetések detail page (mezo-d20.2.4)
// Source of truth: docs/design_2.0/prototypes/src/nap-body.html #page-quest
// (p-gold tone, hajtás spot hero, quest cards with XP pill + reroll
// affordance, quiet principle line). Absorbs the DailyQuestsSheet surface:
// the data layer (useDailyQuests/useQuestActions) and the smart-action
// dispatch are the hub's, verbatim — ADR 0010 keeps quests OFFERS: no
// failure state, no countdowns, nothing self-completes from the UI.
// ÜVEG (mezo-me75u.3, prototypes/uveg-nap.html `kuldetesek()`): frameless halo hero (3D quest
// + done/n), each quest ONE glass card in its slot hue with the icon in a lit well, a flat-lit
// gold XP pill, a solid pill CTA in the card hue and a ghost "Csere" pill; the completed card
// dims and marks itself with the 3D tick. The empty state is dashed.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon3D, type Icon3DName } from '@/shared/ui/clay'
import { EntranceGroup } from '@/shared/ui/mozaik/motion'
import { MozaikPage, PageBody } from '@/shared/ui/mozaik'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { useCheckins, useDailyQuests, useQuestActions, useWaterActions } from '@/data/hooks'
import { questAction } from '@/features/today/logic/questAction'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import type { DailyQuest, QuestSlot } from '@/data/types'

/** The slot's 3D icon and glass hue (uveg-nap.html `QUESTS`). */
const SLOT_ICON: Record<QuestSlot, Icon3DName> = { BODY: 't-dumbbell', FUELBIO: 't-bowl', GROWTH: 't-journal' }
const SLOT_HUE: Record<QuestSlot, string> = { BODY: 'var(--dv-coral)', FUELBIO: 'var(--dv-sage)', GROWTH: 'var(--dv-lav)' }

/** The card's quiet state line. Offered quests close themselves from real logs
 *  (derived evaluation) — the copy says so; terminal states reuse the sheet's
 *  established labels. Never a failure tone (ADR 0010). */
function stateLine(q: DailyQuest): { text: string; done?: boolean } {
  if (q.status === 'completed') return { text: `kész · +${q.xp} XP jóváírva`, done: true }
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
    <MozaikPage tone="gold" className="nap-quest-page nap-oldal">
      <div className="mz-page-head nap-backrow">
        <button type="button" className="mz-backbtn glass nap-back" onClick={() => navigate(-1)} aria-label="Vissza">
          <b aria-hidden="true">‹</b> Ma
        </button>
      </div>
      <section className="nap-hero uv-halo" style={{ '--c': 'var(--dv-amber)', '--c2': 'var(--dv-coral)' } as React.CSSProperties}>
        <Icon3D name="t-quest" size={86} className="nap-hero-art uv-float" />
        {quests.length > 0 && <div className="nap-hero-num">{done}<small>/{quests.length}</small></div>}
        <div className="nap-hero-nm">Napi küldetések</div>
        <div className="nap-hero-sb">ajánlatok a mai napra</div>
      </section>
      <PageBody principle="A küldetés ajánlat: ha kimarad, csendben lejár — bukás nincs. A Csere naponta egyszer ingyenes.">
        <EntranceGroup className="nq-list">
          {quests.length === 0 ? (
            <div className="nq-empty uv-empty">Ma nincs kisorsolt küldetés.</div>
          ) : quests.map((q, i) => {
            const st = stateLine(q)
            const offered = q.status === 'offered'
            const label = offered ? questActionLabel(q) : null
            return (
              <div key={q.id} className={cn('nq-card glass rise', q.status === 'completed' && 'done')}
                style={{ '--d': `${40 + i * 60}ms`, '--i': i, '--c': SLOT_HUE[q.slot] } as React.CSSProperties}>
                <div className="nq-top">
                  <span className="uv-well nq-well"><Icon3D name={SLOT_ICON[q.slot]} size={34} /></span>
                  <div className="nq-grow">
                    <div className="nq-title">{q.title}</div>
                    <div className="nq-why uv-voice">{q.why}</div>
                  </div>
                  <span className="nq-xp">+{q.xp} XP</span>
                </div>
                <div className="nq-foot">
                  <span className={cn('nq-state', st.done && 'f')}>
                    {st.done
                      ? <Icon3D name="t-tick" size={20} className="nq-state-tick" />
                      : <i className="nq-state-dot" aria-hidden="true" />}
                    {st.text}
                  </span>
                  {label && (
                    <button type="button" className="nq-btn primary np-press" onClick={() => actQuest(q)}>
                      {label}
                    </button>
                  )}
                  {offered && rerollsLeft > 0 && (
                    <button type="button" className="nq-btn np-press" disabled={pending} onClick={() => reroll(q.id)}>
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
