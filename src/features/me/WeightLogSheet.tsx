import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Icon } from '@/components/ui/Icon'
import type { WeightLogInput } from '@/data/types'

export function WeightLogSheet({
  onClose,
  onSave,
  currentWeight,
}: {
  onClose: () => void
  onSave: (input: WeightLogInput) => void
  currentWeight: number
}) {
  const [val, setVal] = useState(currentWeight)
  const [note, setNote] = useState('')

  const save = (close: () => void) => {
    onSave({ date: new Date().toISOString().slice(0, 10), weightKg: val, note: note || undefined })
    close()
  }

  return (
    <Sheet onClose={onClose} labelledBy="weight-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow brand">Súly log · reggel</span>
              <div id="weight-log-title" className="h-display size-md" style={{ marginTop: 4 }}>Mi a számunk ma?</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>
          <div className="card notch-12" style={{ padding: 18, marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: 'var(--ff-display)', fontSize: 56, fontWeight: 600, color: 'var(--brand-glow)', lineHeight: 1, textShadow: '0 0 24px rgba(94, 234, 212, 0.4)' }}>{val.toFixed(1)}</span>
              <span style={{ fontFamily: 'var(--ff-mono)', fontSize: 14, color: 'var(--text-tertiary)' }}>kg</span>
            </div>
            <div className="row gap-sm mt-lg" style={{ justifyContent: 'center' }}>
              <button onClick={() => setVal(v => +(v - 0.1).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="minus" size={12} /> 0.1</button>
              <button onClick={() => setVal(v => +(v - 0.5).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="minus" size={12} /> 0.5</button>
              <button onClick={() => setVal(v => +(v + 0.5).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="plus" size={12} /> 0.5</button>
              <button onClick={() => setVal(v => +(v + 0.1).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="plus" size={12} /> 0.1</button>
            </div>
          </div>
          <div className="col gap-sm">
            <span className="label-mono">Egy mondat · opcionális</span>
            <div className="card notch-4" style={{ padding: 10 }}>
              <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))}
                placeholder='pl. "vasárnap reggel · folyadékvesztés" · "Reta D1 reggel"'
                style={{ width: '100%', minHeight: 50, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
            </div>
          </div>
          <div className="card notch-4 mt-lg" style={{ padding: 10, background: 'rgba(94, 234, 212, 0.03)' }}>
            <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
              <Icon name="sparkle" size={11} color="var(--brand-glow)" />
              <p style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
                {val < currentWeight - 0.5 ? 'Nagy nap — a 7-napos átlagba viszont csak részben mehet bele. Memo a vasárnapi mérésekhez.' :
                 val > currentWeight + 0.5 ? 'Magas érték — gondolj a vízsúly-kalibrálásra. Volleyball + magas só napon ez normális.' :
                 'Stabil tartomány. Beírom a 7-napos MA-ba.'}
              </p>
            </div>
          </div>
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost notch-4 flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary notch-4 flex-1" onClick={() => save(close)}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
