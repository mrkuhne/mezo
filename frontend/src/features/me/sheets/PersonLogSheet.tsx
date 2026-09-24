import { useState, type CSSProperties } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
import { toneColor } from '@/features/me/logic/peopleVisuals'
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

  // Üveg (mezo-me75u.7, prototype sheet `plog`): ONE floating rose glass sheet (bible U2 rule 15);
  // the voice hint, the chips, the note box and Mégse are flat, Mentés is the lit rose pill.
  // The person and tone chips light up in the chosen person's / tone's colour.
  return (
    <Sheet onClose={onClose} labelledBy="person-log-title" className="glass ppl-sheet">
      {(close) => (
        <div className="ppl-sh">
          <div className="ppl-shh">
            <Icon3D name="t-people" size={48} />
            <div className="ppl-shh-tx">
              <span className="ppl-sh-eye">Emberek · gyors log</span>
              <div id="person-log-title" className="ppl-sh-title">Mit jegyzünk meg?</div>
            </div>
            <button type="button" className="ppl-sh-x" aria-label="Bezárás" onClick={close}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
          <div className="ppl-sh-voice">
            <span className="ppl-sh-mic"><Icon3D name="t-mic" size={30} /></span>
            <span className="ppl-sh-voicetx">
              <strong>Tartsd nyomva · mondd el</strong>
              <small>Mezo kihallja a nevet, a hangulatot, és magától beköti.</small>
            </span>
          </div>
          <div className="ppl-sh-or"><span>vagy gyors chip</span></div>
          <div className="ppl-sh-field">
            <span className="ppl-sh-lbl">Ki?</span>
            <div className="ppl-sh-chips">
              {people.map(p => (
                <button key={p.id} type="button" onClick={() => setChosen(p.id)}
                  className={`ppl-sh-chip${chosen === p.id ? ' on' : ''}`}
                  aria-pressed={chosen === p.id}
                  style={{ '--c': toneColor(p.affect_baseline) } as CSSProperties}>
                  {p.initial} · {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="ppl-sh-field">
            <span className="ppl-sh-lbl">Hogy érzed</span>
            <div className="ppl-sh-chips ppl-sh-tones">
              {TONES.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTone(k)}
                  className={`ppl-sh-chip${tone === k ? ' on' : ''}`}
                  aria-pressed={tone === k}
                  style={{ '--c': toneColor(k) } as CSSProperties}>
                  <i className="ppl-sh-dot" aria-hidden="true" />{l}
                </button>
              ))}
            </div>
          </div>
          <div className="ppl-sh-field">
            <span className="ppl-sh-lbl">Egy mondat · opcionális</span>
            <textarea className="ppl-sh-ta" value={text} onChange={e => setText(e.target.value.slice(0, 240))}
              placeholder='pl. "Petrával hosszú vacsi, csendben"' />
          </div>
          <div className="ppl-sh-pair">
            <button type="button" className="ppl-sh-ghost" onClick={close}>Mégse</button>
            <button type="button" className="ppl-sh-cta" onClick={() => save(close)}>
              <Icon3D name="t-tick" size={18} /> Mentés
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
