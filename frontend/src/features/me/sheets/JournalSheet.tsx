import { useState } from 'react'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { SECTION_LABEL } from '@/shared/ui/sectionLabel'
import { useDecisionActions, useJournalActions, useGratitudeActions } from '@/data/hooks'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import type { JournalNote } from '@/data/journal/journalTypes'

type Mode = 'note' | 'decision' | 'gratitude'

interface JournalSheetProps {
  onClose: () => void
  /** Task 7's /me/naplo edit flow passes the note being edited; omitted → create mode. */
  entry?: JournalNote | null
  /** QuickInput's „Hála" tile opens the sheet directly in gratitude mode. */
  initialMode?: Mode
}

// Free-prose capture sheet for the journal (mezo-b3pp.1): QuickInput's "Napló" option opens this
// directly, Task 7's /me/naplo page reopens it with `entry` set to edit/delete an existing note.
// Create mode also offers a "Döntés" toggle (mezo-b3pp.4) that routes the save through the
// decision hook instead of the note hook — editing an existing note never offers this, there is
// no backend operation to convert a note into a decision.
// Task 7 adds a "Hála" mode: 1–3 gratitude lines with an optional life-area chip, batch-saved
// through the gratitude hook.
export function JournalSheet({ onClose, entry, initialMode }: JournalSheetProps) {
  const { addNote, updateNote, removeNote, pending: journalPending } = useJournalActions()
  const { addDecision, pending: decisionPending } = useDecisionActions()
  const { addEntry, pending: gratitudePending } = useGratitudeActions()
  const [mode, setMode] = useState<Mode>(initialMode ?? 'note')
  const [text, setText] = useState(entry?.text ?? '')
  const [rows, setRows] = useState<string[]>([''])
  const [lifeArea, setLifeArea] = useState<string | null>(null)
  const [date, setDate] = useState(entry?.occurredOn ?? localDateString())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // The transcript is appended to whatever's already typed — same "check before it commits"
  // idiom as ChatPage's composer (useVoiceInput.ts:16-21).
  const voice = useVoiceInput((t) => setText((d) => (d ? `${d} ${t}` : t)))
  const recording = voice.state === 'recording'
  const busy = journalPending || decisionPending || gratitudePending

  const save = (close: () => void) => {
    if (mode === 'gratitude') {
      const nonEmpty = rows.map(r => r.trim()).filter(Boolean)
      if (nonEmpty.length === 0 || busy) return
      const writes = nonEmpty.map(t => addEntry(t, lifeArea, date))
      void Promise.all(writes).then(close)
      return
    }
    if (!text.trim() || busy) return
    const write =
      mode === 'decision'
        ? addDecision(text.trim(), date)
        : entry
          ? updateNote(entry.id, text.trim(), date)
          : addNote(text.trim(), date)
    void write.then(close)
  }

  const gratitudeTitle = 'Hálabejegyzés'
  const title = entry ? 'Bejegyzés szerkesztése'
    : mode === 'decision' ? 'Milyen döntést hoztál?'
    : mode === 'gratitude' ? gratitudeTitle
    : 'Mi jár a fejedben?'

  return (
    <Sheet onClose={onClose} labelledBy="journal-title">
      {(close) => (
        <div className="col" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="col">
              <span className="eyebrow">Napló</span>
              <div id="journal-title" className="h-display size-md" style={{ marginTop: 4 }}>
                {title}
              </div>
            </div>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}><Icon name="x" size={12} /></button>
          </div>

          {!entry && (
            <div className="row gap-sm" role="group" aria-label="Bejegyzés típusa" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="chip"
                aria-pressed={mode === 'note'}
                onClick={() => setMode('note')}
              >
                Napló
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={mode === 'decision'}
                onClick={() => setMode('decision')}
              >
                Döntés
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={mode === 'gratitude'}
                onClick={() => setMode('gratitude')}
              >
                Hála
              </button>
            </div>
          )}

          <div className="col gap-sm">
            {mode === 'gratitude'
              ? (
                // Gratitude mode: 1–3 rows with optional life-area chip
                <>
                  {rows.map((r, i) => (
                    <div key={i} className="card" style={{ padding: 10, position: 'relative' }}>
                      <textarea
                        value={r}
                        onChange={(e) => {
                          const next = [...rows]
                          next[i] = e.target.value
                          setRows(next)
                        }}
                        aria-label={`${i + 1}. hálás gondolat`}
                        placeholder={`${i + 1}. dolog, amiért hálás vagy…`}
                        maxLength={280}
                        autoFocus={i === 0 && rows.length === 1}
                        style={{ width: '100%', minHeight: 60, resize: 'none', fontSize: 16, lineHeight: 1.45, paddingRight: 36 }}
                      />
                      <button
                        type="button"
                        className={cn('chip', recording && 'chat-mic-live')}
                        style={{
                          position: 'absolute', top: 8, right: 8, padding: 8,
                          ...(recording
                            ? { background: 'var(--wash-amber)', borderColor: 'var(--coral-deep)', color: 'var(--coral-deep)' }
                            : {}),
                        }}
                        onClick={voice.toggle}
                        disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
                        aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
                        aria-pressed={recording}
                      >
                        <Icon name={recording ? 'voice-wave' : 'mic'} size={14} />
                      </button>
                    </div>
                  ))}
                  {voice.error && (
                    <p className="text-tertiary" style={{ fontSize: 11 }}>{voice.error}</p>
                  )}
                  {rows.length < 3 && (
                    <button
                      type="button"
                      className="cta-ghost"
                      onClick={() => setRows((r) => [...r, ''])}
                      style={{ fontSize: 13 }}
                    >
                      + Még egy
                    </button>
                  )}
                  <div className="row gap-sm" style={{ flexWrap: 'wrap' }} role="group" aria-label="Life area">
                    {LIFE_SKILLS.map(s => (
                      <button
                        key={s.key}
                        type="button"
                        className={cn('chip', lifeArea === s.key && 'chip-active')}
                        aria-pressed={lifeArea === s.key}
                        onClick={() => setLifeArea(lifeArea === s.key ? null : s.key)}
                        style={{ fontSize: 12 }}
                      >
                        {s.icon} {s.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-tertiary" style={{ fontSize: 11 }}>
                    1–3 dolog, amiért ma hálás vagy (max. 280 karakter soronként).
                  </p>
                </>
              )
              : (
                // Note/Decision mode: original single-textarea
                <div className="card" style={{ padding: 10, position: 'relative' }}>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    aria-label={mode === 'decision' ? 'Döntés' : undefined}
                    aria-labelledby={mode === 'decision' ? undefined : 'journal-title'}
                    placeholder={mode === 'decision' ? 'Mit döntöttél el — és miért?' : 'Írd le, mi jár a fejedben…'}
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
                        : {}),
                    }}
                    onClick={voice.toggle}
                    disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
                    aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
                    aria-pressed={recording}
                  >
                    <Icon name={recording ? 'voice-wave' : 'mic'} size={14} />
                  </button>
                </div>
              )}

            {mode === 'decision' && (
              <p className="text-tertiary" style={{ fontSize: 11 }}>
                Elmentjük, mit tudott rólad a rendszer ebben a pillanatban — és szólunk, amikor
                itt az ideje, hogy visszanézzük, hogyan sült el.
              </p>
            )}

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', background: 'var(--surface-2)' }}>
              <span style={SECTION_LABEL}>{mode === 'decision' ? 'Döntés napja' : 'Dátum'}</span>
              <input
                type="date"
                aria-label={mode === 'decision' ? 'Döntés napja' : 'Dátum'}
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
          </div>

          <div className="row gap-sm mt-lg">
            <button className="cta-ghost flex-1" onClick={close}>Mégse</button>
            <button
              className="cta-primary flex-1"
              onClick={() => save(close)}
              disabled={(() => {
                if (mode === 'gratitude') {
                  const hasText = rows.some(r => r.trim())
                  return !hasText || busy
                }
                return !text.trim() || busy
              })()}
            >
              Mentem
            </button>
          </div>

          {entry && (
            <div className="col gap-sm mt-lg">
              {confirmingDelete ? (
                <div className="row gap-sm">
                  <button
                    type="button"
                    className="cta-ghost flex-1"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Mégse
                  </button>
                  <button
                    type="button"
                    className="cta-primary flex-1"
                    disabled={busy}
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
                  disabled={busy}
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
