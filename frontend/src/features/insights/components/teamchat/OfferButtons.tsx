import { useState } from 'react'
import type { TeamChatAnswerChoice, TeamChatThread } from '@/data/character/teamChatApi'
import { Icon3D } from '@/shared/ui/clay'

/**
 * S7 (mezo-d6ivw.7, Task 9) — the one/two-tap offer buttons: a known-exception question
 * (`EXCUSE`, one tap: "Igen, {offerTag} volt") or the 30-day capped re-check (`REVIEW`, two
 * taps: "Rendben van" / "Nem, figyelj rá"). Ported from the prototype's `.ofr` block. Renders
 * above the trio on a live (OPEN) ügy that carries an offer; never on a closed one.
 */
export function OfferButtons({ thread, onAnswer, busy }: {
  thread: TeamChatThread
  onAnswer: (threadId: string, choice: TeamChatAnswerChoice) => Promise<void>
  busy: boolean
}) {
  const [error, setError] = useState(false)
  if (thread.status !== 'OPEN' || thread.offer == null) return null

  const answer = async (choice: TeamChatAnswerChoice) => {
    setError(false)
    try {
      await onAnswer(thread.id, choice)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="tf-chat-offer">
      <div className="tf-chat-offer-btns">
        {thread.offer === 'EXCUSE' ? (
          <button type="button" disabled={busy} onClick={() => void answer('EXCUSED')}>
            <Icon3D name="t-tick" size={18} />
            Igen, {thread.offerTag} volt
          </button>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => void answer('KEEP')}>
              <Icon3D name="t-tick" size={18} />
              Rendben van
            </button>
            <button type="button" disabled={busy} onClick={() => void answer('STOP')}>
              <Icon3D name="t-lens" size={18} />
              Nem, figyelj rá
            </button>
          </>
        )}
      </div>
      {error && <p className="tf-error" role="alert">Nem sikerült beállítani — próbáld újra egy kicsit később.</p>}
    </div>
  )
}
