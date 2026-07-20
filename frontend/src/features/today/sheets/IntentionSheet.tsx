import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'

export function IntentionSheet({ creed, onSave, onClose }:
  { creed: string | null; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  return (
    <Sheet onClose={onClose} labelledBy="focus-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px', gap: 12 }}>
          <h2 id="focus-title" style={{ font: '700 18px/1.2 var(--ff-display)' }}>Mi ma a fókuszod?</h2>
          {creed && (
            <div className="intent-creed" style={{ background: 'var(--wash-lav)', padding: '10px 12px', borderRadius: 12 }}>
              „{creed}"
            </div>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={200} rows={2} autoFocus
            placeholder="Ma arra figyelek, hogy…"
            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid var(--card-border)',
              background: 'var(--surface-1)', color: 'var(--ink)', font: '500 14px/1.4 var(--ff-body)', resize: 'none' }} />
          <button className="hab-act" disabled={!text.trim()} style={{ alignSelf: 'flex-end' }}
            onClick={() => { onSave(text.trim()); close() }}>Hozzáadom</button>
        </div>
      )}
    </Sheet>
  )
}
