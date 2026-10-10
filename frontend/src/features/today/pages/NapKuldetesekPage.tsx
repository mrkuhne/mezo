// ============================================================
// Mezo · NapKuldetesekPage — Napi küldetések detail page (mezo-d20.2.4; Folyadék mezo-n4wf5.2,
// prototype vilagos/nap.js `kuldetesek()`).
// Vessels that fill on their own: the hero holds one vial per quest (full once it is done — a
// quest has no partial progress, so an open one shows a sliver), then the offers as rows with
// their state line, a level, the smart action and the „Csere”. The data layer
// (useDailyQuests/useQuestActions) and the smart-action dispatch are the hub's, verbatim —
// ADR 0010 keeps quests OFFERS: no failure state, no countdowns, nothing self-completes from the UI.
// ============================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Icon3DName } from '@/shared/ui/clay'
import { localDateString } from '@/shared/lib/dates'
import { useCheckins, useDailyQuests, useQuestActions, useWaterActions } from '@/data/hooks'
import { questAction } from '@/features/today/logic/questAction'
import { isFillableSlot } from '@/features/today/logic/todayItems'
import { CheckInSheet } from '@/features/today/sheets/CheckInSheet'
import type { DailyQuest, QuestSlot } from '@/data/types'
import { Btn, Card, Empty, FrameBack, Hero, Level, Lk, Note, Page, Row, Section, St, Vials } from '@/shared/ui/folyadek'

/** The slot's glyph and its short name under the vial. */
const SLOT_ICON: Record<QuestSlot, Icon3DName> = { BODY: 't-dumbbell', FUELBIO: 't-bowl', GROWTH: 't-journal' }
const SLOT_LABEL: Record<QuestSlot, string> = { BODY: 'Test', FUELBIO: 'Étkezés', GROWTH: 'Fejlődés' }

/** An open quest has no partial progress: its vessel shows a sliver, a done one is full. */
const OPEN_PCT = 6

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

/** The vial's one-word state under the slot name. */
const VIAL_NOTE: Record<DailyQuest['status'], string> = {
  completed: 'jóváírva', offered: 'folyamatban', expired: 'lejárt', rerolled: 'újrasorsolva',
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
  // The hero's one button: the smart action of the first open offer that has one. Its label is
  // spelled out (the row's own button keeps the short one).
  const firstOpen = quests.find((q) => q.status === 'offered' && questActionLabel(q) != null)
  const heroLabel = firstOpen
    ? (questAction(firstOpen)?.kind === 'water' ? `${questActionLabel(firstOpen)} víz` : `${questActionLabel(firstOpen)} megnyitása`)
    : null

  const foot = (
    <Note>A küldetés ajánlat: ha kimarad, csendben lejár, bukás nincs. A Csere naponta egyszer ingyenes.</Note>
  )
  const sheet = checkInIdx !== null && (
    <CheckInSheet slot={checkins[checkInIdx]} slotIdx={checkInIdx}
      onClose={() => setCheckInIdx(null)} onSave={(d) => saveCheckIn(checkInIdx, d)} />
  )
  const back = <FrameBack history className="nb-back" onBack={() => navigate(-1)}>‹ Ma</FrameBack>

  if (quests.length === 0) {
    return (
      <Page className="nb-page">
        {back}
        <Hero label="Mai ajánlatok" verdict="Ma nincs kisorsolt küldetés."
          sub="Holnap reggel új ajánlatok érkeznek. Addig a napod a szokott rendben megy."
          actions={<Btn onClick={() => navigate('/nap')}>Vissza a mai napra</Btn>}>
          <Vials size="sm" height={116} className="nb-vials"
            items={[0, 1, 2].map(() => ({ label: 'holnap', value: '–', pct: 0, mark: 'üres', color: 'var(--fo-faint)' }))} />
        </Hero>
        <Section n={1} title="Mai ajánlatok" />
        <Card><Empty icon="t-quest">Nincs mára küldetés.</Empty></Card>
        {foot}
        {sheet}
      </Page>
    )
  }

  return (
    <Page className="nb-page">
      {back}
      <Hero label={`Mai ajánlatok · +${quests.reduce((sum, q) => sum + q.xp, 0)} XP`}
        verdict={`${done} kész a ${quests.length} ajánlatból.`}
        sub="A többi magától telik, ahogy a napod halad."
        actions={firstOpen && heroLabel ? <Btn onClick={() => actQuest(firstOpen)}>{heroLabel}</Btn> : undefined}>
        <Vials size="sm" height={116} className="nb-vials" items={quests.map((q) => {
          const isDone = q.status === 'completed'
          return {
            label: SLOT_LABEL[q.slot], note: VIAL_NOTE[q.status], icon: SLOT_ICON[q.slot], value: `+${q.xp} XP`,
            pct: isDone ? 100 : OPEN_PCT, mark: isDone ? <span className="nb-full">kész</span> : undefined, color: isDone ? 'var(--fo-ok)' : undefined,
          }
        })} />
      </Hero>
      <Section n={1} title="Mai ajánlatok" />
      <Card className="nb-quests">
        {quests.map((q) => {
          const st = stateLine(q)
          const offered = q.status === 'offered'
          const label = offered ? questActionLabel(q) : null
          const canSwap = offered && rerollsLeft > 0
          return (
            <Row key={q.id} as="div" className={st.done ? 'nb-quest done' : 'nb-quest'} icon={SLOT_ICON[q.slot]} title={q.title}
              sub={<><span className="nb-why">{q.why}</span><span className="nb-state">{st.text}</span></>}
              right={st.done ? <St tone="ok">Kész</St> : <St tone="plan">{`+${q.xp} XP`}</St>}
              more={(
                <>
                  <Level pct={st.done ? 100 : OPEN_PCT} height={8} color={st.done ? 'var(--fo-ok)' : undefined} />
                  {(label || canSwap) && (
                    <span className="nb-inacts">
                      {label && <Btn sm ghost onClick={() => actQuest(q)}>{label}</Btn>}
                      {canSwap && <Lk disabled={pending} onClick={() => reroll(q.id)}>Csere · {rerollsLeft} maradt</Lk>}
                    </span>
                  )}
                </>
              )} />
          )
        })}
      </Card>
      {foot}
      {sheet}
    </Page>
  )
}
