import { formatCandidateDate } from '@/data/insights/graph'

describe('formatCandidateDate (W5.3, mezo-b3pp.20)', () => {
  it('a LIFE_EVENT dátumát változatlanul, nyers ISO alakban adja vissza', () => {
    expect(formatCandidateDate('LIFE_EVENT', '2026-08-21')).toBe('2026-08-21')
  })

  it('a SEASON dátumát a lefedett negyedévként írja ki (Q1)', () => {
    expect(formatCandidateDate('SEASON', '2026-01-01')).toBe('2026. I. negyedév')
  })

  it('a SEASON dátumát a lefedett negyedévként írja ki (Q3, a negyedéves mélyfutam seed-je)', () => {
    expect(formatCandidateDate('SEASON', '2026-07-01')).toBe('2026. III. negyedév')
  })

  it('a SEASON dátumát a lefedett negyedévként írja ki (Q4)', () => {
    expect(formatCandidateDate('SEASON', '2026-10-01')).toBe('2026. IV. negyedév')
  })
})
