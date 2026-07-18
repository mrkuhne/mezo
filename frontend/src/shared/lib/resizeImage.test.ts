import { describe, expect, it } from 'vitest'
import { fitWithin } from '@/shared/lib/resizeImage'

describe('fitWithin', () => {
  it('keeps small images untouched', () => {
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 })
  })
  it('scales landscape down to maxDim preserving ratio', () => {
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 })
  })
  it('scales portrait down to maxDim preserving ratio', () => {
    expect(fitWithin(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 })
  })
})
