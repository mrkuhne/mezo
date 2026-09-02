import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelPage } from '@/features/me/pages/CelPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const renderGoal = (id = 'lg-kockahas') => render(
  <QueryWrapper>
    <MemoryRouter initialEntries={[`/me/goals/${id}`]}>
      <Routes>
        <Route path="/me/goals/:id" element={<CelPage />} />
        <Route path="/me/goals" element={<div>HUB</div>} />
      </Routes>
    </MemoryRouter>
  </QueryWrapper>,
)

test('renders Kockahas with five pillars, the why quote and two ha–akkor plans, no fabricated numbers', () => {
  renderGoal()
  expect(screen.getByText('Kockahas')).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-pillar')).toHaveLength(5)
  expect(screen.getAllByText(/még nincs adat/)).toHaveLength(5)
  expect(screen.getByText(/Erős, egészséges test/)).toBeInTheDocument()
  expect(screen.getAllByText('HA')).toHaveLength(2)
})

test('Parkolás parks the goal and swaps the action to Aktiválás', async () => {
  renderGoal()
  fireEvent.click(screen.getByRole('button', { name: 'Parkolás' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Aktiválás' })).toBeInTheDocument())
})

test('＋ Pillér is disabled at five pillars', () => {
  renderGoal()
  expect(screen.getByRole('button', { name: '＋ Pillér' })).toBeDisabled()
})

test('unknown id shows the empty state', () => {
  renderGoal('nope')
  expect(screen.getByText('Nincs ilyen cél.')).toBeInTheDocument()
})
