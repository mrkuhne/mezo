// ============================================================
// Mezo · ExerciseImage — the catalog-resolved demo still (mezo-8xdl.3).
//
// The round chip that leads a picker row (Folyadék, mezo-n4wf5.3): the start frame of the
// free-exercise-db photo cropped to the size of a muscle chip, and the muscle chip itself
// (`Mchp`) where there is no photo — imageStartUrl is the presence flag, and the 37 catalog
// rows with no faithful counterpart in the dataset (ADR 0020) must not leave ragged holes in
// a list. Only a muscle the body map does not know falls back to the initial.
//
// The image is always decorative (it stands next to a visible label): alt="" so it does not
// double-announce the exercise name. The cross-fading `hero` variant (the two frames
// alternating on the exercise page) left with the Folyadék exercise page, which draws no photo.
// ============================================================
import type { CSSProperties } from 'react'
import { shapesFor } from '@/features/train/logic/bodyMapShapes'
import { Mchp } from '@/features/train/components/folyadek'

interface ExerciseImageProps {
  start: string | null | undefined
  /** Exercise name — only for the no-image fallback's initial. */
  name: string
  /** Catalog muscle token, for the no-image fallback chip. */
  muscle?: string
  /** Caller-side placement (e.g. alignSelf). */
  style?: CSSProperties
}

export function ExerciseImage({ start, name, muscle, style }: ExerciseImageProps) {
  // A ragged list edge is worse than a plain chip, so the fallback is always rendered.
  if (!start) {
    if (muscle && shapesFor(muscle).length > 0) return <Mchp muscle={muscle} sm className="ee-thumb" />
    return <span aria-hidden="true" className="ee-thumb" style={style}>{name.slice(0, 1).toUpperCase()}</span>
  }
  return <img className="ee-thumb" src={start} alt="" width={32} height={32} loading="lazy" decoding="async" style={style} />
}
