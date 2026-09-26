import { describe, expect, it } from 'vitest'
import { candidateByline, factOwnerTag, pickQuoteClaim, topRoladFacts, ROLAD_COPY } from './roladCopy'

const claim = (id: string, confidence: number, proposedBy: string, sensitive = false) =>
  ({ id, text: `t-${id}`, confidence, sensitive, proposedBy, evidence: [] })

describe('pickQuoteClaim', () => {
  it('returns the highest-confidence non-sensitive claim across dimensions, with its character', () => {
    const overview = { dimensions: [
      { key: 'a', title: 'A', kind: 'CORE', maturity: 40, portrait: '', topClaims: [claim('1', 0.6, 'edzo')] },
      { key: 'b', title: 'B', kind: 'CORE', maturity: 70, portrait: '', topClaims: [claim('2', 0.9, 'szomnologus'), claim('3', 0.95, 'doki', true)] },
    ] }
    expect(pickQuoteClaim(overview as never)).toEqual({ id: '2', text: 't-2', character: 'szunya' })
  })
  it('is null without an overview or without any claim', () => {
    expect(pickQuoteClaim(null)).toBeNull()
    expect(pickQuoteClaim({ dimensions: [] } as never)).toBeNull()
  })
})

describe('factOwnerTag', () => {
  it('says TŐLED for user-authored sources, otherwise the owner name in capitals', () => {
    expect(factOwnerTag({ owner: 'falat', source: 'manual' })).toEqual({ label: 'TŐLED', accent: 'gold' })
    expect(factOwnerTag({ owner: 'falat', source: 'question' }).label).toBe('TŐLED')
    expect(factOwnerTag({ owner: 'szunya', source: 'chat' })).toEqual({ label: 'SZUNYA', accent: 'lav' })
    expect(factOwnerTag({ owner: 'deru', source: 'pattern' }).label).toBe('DERŰ')
  })
})

describe('candidateByline', () => {
  it('names who brought it and when', () => {
    expect(candidateByline('falat', new Date().toISOString())).toBe('Falat hozta · ma')
    expect(candidateByline('mezo', '2026-03-02T09:00:00Z')).toMatch(/^Mezo hozta · /)
  })
})

describe('topRoladFacts', () => {
  it('keeps active facts, most recently reinforced first, max 4', () => {
    const f = (id: string, active: boolean, last: string | null, created: string) =>
      ({ id, text: id, category: 'life', active, reinforced: 1, source: 'chat', owner: 'mezo', lastReinforcedAt: last, createdAt: created })
    const list = [f('a', true, null, '2026-01-01T00:00:00Z'), f('b', false, '2026-09-01T00:00:00Z', '2026-01-01T00:00:00Z'),
      f('c', true, '2026-08-01T00:00:00Z', '2026-01-01T00:00:00Z'), f('d', true, '2026-09-10T00:00:00Z', '2026-01-01T00:00:00Z'),
      f('e', true, null, '2026-09-20T00:00:00Z'), f('g', true, null, '2026-02-01T00:00:00Z')]
    expect(topRoladFacts(list as never).map((x) => x.id)).toEqual(['e', 'd', 'c', 'g'])
  })
})

it('keeps the approved copy verbatim', () => {
  expect(ROLAD_COPY.keep).toBe('Bekerült a rólad szóló képbe — a forrásával együtt')
  expect(ROLAD_COPY.snooze).toBe('Most nem került be — kb. két hét múlva újra megkérdezzük')
  expect(ROLAD_COPY.reject).toBe('Nem került be — nem kérdezzük újra')
})
