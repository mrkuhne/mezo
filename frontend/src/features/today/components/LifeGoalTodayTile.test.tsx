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

/**
 * mezo-iizd.9 final review, 7. lelet: a korábbi `?? 0` a számlálóból ÉS a nevezőből is némán
 * kiejtette a szám nélküli célt — a csempe „2 / 3"-at állított, miközben egy harmadik cél
 * számolatlanul ott volt. Az elhagyás most explicit: csak a MINDKÉT számot közlő cél számít bele.
 */
test('a szám nélküli cél nem csendben tűnik el a tallyből — csak a számolt célok összege látszik', async () => {
  server.use(http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json({
    goals: [
      { goalId: 'a', title: 'Kockahas', dimension: 'health', arrow: 'up',
        days7: ['hit', 'hit', 'miss', 'hit', 'no_data', 'hit', 'hit'],
        pillarsHitToday: 2, pillarsTotal: 3 },
      // se `pillarsHitToday`, se `pillarsTotal` — ez a cél nem pillér-tény
      { goalId: 'b', title: 'Side hustle', dimension: 'work', arrow: 'flat',
        days7: ['no_data', 'no_data', 'no_data', 'no_data', 'no_data', 'no_data', 'no_data'] },
    ],
  })))
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderTile()
  const tile = await screen.findByRole('button', { name: /Célok · ma/ })
  // a tally KIZÁRÓLAG a számolt célé; a pöttysor is azé (a szám nélküli cél nem lehet leadGoal)
  expect(tile).toHaveAccessibleName('Célok · ma — 2 / 3 pillér')
  expect(tile.querySelectorAll('.lg-wk7 i.n')).toHaveLength(1)
})

test('egyetlen cél sem közöl pillér-számot → a csempe eltűnik, nem rajzol 0 / 0-t', async () => {
  server.use(http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json({
    goals: [{ goalId: 'b', title: 'Side hustle', dimension: 'work', arrow: 'flat',
      days7: ['no_data', 'no_data', 'no_data', 'no_data', 'no_data', 'no_data', 'no_data'] }],
  })))
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderTile()
  await new Promise((r) => setTimeout(r, 0))
  expect(container.querySelector('.lg-gtile')).toBeNull()
})

/** A nagy szám TALLY, nem irány — a siker-zöld `up` osztály egy „0 / 9"-et is teljesítésnek festene. */
test('a nagy szám semleges osztályt visel, nem a siker-zöld irány-osztályt', async () => {
  const { container } = renderTile()
  await screen.findByRole('button', { name: /Célok · ma/ })
  expect(container.querySelector('.lg-arrow.up')).toBeNull()
  expect(container.querySelector('.lg-arrow.none')).not.toBeNull()
})

test('nincs aktív cél → a csempe eltűnik, nem rajzol 0 / 0-t', async () => {
  server.use(http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json({ goals: [] })))
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderTile()
  await new Promise((r) => setTimeout(r, 0))
  expect(container.querySelector('.lg-gtile')).toBeNull()
})
