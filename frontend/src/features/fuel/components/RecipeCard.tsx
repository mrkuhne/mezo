import type { Recipe } from '@/data/types'
import type { PantrySourceKey } from '@/data/pantrySources'
import { usePantry } from '@/data/hooks'
import { MacroRow } from '@/components/ui/MacroRow'
import { SourceBadge } from '@/components/ui/SourceBadge'
import { NovaDot } from '@/components/ui/NovaDot'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Icon } from '@/components/ui/Icon'

export function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: (r: Recipe) => void }) {
  const { ingredients } = usePantry()
  const fitScore = recipe.mezoFit.score ?? 0
  const fitColor =
    fitScore >= 0.9
      ? 'var(--brand-glow)'
      : fitScore >= 0.85
        ? 'var(--cat-goal-state)'
        : 'var(--cat-preference)'
  const sources = [
    ...new Set(
      recipe.ingredients
        .map(i => ingredients.find(ii => ii.id === i.refId)?.source)
        .filter((s): s is PantrySourceKey => Boolean(s)),
    ),
  ]

  return (
    <button
      onClick={() => onOpen(recipe)}
      className="card notch-12"
      style={{
        padding: 14,
        textAlign: 'left',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {recipe.starred && (
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <Icon name="bookmark" size={12} color="var(--warning)" />
        </div>
      )}

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        {/* Image placeholder · diagonal stripes */}
        <div
          style={{
            width: 60,
            height: 60,
            flexShrink: 0,
            background: 'repeating-linear-gradient(45deg, var(--surface-2) 0 6px, var(--surface-3) 6px 12px)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--ff-mono)',
            fontSize: 8,
            color: 'var(--text-quaternary)',
            letterSpacing: '0.1em',
          }}
        >
          FOOD
        </div>

        <div className="col flex-1" style={{ minWidth: 0 }}>
          <Eyebrow className="text-tertiary">{recipe.slot}</Eyebrow>
          <div
            style={{
              fontFamily: 'var(--ff-display)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: 4,
              lineHeight: 1.2,
              paddingRight: recipe.starred ? 16 : 0,
            }}
          >
            {recipe.name}
          </div>
          <div className="mt-sm">
            <MacroRow macros={recipe.macros} />
          </div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
        <div className="row gap-xs flex-wrap" style={{ alignItems: 'center' }}>
          <span className="label-mono" style={{ fontSize: 8, color: 'var(--text-tertiary)' }}>
            {recipe.ingredients.length} hozzávaló · {recipe.prepMins + recipe.cookMins}p
          </span>
          {sources.slice(0, 2).map(s => (
            <SourceBadge key={s} source={s} />
          ))}
        </div>
        <div className="row gap-xs" style={{ alignItems: 'center' }}>
          <span className="label-mono" style={{ fontSize: 8, color: fitColor }}>
            Mezo fit
          </span>
          <span style={{ fontFamily: 'var(--ff-display)', fontSize: 14, color: fitColor, lineHeight: 1 }}>
            {(fitScore * 100).toFixed(0)}
          </span>
        </div>
      </div>

      <div
        className="row"
        style={{ justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}
      >
        <span className="text-tertiary" style={{ fontSize: 10, fontFamily: 'var(--ff-mono)' }}>
          {recipe.timesLogged}× logolva · {recipe.lastLogged}
        </span>
        <div className="row gap-xs">
          <NovaDot nova={recipe.novaDominant} />
        </div>
      </div>
    </button>
  )
}
