import { useState } from 'react'
import { Icon3D } from '@/shared/ui/clay'
import { usePeople, useTurnFacts } from '@/data/me/peopleHooks'

/**
 * S3 (mezo-d6ivw.3): a „Megjegyeztem: …" chip — a kinyerés a válasz UTÁN, a háttérben fut,
 * ezért a chip utólag úszik be a válasz alá. Amíg a rövid figyelő-ablak nyitva van, egy apró
 * „még figyelek" jel látszik (owner-döntés 2026-09-26); ha nincs mit megjegyezni, nyomtalanul
 * eltűnik. A Visszavonom deaktiválja a tényt, és a szövege tartós vétó — soha nem jön vissza.
 */
export function RememberedChips({ userMessageId }: { userMessageId: string | null }) {
  const { facts, pending } = useTurnFacts(userMessageId)
  const { undoFact } = usePeople()
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set())
  if (!userMessageId) return null
  const visible = facts.filter(f => !undone.has(f.id))
  if (pending && visible.length === 0) {
    return (
      <div className="mzc-rempend row gap-xs" role="status" aria-label="Mezo még figyel">
        <span className="mzc-rempend-dot" aria-hidden="true" />
        <span className="mzc-rempend-tx">még figyelek…</span>
      </div>
    )
  }
  if (visible.length === 0) return null
  return (
    <div className="mzc-remwrap col gap-xs">
      {visible.map(f => (
        <div key={f.id} className="mzc-remchip row gap-xs">
          <Icon3D name="t-spark" size={18} />
          <span className="mzc-remtx">
            <b>Megjegyeztem:</b> {f.text}
            {f.kind === 'sensitivity' && <span className="mzc-remsens">érzékeny</span>}
          </span>
          <button
            type="button"
            className="mzc-remundo"
            onClick={() => {
              undoFact(f.personId, f.id)
              setUndone(prev => new Set(prev).add(f.id))
            }}
          >
            Visszavonom
          </button>
        </div>
      ))}
    </div>
  )
}
