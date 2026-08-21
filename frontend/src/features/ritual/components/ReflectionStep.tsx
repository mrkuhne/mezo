import { useState } from 'react'
import { useRitualActions, useRitualDay } from '@/data/hooks'
import { useVoiceInput } from '@/features/insights/logic/useVoiceInput'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { localDateString } from '@/shared/lib/dates'

/**
 * Napzárás act 3 — „Ma milyen volt" (Phase 5 W1.2, mezo-b3pp.2, spec §5.2). The one act that
 * writes BEFORE the close: `PUT /api/ritual/reflection` upserts the day's prose onto the
 * `(created_by, ritual_date)` row, which is why `closed` now means `closed_at is not null`
 * rather than "a row exists" (see ritual.md §4).
 *
 * Nothing here is mandatory and nothing here may block the flow (IDENT-3): „Ma nem írok" skips
 * in one tap and writes nothing, an empty „Tovább" is identical, and the save is fire-and-forget
 * — the act advances immediately whether or not the PUT lands (a 409 RITUAL_NOT_TODAY on a
 * stale tab is swallowed here rather than trapping the user mid-ritual).
 *
 * The save happens ON ADVANCE ONLY — deliberately NOT debounced per keystroke. The backend's
 * `ReflectionEmbeddingListener` omits the concurrent-insert retry its sibling listeners carry,
 * and justifies that with "embedded only on close, never on every keystroke-save"; an autosave
 * firing alongside the close could put two events into the embed-insert branch concurrently and
 * leave a stale vector.
 *
 * The prose seeds from the day's existing `reflectionText` as INITIAL state only, so re-entering
 * the act after a back-out shows what was written — but a background refetch can never overwrite
 * what the user is currently typing.
 *
 * The W1.3 gratitude rows join this act below the textarea (spec §5.2's "combined writing act",
 * ONE act, both parts optional); until that slice lands the gratitude half simply isn't rendered.
 */
export function ReflectionStep({ onNext }: { onNext: () => void }) {
  const date = localDateString()
  const { data } = useRitualDay(date)
  const { saveReflection } = useRitualActions(date)
  const [text, setText] = useState(data.reflectionText ?? '')
  // Same append-to-what's-typed idiom as JournalSheet/ChatPage's composer (useVoiceInput.ts).
  const voice = useVoiceInput((t) => setText((d) => (d ? `${d} ${t}` : t)))
  const recording = voice.state === 'recording'

  const advance = () => {
    if (text.trim()) {
      // fire-and-forget: a failed save must never trap the user inside the ritual
      void saveReflection(text.trim()).catch(() => {})
    }
    onNext()
  }

  return (
    <div className="rz-act rz-reflect">
      <div className="rz-story-eyebrow">Ma milyen volt</div>
      <h2 className="rz-reflect-title">Milyen volt a napod valójában?</h2>
      <div className="rz-reflect-box">
        <textarea
          className="rz-reflect-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Milyen volt a napod valójában?"
          placeholder="Írd le, ahogy volt — senki más nem olvassa…"
        />
        <button
          type="button"
          className={cn('chip', 'rz-reflect-mic', recording && 'chat-mic-live')}
          onClick={voice.toggle}
          disabled={voice.state === 'unsupported' || voice.state === 'transcribing'}
          aria-label={recording ? 'Felvétel leállítása' : 'Hangbevitel'}
          aria-pressed={recording}
        >
          <Icon name={recording ? 'voice-wave' : 'mic'} size={14} />
        </button>
      </div>
      {voice.error && <p className="rz-reflect-hint">{voice.error}</p>}
      <button className="rz-cta" onClick={advance}>Tovább</button>
      <button className="rz-skip" onClick={onNext}>Ma nem írok</button>
    </div>
  )
}
