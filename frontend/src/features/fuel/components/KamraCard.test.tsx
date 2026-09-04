import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { KamraCard } from '@/features/fuel/components/KamraCard'
import type { PantryItem } from '@/data/types'

const base: PantryItem = { id: 'x', name: 'Skyr natúr', brand: 'Ehrmann', source: 'manual', category: 'dairy', kind: 'food', macros: { kcal: 63, p: 10.6, c: 4, f: 0.2 } }

test('shows the "közös" badge only when the definition is shared from another user', () => {
  const { rerender } = render(<KamraCard item={{ ...base, sharedFrom: { authorName: 'Anna' } }} onOpen={() => {}} />)
  expect(screen.getByText('közös')).toBeInTheDocument()
  rerender(<KamraCard item={{ ...base, sharedFrom: null }} onOpen={() => {}} />)
  expect(screen.queryByText('közös')).not.toBeInTheDocument()
})
