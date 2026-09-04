import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { WeekGoalsCard } from '@/features/me/components/WeekGoalsCard'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderCard() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/me/week']}>
    <Routes>
      <Route path="/me/week" element={<WeekGoalsCard />} />
      <Route path="/me/goals" element={<div>CELOK HUB</div>} />
    </Routes>
  </MemoryRouter></QueryWrapper>)
}

test('célonként egy sor: cím, dimenzió-chip és egy mondat', async () => {
  renderCard()
  expect(await screen.findByText('Kockahas')).toBeInTheDocument()
  expect(screen.getByText('Side hustle')).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-wgrow')).toHaveLength(3)
  expect(document.querySelectorAll('.lg-goalchip').length).toBeGreaterThan(0)
})

test('a CTA a Célok hubra visz', async () => {
  renderCard()
  fireEvent.click(await screen.findByRole('button', { name: /Célok/ }))
  expect(screen.getByText('CELOK HUB')).toBeInTheDocument()
})

test('nincs aktív cél → a kártya eltűnik', async () => {
  server.use(http.get(`${API_BASE}/api/life-goals/today`, () => HttpResponse.json({ goals: [] })))
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { container } = renderCard()
  await new Promise((r) => setTimeout(r, 0))
  expect(container.querySelector('.lg-wcard')).toBeNull()
})
