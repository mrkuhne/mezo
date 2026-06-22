import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { NewRecipeSheet } from './NewRecipeSheet'
import { QueryWrapper } from '@/test/queryWrapper'

// NewRecipeSheet reads usePantry (ingredients picker) — a dual-mode TanStack query since Task 7.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('Save is disabled until a name and an ingredient are added', async () => {
  render(<NewRecipeSheet onClose={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByRole('button', { name: 'Mentés' })).toBeDisabled()
  await userEvent.type(screen.getByPlaceholderText(/Tonhalsaláta/), 'Teszt recept')
  await userEvent.click(screen.getByRole('button', { name: /Kamrából/ }))
  expect(await screen.findByText('Válassz hozzávalót')).toBeInTheDocument()
})
