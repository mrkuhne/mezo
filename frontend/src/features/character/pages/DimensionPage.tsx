// ============================================================
// Mezo · Karakter — DimensionPage (mezo-1gim.13, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-dim` / `renderDim()` —
// the tinted hero (avatar + count-up maturity % + title), the portrait card (only when
// non-empty), the claim tiles (ClaimTile), the „Beszélgess erről Mezóval" chat handoff, and
// the closing principle line.
//
// Claim snapshot (binding ruling — NEM IGAZ is a transient local state, not a fabricated
// server status): the API serves ACTIVE claims only, and the mock mirrors that by REMOVING a
// retired claim from the query cache the instant feedback is submitted. If this page rendered
// straight off `dimension.claims`, a "nem igaz" verdict would yank the claim out of the list
// mid-interaction — the opposite of the ledger's "keep it rendered in the retired face
// locally" ruling. So the claim LIST is snapshotted once per dimension load and never
// re-derived from later cache writes; each ClaimTile owns its own retired/thanks UI locally
// (see ClaimTile.tsx). Only a fresh mount (a real "next visit" — new key, or leaving and
// coming back) takes a new snapshot off whatever the cache honestly holds by then.
//
// Chat handoff: this codebase has no anchored chat-context idiom yet (checked every /me/week
// sibling page for a context-kind param/state — none exists; ChatPage itself reads no
// navigation state). Per the brief's fallback: plain navigation to the chat route, no fake
// anchor. A character context kind (linking straight to this claim/dimension) is a later
// contract addition.
// ============================================================
import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead, PageBody } from '@/shared/ui/mozaik'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { useCharacterDimension, useCharacterExperts } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { ClaimTile } from '@/features/character/components/ClaimTile'
import { expertColor } from '@/features/character/expertColors'
import type { CharacterClaimDto } from '@/data/character/characterApi'

const PRINCIPLE = 'Az állítások bizonyítékból születnek, sosem fordítva — és amit tévesnek ' +
  'mondasz, azt a csapat nem vitatja tovább.'

export function DimensionPage() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const { dimension, isLoading } = useCharacterDimension(key)
  const { experts, isLoading: expertsLoading } = useCharacterExperts()
  const [snapshot, setSnapshot] = useState<CharacterClaimDto[] | null>(null)

  // A new :key means a different dimension — the old snapshot no longer applies.
  useEffect(() => { setSnapshot(null) }, [key])
  useEffect(() => {
    if (dimension != null && snapshot === null) setSnapshot(dimension.claims)
  }, [dimension, snapshot])

  const swept = useCountUp(dimension?.maturity ?? 0, 900)

  // Fix round (final review, I5): folding expertsLoading in — without it, the pending window
  // renders `sub`'s expertName lookup off a still-empty `experts` array, showing the generic
  // "a csapat" fallback instead of the real owner for one paint.
  if (isLoading || expertsLoading) return null

  if (dimension == null) {
    return (
      <div className="kr-hub">
        <PageHead onBack={() => navigate('/me/karakter/dimenziok')} label="‹ Karakter" />
        <div className="kr-degraded">Ez a dimenzió jelenleg nem elérhető.</div>
      </div>
    )
  }

  const color = expertColor(dimension.expertKey)
  const expertName = dimension.expertKey != null
    ? experts.find((e) => e.key === dimension.expertKey)?.displayName
    : undefined
  const sub = dimension.kind === 'CHAPTER'
    ? 'közös AI-fejezet · érettség'
    : dimension.kind === 'META'
      ? 'a társ önvizsgálata · Szkeptikus'
      : `${expertName ?? 'a csapat'} · érettség`
  const claims = snapshot ?? dimension.claims

  return (
    <div className="kr-hub" style={{ '--pwash': `${color}2e` } as CSSProperties}>
      <PageHead onBack={() => navigate('/me/karakter/dimenziok')} label="‹ Karakter" />
      <div className="kr-dim-hero" style={{ '--pc': color } as CSSProperties}>
        {dimension.expertKey != null
          ? <div className="kr-dim-avatar" style={{ '--pc': color } as CSSProperties}><PersonaOrb expertKey={dimension.expertKey} size={58} /></div>
          : <div className="kr-dim-avatar chaptermark" style={{ '--pc': color } as CSSProperties} aria-hidden="true">✦</div>}
        <div className="kr-dim-num" style={{ color }}>{swept}%</div>
        <div className="kr-dim-name">{dimension.title}</div>
        <div className="kr-dim-sub">{sub}</div>
      </div>
      <PageBody principle={PRINCIPLE}>
        {dimension.portrait !== '' && <div className="kr-portrait">{dimension.portrait}</div>}
        {claims.length > 0 && <div className="mz-eyebrow kr-claims-eyebrow">Állítások</div>}
        {claims.map((c, i) => (
          <ClaimTile key={c.id} claim={c} delayMs={i * 70} />
        ))}
        <button type="button" className="kr-chathand" onClick={() => navigate('/mezo/chat')}>
          <span className="kr-chathand-tx">Beszélgess erről Mezóval</span>
          <span className="kr-chev" aria-hidden="true">›</span>
        </button>
      </PageBody>
    </div>
  )
}
