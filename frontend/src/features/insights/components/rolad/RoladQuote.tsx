import { useState } from 'react'
import '@/features/character/character.css'
import { useCharacterOverview, useClaimFeedback } from '@/data/hooks'
import { CharacterReplyThread } from '@/features/character/components/CharacterReplyThread'
import { pickQuoteClaim, ROLAD_COPY } from '@/features/insights/logic/roladCopy'
import { TEAM } from '@/features/insights/logic/team'
import { Icon3D } from '@/shared/ui/clay'
import { useToast } from '@/shared/ui/ToastProvider'
import { riseStyle } from './riseStyle'

/**
 * Rólad — a közös kép (U9b, mezo-zpxv7): the page opens on ONE sentence the team really said —
 * the most certain non-sensitive character claim (ADR 0049: never an invented sentence). Talál /
 * Pontosítom are the existing claim feedback (the `ClaimTile` pattern). `overview === null` means
 * the character switch is off → the section is simply absent; no claim yet → the honest note.
 */
export function RoladQuote({ delay = 0 }: { delay?: number }) {
  const { overview } = useCharacterOverview()
  const { submit, pending } = useClaimFeedback()
  const { show } = useToast()
  const [confirmed, setConfirmed] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)

  if (overview == null) return null
  const claim = pickQuoteClaim(overview)

  if (!claim) {
    return (
      <div className="glass tf-pnote tf-c-rose kr9-qempty rise" style={riseStyle(delay)}>
        <Icon3D name="t-person" size={36} />
        <div><small>A csapat benyomása</small><p>{ROLAD_COPY.quoteEmpty}</p></div>
      </div>
    )
  }

  const who = TEAM[claim.character]
  async function talal() {
    try {
      await submit(claim!.id, 'TALAL')
      setConfirmed(true)
    } catch {
      show({ kind: 'error', text: 'Nem sikerült elküldeni a visszajelzést — próbáld újra' })
    }
  }

  return (
    <figure className="glass kr9-quote tf-c-rose rise" style={riseStyle(delay)} data-claim={claim.id}>
      <p>„{claim.text}”</p>
      <figcaption>
        Így fogalmaz most rólad <b className={`tf-c-${who.accent}`}>{who.name}</b> · a legbiztosabb állítás · javítható benyomás, nem címke
      </figcaption>
      <div className="kr9-chips">
        {confirmed ? (
          <span className="tf-after kr9-qthanks"><Icon3D name="t-thumb-up" size={15} />Megerősítetted — a benyomás erősödik</span>
        ) : (
          <button type="button" className="kr9-chip is-main tf-c-sage" onClick={talal} disabled={pending}>
            <Icon3D name="t-thumb-up" size={17} />Talál
          </button>
        )}
        <button type="button" className="kr9-chip tf-c-gold" onClick={() => setReplyOpen((o) => !o)} aria-expanded={replyOpen}>
          <Icon3D name="t-chat" size={17} />Pontosítom
        </button>
      </div>
      {/* the reply thread's dark re-dress lives under `.kr9-page` (the nested root the karakter
          block already zeroes the padding of inside `.kr9-rolad`) */}
      {replyOpen && (
        <div className="kr9-page kr9-thread">
          <CharacterReplyThread source={{ sourceType: 'CLAIM', sourceId: claim.id, sourceIndex: 0 }} initialOpen />
        </div>
      )}
    </figure>
  )
}
