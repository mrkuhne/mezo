// ============================================================
// Mezo · CheckInSheet
// 4×/nap dimenziók: Energia · Stressz · Testi · Mentális tisztaság
// + opcionális voice/free note
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { Sheet } from '@/shared/ui/Sheet'
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
  onSave: (data: Partial<CheckinSlot>) => void
}) {
  const [values, setValues] = useState<CheckinValues>(
    () => slot.values ?? { energy: 7, stress: 4, body: 7, mental: 7 },
  )
  const [note, setNote] = useState('')
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

  const save = (close: () => void) => {
    onSave({
      state: 'done',
      values,
      note: note.trim() || null,
      savedAt: new Date().toISOString(),
    })
    close()
  }

  return (
    <Sheet onClose={onClose}>
      {(close) => (
      <>
      {/* Header */}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div className="col">
          <span className="eyebrow brand">Heartbeat · {slot.time}</span>
          <div className="h-display size-md" style={{ marginTop: 4 }}>Hogy vagyunk?</div>
        </div>
        <button className="chip" onClick={close} style={{ padding: '6px 8px' }}>
          <Icon name="x" size={12} />
        </button>
      </div>

      {/* Step progress */}
      <div className="row gap-xs" style={{ margin: '16px 0 18px' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 3,
            background: i <= step ? 'var(--primary-base)' : 'var(--surface-recess)',
            transition: 'background 0.3s ease',
            boxShadow: i === step ? '0 0 6px var(--primary-base)' : 'none',
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
          <div className="col" style={{ alignItems: 'center', padding: '12px 0 4px' }}>
            <div style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 56, fontWeight: 200, letterSpacing: '-0.04em',
              lineHeight: 1, color: dim.color,
              textShadow: `0 0 24px color-mix(in srgb, ${dim.color} 25%, transparent)`,
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
            <div className="row" style={{
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
                    style={{
                      padding: '14px 0', minHeight: 44,
                      background: active ? dim.color : filled ? `color-mix(in srgb, ${dim.color} 20%, transparent)` : 'var(--surface-recess)',
                      border: '1px solid ' + (active ? dim.color : filled ? `color-mix(in srgb, ${dim.color} 35%, transparent)` : 'var(--divider)'),
                      color: active ? 'var(--text-inverse)' : filled ? dim.color : 'var(--text-muted)',
                      fontFamily: 'var(--ff-display)',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                      borderRadius: 'var(--r-sm)',
                      boxShadow: active ? `0 0 12px color-mix(in srgb, ${dim.color} 50%, transparent)` : 'none',
                    }}
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
              <label htmlFor="checkin-note" className="label-mono">Egy mondat · opcionális</label>
              <span className="label-mono" style={{ color: 'var(--text-muted)' }}>{note.length}/200</span>
            </div>
            {/* the decorative mic chip is gone (mezo-setx.5.5) — a control that does
                nothing is the ItemRow doctrine's dead button, not a form affordance */}
            <div className="card" style={{ padding: 10, display: 'flex', gap: 8 }}>
              <textarea
                id="checkin-note"
                value={note}
                onChange={e => setNote(e.target.value.slice(0, 200))}
                placeholder='pl. "tegnap volleyball után még izomláz" · "fejes meeting előtt"'
                style={{
                  flex: 1, minHeight: 50, resize: 'none',
                  fontSize: 16, color: 'var(--text-primary)',
                  lineHeight: 1.45,
                }}
              />
            </div>
          </div>

          {/* Companion observation */}
          <CheckInObservation values={values} slot={slot} />

          {/* Save */}
          <button className="cta-primary" onClick={() => save(close)}>
            <Icon name="check" size={16} />
            <span>Mentés · {slot.time}</span>
          </button>
        </div>
      )}
      </>
      )}
    </Sheet>
  )
}

// Mezo's reactive observation based on the values entered
function CheckInObservation({ values }: { values: CheckinValues; slot?: CheckinSlot }) {
  const obs = useMemo(() => {
    if (values.energy <= 4 && values.stress >= 6) {
      return {
        tone: 'concern',
        msg: 'Alacsony energia + magas stressz — ezt láttuk múlt kedden is volleyball után. Délután lehet hogy érdemes a Pull Day-t enyhébbre venni.',
      }
    }
    if (values.body <= 4) {
      return {
        tone: 'concern',
        msg: 'A testi 4 alatt van — ez a 3. nap a héten. Lehet hogy az alvás-mennyiség nem elég, vagy egy aktív niggle nyomja. Nézzünk rá ma?',
      }
    }
    if (values.energy >= 8 && values.mental >= 8) {
      return {
        tone: 'good',
        msg: 'Energia 8+, mentális 8+ — ez Pull Day-en a PR-attempt-re ideális ablak. Most aktiváltam a 107.5kg target predikciót.',
      }
    }
    if (values.stress >= 8) {
      return {
        tone: 'concern',
        msg: 'Magas stressz — most lélegezzünk együtt. Próbáljunk 4 másodperc be / 6 másodperc ki ritmust 2 percig, mielőtt belevágsz a következőbe.',
      }
    }
    return {
      tone: 'neutral',
      msg: 'Megvan, beírom. A 4×/nap mérés ritmusa az, amiből a heti memoir is épül — köszönöm.',
    }
  }, [values])

  const accent = obs.tone === 'concern' ? 'var(--warning-hover)' : obs.tone === 'good' ? 'var(--primary-deep)' : 'var(--text-secondary)'
  return (
    <div className="card" style={{
      padding: 12,
      background: obs.tone === 'good' ? 'var(--primary-bg)' : obs.tone === 'concern' ? 'var(--warning-bg)' : 'var(--surface-card)',
      borderColor: obs.tone === 'good' ? 'var(--primary-soft)' : obs.tone === 'concern' ? 'var(--warning-soft)' : 'var(--divider)',
    }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <Icon name="sparkle" size={12} color={accent} />
        <div className="col flex-1">
          <span className="label-mono" style={{ color: accent }}>Mezo · azonnali olvasat</span>
          <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5, marginTop: 6, color: 'var(--text-primary)' }}>{obs.msg}</p>
        </div>
      </div>
    </div>
  )
}
