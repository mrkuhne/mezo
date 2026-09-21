import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { CaptureHeader } from '@/shared/ui/CaptureHeader'
import { Icon } from '@/shared/ui/Icon'
import type { WeightLogInput } from '@/data/types'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'

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
    <Sheet onClose={onClose} labelledBy="weight-log-title" className="capture-sheet capture-tone-weight">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <CaptureHeader id="weight-log-title" kind="weight" title="Mi a számunk ma?"
            subtitle="Egy mérés a napodban." onClose={close} />
          <div className="card capture-hero" style={{ padding: 18, marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: 'center', alignItems: 'baseline', gap: 6 }}>
              <span className="capture-hero-value">{val.toFixed(1)}</span>
              <span className="capture-hero-unit">kg</span>
            </div>
            <div className="capture-ruler" aria-hidden="true" />
            <div className="row gap-sm mt-lg" style={{ justifyContent: 'center' }}>
              <button onClick={() => setVal(v => +(v - 0.1).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="minus" size={12} /> 0.1</button>
              <button onClick={() => setVal(v => +(v - 0.5).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="minus" size={12} /> 0.5</button>
              <button onClick={() => setVal(v => +(v + 0.5).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="plus" size={12} /> 0.5</button>
              <button onClick={() => setVal(v => +(v + 0.1).toFixed(1))} className="chip" style={{ padding: '8px 14px' }}><Icon name="plus" size={12} /> 0.1</button>
            </div>
          </div>
          <div className="col gap-sm">
            <span style={SECTION_LABEL}>Egy mondat · opcionális</span>
            <div className="card" style={{ padding: 10 }}>
              <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 200))}
                placeholder='pl. "vasárnap reggel · folyadékvesztés" · "sok só tegnap"'
                style={{ width: '100%', minHeight: 50, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
            </div>
          </div>
          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary flex-1" onClick={() => save(close)}>
              <Icon name="check" size={14} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
