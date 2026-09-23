// ============================================================
// Mezo · CheckInSheet
// 4×/nap dimenziók: Energia · Stressz · Testi · Mentális tisztaság
// + opcionális voice/free note
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { Sheet } from '@/shared/ui/Sheet'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { CaptureArt } from '@/shared/ui/CaptureArt'
import type { CheckinSlot, CheckinValues } from '@/data/types'

type DimId = keyof CheckinValues

interface CheckinDim {
  id: DimId
  label: string
  sub: string
  color: string
  lowLabel: string
  highLabel: string
}

export const CHECKIN_DIMS: CheckinDim[] = [
  {
    id: 'energy',
    label: 'Energia',
    sub: 'Mennyi van benned ebben a pillanatban',
    color: 'var(--dv-coral)',
    lowLabel: 'Üres',
    highLabel: 'Tele',
  },
  {
    id: 'stress',
    label: 'Stressz',
    sub: 'Mennyire vagy feszült most',
    color: 'var(--warning-base)',
    lowLabel: 'Nyugodt',
    highLabel: 'Túlfeszült',
  },
  {
    id: 'body',
    label: 'Testi',
    sub: 'Hogy érzed magad fizikailag',
    color: 'var(--dv-rose)',
    lowLabel: 'Lerakva',
    highLabel: 'Friss',
  },
  {
    id: 'mental',
    label: 'Mentális tisztaság',
    sub: 'Mennyire tiszta a fej',
    color: 'var(--dv-sky)',
    lowLabel: 'Köd',
    highLabel: 'Éles',
  },
]

export function CheckInSheet({
  slot,
  onClose,
  onSave,
}: {
  slot: CheckinSlot
  slotIdx: number
  onClose: () => void
  onSave: (data: Partial<CheckinSlot>) => void | Promise<void>
}) {
  const [values, setValues] = useState<CheckinValues>(
    () => slot.values ?? { energy: 7, stress: 4, body: 7, mental: 7 },
  )
  const [note, setNote] = useState(slot.note ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [step, setStep] = useState(0) // 0..3 = dim, 4 = note
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isLast = step >= CHECKIN_DIMS.length
  const dim = CHECKIN_DIMS[step]

  const handleSetValue = (val: number) => {
    if (!dim) return
    setValues(v => ({ ...v, [dim.id]: val }))
    // Auto-advance after a tick — feels native
    advanceTimer.current = setTimeout(() => setStep(s => s + 1), 200)
  }

  // The auto-advance timer must not outlive the component: a timer surviving
  // unmount calls setStep (a parent-less but still post-teardown setState)
  // after the test environment tears down — the nondeterministic
  // "window is not defined" CI failure (mezo-91rw class, see Sheet.tsx).
  useEffect(
    () => () => {
      if (advanceTimer.current != null) clearTimeout(advanceTimer.current)
    },
    [],
  )

  const save = async (close: () => void) => {
    if (saving) return
    setSaving(true)
    setSaveError(false)
    try {
      await onSave({
        state: 'done',
        values,
        note: note.trim() || null,
        savedAt: new Date().toISOString(),
      })
      close()
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="checkin-title" className="capture-sheet capture-tone-checkin glass">
      {(close) => (
      <>
      <CaptureHeader id="checkin-title" title="Hogy vagyunk?" eyebrow={`Heartbeat · ${slot.time}`}
        kind="checkin" onClose={close} />

      {/* Üveg (mezo-me75u.3, `SH.checkin`): five lit progress segments, the step's number as the
          one loud value (the 3D mark + a glowing numeral on a frameless halo in the step's hue),
          the 1–10 scale as recess → tinted → solid cells. */}
      <div className="capture-prog" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => <i key={i} className={i <= step ? 'on' : undefined} />)}
      </div>

      {/* Step body */}
      {!isLast && (
        <div className="col capture-step" style={{ '--c': dim.color } as CSSProperties}>
          <div className="col gap-xs">
            <span className="capture-stepl">
              {String(step + 1).padStart(2, '0')} / 04 · {dim.label}
            </span>
            <div className="capture-stepq">
              {dim.sub}
            </div>
          </div>

          {/* Selected value display */}
          <div className="capture-check-orbit" data-step={dim.id}>
            <CaptureArt kind="checkin" size={58} />
            <div className="capture-check-value">
              {values[dim.id]}
              <small> / 10</small>
            </div>
          </div>

          {/* 1-10 scale */}
          <div>
            <div className="capture-rating-scale">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                const active = values[dim.id] === n
                const filled = values[dim.id] >= n
                return (
                  <button
                    key={n}
                    onClick={() => handleSetValue(n)}
                    className="capture-scale-cell"
                    data-state={active ? 'active' : filled ? 'filled' : undefined}
                    style={{ '--cell-hue': dim.color } as CSSProperties}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <div className="capture-scale-l">
              <span>{dim.lowLabel}</span>
              <span>{dim.highLabel}</span>
            </div>
          </div>

          {/* Nav — typographic arrows (aria-hidden), the names stay „Vissza" / „Kihagy" */}
          <div className="capture-stepnav">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(s => s - 1)}>
                <span aria-hidden="true">‹</span> Vissza
              </button>
            ) : <span />}
            <button type="button" onClick={() => setStep(s => s + 1)}>
              Kihagy <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary + note step */}
      {isLast && (
        <div className="col gap-lg">
          <div className="col gap-xs">
            <span className="capture-sum-eyebrow">Megvan · összegzés</span>
            <div className="capture-sum-title">
              Bármi még amit szeretnél?
            </div>
          </div>

          {/* Summary grid */}
          <div className="capture-sum4">
            {CHECKIN_DIMS.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => setStep(CHECKIN_DIMS.findIndex(x => x.id === d.id))}
                className="capture-sum"
                style={{ '--c': d.color } as CSSProperties}
              >
                <small>{d.label}</small>
                <b>{values[d.id]}</b>
                <span className="uv-bar" aria-hidden="true"><b style={{ '--w': (values[d.id] * 10) + '%' } as CSSProperties} /></span>
              </button>
            ))}
          </div>

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
