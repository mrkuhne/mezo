// ============================================================
// Mezo · Karakter — DimensionsPage (mezo-1gim.13, Task 4)
// The dimension list (7 CORE + 1 META + 1 CHAPTER since round 4, mezo-1gim.15).
// Üvegesítés U9 (mezo-me75u.9): every dimension is a `glass tf-rowg` row wearing the owning
// csapatfal character's accent + figure, its first claim and the maturity % badge; a CHAPTER
// dimension (no owner) carries the t-spark icon instead of a figure. Standalone the page wears
// the `tf-dhead` back head; embedded (Rólad) it opens under a `tf-sec` heading instead.
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import '@/features/insights/boop-world.css'
import { useCharacterOverview } from '@/data/hooks'
import { Icon3D } from '@/shared/ui/clay'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { KarakterBackHead } from '@/features/character/components/KarakterBackHead'
import { personaCharacter } from '@/features/character/personaCharacter'

export function DimensionsPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { overview, isLoading } = useCharacterOverview()

  if (isLoading) return null

  if (overview == null) {
    return (
      <div className="kr9-page kr9-dims">
        {!embedded && <KarakterBackHead small="Karakter" title="Amit eddig tudunk rólad" onBack={() => navigate('/mezo/rolad')} />}
        <div className="tf-dash kr9-degraded">
          <Icon3D name="t-info" size={30} />
          <span>A karakter-dosszié jelenleg nem elérhető — ez nem hiba, csak a funkció ki van kapcsolva.</span>
        </div>
      </div>
    )
  }

  // I3 (final review): CHAPTER dimensions open/retire dynamically — "mind a nyolc" was a
  // hardcoded lie the moment the chapter count moved off 1. Derived from the live overview.
  const countLine = `${overview.dimensions.length} témakör · mindegyik pontosítható`

  return (
    <div className="kr9-page kr9-dims">
      {embedded ? (
        <div className="tf-sec"><h2>Amit eddig tudunk rólad</h2><span className="tf-hint">{countLine}</span></div>
      ) : (
        <KarakterBackHead small={`Karakter · ${countLine}`} title="Amit eddig tudunk rólad" onBack={() => navigate('/mezo/rolad')} />
      )}
      <div className="tf-rows kr9-dimrows">
        {overview.dimensions.map((d, i) => {
          const who = personaCharacter(d.expertKey)
          const topClaim = d.topClaims[0]
          const isChapter = d.kind === 'CHAPTER'
          const isMeta = d.kind === 'META'
          return (
            <button
              key={d.key}
              type="button"
              className={`glass tf-rowg tf-c-${who.accent} kr9-dim rise${isChapter ? ' kr9-chapter' : isMeta ? ' kr9-meta' : ''}`}
              style={{ '--d': `${40 + i * 45}ms` } as React.CSSProperties}
              onClick={() => navigate(`/mezo/karakter/dimenzio/${d.key}`)}
              aria-label={d.title}
            >
              {isChapter
                ? <Icon3D name="t-spark" size={40} />
                : <PersonaOrb expertKey={d.expertKey ?? 'mezo'} size={44} />}
              <span className="tf-rowtxt">
                <span className="tf-rowname">{d.title}</span>
                {topClaim != null && <span className="tf-rowsub">{topClaim.text}</span>}
              </span>
              <span className="tf-rowbadge">{d.maturity}%</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
