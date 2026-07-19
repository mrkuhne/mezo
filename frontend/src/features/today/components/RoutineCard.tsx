import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useHabitDay, useHabitActions } from '@/data/hooks'
import type { HabitItem } from '@/data/types'
import { habitAction } from '@/features/today/logic/habitAction'
import { useLevelUp } from '@/features/progression/LevelUpProvider'
import { LogMealSheet } from '@/features/fuel/sheets/LogMealSheet'
import { daypartNow } from '@/shared/lib/daypart'
import { localDateString } from '@/shared/lib/dates'
import { emitToast } from '@/shared/lib/toastBus'

const STATE_ICON: Record<HabitItem['status'], string> = { pending: '◦', done: '✓', missed: '—' }

/** Daypart-aware routine chains: morning chain in the morning, evening chain in the evening. */
export function RoutineCard() {
  const date = localDateString()
  const { habits, levelUps } = useHabitDay(date)
  const { check, pending, consumeLevelUps } = useHabitActions(date)
  const { showLevelUp } = useLevelUp()
  const navigate = useNavigate()
  const [mealOpen, setMealOpen] = useState(false)
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
      <Link to="/me/growth" className="card row" style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
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

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">{title}</span>
        <span className="eyebrow text-tertiary">{doneOf(chain)}/{chain.length} ma</span>
      </div>
      {chain.map((h) => {
        const action = habitAction(h)
        const glow = h.key === firstPending
        return (
          <div key={h.key} className="row" style={{ alignItems: 'flex-start', gap: 10, padding: '6px 0',
            ...(glow ? { background: 'var(--wash-lav)', borderRadius: 8, padding: '6px 8px' } : {}) }}>
            <span style={{ color: h.status === 'done' ? 'var(--success)' : 'var(--coral)',
              opacity: h.status === 'missed' ? 0.4 : 1, width: 14, textAlign: 'center' }}>
              {STATE_ICON[h.status]}
            </span>
            <div style={{ flex: 1, opacity: h.status === 'missed' ? 0.5 : 1 }}>
              <div className="text-tertiary" style={{ fontSize: 10 }}>{h.anchorCopy}</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{h.title}</div>
            </div>
            <span className="chip" style={{ whiteSpace: 'nowrap' }}>+{h.xp} XP</span>
            {action.kind === 'check' && (
              <button className="chip" disabled={pending} aria-label={`${h.title} pipálása`}
                onClick={() => check(h.key).then((lu) => lu?.[0] && showLevelUp(lu[0]))}>
                Pipa
              </button>
            )}
            {action.kind === 'nav' && (
              <button className="chip" aria-label={`${h.title} logolása`}
                onClick={() => navigate(action.to)}>
                Logolás
              </button>
            )}
            {action.kind === 'meal-sheet' && (
              <button className="chip" aria-label={`${h.title} logolása`}
                onClick={() => setMealOpen(true)}>
                Logolás
              </button>
            )}
          </div>
        )
      })}
      {mealOpen && <LogMealSheet initialSlot="breakfast" onClose={() => setMealOpen(false)} />}
    </div>
  )
}
