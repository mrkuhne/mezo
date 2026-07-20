import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'

export function CreedSheet({ initial, onSave, onClose }:
  { initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(initial)
  return (
    <Sheet onClose={onClose} labelledBy="creed-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 12 }}>
          <h2 id="creed-title" style={{ font: '700 18px/1.2 var(--ff-display)' }}>A vezérelved</h2>
          <p className="text-tertiary" style={{ fontSize: 12.5 }}>
            Egy mondat az irányról, ami a döntéseidet vezeti — erre nézel rá minden nap.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={3}
            placeholder="Minden döntésem a célom felé visz — szándékkal élek."
            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--card-border)',
              background: 'var(--surface-1)', color: 'var(--ink)', font: '500 14px/1.4 var(--ff-body)', resize: 'none' }} />
          <button className="hab-act" disabled={!text.trim()} style={{ alignSelf: 'flex-end' }}
            onClick={() => { onSave(text.trim()); close() }}>Mentés</button>
        </div>
      )}
    </Sheet>
  )
}
