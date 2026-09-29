import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

// DS re-dress (mezo-setx.5.5): h2 role title (it IS the field's visible question, Rule 17 —
// wired via aria-labelledby), the creed quote in the Fraunces meta voice (.shcreed),
// 16px .shta field, cta-primary save.
// Üveg (mezo-me75u.3): ONE floating amber glass sheet (bible U2 rule 15); the save is a lit flat
// pill inside it, never glass in glass. Styling only — `nap-glass-sheet` in the `uveg nap oldalak` block.
export function IntentionSheet({ creed, onSave, onClose }:
  { creed: string | null; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  return (
    <Sheet onClose={onClose} labelledBy="focus-title" className="glass nap-glass-sheet">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 12 }}>
          <h2 id="focus-title" className="h-display size-lg">Mi ma a fókuszod?</h2>
          {creed && (
            <div className="shcreed">
              „{creed}"
            </div>
          )}
          <VoiceField domain="nap" onTranscript={(t) => setText((d) => appendDictation(d, t, 200))}>
            <textarea className="shta" value={text} onChange={(e) => setText(e.target.value)}
              maxLength={200} rows={2} autoFocus aria-labelledby="focus-title"
              placeholder="Ma arra figyelek, hogy…" />
          </VoiceField>
          <button className="cta-primary" disabled={!text.trim()}
            onClick={() => { onSave(text.trim()); close() }}>Hozzáadom</button>
        </div>
      )}
    </Sheet>
  )
}
