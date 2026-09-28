import { useEffect, useState } from 'react'
import { useIntakeDayMark, useIntakeDays } from '@/data/fuel/expenditureHooks'
import type { IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { huInt } from '@/shared/lib/huNum'
import { addDays, localDateString } from '@/shared/lib/dates'
import { Toggle } from '@/shared/ui/Toggle'
import { useToast } from '@/shared/ui/ToastProvider'
import { DAY_STATUS, dayCounts, huWeekdayDate, markToastLine, type LearningMode } from '@/features/fuel/sheets/learnedBaseFormat'

// ============================================================
// Mezo · LearningDaysList — „Az utolsó 14 nap” (mezo-3n2so, learned expenditure part 2, spec §5.4).
// Build target: docs/design_2.0/prototypes/elo/fuel.html `dayRows()` / `setOn()` / `changeMsg()`.
// The 14 days BEFORE today (today never counts), newest first: the date, the logged kcal, a status
// chip, and a „számít” switch — on for a day that counts (usable / confirmed complete). A day with
// nothing logged takes no mark, so it gets no switch (a same-width placeholder keeps the chips
// aligned). Flipping the switch re-chains the learned base at once; a toast says how the frame
// moved. A mark that would only return the day to what the rule says is CLEARED, not stored.
// ============================================================

type DayState = IntakeDayStatus['status']
export type { LearningMode }

export function LearningDaysList({ mode }: { mode: LearningMode }) {
  const [today] = useState(() => localDateString())
  const { days, isPending } = useIntakeDays(addDays(today, -14), addDays(today, -1))
  const { setMark, clearMark } = useIntakeDayMark()
  const { show } = useToast()
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
      show({ kind: 'error', text: 'Nem sikerült menteni, próbáld újra' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {isPending && rows.length === 0 && <p className="fln-fine">Betöltöm a napjaidat…</p>}
      {rows.map(d => {
        const state = live[d.date] ?? d.status
        const [word, tone] = DAY_STATUS[state]
        const label = huWeekdayDate(d.date)
        return (
          <div key={d.date} className="fln-day">
            <span className="fln-grow">
              <strong>{label}</strong>
              {d.kcal != null && <small>{huInt(d.kcal)} kcal</small>}
            </span>
            <span className={`fln-chip fwl-st st-${tone}`}>{word}</span>
            {state === 'unlogged' ? (
              <span className="fln-swph" aria-hidden="true" />
            ) : (
              <Toggle
                glass
                on={dayCounts(state)}
                ariaLabel={`${label} számít`}
                disabled={busy === d.date}
                onToggle={() => flip(d, state)}
              />
            )}
          </div>
        )
      })}
      <p className="fln-fine">
        A kapcsolóval megmondod, hogy egy nap teljes volt-e. Azonnal újraszámolom. Felírás nélküli napot nem lehet jelölni — ott nincs mit számolni.
      </p>
    </>
  )
}
