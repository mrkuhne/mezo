import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIntakeDayMark, useIntakeDays } from '@/data/fuel/expenditureHooks'
import type { IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { useToast } from '@/shared/ui/ToastProvider'
import { ContentIcon } from '@/shared/ui/clay'
import { dayCounts, markChangeLine } from '@/features/fuel/sheets/learnedBaseFormat'

// ============================================================
// Mezo · DayLearningMark — the day-log mark line (mezo-3n2so, learned expenditure part 2, task 11).
// Build target: docs/design_2.0/prototypes/elo/fuel.html `markSlot()` (§5.4) — a QUIET row with a
// hairline, not glass, at the bottom of the day's food log on FuelMaiPage (both `#mai` and a past
// day via the day navigator). Reads the ONE viewed day (`useIntakeDays(date, date)` — the range
// endpoint allows `to = today`) and renders nothing while that read is pending or the day has
// nothing logged (an unlogged day has no mark to make). Today additionally reminds that the mark
// is banked for next Monday's re-chain. Every state opens „Mit jelent ez?” → /fuel/tanulas.
// ============================================================

const COPY: Record<IntakeDayStatus['status'], string> = {
  usable: 'Ez a nap számít a tanulásban',
  suspicious: 'Ez a nap hiányosnak tűnt, kihagytam',
  marked_incomplete: 'Ezt a napot hiányosnak jelölted — kihagyom a tanulásból',
  confirmed_complete: 'Ezt a napot teljesnek jelölted — számít a tanulásban',
  unlogged: '',
}

export function DayLearningMark({ date, today }: { date: string; today: boolean }) {
  const { days, isPending } = useIntakeDays(date, date)
  const { setMark, clearMark } = useIntakeDayMark()
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
      show({ kind: 'success', text: markChangeLine(r) })
    } catch {
      show({ kind: 'error', text: 'Nem sikerült menteni, próbáld újra' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fmx-mark">
      <ContentIcon name={counts ? 't-tick' : 't-shield'} size={26} />
      <span className="grow">
        <span>{COPY[day.status]}</span>
        {today && <small>A mai napot jövő hétfőn számolom bele — a jelölést addig is elmentem.</small>}
        <button type="button" className="link" onClick={() => navigate('/fuel/tanulas')}>Mit jelent ez?</button>
      </span>
      {marked ? (
        <button type="button" className="fwl-qbtn" disabled={busy} onClick={() => act(() => clearMark(date))}>
          Visszavonom
        </button>
      ) : day.status === 'usable' ? (
        <button type="button" className="fwl-qbtn" disabled={busy} onClick={() => act(() => setMark(date, 'incomplete'))}>
          Hiányos volt
        </button>
      ) : (
        <button type="button" className="fwl-qbtn is-on" disabled={busy} onClick={() => act(() => setMark(date, 'complete'))}>
          Teljes volt
        </button>
      )}
    </div>
  )
}
