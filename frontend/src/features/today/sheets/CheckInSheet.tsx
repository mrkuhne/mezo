// ============================================================
// Mezo · CheckInSheet — Check-in 2.0 (mezo-ck2, spec §2 + §5)
// Source of truth: docs/design_2.0/prototypes/elo/nap.html `SH.checkin` (owner OK 2026-09-27).
// The slot's question plan (server config: the five core items, the time-of-day items, then the
// question of the day) one item per step. Nothing is pre-selected: a tap selects and advances
// after 200 ms, „Kihagyom" stores the item as skipped (NULL), and from the sixth step
// „Most csak ennyi" jumps to the summary — the not-yet-asked items stay empty and the check-in
// still counts. Pain and craving have their own steps (sheets/checkin/*). The summary shows every
// step as a cell (tap to edit), the optional note, and „Mentés · HH:mm".
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useCheckInPlan } from '@/data/hooks'
import { CORE_ITEMS, planSteps } from '@/data/today/checkinPlan'
import { CHECKIN_LOOK } from '@/features/today/logic/checkinItems'
import { ScaleStep } from '@/features/today/sheets/checkin/ScaleStep'
import { PainStep } from '@/features/today/sheets/checkin/PainStep'
import { CravingStep, CRAVING_KINDS_FROM } from '@/features/today/sheets/checkin/CravingStep'
import { CheckInSummary } from '@/features/today/sheets/checkin/CheckInSummary'
import { Icon3D } from '@/shared/ui/clay'
import { Sheet } from '@/shared/ui/Sheet'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { localDateString } from '@/shared/lib/dates'
import type { CheckinItemId, CheckinSlot, CheckinValues } from '@/data/types'

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

  const prog = plan && (
    <div className="ck-prog" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${steps.length + 1}, 1fr)` }}>
      {Array.from({ length: steps.length + 1 }, (_, i) => (
        <i key={i} className={i <= step ? 'on' : i < coreCount ? 'core' : undefined} />
      ))}
    </div>
  )

  const stepBody = () => {
    if (!item) return null
    const id = item.id as CheckinItemId
    const look = CHECKIN_LOOK[id]
    const isAd = adaptiveId != null && step === steps.length - 1
    const s = step
    const tag = s < coreCount ? ' · ALAP' : isAd ? '' : ` · ${slotName.toUpperCase()}`
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
          color={look.color}
          value={answers.craving}
          options={item.options}
          low={item.low}
          high={item.high}
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
          color={look.color}
          value={typeof v === 'number' ? v : null}
          low={item.low}
          high={item.high}
          onPick={(n) => { setAnswer(id, n); advanceFrom(s) }}
        />
      )
    }
    return (
      <div className="col capture-step" style={{ '--c': look.color } as CSSProperties}>
        <span className="capture-stepl">
          {pad2(s + 1)} / {pad2(steps.length)} · {item.label.toUpperCase()}{tag}
        </span>
        {isAd && plan?.adaptive && (
          <div className="ck-callout ck-ad" style={{ '--c': 'var(--dv-lav)' } as CSSProperties}>
            <span className="ck-callout-eb"><Icon3D name="t-orb" size={14} className="ck-inl" /> A nap kérdése</span>
            <p>{plan.adaptive.why}</p>
          </div>
        )}
        <p className="ck-q">{item.question}</p>
        {body}
        {s === coreCount && (
          <div className="ck-coremsg"><Icon3D name="t-tick" size={18} />Az alap megvan. Innen bármikor kiléphetsz.</div>
        )}
        {/* typographic arrows (aria-hidden); the names stay „Vissza" / „Kihagyom" */}
        <div className="capture-stepnav ck-stepnav">
          {s > 0 ? (
            <button type="button" onClick={() => goTo(s - 1)}>
              <span aria-hidden="true">‹</span> Vissza
            </button>
          ) : <span />}
          {s >= coreCount && (
            <button type="button" className="ck-quick" onClick={() => { setQuick(true); goTo(steps.length) }}>
              Most csak ennyi
            </button>
          )}
          <button type="button" onClick={() => { setAnswer(id, null); goTo(s + 1) }}>
            Kihagyom <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <Sheet onClose={onClose} labelledBy="checkin-title" className="capture-sheet capture-tone-checkin glass">
      {(close) => (
      <>
      <CaptureHeader id="checkin-title" title="Hogy vagyunk?" eyebrow={`Heartbeat · ${slotName ? `${slotName} · ` : ''}${slot.time}`}
        kind="checkin" onClose={close} />

      {!plan && (isError ? (
        <div className="col gap-sm">
          <p role="alert" className="ck-q">Nem sikerült betölteni a kérdéseket.</p>
          <button type="button" className="cta-ghost" onClick={refetch}>Újra</button>
        </div>
      ) : (
        <p className="ck-loading" role="status">Kérdések betöltése…</p>
      ))}

      {prog}
      {stepBody()}

      {/* Summary + note step */}
      {isSummary && (
        <div className="col gap-lg">
          <div className="col gap-xs">
            <span className="capture-sum-eyebrow">Megvan · összegzés</span>
            <div className="capture-sum-title">
              Bármi még amit szeretnél?
            </div>
          </div>

          <CheckInSummary
            steps={steps.map((s) => ({ id: s.id as CheckinItemId, label: s.label }))}
            answers={answers}
            adaptiveId={adaptiveId}
            quick={quick}
            onEdit={goTo}
          />

          {/* Optional free note */}
          <div className="col gap-sm">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <label htmlFor="checkin-note" className="label-mono">Gondolatok · opcionális</label>
            </div>
            {/* the decorative mic chip is gone (mezo-setx.5.5) — a control that does
                nothing is the ItemRow doctrine's dead button, not a form affordance */}
            <div className="card" style={{ padding: 10, display: 'flex', gap: 8 }}>
              <textarea
                id="checkin-note"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder='pl. "tegnap volleyball után még izomláz" · "fejes meeting előtt"'
                style={{
                  flex: 1, minHeight: 120, resize: 'vertical',
                  fontSize: 16, color: 'var(--text-primary)',
                  lineHeight: 1.45,
                }}
              />
            </div>
          </div>

          {/* Save */}
          {saveError && <p role="alert">A mentés nem sikerült. A szöveged megmaradt, próbáld újra.</p>}
          <button className="cta-primary capture-save" disabled={saving} onClick={() => { void save(close) }}>
            <Icon3D name="t-tick" size={22} />
            <span>{saving ? 'Mentés…' : `Mentés · ${slot.time}`}</span>
          </button>
        </div>
      )}
      </>
      )}
    </Sheet>
  )
}
