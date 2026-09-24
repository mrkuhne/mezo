import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Chip } from '@/shared/ui/Chip'
import { Icon3D } from '@/shared/ui/clay'
import { useHabitAiSuggest, useHabitCatalog } from '@/data/hooks'
import type { HabitSuggestion } from '@/data/types'

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
    navigate(`/me/rutin/uj?chain=${encodeURIComponent(s.chainKey)}`)
  }

  const dismiss = (s: HabitSuggestion) => {
    setCards((prev) => prev?.filter((c) => c !== s) ?? prev)
  }

  return (
    <Sheet className="glass rt-sheet is-lav" onClose={onClose} labelledBy="ai-suggest-title">
      {(close) => (
        <div className="col gap-sm">
          <div className="rt-shh">
            <Icon3D name="t-spark" size={46} />
            <span className="rt-shh-t">
              <span className="rt-shh-eb">Rutin</span>
              <h2 id="ai-suggest-title">AI javaslat</h2>
            </span>
            <button className="chip rt-shx" aria-label="Bezárás" onClick={close}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {unavailable ? (
            <div className="card rt-aicard is-off">
              <p>Az AI-javasló most nem elérhető — próbáld később.</p>
            </div>
          ) : (
            <>
              <label className="rt-field">
                <span className="rt-flabel">Szándék (opcionális)</span>
                <input
                  className="rt-fin"
                  aria-label="Szándék"
                  value={hint}
                  maxLength={HINT_MAX}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="pl. jobb esti lezárás"
                />
              </label>

              <button
                type="button"
                className="cta-primary rt-litpill"
                disabled={suggestPending}
                onClick={run}
              >
                <Icon3D name="t-spark" size={20} />Javasolj
              </button>

              {cards && cards.length === 0 && (
                <span className="rt-emptyline uv-empty">
                  Nincs javaslat — próbálj pontosabb szándékkal.
                </span>
              )}

              {cards?.map((s, i) => (
                <div key={`${s.chainKey}-${s.title}-${i}`} className="card rt-aicard">
                  <div className="rt-aicard-t">{s.title}</div>
                  <p className="rt-aicard-why">{s.why}</p>
                  <div className="rt-aicard-chips">
                    <Chip>{s.anchorCopy}</Chip>
                    <Chip>{s.skillKey}</Chip>
                    <Chip>{s.xp} XP</Chip>
                    <Chip>{chainTitle(s.chainKey)}</Chip>
                  </div>
                  <div className="rt-aicard-acts">
                    <button
                      type="button"
                      className="chip rt-aicard-ok"
                      onClick={() => accept(s, close)}
                    >
                      Megnyitom a varázslóban
                    </button>
                    <button
                      type="button"
                      className="chip rt-aicard-no"
                      onClick={() => dismiss(s)}
                    >
                      Elvetem
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
