// Mezo · the per-exercise note editor of the in-workout flow (F4 durable note: PUT /api/train/exercises/{id}/note).
// Folyadék F4 (mezo-n4wf5.4, area C): a light sheet built to the prototype's `note` sheet
// (docs/design_2.0/prototypes/vilagos/edzes.js) — the note glyph, the exercise's name under the title, the field with
// dictation, „Mentés" + „Mégse". The `VoiceField` mic tile keeps its own look (converted in F8).
import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { FoSheetHead, SheetActs, TextArea } from '@/shared/ui/folyadek'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

export function NoteEditSheet({
  initialNote,
  exerciseName,
  onSave,
  onClose,
}: {
  initialNote: string
  /** Whose note this is — the line under the title. */
  exerciseName?: string
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(initialNote)
  return (
    <Sheet onClose={onClose} labelledBy="note-edit-title" className="sheet-nested fo-sheet el-sheet">
      {(close) => (
        <>
          <FoSheetHead eyebrow="Gyakorlat-jegyzet" title="Jegyzet a gyakorlathoz" titleId="note-edit-title" sub={exerciseName} icon="t-note" onClose={close} />
          <VoiceField domain="train" className="el-note" onTranscript={(t) => setText((d) => appendDictation(d, t, 500))}>
            <TextArea
              aria-label="Gyakorlat-jegyzet szerkesztése"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="Forma-emlékeztető, beállítás, fájdalom-jelzés…"
            />
          </VoiceField>
          <SheetActs
            label="Mentés" onCancel={close}
            onSave={() => {
              onSave(text.trim())
              close()
            }}
          />
        </>
      )}
    </Sheet>
  )
}
