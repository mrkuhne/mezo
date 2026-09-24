import type { CSSProperties } from 'react'
import { Icon3D } from '@/shared/ui/clay'

/**
 * Derived, presentational cross-load note — sprint eccentric load carries over to gym leg
 * volume, like the volleyball cross-load. Phase 2 shows it statically; wiring into the
 * volume-recompute engine is Phase 3.
 * Üveg re-dress (mezo-me75u.4, prototype uveg-edzes-body.html `futas('het')` `.xl`): a sky
 * glass card with a 3D head icon; the note itself is a flat line inside.
 */
export function RunCrossLoadCard() {
  return (
    <article className="uvs-xl glass" style={{ '--c': 'var(--dv-sky)' } as CSSProperties}>
      <div className="uvs-chead">
        <Icon3D name="t-chain" size={40} />
        <span className="uv-eyebrow uv-tint">Cross-load → kondi</span>
      </div>
      <div className="uvs-xl-lines">
        <div className="uvs-xrow">
          <Icon3D name="t-run" size={26} />
          <div className="uvs-xrow-body">
            <p>
              A sprintek hamstring/quad eccentric terhelése automatikusan levonódik a láb-volumenből
              (<strong>Comb / Lábhajlító MAV −2</strong>) — ahogy a röplabdánál. A volumen-motorba kötés a Phase 3 pattern-engine része.
            </p>
          </div>
        </div>
      </div>
    </article>
  )
}
