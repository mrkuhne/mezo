import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { ContentIcon } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { huInt } from '@/shared/lib/huNum'
import { useDismissWeeklyCard, useIntakeDayMark } from '@/data/fuel/expenditureHooks'
import type { ExpenditureWeeklyCard, IntakeDayMarkResult, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { CONFIDENCE_WORD, huWeekRange, huWeekdayDate, round10, signed } from '@/features/fuel/sheets/learnedBaseFormat'

// ============================================================
// Mezo · WeeklyLearningSheet — „Heti tanulás” (mezo-3n2so, learned expenditure part 2, spec §5.1).
// Opened from the highlighted Alap row of the Fuel Mai equation box (FuelEnergyHero). Build target:
// docs/design_2.0/prototypes/elo/fuel.html `SH.weekly`. Anatomy top→bottom:
//   head — lens (or hold) sprite, „HETI TANULÁS · SZEPT. 21–27.”, the learned base and its σ̂
//   step line + the reason (only when the frame moved), or the holding copy with the card's numbers
//   KIHAGYOTT NAPOK — each excluded day with its kcal, a status chip and one action
//   the change line after a mark („A keret −40 kcal-lal változott” / „A keret nem változott”)
//   footer — „Részletek ›” (the learning page) and „Bezárom” (dismiss this week + close)
// The excluded rows are SNAPSHOT at open: a mark re-chains the base and may drop the day from the
// refetched card, but the row must stay so its „Visszavonom” stays reachable (the prototype's
// behaviour). A row only changes on a successful save — a failed one toasts and stays as it was.
// ============================================================

const REASON = {
  up: 'A súlyod lassabban nőtt, mint amit a felírt evés alapján vártam.',
  down: 'A súlyod gyorsabban nőtt, mint amit a felírt evés alapján vártam.',
} as const

type DayState = IntakeDayStatus['status']

/** Status chip copy + tone (elo/fuel.html `STATUS`). */
const STATUS: Record<DayState, [string, string]> = {
  usable: ['számít', 'ok'],
  suspicious: ['hiányosnak tűnt', 'sus'],
  confirmed_complete: ['te jelölted teljesnek', 'mc'],
  marked_incomplete: ['te jelölted hiányosnak', 'mi'],
  unlogged: ['nincs felírva', 'none'],
}

const counts = (s: DayState) => s === 'usable' || s === 'confirmed_complete'

function changeLine(r: IntakeDayMarkResult): string {
  const before = r.appliedBaseBeforeKcal
  const after = r.appliedBaseAfterKcal
  const delta = before != null && after != null ? Math.round(after - before) : 0
  return delta ? `A keret ${signed(delta)} kcal-lal változott` : 'A keret nem változott'
}

export function WeeklyLearningSheet({ card, onClose }: { card: ExpenditureWeeklyCard; onClose: () => void }) {
  const { setMark, clearMark } = useIntakeDayMark()
  const { dismiss } = useDismissWeeklyCard()
  const { show } = useToast()
  const navigate = useNavigate()
  const hold = card.status === 'holding'
  const [days] = useState(() => card.excludedDays)
  const [states, setStates] = useState<Record<string, DayState>>(() =>
    Object.fromEntries(card.excludedDays.map(d => [d.date, d.reason === 'marked' ? 'marked_incomplete' : 'suspicious'])))
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const act = async (date: string, run: () => Promise<IntakeDayMarkResult>) => {
    setBusy(date)
    try {
      const r = await run()
      setStates(s => ({ ...s, [date]: r.day.status }))
      setMsg(changeLine(r))
    } catch {
      show({ kind: 'error', text: 'Nem sikerült menteni, próbáld újra' })
    } finally {
      setBusy(null)
    }
  }

  const base = `Alap ${huInt(card.appliedBaseKcal)} kcal`
  const certainty = `${CONFIDENCE_WORD[card.confidence]} · ±${round10(card.posteriorSdKcal)} kcal`

  return (
    <Sheet glass onClose={onClose} labelledBy="weekly-learning-title" className={`uvl-fuel fwl-sheet${hold ? ' is-hold' : ''}`}>
      {(close) => (
        <>
          <div className="flp-eh fwl-head">
            <ContentIcon name={hold ? 't-hold' : 't-lens'} size={48} />
            <div className="col" style={{ flex: 1, minWidth: 0 }}>
              <span className="uv-eyebrow">Heti tanulás · {huWeekRange(card.weekStart, card.weekEnd)}</span>
              <h2 id="weekly-learning-title">{hold ? 'Ezen a héten vártam' : base}</h2>
              <small className="fwl-sub">{hold ? `${base} · ${certainty}` : certainty}</small>
            </div>
            <button type="button" className="flp-x" onClick={close} aria-label="Bezárás">
              <Icon name="x" size={12} />
            </button>
          </div>

          {!hold && card.stepKcal !== 0 && (
            <>
              <div className="fwl-step"><b>{signed(card.stepKcal)} kcal</b> a napi keretedben</div>
              <p className="fwl-why">{card.stepKcal > 0 ? REASON.up : REASON.down}</p>
            </>
          )}
          {hold && (
            <p className="fwl-why">
              Kevés adat volt: <b>{card.usableDays} teljes nap, {card.weighInDays} mérlegelés</b> — legalább{' '}
              {card.minUsableDays} és {card.minWeighInDays} kell. A keret nem változott.
            </p>
          )}

          {days.length > 0 && (
            <div className="fwl-days">
              <span className="uv-eyebrow">Kihagyott napok</span>
              {days.map(d => {
                const st = states[d.date]
                const [word, tone] = STATUS[st]
                const marked = st === 'confirmed_complete' || st === 'marked_incomplete'
                return (
                  <div key={d.date} className="fwl-day">
                    <ContentIcon name={counts(st) ? 't-tick' : 't-shield'} size={26} />
                    <span className="fwl-grow">
                      <strong>{huWeekdayDate(d.date)}</strong>
                      <small>{huInt(d.kcal)} kcal · <em className={`fwl-st st-${tone}`}>{word}</em></small>
                    </span>
                    {marked ? (
                      <button type="button" className="fwl-qbtn" disabled={busy === d.date}
                        onClick={() => act(d.date, () => clearMark(d.date))}>Visszavonom</button>
                    ) : st === 'usable' ? (
                      <button type="button" className="fwl-qbtn" disabled={busy === d.date}
                        onClick={() => act(d.date, () => setMark(d.date, 'incomplete'))}>Hiányos volt</button>
                    ) : (
                      <button type="button" className="fwl-qbtn is-on" disabled={busy === d.date}
                        onClick={() => act(d.date, () => setMark(d.date, 'complete'))}>Teljes volt</button>
                    )}
                  </div>
                )
              })}
              <p className="fwl-fine">Ha nem nyúlsz hozzá, ezeket a napokat kihagyva hagyom.</p>
            </div>
          )}

          {msg && (
            <p className="fwl-msg" role="status">
              <ContentIcon name="t-ring" size={22} />
              {msg}
            </p>
          )}

          <div className="fwl-foot">
            <button type="button" className="fwl-qbtn" onClick={() => { onClose(); navigate('/fuel/tanulas') }}>
              Részletek ›
            </button>
            <button type="button" className="fwl-qbtn is-ghost" onClick={async () => {
              try {
                await dismiss(card.weekStart)
                show({ kind: 'success', text: 'Elrejtettem — ezt a hetet nem mutatom újra' })
              } catch {
                show({ kind: 'error', text: 'Nem sikerült menteni, próbáld újra' })
              }
              close()
            }}>Bezárom</button>
          </div>
        </>
      )}
    </Sheet>
  )
}
