import { render, screen } from '@testing-library/react'
import { MacroHero } from './MacroHero'
const targets = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
const consumed = { kcal: 1840, p: 142, c: 198, f: 58, water: 1850 }

test('shows consumed kcal and remaining', () => {
  render(<MacroHero targets={targets} consumed={consumed} />)
  expect(screen.getByText(/1840/)).toBeInTheDocument()
  expect(screen.getByText(/1260 kcal hátra/)).toBeInTheDocument() // 3100-1840
})
test('renders the three macro cells and hydration', () => {
  render(<MacroHero targets={targets} consumed={consumed} />)
  for (const m of ['Protein', 'Carbs', 'Fat', 'Víz']) expect(screen.getByText(m)).toBeInTheDocument()
})
