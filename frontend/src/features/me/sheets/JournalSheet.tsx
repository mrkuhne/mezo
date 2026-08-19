import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { useJournalActions } from '@/data/hooks'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import type { JournalNote } from '@/data/journal/journalTypes'

interface JournalSheetProps {
  onClose: () => void
  /** Task 7's /me/naplo edit flow passes the note being edited; omitted → create mode. */
  entry?: JournalNote | null
}

// Free-prose capture sheet for the journal (mezo-b3pp.1): QuickInput's "Napló" option opens this
// directly, Task 7's /me/naplo page reopens it with `entry` set to edit/delete an existing note.
export function JournalSheet({ onClose, entry }: JournalSheetProps) {
  const { addNote, updateNote, removeNote, pending } = useJournalActions()
  const [text, setText] = useState(entry?.text ?? '')
  const [date, setDate] = useState(entry?.occurredOn ?? localDateString())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // The transcript is appended to whatever's already typed — same "check before it commits"
  // idiom as ChatPage's composer (useVoiceInput.ts:16-21).
  const voice = useVoiceInput((t) => setText((d) => (d ? `${d} ${t}` : t)))
  const recording = voice.state === 'recording'

  const save = (close: () => void) => {
    if (!text.trim() || pending) return
    const write = entry ? updateNote(entry.id, text.trim(), date) : addNote(text.trim(), date)
    void write.then(close)
  }

  return (
    <Sheet onClose={onClose} labelledBy="journal-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow">Napló</span>
              <div id="journal-title" className="h-display size-md" style={{ marginTop: 4 }}>
                {entry ? 'Bejegyzés szerkesztése' : 'Mi jár a fejedben?'}
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          <div className="col gap-sm">
            <div className="card" style={{ padding: 10, position: 'relative' }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-labelledby="journal-title"
                placeholder="Írd le, mi jár a fejedben…"
                autoFocus
                style={{ width: '100%', minHeight: 120, resize: 'none', fontSize: 16, lineHeight: 1.45, paddingRight: 36 }}
              />
              <button
                type="button"
                className={cn('chip', recording && 'chat-mic-live')}
                style={{
                  position: 'absolute', top: 8, right: 8, padding: 8,
                  ...(recording
                    ? { background: 'var(--wash-amber)', borderColor: 'var(--coral-deep)', color: 'var(--coral-deep)' }
                    : null),
                }}
                onClick={voice.toggle}
                disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
                aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
                aria-pressed={recording}
              >
                <Icon name={recording ? 'voice-wave' : 'mic'} size={14} />
              </button>
            </div>
            {voice.error && (
              <p className="text-tertiary" style={{ fontSize: 11 }}>{voice.error}</p>
            )}

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
              <span style={SECTION_LABEL}>Dátum</span>
              <input
                type="date"
                aria-label="Dátum"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
            <button className="cta-primary flex-1" onClick={() => save(close)} disabled={!text.trim() || pending}>Mentem</button>
          </div>

          {entry && (
            <div className="col gap-sm mt-lg">
              {confirmingDelete ? (
                <div className="row gap-sm">
                  <button
                    type="button"
                    className="cta-ghost flex-1"
                    disabled={pending}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Mégse
                  </button>
                  <button
                    type="button"
                    className="cta-primary flex-1"
                    disabled={pending}
                    style={{ background: 'var(--error)', borderColor: 'var(--error)', color: '#fff' }}
                    onClick={() => void removeNote(entry.id).then(close)}
                  >
                    Biztosan törlöd?
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="cta-ghost"
                  disabled={pending}
                  style={{ borderColor: 'color-mix(in srgb, var(--error) 30%, transparent)', color: 'var(--error)' }}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Törlés
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
