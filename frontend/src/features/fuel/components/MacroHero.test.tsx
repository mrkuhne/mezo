import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { MacroHero } from '@/features/fuel/components/MacroHero'
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
test('zero targets (real-mode cold load) render 0%, never NaN%', () => {
  // useFuelDay returns a ZERO day before the backend resolves (no static fallback in
  // real mode); a 0/0 percent must read as a benign 0%, not "NaN%".
  const zero = { kcal: 0, p: 0, c: 0, f: 0, water: 0 }
  const { container } = render(<MacroHero targets={zero} consumed={zero} />)
  expect(container.textContent).not.toMatch(/NaN/)
  expect(screen.getByText(/0% target/)).toBeInTheDocument()
})
test('renders the optional pacing eyebrow when provided, omits it otherwise', () => {
  const { unmount } = render(<MacroHero targets={targets} consumed={consumed} eyebrow="Pacing · 13:42" />)
  expect(screen.getByText('Pacing · 13:42')).toBeInTheDocument()
  unmount()
  render(<MacroHero targets={targets} consumed={consumed} />)
  expect(screen.queryByText('Pacing · 13:42')).not.toBeInTheDocument()
})
it('renders +250/+500 water chips and calls onLogWater', () => {
  const onLogWater = vi.fn()
  render(<MacroHero targets={targets} consumed={consumed} onLogWater={onLogWater} />)
  fireEvent.click(screen.getByRole('button', { name: 'Víz +250 ml' }))
  fireEvent.click(screen.getByRole('button', { name: 'Víz +500 ml' }))
  expect(onLogWater).toHaveBeenNthCalledWith(1, 250)
  expect(onLogWater).toHaveBeenNthCalledWith(2, 500)
})

it('renders no water chips without onLogWater', () => {
  render(<MacroHero targets={targets} consumed={consumed} />)
  expect(screen.queryByRole('button', { name: /Víz \+/ })).toBeNull()
})
