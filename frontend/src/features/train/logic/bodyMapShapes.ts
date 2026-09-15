/**
 * Which drawable shapes carry each muscle token, and on which view. The artwork is coarser than
 * the planner ON PURPOSE: the three biceps heads share one shape, the mid back rides on the
 * upper back (no rhomboid shape upstream). Where tokens share a shape, the shape's load is the
 * SUM of its tokens. Anything unmapped is dropped, never guessed.
 */
import type { BodyView } from './bodyGeometry.gen'

// The prototype's mapping (docs/design_2.0/prototypes/companion-titanium/muscle-taxonomy.js),
// translated verbatim — 21 live catalog tokens → [view, shape-slug] pairs.
export const TOKEN_SHAPES: Record<string, Array<[BodyView, string]>> = {
  'chest-upper': [['front', 'upper-chest']],
  'chest-mid': [['front', 'chest']],
  'chest-lower': [['front', 'lower-chest']],
  'back-wide': [['back', 'upper-back']],
  'back-mid': [['back', 'upper-back']],
  'back-lower': [['back', 'lower-back']],
  traps: [['back', 'trapezius']],
  'shoulder-front': [['front', 'front-deltoid']],
  'shoulder-side': [['front', 'deltoids']],
  'shoulder-rear': [['back', 'deltoids']],
  'biceps-long': [['front', 'biceps']],
  'biceps-short': [['front', 'biceps']],
  'biceps-brachialis': [['front', 'biceps']],
  'triceps-long': [['back', 'triceps']],
  'triceps-lateral': [['back', 'triceps']],
  'triceps-medial': [['back', 'triceps']],
  quad: [['front', 'quadriceps'], ['front', 'inner-quad'], ['front', 'outer-quad']],
  ham: [['back', 'hamstring']],
  glute: [['back', 'gluteal']],
  calf: [['back', 'calves']],
  core: [['front', 'abs'], ['front', 'upper-abs'], ['front', 'lower-abs'], ['front', 'obliques']],
}

// Legacy coarse keys still emitted by the volume log (muscleColors.ts:30-38) — remapped to the
// nearest live token so old rows stay visible on the body map instead of vanishing.
const LEGACY: Record<string, string> = {
  chest: 'chest-mid', // generic "Mell" → the middle head (most central shape)
  lats: 'back-wide', // "Hát" wide-grip lift → the lats shape (upper-back)
  back: 'back-wide', // generic "Hát" → same shape as lats
  shoulder: 'shoulder-side', // generic "Váll" → the lateral/middle head
  'rear-delt': 'shoulder-rear', // rear delt isolation → the rear-delt token
  biceps: 'biceps-long', // generic "Kar" biceps → any head resolves to the same shape
  triceps: 'triceps-long', // generic "Kar" triceps → any head resolves to the same shape
}

/** Shapes for a muscle token, legacy keys resolved. Unknown tokens are dropped, never guessed. */
export function shapesFor(token: string): Array<[BodyView, string]> {
  return TOKEN_SHAPES[token] ?? TOKEN_SHAPES[LEGACY[token]] ?? []
}
