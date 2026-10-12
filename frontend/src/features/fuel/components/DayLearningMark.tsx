import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExpenditureHistory, useIntakeDayMark, useIntakeDays } from '@/data/fuel/expenditureHooks'
import type { IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { useToast } from '@/shared/ui/ToastProvider'
import { useM } from '@/shared/i18n'
import { Btn, Bub, Card, Lk, Section } from '@/shared/ui/folyadek'
import { dayCounts, learningModeOf, markToastLine } from '@/features/fuel/sheets/learnedBaseFormat'

// ============================================================
// Mezo · DayLearningMark — the day's mark in the learning (mezo-3n2so, learned expenditure part 2, task 11;
// Folyadék F5, mezo-n4wf5.5 — prototype vilagos/fuel.js `learnMark`): the LAST section of the Fuel Mai, on
// today and on a past day alike. Reads the ONE viewed day (`useIntakeDays(date, date)` — the range endpoint
// allows `to = today`) and renders nothing — no section head either — while that read is pending or the day
// has nothing logged (an unlogged day has no mark to make). Today additionally reminds that the mark is
// banked for next Monday's re-chain. Every state opens „Mit jelent ez?" → /fuel/tanulas.
// ============================================================

const COPY_KEY: Record<Exclude<IntakeDayStatus['status'], 'unlogged'>, 'usable' | 'suspicious' | 'markedIncomplete' | 'confirmedComplete'> = {
  usable: 'usable',
  suspicious: 'suspicious',
  marked_incomplete: 'markedIncomplete',
  confirmed_complete: 'confirmedComplete',
}

export function DayLearningMark({ date, today, n }: {
  date: string; today: boolean
  /** The section's number on the page (the page counts its sections; without it the head has no badge). */
  n?: number
}) {
  const M = useM()
  const K = M.fuelMai.mark
  const { days, isPending } = useIntakeDays(date, date)
  const { setMark, clearMark } = useIntakeDayMark()
  // With the switch off (or nothing learned yet) the served frame cannot move — say so honestly.
  const { data: history } = useExpenditureHistory()
  const { show } = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const day = days[0]
  if (isPending || !day || day.status === 'unlogged') return null

  const marked = day.status === 'marked_incomplete' || day.status === 'confirmed_complete'
  const counts = dayCounts(day.status)

  const act = async (run: () => Promise<IntakeDayMarkResult>) => {
    setBusy(true)
    try {
      const r = await run()
      show({ kind: 'success', text: markToastLine(learningModeOf(history), r) })
    } catch {
      show({ kind: 'error', text: K.saveError })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Section n={n} title={K.section} />
      <Card>
        <div className="fa-mark">
          <Bub icon={counts ? 't-tick' : 't-shield'} size={38} color={counts ? undefined : 'var(--fo-warn)'} />
          <span className="g">
            <b>{K[COPY_KEY[day.status]]}</b>
            {today && <small>{K.todayNote}</small>}
            <Lk onClick={() => navigate('/fuel/tanulas')}>{K.what}</Lk>
          </span>
          {marked ? (
            <Btn sm ghost disabled={busy} onClick={() => act(() => clearMark(date))}>{K.undo}</Btn>
          ) : day.status === 'usable' ? (
            <Btn sm ghost disabled={busy} onClick={() => act(() => setMark(date, 'incomplete'))}>{K.incomplete}</Btn>
          ) : (
            <Btn sm ghost disabled={busy} onClick={() => act(() => setMark(date, 'complete'))}>{K.complete}</Btn>
          )}
        </div>
      </Card>
    </>
  )
}
