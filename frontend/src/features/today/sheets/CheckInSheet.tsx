// ============================================================
// Mezo · CheckInSheet — Check-in 2.0 (mezo-ck2, spec §2 + §5)
// Flow source: docs/design_2.0/prototypes/elo/nap.html `SH.checkin` (owner OK 2026-09-27).
// FOLYADÉK (mezo-n4wf5.2, prototypes/vilagos/nap.js `ckSheet()`): a light sheet; every answer is a
// vessel you fill: the jar and the ten vials of a scale step, the level under each summary row.
// The slot's question plan (server config: the five core items, the time-of-day items, then the
// question of the day) one item per step. Nothing is pre-selected: a tap selects and advances
// after 200 ms, „Kihagyom" stores the item as skipped (NULL), and from the sixth step
// „Most csak ennyi" jumps to the summary — the not-yet-asked items stay empty and the check-in
// still counts. Pain and craving have their own steps (sheets/checkin/*). The summary shows every
// step as a row (tap to edit), the optional note, and „Mentés · HH:mm".
// ============================================================
import { useEffect, useRef, useState } from 'react'
import { useCheckInPlan } from '@/data/hooks'
import { CORE_ITEMS, planSteps } from '@/data/today/checkinPlan'
import { CHECKIN_LOOK } from '@/features/today/logic/checkinItems'
import { ScaleStep } from '@/features/today/sheets/checkin/ScaleStep'
import { PainStep } from '@/features/today/sheets/checkin/PainStep'
import { CravingStep, CRAVING_KINDS_FROM } from '@/features/today/sheets/checkin/CravingStep'
import { CheckInSummary } from '@/features/today/sheets/checkin/CheckInSummary'
import { Sheet } from '@/shared/ui/Sheet'
import { Btn, Dots, ErrorRow, FoSheetHead, Lab, Lk, Note, Why } from '@/shared/ui/folyadek'
import { localDateString } from '@/shared/lib/dates'
import type { CheckinItemId, CheckinSlot, CheckinValues } from '@/data/types'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

/** The four canonical slots' daypart names, by slot time (index fallback for any other time). */
const SLOT_NAME: Record<string, string> = { '06:30': 'Reggel', '10:00': 'Délelőtt', '14:00': 'Délután', '20:00': 'Este' }
const SLOT_NAMES = ['Reggel', 'Délelőtt', 'Délután', 'Este']
/** The auto-advance delay after a tap — long enough to see the selection land. */
const ADVANCE_MS = 200

const pad2 = (n: number) => String(n).padStart(2, '0')

export function CheckInSheet({
  slot,
  slotIdx,
  onClose,
  onSave,
}: {
  slot: CheckinSlot
  slotIdx: number
  onClose: () => void
  onSave: (data: Partial<CheckinSlot>) => void | Promise<void>
}) {
  const { plan, isError, refetch } = useCheckInPlan(localDateString(), slot.time)
  const [answers, setAnswers] = useState<CheckinValues>(() => slot.values ?? {})
  const [note, setNote] = useState(slot.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [step, setStep] = useState(0)
  const [quick, setQuick] = useState(false)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const slotName = SLOT_NAME[slot.time] ?? SLOT_NAMES[slotIdx] ?? ''
  const steps = plan ? planSteps(plan) : []
  const adaptiveId = (plan?.adaptive?.id ?? null) as CheckinItemId | null
  const coreCount = CORE_ITEMS.length
  const isSummary = plan != null && step >= steps.length
  const item = plan && !isSummary ? steps[step] : null

  const clearTimer = () => {
    if (advanceTimer.current != null) clearTimeout(advanceTimer.current)
    advanceTimer.current = null
  }
  // The auto-advance timer must not outlive the component: a timer surviving unmount calls
  // setStep after the test environment tears down — the nondeterministic "window is not
  // defined" CI failure (mezo-91rw class, see Sheet.tsx).
  useEffect(() => clearTimer, [])

  const goTo = (n: number) => { clearTimer(); setStep(n) }
  /** Advance from step `from` after the tap has had its 200 ms to land. */
  const advanceFrom = (from: number) => {
    clearTimer()
    advanceTimer.current = setTimeout(() => { advanceTimer.current = null; setStep(from + 1) }, ADVANCE_MS)
  }
  const setAnswer = <K extends CheckinItemId>(id: K, v: CheckinValues[K]) =>
    setAnswers((a) => ({ ...a, [id]: v }))

  const save = async (close: () => void) => {
    if (saving || !plan) return
    setSaving(true)
    setSaveError(false)
    const ids = steps.map((s) => s.id as CheckinItemId)
    const askedItems = ids.filter((id) => id in answers)
    const values: CheckinValues = {}
    for (const id of askedItems) (values as Record<CheckinItemId, unknown>)[id] = answers[id] ?? null
    try {
      await onSave({
        state: 'done',
        values,
        note: note.trim() || null,
        savedAt: new Date().toISOString(),
        askedItems,
        adaptiveItem: adaptiveId,
        adaptiveReason: plan.adaptive?.reason ?? null,
        quickExit: quick && ids.some((id) => !(id in answers)),
      })
      close()
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  const stepBody = () => {
    if (!item) return null
    const id = item.id as CheckinItemId
    const look = CHECKIN_LOOK[id]
    const isAd = adaptiveId != null && step === steps.length - 1
    const s = step
    const tag = s < coreCount ? 'alap' : isAd ? 'a nap kérdése' : slotName
    let body
    if (item.kind === 'PAIN') {
      body = (
        <PainStep
          value={answers.pain}
          options={item.options}
          low={item.low}
          high={item.high}
          onNo={() => { setAnswer('pain', false); advanceFrom(s) }}
          onChange={(p) => { clearTimer(); setAnswer('pain', p) }}
          onNext={() => goTo(s + 1)}
        />
      )
    } else if (item.kind === 'CRAVING') {
      body = (
        <CravingStep
          icon={look.icon}
          value={answers.craving}
          options={item.options}
          low={item.low}
          high={item.high}
          labelledBy="checkin-q"
          onPick={(n) => {
            setAnswer('craving', { value: n, kinds: answers.craving?.kinds ?? [] })
            if (n < CRAVING_KINDS_FROM) advanceFrom(s)
            else clearTimer()
          }}
          onKinds={(kinds) => setAnswer('craving', { value: answers.craving?.value ?? CRAVING_KINDS_FROM, kinds })}
          onNext={() => goTo(s + 1)}
        />
      )
    } else {
      const v = answers[id]
      body = (
        <ScaleStep
          icon={look.icon}
          value={typeof v === 'number' ? v : null}
          low={item.low}
          high={item.high}
          labelledBy="checkin-q"
          onPick={(n) => { setAnswer(id, n); advanceFrom(s) }}
        />
      )
    }
    return (
      <>
        <Lab className="nck2-stepl">
          {pad2(s + 1)} / {pad2(steps.length)} · {item.label}{tag ? ` · ${tag}` : ''}
        </Lab>
        {isAd && plan?.adaptive && (
          <Why icon="t-orb"><b>A nap kérdése.</b> {plan.adaptive.why}</Why>
        )}
        <p className="nck2-q" id="checkin-q">{item.question}</p>
        {body}
        {s === coreCount && (
          <p className="nck2-okline">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            Az alap megvan. Innen bármikor kiléphetsz.</p>
        )}
        {/* typographic arrows (aria-hidden); the names stay „Vissza" / „Kihagyom" */}
        <div className="nck2-nav">
          {s > 0 ? (
            <Lk onClick={() => goTo(s - 1)}><span aria-hidden="true">‹</span> Vissza</Lk>
          ) : <span />}
          {s >= coreCount && (
            <Lk onClick={() => { setQuick(true); goTo(steps.length) }}>Most csak ennyi</Lk>
          )}
          <Lk onClick={() => { setAnswer(id, null); goTo(s + 1) }}>Kihagyom <span aria-hidden="true">›</span></Lk>
        </div>
      </>
    )
  }

  return (
    <Sheet onClose={onClose} labelledBy="checkin-title" className="fo-sheet nck2-sheet">
      {(close) => (
      <>
      <FoSheetHead titleId="checkin-title" title="Hogy vagy?" icon="t-checkin"
        sub={`Check-in · ${slotName ? `${slotName} · ` : ''}${slot.time}`} onClose={close} />

      {!plan && (isError ? (
        <ErrorRow message="Nem sikerült betölteni a kérdéseket." onRetry={refetch} />
      ) : (
        <Note role="status">Kérdések betöltése…</Note>
      ))}

      {plan && <Dots count={steps.length + 1} at={step} core={coreCount} />}
      {stepBody()}

      {/* Summary + note step */}
      {isSummary && (
        <>
          <Lab className="nck2-stepl">Megvan · összegzés</Lab>
          <p className="nck2-q">Bármi még, amit szeretnél?</p>

          <CheckInSummary
            steps={steps.map((s) => ({ id: s.id as CheckinItemId, label: s.label }))}
            answers={answers}
            adaptiveId={adaptiveId}
            quick={quick}
            onEdit={goTo}
          />

          {/* Optional free note; the mic is the shared voice field (mezo-xojq8) */}
          <Lab htmlFor="checkin-note">Gondolatok · opcionális</Lab>
          <VoiceField domain="nap" onTranscript={t => setNote(d => appendDictation(d, t))}>
            <textarea
              id="checkin-note"
              className="nck2-in"
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="pl. „tegnap röpi után még izomláz” · „fejes meeting előtt”"
            />
          </VoiceField>

          {/* Save */}
          {saveError && <p role="alert" className="nck2-alert">A mentés nem sikerült. A szöveged megmaradt, próbáld újra.</p>}
          <Btn wide className="nck2-save" disabled={saving} onClick={() => { void save(close) }}>
            {saving ? 'Mentés…' : `Mentés · ${slot.time}`}
          </Btn>
        </>
      )}
      </>
      )}
    </Sheet>
  )
}
