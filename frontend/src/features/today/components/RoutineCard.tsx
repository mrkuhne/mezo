import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHabitDay, useHabitActions, useSleep } from '@/data/hooks'
import type { HabitItem } from '@/data/types'
import { habitAction, type HabitAction } from '@/features/today/logic/habitAction'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { SleepLogSheet } from '@/features/me/sheets/SleepLogSheet'
import { daypartNow } from '@/shared/lib/daypart'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
const IconPencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
)

/**
 * Daypart-aware routine chains rendered as a single vertical thread — the habit-stacking
 * chain made literal. Only the current (first-pending) habit carries a prominent action; the
 * remaining pending habits stay tappable rows with a quiet chevron (single-next-action focus).
 */
export function RoutineCard() {
  const date = localDateString()
  const { habits, levelUps } = useHabitDay(date)
  const { check, pending, consumeLevelUps } = useHabitActions(date)
  const { logSleep } = useSleep()
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()
  const [mealOpen, setMealOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)
  const daypart = daypartNow()

  // surface a completion's level-up exactly once
  useEffect(() => {
    if (levelUps.length > 0) {
      showLevelUp(levelUps[0])
      consumeLevelUps()
    }
  }, [levelUps, showLevelUp, consumeLevelUps])

  const morning = habits.filter((h) => h.chain === 'MORNING')
  const evening = habits.filter((h) => h.chain === 'EVENING')
  const chain = daypart === 'este' ? evening : morning
  const title = daypart === 'este' ? 'Esti rutin' : 'Reggeli rutin'
  const doneOf = (list: HabitItem[]) => list.filter((h) => h.status === 'done').length

  // quiet celebration when the visible chain just completed
  const wasComplete = useRef(false)
  const complete = chain.length > 0 && chain.every((h) => h.status === 'done')
  useEffect(() => {
    if (complete && !wasComplete.current) {
      emitToast({ kind: 'success', text: daypart === 'este' ? '🌙 Tökéletes este' : '🌅 Tökéletes reggel' })
    }
    wasComplete.current = complete
  }, [complete, daypart])

  if (habits.length === 0) {
    return null // honest ghost: switch off / real mode before data
  }

  if (daypart === 'delutan') {
    return (
      <Link to="/me/growth" className="card row"
        style={{ alignItems: 'center', gap: 10, padding: '14px 16px', margin: '8px 0', textDecoration: 'none' }}>
        <span aria-hidden="true">🔁</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
          Reggeli rutin {doneOf(morning)}/{morning.length}
        </span>
        <span className="text-tertiary" style={{ fontSize: 11 }}>
          este: {doneOf(evening)}/{evening.length}
        </span>
      </Link>
    )
  }

  const firstPending = chain.find((h) => h.status === 'pending')?.key
  const earnedXp = chain.filter((h) => h.status === 'done').reduce((sum, h) => sum + h.xp, 0)

  const runAction = (h: HabitItem, action: HabitAction) => {
    if (action.kind === 'check') {
      check(h.key).then((lu) => lu?.[0] && showLevelUp(lu[0]))
    } else if (action.kind === 'nav') {
      navigate(action.to)
    } else if (action.kind === 'meal-sheet') {
      setMealOpen(true)
    } else if (action.kind === 'sleep-sheet') {
      setSleepOpen(true)
    }
  }

  const renderRow = (h: HabitItem) => {
    const action = habitAction(h)
    const isCheck = action.kind === 'check'
    const hasAction = action.kind !== 'none'
    const ariaLabel = isCheck ? `${h.title} pipálása` : `${h.title} logolása`
    const nodeCls =
      h.status === 'done' ? 'hab-node done' : h.key === firstPending ? 'hab-node now' : 'hab-node'
    const node = <span className={nodeCls} />
    const main = (
      <div className="hab-main">
        <div className="hab-anchor">{h.anchorCopy}</div>
        <div className="hab-title">{h.title}</div>
      </div>
    )

    // done / missed — static, no affordance
    if (h.status !== 'pending') {
      return (
        <div key={h.key} className={`hab-row ${h.status}`}>
          {node}
          {main}
          <div className="hab-right">
            {h.status === 'done' ? (
              <span className="hab-earned"><IconCheck />+{h.xp}</span>
            ) : (
              <span className="hab-xp">+{h.xp}</span>
            )}
          </div>
        </div>
      )
    }

    // current habit — the one prominent action (none for passively-derived habits)
    if (h.key === firstPending) {
      return (
        <div key={h.key} className="hab-row now">
          {node}
          {main}
          <div className="hab-right">
            <span className="hab-xp">+{h.xp}</span>
            {hasAction && (
              <button className="hab-act" disabled={pending} aria-label={ariaLabel}
                onClick={() => runAction(h, action)}>
                {isCheck ? <IconCheck /> : <IconPencil />}
                {isCheck ? 'Pipa' : 'Napló'}
              </button>
            )}
          </div>
        </div>
      )
    }

    // downstream pending with no user surface — a plain, non-tappable row
    if (!hasAction) {
      return (
        <div key={h.key} className="hab-row">
          {node}
          {main}
          <div className="hab-right"><span className="hab-xp">+{h.xp}</span></div>
        </div>
      )
    }

    // downstream pending — the whole row is tappable, a quiet chevron hints at the action
    return (
      <button key={h.key} className="hab-row" disabled={pending} aria-label={ariaLabel}
        onClick={() => runAction(h, action)}>
        {node}
        {main}
        <div className="hab-right">
          <span className="hab-xp">+{h.xp}</span>
          <span className="hab-chev"><IconChevron /></span>
        </div>
      </button>
    )
  }

  return (
    <div className="card" style={{ padding: '14px 16px', margin: '8px 0' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span className="eyebrow">{title}</span>
        <span className="eyebrow text-tertiary">{doneOf(chain)}/{chain.length} ma · +{earnedXp} XP</span>
      </div>
      <div className="hab-chain">{chain.map(renderRow)}</div>
      {mealOpen && <LogMealSheet initialSlot="breakfast" onClose={() => setMealOpen(false)} />}
      {sleepOpen && <SleepLogSheet onClose={() => setSleepOpen(false)} onSave={logSleep} />}
    </div>
  )
}
