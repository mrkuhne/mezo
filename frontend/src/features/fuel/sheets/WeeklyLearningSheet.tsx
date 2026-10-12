import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { useToast } from '@/shared/ui/ToastProvider'
import { useM } from '@/shared/i18n'
import { fmtGrouped } from '@/shared/lib/format'
import { Acts, Btn, FoSheetHead, Lab, Lk, Note, Row, Txt } from '@/shared/ui/folyadek'
import { useDismissWeeklyCard, useIntakeDayMark } from '@/data/fuel/expenditureHooks'
import type { ExpenditureWeeklyCard, IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { CONFIDENCE_WORD, DAY_STATUS, dayCounts, huWeekRange, huWeekdayDate, markChangeLine, round10, signed } from '@/features/fuel/sheets/learnedBaseFormat'
import { BandG, Tot, rich } from '@/features/fuel/sheets/tanulasPieces'

// ============================================================
// Mezo · WeeklyLearningSheet — „Heti tanulás” (mezo-3n2so, learned expenditure part 2, spec §5.1).
// Opened from the Alap row of the Fuel Mai equation box and from the learning page's hero.
// Folyadék (mezo-n4wf5.5): build target docs/design_2.0/prototypes/vilagos/fuel.js sheet `weekly[:var]`.
// Anatomy top→bottom:
//   head — lens (or hold) glyph, the learned base (or „Ezen a héten vártam"), the week and its σ̂
//   moved: the step on a tinted line + the reason + the base in its ± band with last week's tick;
//   held: the holding copy with the card's numbers
//   KIHAGYOTT NAPOK — each excluded day with its kcal, its status word and one action
//   the change line after a mark („A keret −40 kcal-lal változott” / „A keret nem változott”)
//   foot — „Részletek” (the learning page) and „Bezárom” (dismiss this week + close)
// The excluded rows are SNAPSHOT at open: a mark re-chains the base and may drop the day from the
// refetched card, but the row must stay so its „Visszavonom” stays reachable (the prototype's
// behaviour). A row only changes on a successful save — a failed one toasts and stays as it was.
// ============================================================

type DayState = IntakeDayStatus['status']

export function WeeklyLearningSheet({ card, onClose }: { card: ExpenditureWeeklyCard; onClose: () => void }) {
  const { setMark, clearMark } = useIntakeDayMark()
  const { dismiss } = useDismissWeeklyCard()
  const { show } = useToast()
  const navigate = useNavigate()
  const M = useM()
  const T = M.fuelTanulas
  const W = T.weekly
  const hold = card.status === 'holding'
  const [days] = useState(() => card.excludedDays)
  const [states, setStates] = useState<Record<string, DayState>>(() =>
    Object.fromEntries(card.excludedDays.map(d => [d.date, d.reason === 'marked' ? 'marked_incomplete' : 'suspicious'])))
  const [busy, setBusy] = useState<string | null>(null)
  // the last successful mark — the DATA; its sentence is built at render, in the current language (N1.3)
  const [moved, setMoved] = useState<IntakeDayMarkResult | null>(null)

  const act = async (date: string, run: () => Promise<IntakeDayMarkResult>) => {
    setBusy(date)
    try {
      const r = await run()
      setStates(s => ({ ...s, [date]: r.day.status }))
      setMoved(r)
    } catch {
      show({ kind: 'error', text: T.saveFailed })
    } finally {
      setBusy(null)
    }
  }

  const base = W.base(fmtGrouped(card.appliedBaseKcal))
  const sd = String(round10(card.posteriorSdKcal))
  const sure = W.sure(CONFIDENCE_WORD[card.confidence], sd)
  const range = huWeekRange(card.weekStart, card.weekEnd)
  const before = card.appliedBaseKcal - card.stepKcal

  return (
    <Sheet onClose={onClose} labelledBy="weekly-learning-title" className={`fo-sheet ft-weekly${hold ? ' hold' : ''}`}>
      {(close) => (
        <>
          <FoSheetHead
            icon={hold ? 't-hold' : 't-lens'} titleId="weekly-learning-title" onClose={close}
            title={hold ? W.heldTitle : base}
            sub={hold ? W.subHeld(range, base, sure) : W.sub(range, sure)}
          />

          {!hold && card.stepKcal !== 0 && (
            <>
              <Tot label={W.inBudget} value={signed(card.stepKcal)} unit="kcal" />
              <Txt>{card.stepKcal > 0 ? W.reasonUp : W.reasonDown}</Txt>
              <BandG
                value={card.appliedBaseKcal} sd={round10(card.posteriorSdKcal)} valueLabel={fmtGrouped(card.appliedBaseKcal)}
                tick={before} tickLabel={W.lastWeek(fmtGrouped(before))}
                label={W.bandAria(fmtGrouped(before), fmtGrouped(card.appliedBaseKcal))}
              />
            </>
          )}
          {hold && <Txt className="ft-held">{rich(W.held(card.usableDays, card.weighInDays, card.minUsableDays, card.minWeighInDays))}</Txt>}

          {days.length > 0 && (
            <>
              <Lab>{W.leftOut}</Lab>
              {days.map(d => {
                const st = states[d.date]
                const [word] = DAY_STATUS[st]
                const marked = st === 'confirmed_complete' || st === 'marked_incomplete'
                return (
                  <Row
                    key={d.date}
                    className="ft-wday"
                    icon={dayCounts(st) ? 't-tick' : 't-shield'}
                    title={huWeekdayDate(d.date)}
                    sub={W.daySub(fmtGrouped(d.kcal), word)}
                    right={marked ? (
                      <Btn sm ghost disabled={busy === d.date} onClick={() => act(d.date, () => clearMark(d.date))}>{W.undo}</Btn>
                    ) : st === 'usable' ? (
                      <Btn sm ghost disabled={busy === d.date} onClick={() => act(d.date, () => setMark(d.date, 'incomplete'))}>{W.wasIncomplete}</Btn>
                    ) : (
                      <Btn sm ghost disabled={busy === d.date} onClick={() => act(d.date, () => setMark(d.date, 'complete'))}>{W.wasComplete}</Btn>
                    )}
                  />
                )
              })}
              <Note>{W.note}</Note>
            </>
          )}

          {moved && <p className="fo-txt ft-msg" role="status">{markChangeLine(moved)}</p>}

          <Acts>
            <Btn sm onClick={() => { onClose(); navigate('/fuel/tanulas') }}>{W.details}</Btn>
            <Lk onClick={async () => {
              try {
                await dismiss(card.weekStart)
                show({ kind: 'success', text: W.hidden })
              } catch {
                show({ kind: 'error', text: T.saveFailed })
              }
              close()
            }}>{T.close}</Lk>
          </Acts>
        </>
      )}
    </Sheet>
  )
}
