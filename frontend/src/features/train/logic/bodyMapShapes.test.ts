import { describe, expect, it } from 'vitest'
import { BODY } from './bodyGeometry.gen'
import { LIVE_MUSCLES } from './muscleColors'
import { TOKEN_SHAPES, shapesFor } from './bodyMapShapes'

describe('bodyMapShapes', () => {
  it('resolves every live token to at least one shape the artwork really has', () => {
    for (const token of LIVE_MUSCLES) {
      const shapes = shapesFor(token)
      expect(shapes.length, token).toBeGreaterThan(0)
      for (const [view, slug] of shapes) {
        expect(BODY[view].p[slug]?.length, `${token} → ${view}/${slug}`).toBeGreaterThan(0)
      }
    }
  })

  it('maps the legacy read-only keys so old rows stay visible', () => {
    expect(shapesFor('lats')).toEqual([['back', 'upper-back']])
    expect(shapesFor('rear-delt')).toEqual([['back', 'deltoids']])
    expect(shapesFor('back')).toEqual([['back', 'upper-back']])
    expect(shapesFor('chest')).toEqual([['front', 'chest']])
  })

  it('drops the unknown instead of guessing', () => {
    expect(shapesFor('nincs-ilyen')).toEqual([])
  })
})
