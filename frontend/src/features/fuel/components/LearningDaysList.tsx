import { useEffect, useState } from 'react'
import { useIntakeDayMark, useIntakeDays } from '@/data/fuel/expenditureHooks'
import type { IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { addDays, localDateString } from '@/shared/lib/dates'
import { useToast } from '@/shared/ui/ToastProvider'
import { Bub, Note, Row, Switch } from '@/shared/ui/folyadek'
import type { Icon3DName } from '@/shared/ui/clay'
import { DAY_STATUS, dayCounts, huWeekdayDate, markToastLine, type LearningMode } from '@/features/fuel/sheets/learnedBaseFormat'

// ============================================================
// Mezo · LearningDaysList — „Az utolsó 14 nap” (mezo-3n2so, learned expenditure part 2, spec §5.4).
// Folyadék (mezo-n4wf5.5): build target docs/design_2.0/prototypes/vilagos/fuel.js `tanulas()` section
// „Az utolsó 14 nap" — one kit row per day. The 14 days BEFORE today (today never counts), newest
// first: a state bubble (tick = counts, shield = left out, calendar = nothing logged), the date, the
// logged kcal and the status word, and a „számít” switch — on for a day that counts (usable /
// confirmed complete). A day with nothing logged takes no mark, so it gets a dash instead of a
// switch. Flipping the switch re-chains the learned base at once; a toast says how the frame
// moved. A mark that would only return the day to what the rule says is CLEARED, not stored.
// ============================================================

type DayState = IntakeDayStatus['status']
export type { LearningMode }

export function LearningDaysList({ mode }: { mode: LearningMode }) {
  const [today] = useState(() => localDateString())
  const { days, isPending } = useIntakeDays(addDays(today, -14), addDays(today, -1))
  const { setMark, clearMark } = useIntakeDayMark()
  const { show } = useToast()
  const M = useM()
  const D = M.fuelTanulas.days
  const [live, setLive] = useState<Record<string, DayState>>({})
  const [busy, setBusy] = useState<string | null>(null)
  // A fresh read that CHANGED a status is the truth again — drop the just-saved overrides. Keyed on
  // the content, not the array identity (a re-render may hand over an equal, new array).
  const readSig = days.map(d => `${d.date}:${d.status}`).join()
  useEffect(() => setLive({}), [readSig])

  const rows = [...days].sort((a, b) => b.date.localeCompare(a.date))

  const flip = async (d: IntakeDayStatus, state: DayState) => {
    const want = !dayCounts(state)
    setBusy(d.date)
    try {
      let r: IntakeDayMarkResult
      if (state === 'confirmed_complete' || state === 'marked_incomplete') {
        // Undo the owner's mark first; if the rule points the other way, mark the wanted state.
        const cleared = await clearMark(d.date)
        r = dayCounts(cleared.day.status) === want
          ? cleared
          : { ...(await setMark(d.date, want ? 'complete' : 'incomplete')), appliedBaseBeforeKcal: cleared.appliedBaseBeforeKcal }
      } else {
        r = await setMark(d.date, want ? 'complete' : 'incomplete')
      }
      setLive(s => ({ ...s, [d.date]: r.day.status }))
      show({ kind: 'success', text: markToastLine(mode, r) })
    } catch {
      show({ kind: 'error', text: M.fuelTanulas.saveFailed })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {isPending && rows.length === 0 && <Note>{D.loading}</Note>}
      {rows.map(d => {
        const state = live[d.date] ?? d.status
        const [word] = DAY_STATUS[state]
        const label = huWeekdayDate(d.date)
        const [icon, color] = FACE[dayCounts(state) ? 'counts' : state === 'unlogged' ? 'none' : 'out']
        return (
          <Row
            key={d.date}
            className="ft-day"
            left={<Bub icon={icon} size={40} color={color} />}
            title={label}
            sub={d.kcal != null ? D.sub(fmtGrouped(d.kcal), word) : word}
            right={state === 'unlogged'
              ? <span className="ft-dash" aria-hidden="true">—</span>
              : <Switch on={dayCounts(state)} label={D.counts(label)} disabled={busy === d.date} onChange={() => flip(d, state)} />}
          />
        )
      })}
      <Note>{D.note}</Note>
    </>
  )
}

/** The bubble in front of a day: does it count, was it left out, or is there nothing to count. */
const FACE: Record<'counts' | 'out' | 'none', [Icon3DName, string]> = {
  counts: ['t-tick', 'var(--dom)'],
  out: ['t-shield', 'var(--fo-warn)'],
  none: ['t-calendar', 'var(--fo-faint)'],
}
