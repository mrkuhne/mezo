import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { LifeGoalTodayTile } from '@/features/today/components/LifeGoalTodayTile'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderTile() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/nap']}>
    <Routes>
      <Route path="/nap" element={<LifeGoalTodayTile delayMs={120} />} />
      <Route path="/me/goals" element={<div>CELOK HUB</div>} />
    </Routes>
  </MemoryRouter></QueryWrapper>)
}

test('a csempe a mai pillér-találatot mondja az összesből, hét pöttyel', async () => {
  renderTile()
  const tile = await screen.findByRole('button', { name: /Célok · ma/ })
  expect(tile).toBeInTheDocument()
  // a mock három aktív célt ad; a nagy szám "n / m" alakú, m > 0
  expect(tile.textContent).toMatch(/\d+\s*\/\s*\d+/)
  expect(tile.querySelectorAll('.lg-wk7 i')).toHaveLength(7)
})

test('nincs aktív cél → a csempe eltűnik, nem rajzol 0 / 0-t', async () => {
  server.use(http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json({ goals: [] })))
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderTile()
  await new Promise((r) => setTimeout(r, 0))
  expect(container.querySelector('.lg-gtile')).toBeNull()
})
