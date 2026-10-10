import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Acts, Btn, Chips, Empty, FoSheetHead, Lab, Lk, Note } from '@/shared/ui/folyadek'
import { useHabitAiSuggest, useHabitCatalog } from '@/data/hooks'
import type { HabitSuggestion } from '@/data/types'
import { LIFE_SKILLS } from '@/features/progression/logic/levelUpMeta'
import { VoiceField } from '@/shared/ui/voice/VoiceField'
import { appendDictation } from '@/shared/lib/voice/useVoiceInput'

const HINT_MAX = 200
// Shared with RoutineWizardPage, which claims the value once on mount and deletes it.
const SUGGESTION_KEY = 'mezo.routineWizard.suggestion'


/**
 * AI habit suggestion sheet (routine editor, mezo-n5e9.3): an optional "Szándék" hint →
 * `useHabitAiSuggest().suggest()` → per-card accept or dismiss (removes the card, no server
 * call). Cards live in local state (`cards`), not the query cache — a fresh suggestion run
 * always replaces the set. `unavailable` (the suggester off — 503/404) shows the ChatPage
 * degraded-card style instead of the form; an empty (but resolved) result shows a quiet ghost
 * instead of implying a failure.
 *
 * FOLYADÉK (mezo-n4wf5.2, prototypes/vilagos/nap.js `SHEETS.ai`): a light sheet — head with the
 * icon chip, the hint field, „Javasolj", then one block per suggestion.
 *
 * Accepting no longer WRITES a definition (mezo-3zue.4): it hands the proposal to the recipe
 * wizard, which is where a habit gains a framework and where the user's "Vállalom" tick is the
 * human pass ADR 0019's propose-only rule requires. The sheet is therefore write-free.
 */
export function AiSuggestSheet({ chainKey, onClose }: { chainKey?: string; onClose: () => void }) {
  const navigate = useNavigate()
  const { suggest, pending: suggestPending, unavailable } = useHabitAiSuggest()
  const { catalog } = useHabitCatalog()
  const [hint, setHint] = useState('')
  const [cards, setCards] = useState<HabitSuggestion[] | null>(null)

  const chainTitle = (key: string) => catalog.chains.find((c) => c.chainKey === key)?.title ?? key
  const skillName = (key: string) => LIFE_SKILLS.find((s) => s.key === key)?.name ?? key

  const run = () => {
    suggest({ chainKey, hint: hint.trim() || undefined })
      .then(setCards)
      // Same rationale as accept() below: a genuine failure (network/500/etc — the hook already
      // rethrows anything that isn't 503/404) already surfaces via the global mutation-error
      // toast — swallow it here so it doesn't also become an unhandled rejection; the sheet
      // just stays on the empty/no-cards form, ready for another "Javasolj" attempt.
      .catch(() => {})
  }

  // The suggestion travels in sessionStorage, not the query string: five prose fields (cím,
  // jelzés, vágy, jutalom, ünneplés) would make an unreadable URL. The chain still rides in the
  // URL so the wizard opens on the right lánc even if the store is unavailable — a storage
  // failure degrades to an empty wizard, it never blocks the navigation.
  const accept = (s: HabitSuggestion, close: () => void) => {
    try {
      sessionStorage.setItem(SUGGESTION_KEY, JSON.stringify(s))
    } catch {
      // private mode / quota / a disabled store — the wizard simply opens unseeded
    }
    close()
    navigate(`/nap/rutin/uj?chain=${encodeURIComponent(s.chainKey)}`)
  }

  const dismiss = (s: HabitSuggestion) => {
    setCards((prev) => prev?.filter((c) => c !== s) ?? prev)
  }

  return (
    <Sheet className="fo-sheet" onClose={onClose} labelledBy="ai-suggest-title">
      {(close) => (
        <>
          <FoSheetHead titleId="ai-suggest-title" icon="t-spark" title="Milyen szokás segítene?" sub="AI javaslat" onClose={close} />

          {unavailable ? (
            <Empty icon="t-info">Az AI-javasló most nem elérhető — próbáld később.</Empty>
          ) : (
            <>
              <Lab htmlFor="rb-ai-hint">Szándék (opcionális)</Lab>
              <VoiceField domain="me" size="sm" onTranscript={(t) => setHint(appendDictation(hint, t, HINT_MAX))}>
                <textarea
                  id="rb-ai-hint"
                  className="fo-in"
                  rows={2}
                  aria-label="Szándék"
                  value={hint}
                  maxLength={HINT_MAX}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="pl. jobb esti lezárás"
                />
              </VoiceField>

              <Btn wide className="rb-save" disabled={suggestPending} onClick={run}>Javasolj</Btn>

              {cards && cards.length === 0 && <Note>Nincs javaslat — próbálj pontosabb szándékkal.</Note>}

              {cards?.map((s, i) => (
                <div key={`${s.chainKey}-${s.title}-${i}`} className="rb-sug">
                  <strong>{s.title}</strong>
                  <small>{s.why}</small>
                  <Chips items={[s.anchorCopy, skillName(s.skillKey), `+${s.xp} XP`, chainTitle(s.chainKey)].filter(Boolean)} />
                  <Acts>
                    <Btn sm onClick={() => accept(s, close)}>Megnyitom a varázslóban</Btn>
                    <Lk onClick={() => dismiss(s)}>Elvetem</Lk>
                  </Acts>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
