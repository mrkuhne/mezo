import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { SuggestionCard } from '@/features/fuel/components/SuggestionCard'

// The old `KamraCard` (the dark glass shelf tile) left with Folyadék F5: the Kamra tiles are the kit `Stat` (covered by
// FuelKamraPage.test.tsx). This file keeps the suggestion card.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

// Folyadék F5 (mezo-n4wf5.5): the suggestion is a dashed card (`.fp-swap`) that is NOT tappable itself; the add button
// is the kit's small ghost button, named „+ Polcra".
test('SuggestionCard shows the reason; „+ Polcra" renders only when onAdd is wired (P6)', () => {
  const { rerender, container } = render(
    <SuggestionCard sug={{ name: 'ZMA', source: 'myprotein.hu', price: '4 990 Ft', reason: 'Alvás-minőség' }} />,
  )
  expect(screen.getByText('Alvás-minőség')).toBeInTheDocument()
  // Swap suggestions reference items already on the shelf — no CTA without a real add-flow.
  expect(screen.queryByRole('button')).toBeNull()
  expect(container.querySelector('.fp-swap')).not.toBeNull()
  expect(container.querySelector('.glass, [class*="fkk-"], [class*="fkx-"]')).toBeNull()
  rerender(
    <SuggestionCard sug={{ name: 'ZMA', source: 'myprotein.hu', price: '4 990 Ft', reason: 'Alvás-minőség' }} onAdd={() => {}} />,
  )
  expect(screen.getByRole('button', { name: '+ Polcra' })).toHaveClass('fo-btn', 'sm', 'ghost')
})
