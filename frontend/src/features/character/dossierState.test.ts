import { describe, expect, test } from 'vitest'
import { isDossierEmpty } from './dossierState'
import { MOCK_OVERVIEW, MOCK_OVERVIEW_EMPTY } from '@/data/character/characterMock'

describe('isDossierEmpty — the ONE shared untouched-dossier predicate (mezo-1gim.13, fix round 1)', () => {
  test('the pre-bootstrap mock seed (all CORE dims at maturity 0, no portrait, no claims) is empty', () => {
    expect(isDossierEmpty(MOCK_OVERVIEW_EMPTY)).toBe(true)
  })

  test('the seeded, populated dossier is NOT empty', () => {
    expect(isDossierEmpty(MOCK_OVERVIEW)).toBe(false)
  })

  test('overview === null (switch off) is the degraded case, not "empty"', () => {
    expect(isDossierEmpty(null)).toBe(false)
  })

  test('any single CORE dimension with a portrait, a claim, or nonzero maturity is enough to end the empty state', () => {
    const withPortrait = { dimensions: MOCK_OVERVIEW_EMPTY.dimensions.map((d, i) => (i === 0 ? { ...d, portrait: 'x' } : d)) }
    expect(isDossierEmpty(withPortrait)).toBe(false)
    const withClaim = { dimensions: MOCK_OVERVIEW_EMPTY.dimensions.map((d, i) => (i === 0 ? { ...d, topClaims: [{ id: 'c', text: 't', confidence: 0.6, sensitive: false, evidence: [] }] } : d)) }
    expect(isDossierEmpty(withClaim)).toBe(false)
    const withMaturity = { dimensions: MOCK_OVERVIEW_EMPTY.dimensions.map((d, i) => (i === 0 ? { ...d, maturity: 5 } : d)) }
    expect(isDossierEmpty(withMaturity)).toBe(false)
  })

  test('no CORE dimensions at all is not "empty" (nothing to bootstrap into)', () => {
    expect(isDossierEmpty({ dimensions: [] })).toBe(false)
  })
})
