// ============================================================
// Mezo · RecipeCard (editorial library card)
// docs/design/recipes-library.html `.rc-b`: an image band (diagonal-stripe
// gradient placeholder) with a slot tag + star top-left and the Mezo-fit badge
// top-right; the Antonio name lives on the card surface below the band
// (var(--ink) — Napiv de-darkening, mezo-8141: the retired dark-media text token),
// followed by a MacroCells strip (whole-recipe macros) and a meta line. v1
// fit_score is null → the badge shows the P2 pending sparkle.
// ============================================================
import type { Recipe } from '@/data/types'
import { Icon } from '@/shared/ui/Icon'
import { MacroCells } from '@/features/fuel/components/MacroCells'
import { RecipeFitBadge } from '@/features/fuel/components/RecipeFitBadge'

const NOVA_COLOR: Record<number, string> = { 1: 'var(--success)', 2: 'var(--warning)', 3: 'var(--warning)', 4: 'var(--error)' }

export function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: (r: Recipe) => void }) {
  const totalMins = recipe.prepMins + recipe.cookMins
  return (
    <button
      onClick={() => onOpen(recipe)}
      aria-label={recipe.name}
      className="rad-24"
      style={{ position: 'relative', width: '100%', textAlign: 'left', background: 'var(--surface-1)', overflow: 'hidden', marginBottom: 0 }}
    >
      {/* Image band */}
      <div style={{ position: 'relative', height: 118, background: 'linear-gradient(135deg,#16323a,#0f2027)' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(125deg,rgba(255,255,255,0.025) 0 14px,rgba(255,255,255,0) 14px 28px)' }} />
        {/* top-left: slot tag + star */}
        <div className="row gap-xs" style={{ position: 'absolute', top: 10, left: 11, zIndex: 3, alignItems: 'center' }}>
          {recipe.slot && (
            <span className="chip brand" style={{ fontSize: 8, padding: '3px 7px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {recipe.slot}
            </span>
          )}
          {recipe.starred && <Icon name="bookmark" size={12} color="var(--warning)" />}
        </div>
        <RecipeFitBadge score={recipe.mezoFit.score} />
      </div>

      {/* Body — name moved off the media band onto the card surface (var(--ink)) */}
      <div style={{ padding: '11px 13px 13px' }}>
        <div
          style={{
            fontFamily: 'var(--ff-display)', fontSize: 18, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 1.15, color: 'var(--ink)', marginBottom: 9,
          }}
        >
          {recipe.name}
        </div>
        <MacroCells macros={recipe.macros} />
        <div className="row gap-xs flex-wrap" style={{ alignItems: 'center', marginTop: 10, fontFamily: 'var(--ff-mono)', fontSize: 8, color: 'var(--text-tertiary)' }}>
          <span>{recipe.ingredients.length} hozzávaló</span>
          <span>·</span>
          <span>{totalMins} perc</span>
          <span>·</span>
          <span style={{ color: NOVA_COLOR[recipe.novaDominant] ?? 'var(--text-tertiary)' }}>NOVA {recipe.novaDominant}</span>
        </div>
      </div>
    </button>
  )
}
