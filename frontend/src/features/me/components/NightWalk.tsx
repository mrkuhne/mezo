import { useEffect, useState } from 'react'
import { WALK_CARD_MS, WALK_CARDS, WALK_SETUP } from '@/features/me/logic/nightContent'

/** The 4K mental-walk self-narration frame (Alison Harvey's method, spec D6):
 *  a setup card, then very slowly advancing gentle reminders. */
export function NightWalk({ onStop }: { onStop: () => void }) {
  // idx 0 = setup, 1..WALK_CARDS.length = reminder cards
  const [idx, setIdx] = useState(0)
  const last = WALK_CARDS.length
  useEffect(() => {
    if (idx >= last) return
    const id = setInterval(() => setIdx((i) => Math.min(i + 1, last)), WALK_CARD_MS)
    return () => clearInterval(id)
  }, [idx, last])
  return (
    <div className="nw">
      <div className="night-eye">4K-séta</div>
      <button className="nw-stage" aria-label="Következő kártya"
        onClick={() => setIdx((i) => Math.min(i + 1, last))}>
        {idx === 0 ? (
          <span className="nw-setup">
            <span className="nw-t">{WALK_SETUP.title}</span>
            <span className="nw-tx">{WALK_SETUP.text}</span>
          </span>
        ) : (
          <span className="nw-remind"><span className="nw-rtx">{WALK_CARDS[idx - 1]}</span></span>
        )}
      </button>
      <div className="nw-note">A kártyák nagyon lassan, maguktól váltanak.</div>
      <button className="night-quiet" onClick={onStop}>megállítom ›</button>
    </div>
  )
}
