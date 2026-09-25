import type { CharacterClaimDto } from '@/data/character/characterApi'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '@/features/character/character.css'
import '@/features/insights/boop-world.css'
import { useCountUp } from '@/shared/ui/mozaik/motion'
import { Icon3D } from '@/shared/ui/clay'
import { useCharacterDimension, useCharacterExperts } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { ClaimTile } from '@/features/character/components/ClaimTile'
import { KarakterBackHead } from '@/features/character/components/KarakterBackHead'
import { personaCharacter, personaName } from '@/features/character/personaCharacter'

const PRINCIPLE = 'Az állítások bizonyítékból születnek, sosem fordítva — és amit tévesnek ' +
  'mondasz, azt a csapat nem vitatja tovább.'

// Üvegesítés U9 (mezo-me75u.9): tf-dhead · tf-rhero (the owning character's figure) · the
// maturity tf-gauge · the portrait as a flat upright panel · claims as glass cases · the chat
// door row · the principle footer.
export function DimensionPage() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  const { dimension, isLoading } = useCharacterDimension(key)
  const { isLoading: expertsLoading } = useCharacterExperts()
  const [seen, setSeen] = useState<{ key: string; claims: CharacterClaimDto[] }>({ key, claims: [] })
  useEffect(() => {
    if (!dimension) return
    setSeen(previous => ({ key, claims: [...dimension.claims, ...(previous.key === key ? previous.claims.filter(claim => !dimension.claims.some(active => active.id === claim.id)) : [])] }))
  }, [dimension, key])
  const swept = useCountUp(dimension?.maturity ?? 0, 900)

  // Fix round (final review, I5): folding expertsLoading in — the page waits for the expert
  // catalogue exactly as before, so the owner line never flashes a fallback for one paint.
  if (isLoading || expertsLoading) return null

  const back = () => navigate('/mezo/karakter/dimenziok')

  if (dimension == null) {
    return (
      <div className="kr9-page kr9-dimpage">
        <KarakterBackHead small="Karakter" title="Dimenzió" onBack={back} />
        <div className="tf-dash kr9-degraded">
          <Icon3D name="t-info" size={30} />
          <span>Ez a dimenzió jelenleg nem elérhető.</span>
        </div>
      </div>
    )
  }

  const who = personaCharacter(dimension.expertKey)
  const sub = dimension.kind === 'CHAPTER'
    ? 'közös AI-fejezet · érettség'
    : dimension.kind === 'META'
      ? 'a társ önvizsgálata · Szkeptikus'
      : `${dimension.expertKey != null ? personaName(dimension.expertKey) : 'a csapat'} · érettség`
  const claims = [...dimension.claims, ...(seen.key === key ? seen.claims.filter(claim => !dimension.claims.some(active => active.id === claim.id)) : [])]

  return (
    <div className={`kr9-page kr9-dimpage tf-c-${who.accent}`}>
      <KarakterBackHead small="Dimenzió" title={dimension.title} onBack={back} />
      <section className="tf-rhero kr9-rhero">
        {dimension.expertKey != null
          ? <PersonaOrb expertKey={dimension.expertKey} size={92} className="kr9-rfig" />
          : <span className="kr9-rfig kr9-chaptermark" aria-hidden="true"><Icon3D name="t-spark" size={64} /></span>}
        <h1>{dimension.title}</h1>
        <p className="kr9-rsub">{sub}</p>
      </section>
      <section className="tf-gauges kr9-gauges" aria-label="Érettség">
        <div className="tf-gauge">
          <svg viewBox="0 0 64 64" className="uv-ring" aria-hidden="true">
            <circle className="uv-ring-track" cx="32" cy="32" r="28" pathLength={100} />
            {swept > 0 && <circle className="uv-ring-prog" cx="32" cy="32" r="28" pathLength={100} strokeDasharray={`${swept} 100`} />}
          </svg>
          <span className="tf-gauge-value">{swept}%</span>
          <span className="tf-gauge-label">Érettség</span>
        </div>
      </section>
      {dimension.portrait !== '' && <div className="kr9-portrait">{dimension.portrait}</div>}
      {claims.length > 0 && (
        <div className="tf-sec"><h2>Állítások</h2><span className="tf-hint">{claims.length}</span></div>
      )}
      <div className="tf-rows kr9-claims">
        {claims.map((c, i) => (
          <ClaimTile key={c.id} claim={c} withdrawn={!dimension.claims.some(active => active.id === c.id)} delayMs={i * 70} />
        ))}
      </div>
      <div className="tf-rows kr9-door">
        <button type="button" className="glass tf-rowg tf-c-gold" onClick={() => navigate('/mezo/chat')}>
          <PersonaOrb expertKey="mezo" size={44} />
          <span className="tf-rowtxt"><span className="tf-rowname">Beszélgess erről Mezóval</span></span>
          <span className="tf-rowbadge" aria-hidden="true">›</span>
        </button>
      </div>
      <p className="kr9-principle">{PRINCIPLE}</p>
    </div>
  )
}
