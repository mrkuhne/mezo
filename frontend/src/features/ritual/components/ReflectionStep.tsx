import { useState } from 'react'
import { useGratitudeActions, useGratitudeEntries, useRitualActions, useRitualDay } from '@/data/hooks'
import { GratitudeRows } from '@/features/me/components/GratitudeRows'
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
 * „Tovább" writes iff the prose CHANGED against that seed — not merely iff it is non-empty. The
 * difference is the clear path: a user who wrote prose, backed out, re-entered and DELETED the
 * text must have that erasure persist, or the close would embed prose the user just took back
 * (the whole `text.isBlank() ? null` chain — RitualService, the mock branch, the MSW default —
 * exists for exactly this and would otherwise be unreachable from the UI). Comparing against the
 * seed also drops the redundant identical re-PUT when the act is re-entered and advanced unedited.
 * „Ma nem írok" is NOT a clear: skipping means "don't touch today's entry", so it writes nothing
 * whatever is in the box.
 *
 * The W1.3 gratitude rows join this act below the textarea (W1.3b, `mezo-b3pp.25`, spec §5.2's
 * "combined writing act" — ONE act, both parts optional). They obey the same two rules as the
 * prose: written on advance only, never on a keystroke, and fire-and-forget so a failed POST
 * cannot trap the user; „Ma nem írok" writes neither half. What differs is the cap: today's
 * already-saved entries are read back, rendered as a saved list, and only `3 − saved.length`
 * input slots are offered, because a ✕-and-re-entered ritual replays this act from the start and
 * would otherwise duplicate the evening's lines. A GET that fails outright gets zero slots too,
 * not three — see the `slots` comment below for why.
 */
export function ReflectionStep({ onNext }: { onNext: () => void }) {
  const date = localDateString()
  const { data } = useRitualDay(date)
  const { saveReflection } = useRitualActions(date)
  const [text, setText] = useState(data.reflectionText ?? '')
  // The prose as it stood when the act opened, normalised the same way the comparison below is
  // (and the same way the server stores it) so a whitespace-only difference is never a "change".
  const [seed] = useState(() => (data.reflectionText ?? '').trim())
  // Same append-to-what's-typed idiom as JournalSheet/ChatPage's composer (useVoiceInput.ts).
  const voice = useVoiceInput((t) => setText((d) => (d ? `${d} ${t}` : t)))
  const recording = voice.state === 'recording'

  // Today's already-saved gratitude lines. The read is what keeps a RE-ENTERED ritual (✕ then
  // back in — the flow always replays act 3 from act 1) from silently duplicating the evening's
  // lines and blowing past the spec's "1–3 a day": they render as a saved list and only the
  // remaining slots are offered. There is no gratitude PUT, so a saved line is shown, not edited.
  const { data: saved, isPending: savedPending, isError: savedErrored } = useGratitudeEntries(date, date)
  const { addEntry } = useGratitudeActions()
  const [rows, setRows] = useState<string[]>([''])
  const [lifeArea, setLifeArea] = useState<string | null>(null)
  // A failed GET must NOT be read as "zero saved today": `useDualQuery` returns `realEmpty: []`
  // for BOTH an unresolved read and a genuinely-errored one (useDualQuery.ts), so `saved.length`
  // alone can't tell "the day really is empty" from "the day is empty because the fetch 500'd".
  // Trusting it here would open all three slots on an errored read — a user who already has 3
  // entries today would silently be offered 3 more, blowing the "1–3 a day" cap the docs call
  // absolute (mezo-n5e9.2 idiom, JournalPage.tsx / RoutineEditorPage.tsx). So an errored read gets
  // ZERO slots, same as the still-pending read below — never `3 - 0`.
  const slots = savedErrored ? 0 : Math.max(0, 3 - saved.length)

  const advance = () => {
    const next = text.trim()
    // `next !== seed` — NOT `next` — so an emptied box actually clears the stored prose ('' is
    // the CLEAR payload the backend maps to null), and an untouched one writes nothing at all.
    if (next !== seed) {
      // fire-and-forget: a failed save must never trap the user inside the ritual
      void saveReflection(next).catch(() => {})
    }
    // Same fire-and-forget rule for the gratitude rows, and `slice(0, slots)` re-checks the cap
    // against the freshest read — a refetch may have landed an entry while the act was open.
    for (const line of rows.map((r) => r.trim()).filter(Boolean).slice(0, slots)) {
      void addEntry(line, lifeArea, date).catch(() => {})
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
      {!savedPending && (
        <div className="rz-reflect-gratitude">
          <div className="rz-story-eyebrow">Amiért hálás vagy</div>
          {savedErrored ? (
            // No input rows here either — see the `slots` comment above for why an errored
            // read can't be trusted to open slots. This line is what keeps that "render
            // nothing" from reading as "there's simply no gratitude section today".
            <p className="rz-reflect-hint">A mai hálabejegyzéseid most nem érhetők el.</p>
          ) : (
            <>
              {saved.length > 0 && (
                <ul className="rz-gratitude-saved" aria-label="Ma már elmentett hálabejegyzések">
                  {saved.map((g) => <li key={g.id}>{g.text}</li>)}
                </ul>
              )}
              {slots > 0 ? (
                <div className="col gap-sm">
                  <GratitudeRows
                    rows={rows}
                    onRowsChange={setRows}
                    lifeArea={lifeArea}
                    onLifeAreaChange={setLifeArea}
                    max={slots}
                    hint={`Legfeljebb ${slots} sor — teljesen opcionális.`}
                  />
                </div>
              ) : (
                <p className="rz-reflect-hint">Ma már mind a három hálabejegyzésed megvan.</p>
              )}
            </>
          )}
        </div>
      )}
      <button className="rz-cta" onClick={advance}>Tovább</button>
      <button className="rz-skip" onClick={onNext}>Ma nem írok</button>
    </div>
  )
}
