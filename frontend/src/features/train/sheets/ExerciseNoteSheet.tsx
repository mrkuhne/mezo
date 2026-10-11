// Mezo · the per-exercise note editor of the in-workout flow (F4 durable note: PUT /api/train/exercises/{id}/note).
// Moved out of pages/ActiveWorkoutPage.tsx unchanged (mezo-n4wf5.4 foundation) so the session sheets own their own files.
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon3D } from '@/shared/ui/clay'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

export function NoteEditSheet({
  initialNote,
  onSave,
  onClose,
}: {
  initialNote: string
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(initialNote)
  return (
    <Sheet onClose={onClose} labelledBy="note-edit-title" className="sheet-nested glass wos-sheet is-lav">
      {(close) => (
        <>
          {/* U4: a floating lavender glass sheet — the prototype's `note` sheet. */}
          <div className="wos-sheet-head">
            <Icon3D name="t-note" size={52} className="wos-sheet-art3d" />
            <span className="wos-sheet-title">
              <span className="wos-sheet-eb">Gyakorlat-jegyzet</span>
              <h3 id="note-edit-title">Jegyzet a gyakorlathoz</h3>
            </span>
          </div>
          <VoiceField domain="train" onTranscript={(t) => setText((d) => appendDictation(d, t, 500))}>
            <textarea
              className="wos-sheet-ta"
              aria-label="Gyakorlat-jegyzet szerkesztése"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Forma-emlékeztető, beállítás, fájdalom-jelzés…"
            />
          </VoiceField>
          <div className="wos-sheet-two">
            <button type="button" className="wos-pill is-block" onClick={close}>
              Mégse
            </button>
            <button
              type="button"
              className="wos-primary"
              onClick={() => {
                onSave(text.trim())
                close()
              }}
            >
              <Icon3D name="t-tick" size={22} />
              Mentés
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
