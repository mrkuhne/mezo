// ============================================================
// Mezo · RecipeFitBadge (Mezo-fit slot — pending vs scored)
// The stable top-right badge from docs/design/recipes-library.html / -detail.html.
// v1: fit_score is always null (Phase-3 scoring deferred) → P2 sparkle "pending"
// signal. When a real score lands the SAME slot shows the Antonio number + "fit"
// — no layout shift. `size="hero"` is the bigger detail-hero variant.
// ============================================================
import { Icon } from '@/shared/ui/Icon'

export interface RecipeFitBadgeProps {
  score: number | null
  size?: 'card' | 'hero'
}

export function RecipeFitBadge({ score, size = 'card' }: RecipeFitBadgeProps) {
  const isHero = size === 'hero'
  const pending = score == null
  return (
    <div
      className="notch-8"
      style={{
        position: 'absolute', top: isHero ? 10 : 9, right: isHero ? 11 : 10, zIndex: 4,
        minWidth: isHero ? 44 : 40, padding: isHero ? '6px 6px 5px' : '5px 5px 4px', textAlign: 'center',
        background: 'rgba(8,12,16,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        boxShadow: pending ? undefined : '0 0 0 1px color-mix(in srgb, var(--sage) 25%, transparent), 0 6px 16px -6px color-mix(in srgb, var(--sage) 50%, transparent)',
      }}
    >
      {pending ? (
        <>
          <div style={{ color: 'var(--brand-glow)', display: 'flex', justifyContent: 'center', animation: 'mezo-twinkle 2.2s ease-in-out infinite' }}>
            <Icon name="sparkle" size={isHero ? 18 : 16} />
          </div>
          <div className="label-mono" style={{ fontSize: 6.5, letterSpacing: '0.16em', color: 'var(--brand-glow)', opacity: 0.8, marginTop: 3 }}>
            Mezo
          </div>
        </>
      ) : (
        <>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: isHero ? 22 : 18, fontWeight: 600, lineHeight: 1, color: 'var(--brand-glow)' }}>
            {Math.round(score * 100)}
          </div>
          <div className="label-mono" style={{ fontSize: 6.5, letterSpacing: '0.16em', color: 'var(--text-tertiary)', marginTop: 3 }}>
            fit
          </div>
        </>
      )}
    </div>
  )
}
