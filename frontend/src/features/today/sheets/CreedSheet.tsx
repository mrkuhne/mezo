import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'

// DS re-dress (mezo-setx.5.5): h2 role title, the intro doubles as the field's visible
// label (Rule 17 — wired via aria-labelledby), 16px .shta field, cta-primary save.
export function CreedSheet({ initial, onSave, onClose }:
  { initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial)
  return (
    <Sheet onClose={onClose} labelledBy="creed-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 12 }}>
          <h2 id="creed-title" className="h-display size-lg">A vezérelved</h2>
          <p id="creed-label" className="shlabel">
            Egy mondat az irányról, ami a döntéseidet vezeti — erre nézel rá minden nap.
          </p>
          <textarea className="shta" value={text} onChange={(e) => setText(e.target.value)}
            maxLength={280} rows={3} aria-labelledby="creed-title creed-label"
            placeholder="Minden döntésem a célom felé visz — szándékkal élek." />
          <button className="cta-primary" disabled={!text.trim()}
            onClick={() => { onSave(text.trim()); close() }}>Mentés</button>
        </div>
      )}
    </Sheet>
  )
}
