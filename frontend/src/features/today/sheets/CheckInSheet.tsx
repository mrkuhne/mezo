// ============================================================
// Mezo · CheckInSheet
// 4×/nap dimenziók: Energia · Stressz · Testi · Mentális tisztaság
// + opcionális voice/free note
// ============================================================
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '@/shared/ui/Icon'
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
    <Sheet onClose={onClose} labelledBy="checkin-title" className="capture-sheet capture-tone-checkin">
      {(close) => (
      <>
      <CaptureHeader id="checkin-title" title="Hogy vagyunk?" eyebrow={`Heartbeat · ${slot.time}`}
        kind="checkin" onClose={close} />

      {/* Step progress */}
      <div className="row gap-xs" style={{ margin: '16px 0 18px' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= step ? 'var(--primary-base)' : 'var(--surface-recess)',
            transition: 'background 0.3s ease',
          }} />
        ))}
      </div>

      {/* Step body */}
      {!isLast && (
        <div className="col gap-lg">
          <div className="col gap-xs">
            <span className="label-mono" style={{ color: dim.color }}>
              {String(step + 1).padStart(2, '0')} / 04 · {dim.label}
            </span>
            <div style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 18, fontWeight: 600,
              lineHeight: 1.25, color: 'var(--text-primary)',
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginTop: 6,
            }}>
              {dim.sub}
            </div>
          </div>

          {/* Selected value display */}
          <div className="capture-check-orbit" data-step={dim.id} style={{ color: dim.color }}>
            <CaptureArt kind="checkin" />
            <div style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 56, fontWeight: 200, letterSpacing: '-0.04em',
              lineHeight: 1, color: dim.color,
              transition: 'color var(--duration-normal) var(--ease-out)',
            }}>
              {values[dim.id]}
            </div>
            <span className="label-mono" style={{ color: 'var(--text-muted)', marginTop: 4 }}>
              / 10
            </span>
          </div>

          {/* 1-10 scale */}
          <div>
            <div className="row capture-rating-scale" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 4,
            }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                const active = values[dim.id] === n
                const filled = values[dim.id] >= n
                return (
                  <button
                    key={n}
                    onClick={() => handleSetValue(n)}
                    className="capture-scale-cell"
                    data-state={active ? 'active' : filled ? 'filled' : undefined}
                    style={{ '--cell-hue': dim.color, padding: '14px 0', fontSize: 13 } as CSSProperties}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
              <span className="label-mono" style={{ color: 'var(--text-muted)' }}>{dim.lowLabel}</span>
              <span className="label-mono" style={{ color: 'var(--text-muted)' }}>{dim.highLabel}</span>
            </div>
          </div>

          {/* Nav */}
          <div className="row gap-sm" style={{ paddingTop: 8 }}>
            {step > 0 && (
              <button className="cta-ghost flex-1" style={{ padding: '10px' }} onClick={() => setStep(s => s - 1)}>
                ← Vissza
              </button>
            )}
            <button className="cta-ghost flex-1" style={{ padding: '10px' }} onClick={() => setStep(s => s + 1)}>
              Kihagy →
            </button>
          </div>
        </div>
      )}

      {/* Summary + note step */}
      {isLast && (
        <div className="col gap-lg">
          <div className="col gap-xs">
            <span className="eyebrow brand">Megvan · összegzés</span>
            <div style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 18, fontWeight: 600,
              lineHeight: 1.25, color: 'var(--text-primary)',
              textTransform: 'uppercase', letterSpacing: '0.02em',
              marginTop: 6,
            }}>
              Bármi még amit szeretnél?
            </div>
          </div>

          {/* Summary grid */}
          <div className="row gap-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {CHECKIN_DIMS.map(d => (
              <button
                key={d.id}
                onClick={() => setStep(CHECKIN_DIMS.findIndex(x => x.id === d.id))}
                className="card"
                style={{ padding: 12, textAlign: 'left', background: 'var(--surface-1)' }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="label-mono" style={{ color: d.color }}>{d.label}</span>
                  <span style={{ fontFamily: 'var(--ff-display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: d.color, lineHeight: 1 }}>
                    {values[d.id]}
                  </span>
                </div>
                <div className="bar mt-sm" style={{ height: 3 }}>
                  <div className="bar-fill" style={{ width: (values[d.id] * 10) + '%', background: d.color }} />
                </div>
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
          <button className="cta-primary" disabled={saving} onClick={() => { void save(close) }}>
            <Icon name="check" size={16} />
            <span>{saving ? 'Mentés…' : `Mentés · ${slot.time}`}</span>
          </button>
        </div>
      )}
      </>
      )}
    </Sheet>
  )
}
