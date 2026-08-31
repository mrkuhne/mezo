import { useRef, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { ClayIcon } from '@/shared/ui/clay'

interface GratitudeRowsProps {
  rows: string[]
  onRowsChange: (rows: string[]) => void
  lifeArea: string | null
  onLifeAreaChange: (area: string | null) => void
  /** Hard cap on the number of rows the user may add. Default 3 (spec §5.3, "1–3 lines a day"). */
  max?: number
  /** Focus the first row on mount — the sheet wants it, the ritual act must not steal focus. */
  autoFocusFirst?: boolean
  /** Small tertiary line under the chips. Omitted → not rendered. */
  hint?: string
}

/**
 * The gratitude capture block (W1.3, `mezo-b3pp.3`) — up to `max` lines plus one optional
 * life-area chip, shared by `JournalSheet`'s „Hála" mode and Napzárás act 3's `ReflectionStep`
 * (W1.3b, `mezo-b3pp.25`, spec §5.2's combined writing act).
 *
 * Deliberately **state-free and data-free**: the rows, the chosen life area and the save all
 * belong to the caller, because the two callers save at genuinely different moments (the sheet
 * on „Mentem", the ritual act on „Tovább", fire-and-forget). That also keeps this file out of
 * `@/data/*` — the `frontend_conventions.md` rule for a component reused across features.
 *
 * The mic is per row and its target is tracked in a **ref**: `useVoiceInput`'s `onstop` closure
 * captures the transcript callback when recording STARTS (useVoiceInput.ts — `rec.onstop` closes
 * over `finish`, itself memoised on `onTranscript`), so reading the active row out of React state
 * inside the callback would read it as it stood at record-start. Before the extraction the
 * callback wrote into `JournalSheet`'s *note* textarea, which gratitude mode never renders — the
 * transcription simply vanished.
 */
export function GratitudeRows({
  rows,
  onRowsChange,
  lifeArea,
  onLifeAreaChange,
  max = 3,
  autoFocusFirst = false,
  hint,
}: GratitudeRowsProps) {
  // Mirrors for the frozen voice callback (see the doc comment).
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const targetRef = useRef(0)
  const [activeRow, setActiveRow] = useState(0)

  const voice = useVoiceInput((t) => {
    const i = targetRef.current
    const next = [...rowsRef.current]
    next[i] = next[i] ? `${next[i]} ${t}` : t
    onRowsChange(next)
  })
  const recording = voice.state === 'recording'

  const setRow = (i: number, value: string) => {
    const next = [...rows]
    next[i] = value
    onRowsChange(next)
  }

  return (
    <>
      {rows.slice(0, max).map((r, i) => (
        <div key={i} className="card" style={{ padding: 10, position: 'relative' }}>
          <textarea
            value={r}
            onChange={(e) => setRow(i, e.target.value)}
            aria-label={`${i + 1}. hálás gondolat`}
            placeholder={`${i + 1}. dolog, amiért hálás vagy…`}
            maxLength={280}
            autoFocus={autoFocusFirst && i === 0 && rows.length === 1}
            style={{ width: '100%', minHeight: 60, resize: 'none', fontSize: 16, lineHeight: 1.45, paddingRight: 36 }}
          />
          <button
            type="button"
            className={cn('chip', recording && activeRow === i && 'chat-mic-live')}
            style={{
              position: 'absolute', top: 8, right: 8, padding: 8,
              ...(recording && activeRow === i
                ? { background: 'var(--wash-amber)', borderColor: 'var(--coral-deep)', color: 'var(--coral-deep)' }
                : {}),
            }}
            onClick={() => { targetRef.current = i; setActiveRow(i); voice.toggle() }}
            disabled={
              voice.state === 'unsupported' ||
              voice.state === 'transcribing' ||
              (recording && activeRow !== i)
            }
            aria-label={recording && activeRow === i ? 'Felvétel leállítása' : 'Hangbevitel'}
            aria-pressed={recording && activeRow === i}
          >
            <Icon name={recording && activeRow === i ? 'voice-wave' : 'mic'} size={14} />
          </button>
        </div>
      ))}

      {voice.error && <p className="text-tertiary" style={{ fontSize: 11 }}>{voice.error}</p>}

      {rows.length < max && (
        <button
          type="button"
          className="cta-ghost"
          onClick={() => onRowsChange([...rows, ''])}
          style={{ fontSize: 13 }}
        >
          + Még egy
        </button>
      )}

      <div className="row gap-sm" style={{ flexWrap: 'wrap' }} role="group" aria-label="Life area">
        {LIFE_SKILLS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={cn('chip', lifeArea === s.key && 'chip-active')}
            aria-pressed={lifeArea === s.key}
            onClick={() => onLifeAreaChange(lifeArea === s.key ? null : s.key)}
            style={{ fontSize: 12 }}
          >
            <ClayIcon name={s.clayIcon} size={13} className="chip-clay" /> {s.name}
          </button>
        ))}
      </div>

      {hint && <p className="text-tertiary" style={{ fontSize: 11 }}>{hint}</p>}
    </>
  )
}
