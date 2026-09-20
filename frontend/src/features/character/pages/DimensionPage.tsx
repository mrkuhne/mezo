import type { CharacterClaimDto } from '@/data/character/characterApi'
import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead, PageBody } from '@/shared/ui/mozaik'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { useCharacterDimension, useCharacterExperts } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { ClaimTile } from '@/features/character/components/ClaimTile'
import { expertColor } from '@/features/character/expertColors'

const PRINCIPLE = 'Az állítások bizonyítékból születnek, sosem fordítva — és amit tévesnek ' +
  'mondasz, azt a csapat nem vitatja tovább.'

export function DimensionPage() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const { dimension, isLoading } = useCharacterDimension(key)
  const { experts, isLoading: expertsLoading } = useCharacterExperts()
  const [seen, setSeen] = useState<{ key: string; claims: CharacterClaimDto[] }>({ key, claims: [] })
  useEffect(() => {
    if (!dimension) return
    setSeen(previous => ({ key, claims: [...dimension.claims, ...(previous.key === key ? previous.claims.filter(claim => !dimension.claims.some(active => active.id === claim.id)) : [])] }))
  }, [dimension, key])
  const swept = useCountUp(dimension?.maturity ?? 0, 900)

  // Fix round (final review, I5): folding expertsLoading in — without it, the pending window
  // renders `sub`'s expertName lookup off a still-empty `experts` array, showing the generic
  // "a csapat" fallback instead of the real owner for one paint.
  if (isLoading || expertsLoading) return null

  if (dimension == null) {
    return (
      <div className="kr-hub">
        <PageHead onBack={() => navigate('/mezo/karakter/dimenziok')} label="‹ Karakter" />
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
  const claims = [...dimension.claims, ...(seen.key === key ? seen.claims.filter(claim => !dimension.claims.some(active => active.id === claim.id)) : [])]

  return (
    <div className="kr-hub" style={{ '--pwash': `${color}2e` } as CSSProperties}>
      <PageHead onBack={() => navigate('/mezo/karakter/dimenziok')} label="‹ Karakter" />
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
          <ClaimTile key={c.id} claim={c} withdrawn={!dimension.claims.some(active => active.id === c.id)} delayMs={i * 70} />
        ))}
        <button type="button" className="kr-chathand" onClick={() => navigate('/mezo/chat')}>
          <span className="kr-chathand-tx">Beszélgess erről Mezóval</span>
          <span className="kr-chev" aria-hidden="true">›</span>
        </button>
      </PageBody>
    </div>
  )
}
