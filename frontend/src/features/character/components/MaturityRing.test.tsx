import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { MaturityRing } from './MaturityRing'
import type { CharacterDimensionSummary } from '@/data/character/characterApi'

const dim = (key: string, expertKey: string, maturity: number, kind: 'CORE' | 'CHAPTER' = 'CORE'): CharacterDimensionSummary => ({
  key, title: key, kind, expertKey, maturity, portrait: '', topClaims: [],
})

const SEVEN_CORE = [
  dim('physical', 'doki', 58),
  dim('athletic', 'edzo', 71),
  dim('nutrition', 'taplalkozo', 45),
  dim('recovery', 'szomnologus', 66),
  dim('mental', 'pszichologus', 39),
  dim('discipline', 'drill', 74),
  dim('life', 'antropologus', 33),
]

describe('MaturityRing', () => {
  test('draws exactly 7 CORE arcs, one per expert domain color', () => {
    const { container } = render(<MaturityRing dimensions={SEVEN_CORE} />)
    const segs = container.querySelectorAll('.kr-seg')
    expect(segs).toHaveLength(7)
    expect(segs[0]).toHaveAttribute('stroke', '#3E7396') // doki
    expect(segs[1]).toHaveAttribute('stroke', '#A84A26') // edzo
  })

  test('a trailing CHAPTER dimension is ignored — the ring stays a 7-segment hero', () => {
    const { container } = render(<MaturityRing dimensions={[...SEVEN_CORE, dim('chapter-work', 'x', 21, 'CHAPTER')]} />)
    expect(container.querySelectorAll('.kr-seg')).toHaveLength(7)
  })

  test('the center counts up to the aggregate % with an accessible label', async () => {
    render(<MaturityRing dimensions={SEVEN_CORE} />)
    // avg = round((58+71+45+66+39+74+33)/7) = 55; the label is set from the start (it doesn't
    // wait on the count-up animation), the numeral sweeps up to match it.
    expect(screen.getByRole('img', { name: 'Karakter érettség: 55%' })).toBeInTheDocument()
    expect(screen.getByText('érettség')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('55%')).toBeInTheDocument(), { timeout: 2000 })
  })

  test('no dimensions at all -> a 0% ring, not a crash (honest pre-bootstrap state)', () => {
    render(<MaturityRing dimensions={[]} />)
    expect(screen.getByRole('img', { name: 'Karakter érettség: 0%' })).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
