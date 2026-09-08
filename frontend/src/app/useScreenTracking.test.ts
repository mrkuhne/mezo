import { describe, it, expect } from 'vitest'
import { routePatternOf, scrubPathname } from '@/app/useScreenTracking'

// The PII guard (spec T3): what leaves the client is the route pattern, never the concrete URL.
describe('routePatternOf', () => {
  it('substitutes a matched param back into its pattern', () => {
    expect(routePatternOf('/admin/users/42', { id: '42' })).toBe('/admin/users/:id')
  })

  it('substitutes every param of a multi-param route', () => {
    expect(routePatternOf('/me/nap/2026-09-07/edit', { date: '2026-09-07', mode: 'edit' }))
      .toBe('/me/nap/:date/:mode')
  })

  it('collapses a splat to a literal star, never the typed path', () => {
    expect(routePatternOf('/valami/amit/beirt', { '*': 'valami/amit/beirt' })).toBe('/*')
  })

  it('leaves a param-free path untouched', () => {
    expect(routePatternOf('/nap', {})).toBe('/nap')
  })

  it('ignores an undefined optional param instead of writing "undefined"', () => {
    expect(routePatternOf('/fuel', { id: undefined })).toBe('/fuel')
  })
})

// The no-data-router fallback: still no concrete id, even without any route knowledge.
describe('scrubPathname', () => {
  it('replaces a numeric id segment', () => {
    expect(scrubPathname('/admin/users/42')).toBe('/admin/users/:id')
  })

  it('replaces a uuid segment', () => {
    expect(scrubPathname('/recept/3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('/recept/:id')
  })

  it('replaces an ISO date segment', () => {
    expect(scrubPathname('/nap/2026-09-07')).toBe('/nap/:id')
  })

  it('leaves a word-only path untouched', () => {
    expect(scrubPathname('/fuel/kamra')).toBe('/fuel/kamra')
  })
})
