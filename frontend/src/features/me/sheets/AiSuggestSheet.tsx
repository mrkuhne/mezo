import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/shared/ui/Sheet'
import { Icon } from '@/shared/ui/Icon'
import { Chip } from '@/shared/ui/Chip'
import { useHabitAiSuggest, useHabitCatalog } from '@/data/hooks'
import type { HabitSuggestion } from '@/data/types'

const HINT_MAX = 200
// Shared with RoutineWizardPage, which claims the value once on mount and deletes it.
const SUGGESTION_KEY = 'mezo.routineWizard.suggestion'

const ROW: React.CSSProperties = { padding: '9px 12px', background: 'var(--surface-2)' }
const LABEL: React.CSSProperties = { fontSize: 9, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }
const TEXT_INPUT: React.CSSProperties = { width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 13 }

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
    <Sheet onClose={onClose} labelledBy="ai-suggest-title">
      {(close) => (
        <div className="col gap-sm" style={{ padding: '4px 4px 8px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 id="ai-suggest-title" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              <span aria-hidden="true">✨</span> AI javaslat
            </h2>
            <button className="chip" aria-label="Bezárás" onClick={close} style={{ padding: '6px 8px' }}>
              <Icon name="x" size={12} />
            </button>
          </div>

          {unavailable ? (
            <div className="card" style={{ padding: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                Az AI-javasló most nem elérhető — próbáld később.
              </p>
            </div>
          ) : (
            <>
              <div className="row" style={ROW}>
                <div className="col" style={{ width: '100%' }}>
                  <span style={LABEL}>Szándék (opcionális)</span>
                  <input
                    aria-label="Szándék"
                    value={hint}
                    maxLength={HINT_MAX}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="pl. jobb esti lezárás"
                    style={TEXT_INPUT}
                  />
                </div>
              </div>

              <button
                type="button"
                className="cta-primary"
                disabled={suggestPending}
                style={{ opacity: suggestPending ? 0.5 : 1 }}
                onClick={run}
              >
                <span aria-hidden="true">✨</span> Javasolj
              </button>

              {cards && cards.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
                  Nincs javaslat — próbálj pontosabb szándékkal.
                </span>
              )}

              {cards?.map((s, i) => (
                <div key={`${s.chainKey}-${s.title}-${i}`} className="card" style={{ padding: 14 }}>
                  <div style={{ fontFamily: 'var(--ff-display)', fontSize: 15, lineHeight: 1.2 }}>{s.title}</div>
                  <p className="text-secondary mt-sm" style={{ fontSize: 12, lineHeight: 1.5 }}>{s.why}</p>
                  <div className="row gap-sm mt-sm" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <Chip>{s.anchorCopy}</Chip>
                    <Chip>{s.skillKey}</Chip>
                    <Chip>{s.xp} XP</Chip>
                    <Chip>{chainTitle(s.chainKey)}</Chip>
                  </div>
                  <div className="row gap-sm mt-md">
                    <button
                      type="button"
                      className="chip"
                      onClick={() => accept(s, close)}
                      style={{ fontSize: 11, padding: '6px 12px', background: 'var(--wash-lav)', borderColor: 'var(--lav-deep)', color: 'var(--lav-deep)' }}
                    >
                      Megnyitom a varázslóban
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => dismiss(s)}
                      style={{ fontSize: 11, padding: '6px 12px' }}
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
