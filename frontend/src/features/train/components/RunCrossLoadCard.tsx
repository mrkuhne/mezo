import { Icon } from '@/shared/ui/Icon'

/**
 * Derived, presentational cross-load note — sprint eccentric load carries over to gym leg
 * volume, like the volleyball cross-load. Phase 2 shows it statically; wiring into the
 * volume-recompute engine is Phase 3.
 */
export function RunCrossLoadCard() {
  return (
    <div className="card notch-4" style={{ padding: 12, background: 'var(--wash-run)', borderColor: 'color-mix(in srgb, var(--tag-run) 25%, transparent)' }}>
      <div className="row gap-sm" style={{ alignItems: 'flex-start' }}>
        <Icon name="sparkle" size={12} color="var(--tag-run)" />
        <div className="col flex-1">
          <span className="eyebrow" style={{ color: 'var(--tag-run)' }}>Cross-load → kondi</span>
          <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            A sprintek hamstring/quad eccentric terhelése automatikusan levonódik a láb-volumenből
            (<strong>Comb / Lábhajlító MAV −2</strong>) — ahogy a röplabdánál. A volumen-motorba kötés a Phase 3 pattern-engine része.
          </p>
        </div>
      </div>
    </div>
  )
}
