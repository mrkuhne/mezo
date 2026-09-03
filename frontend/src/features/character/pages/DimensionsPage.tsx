// ============================================================
// Mezo · Karakter — DimensionsPage (mezo-1gim.13, Task 4)
// Source: docs/design_2.0/prototypes/src/karakter-body.html `#page-dims` +
// `dimsListTiles.innerHTML` — the flat tile list (7 CORE + 1 META + 1 CHAPTER since round 4,
// mezo-1gim.15), CHAPTER dimensions getting the dashed `.chapter` treatment (character.css
// `.kr-dimtile.chapter`) and the META dimension getting the solid `.meta` treatment
// (`.kr-dimtile.meta`).
// ============================================================
import { useNavigate } from 'react-router-dom'
import '@/features/character/character.css'
import { PageHead } from '@/shared/ui/mozaik'
import { useCharacterOverview } from '@/data/hooks'
import { PersonaOrb } from '@/features/character/components/PersonaOrb'
import { expertColor } from '@/features/character/expertColors'

export function DimensionsPage() {
  const navigate = useNavigate()
  const { overview, isLoading } = useCharacterOverview()

  if (isLoading) return null

  if (overview == null) {
    return (
      <div className="kr-hub">
        <div className="kr-degraded">
          A karakter-dosszié jelenleg nem elérhető — ez nem hiba, csak a funkció ki van kapcsolva.
        </div>
      </div>
    )
  }

  return (
    <div className="kr-hub">
      <PageHead onBack={() => navigate('/me/karakter')} label="‹ Karakter" />
      <div className="mz-page-hero">
        <div className="mz-hero-nm">Dimenziók</div>
        {/* I3 (final review): CHAPTER dimensions open/retire dynamically — "mind a nyolc" was a
           hardcoded lie the moment the chapter count moved off 1. Derived from the live
           overview instead. */}
        <div className="mz-hero-sb">{overview.dimensions.length} dimenzió, egy helyen</div>
      </div>
      <div className="kr-dimlist">
        {overview.dimensions.map((d, i) => {
          const color = expertColor(d.expertKey)
          const topClaim = d.topClaims[0]
          const isChapter = d.kind === 'CHAPTER'
          const isMeta = d.kind === 'META'
          return (
            <button
              key={d.key}
              type="button"
              className={`kr-dimtile rise${isChapter ? ' chapter' : isMeta ? ' meta' : ''}`}
              style={{ '--d': `${40 + i * 45}ms`, '--wash': `${color}22`, '--dc': color, '--sh': `${color}4d`, '--mv': d.maturity } as React.CSSProperties}
              onClick={() => navigate(`/me/karakter/dimenzio/${d.key}`)}
              aria-label={d.title}
            >
              <div className="kr-dhd">
                {isChapter
                  ? <div className="kr-miniring" aria-hidden="true" />
                  : <div className="kr-disc"><PersonaOrb expertKey={d.expertKey ?? 'mezo'} size={24} /></div>}
                <div className="kr-dnm">{d.title}</div>
              </div>
              {topClaim != null && <div className="kr-dline">{topClaim.text}</div>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
