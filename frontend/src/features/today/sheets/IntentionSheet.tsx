import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Btn, FoSheetHead, Note, TextArea, TwoBtn, Why } from '@/shared/ui/folyadek'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

// The morning focus (the `daily_intention` row of the routine). The sheet title IS the field's
// visible question (Rule 17: wired via aria-labelledby); the creed, when the user has one, is the
// quiet „why" above the field.
// FOLYADÉK (mezo-n4wf5.2, prototypes/vilagos/nap.js `SHEETS.intention`): a light sheet: head with
// the icon chip, the creed as a `Why`, the field, a footnote, Mégse / Hozzáadom.
export function IntentionSheet({ creed, onSave, onClose }:
  { creed: string | null; onSave: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('')
  return (
    <Sheet onClose={onClose} labelledBy="focus-title" className="fo-sheet nck2-sheet">
      {(close) => (
        <>
          <FoSheetHead titleId="focus-title" title="Mi ma a fókuszod?" sub="Rutin · reggel · a mai szándék" icon="t-ring" onClose={close} />
          {creed && <Why icon="t-compass">„{creed}”</Why>}
          <VoiceField domain="nap" className="nck2-field" onTranscript={(t) => setText((d) => appendDictation(d, t, 200))}>
            <TextArea value={text} onChange={(e) => setText(e.target.value)}
              maxLength={200} rows={2} autoFocus aria-labelledby="focus-title"
              placeholder="pl. nyugodt tempó" />
          </VoiceField>
          <Note>Legfeljebb 200 karakter. Este megkérdezzük, sikerült-e eszerint élned a napot.</Note>
          <TwoBtn className="nck2-save">
            <Btn ghost onClick={close}>Mégse</Btn>
            <Btn disabled={!text.trim()} onClick={() => { onSave(text.trim()); close() }}>Hozzáadom</Btn>
          </TwoBtn>
        </>
      )}
    </Sheet>
  )
}
