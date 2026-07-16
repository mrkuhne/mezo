import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { affectColor } from '@/data/me/people'
import type { Affect, MentionLogInput, PersonEntry } from '@/data/types'

const TONES: [Affect, string][] = [
  ['positive', 'Jó'],
  ['neutral', 'OK'],
  ['mixed', 'Vegyes'],
  ['negative', 'Nehéz'],
]

export function PersonLogSheet({
  onClose,
  onSave,
  people,
  initialPersonId,
}: {
  onClose: () => void
  onSave: (input: MentionLogInput) => void
  people: PersonEntry[]
  initialPersonId?: string
}) {
  const [chosen, setChosen] = useState<string | null>(initialPersonId ?? null)
  const [tone, setTone] = useState<Affect>('positive')
  const [text, setText] = useState('')

  const save = (close: () => void) => {
    if (!chosen) return
    onSave({ personId: chosen, tone, text: text || undefined })
    close()
  }

  return (
    <Sheet onClose={onClose} labelledBy="person-log-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow" style={{ color: 'var(--lav-deep)' }}>People · gyors log</span>
              <div id="person-log-title" className="h-display size-md" style={{ marginTop: 4 }}>Mit jegyzünk meg?</div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>
          <div className="card notch-12" style={{ padding: 18, marginBottom: 14, textAlign: 'center',
            background: 'linear-gradient(180deg, var(--wash-lav) 0%, var(--surface-1) 100%)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--lav-deep)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <Icon name="mic" size={26} color="var(--text-inverse)" />
            </div>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: 14, fontWeight: 600, marginTop: 12 }}>Tartsd nyomva · mondd el</div>
            <span className="text-secondary" style={{ fontSize: 11, marginTop: 4, display: 'block', lineHeight: 1.5 }}>
              Mezo kihallja a nevet, a hangulatot, és magától beköti.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>vagy gyors chip</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          </div>
          <div className="col gap-sm">
            <span style={SECTION_LABEL}>Ki?</span>
            <div className="row gap-xs flex-wrap">
              {people.map(p => (
                <button key={p.id} onClick={() => setChosen(p.id)}
                  className="chip"
                  style={{ padding: '6px 10px', fontSize: 11,
                    background: chosen === p.id ? `color-mix(in srgb, ${affectColor(p.affect_baseline)} 14%, transparent)` : 'var(--surface-2)',
                    borderColor: chosen === p.id ? affectColor(p.affect_baseline) : 'var(--border-subtle)',
                    color: chosen === p.id ? affectColor(p.affect_baseline) : 'var(--text-secondary)' }}>
                  {p.initial} · {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="col gap-sm mt-md">
            <span style={SECTION_LABEL}>Hogy érzed</span>
            <div className="row gap-xs">
              {TONES.map(([k, l]) => (
                <button key={k} onClick={() => setTone(k)}
                  className="chip flex-1"
                  style={{ padding: '8px 10px', fontSize: 11, justifyContent: 'center',
                    background: tone === k ? `color-mix(in srgb, ${affectColor(k)} 14%, transparent)` : 'var(--surface-2)',
                    borderColor: tone === k ? affectColor(k) : 'var(--border-subtle)',
                    color: tone === k ? affectColor(k) : 'var(--text-secondary)' }}>{l}</button>
              ))}
            </div>
          </div>
          <div className="col gap-sm mt-md">
            <span style={SECTION_LABEL}>Egy mondat · opcionális</span>
            <div className="card notch-4" style={{ padding: 10 }}>
              <textarea value={text} onChange={e => setText(e.target.value.slice(0, 240))}
                placeholder='pl. "Petrával hosszú vacsi, csendben"'
                style={{ width: '100%', minHeight: 60, resize: 'none', fontSize: 13, lineHeight: 1.45 }} />
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
