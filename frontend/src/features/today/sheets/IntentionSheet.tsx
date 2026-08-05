import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'

// DS re-dress (mezo-setx.5.5): h2 role title (it IS the field's visible question, Rule 17 —
// wired via aria-labelledby), the creed quote in the Fraunces meta voice (.shcreed),
// 16px .shta field, cta-primary save.
export function IntentionSheet({ creed, onSave, onClose }:
  { creed: string | null; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  return (
    <Sheet onClose={onClose} labelledBy="focus-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 12 }}>
          <h2 id="focus-title" className="h-display size-lg">Mi ma a fókuszod?</h2>
          {creed && (
            <div className="shcreed">
              „{creed}"
            </div>
          )}
          <textarea className="shta" value={text} onChange={(e) => setText(e.target.value)}
            maxLength={200} rows={2} autoFocus aria-labelledby="focus-title"
            placeholder="Ma arra figyelek, hogy…" />
          <button className="cta-primary" disabled={!text.trim()}
            onClick={() => { onSave(text.trim()); close() }}>Hozzáadom</button>
        </div>
      )}
    </Sheet>
  )
}
