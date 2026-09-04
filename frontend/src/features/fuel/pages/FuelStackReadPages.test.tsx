import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { FuelStackMealsPage } from '@/features/fuel/pages/FuelStackMealsPage'
import { FuelStackProtocolPage } from '@/features/fuel/pages/FuelStackProtocolPage'
import { FuelStackTodayPage } from '@/features/fuel/pages/FuelStackTodayPage'
import { StackTimeline } from '@/features/fuel/components/StackTimeline'
import type { StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import { QueryWrapper } from '@/test/queryWrapper'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

function renderPage(path: string) {
  return render(
    <QueryWrapper><ToastProvider><MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/fuel/stack/protocol" element={<FuelStackProtocolPage />} />
      <Route path="/fuel/stack/today" element={<FuelStackTodayPage />} />
      <Route path="/fuel/stack/meals" element={<FuelStackMealsPage />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes></MemoryRouter></ToastProvider></QueryWrapper>,
  )
}

afterEach(() => vi.unstubAllEnvs())

describe('Stack read pages — mock', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  test('a teljes protokoll read-only sorrendet, eredetet és szerkesztési kijáratot mutat', async () => {
    const { container } = renderPage('/fuel/stack/protocol')
    expect(screen.getByText('Teljes protokoll')).toBeInTheDocument()
    expect(screen.getByText('8 tétel')).toBeInTheDocument()
    expect(screen.getByText('v3 · 86% bizalom')).toBeInTheDocument()
    expect(screen.getByText('Kreatin monohidrát')).toBeInTheDocument()
    expect(screen.getByText('5g')).toBeInTheDocument()
    expect(screen.getByText(/Kreatin ébredés után/)).toBeInTheDocument()
    expect(screen.getAllByText('auto').length).toBeGreaterThan(0)
    expect(container.querySelector('use[href="#i-stack"]')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /bevétel jelölése/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack/manage/protocol')
  })

  test.each(['/fuel/stack/protocol', '/fuel/stack/today', '/fuel/stack/meals'])(
    '%s visszalép a Stack hubra', async path => {
      renderPage(path)
      await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
      expect(screen.getByTestId('location')).toHaveTextContent('/fuel/stack')
    },
  )

  test('a mai ritmus teljes timeline-t, napívet és success toastot mutat', async () => {
    const { container } = renderPage('/fuel/stack/today')
    expect(screen.getByText('Mai ritmus')).toBeInTheDocument()
    expect(container.querySelector('.stk-arc')).toBeInTheDocument()
    expect(container.querySelector('.stk-timeline')).toBeInTheDocument()
    expect(container.querySelector('use[href="#i-idozito"]')).toBeInTheDocument()
    const tick = screen.getByRole('button', { name: 'Origin PWO bevétel jelölése' })
    await userEvent.click(tick)
    expect(await screen.findByRole('status')).toHaveTextContent('Origin PWO bevéve')
  })

  test('az étkezési oldal valódi találatokat és recipe linket mutat', () => {
    const { container } = renderPage('/fuel/stack/meals')
    expect(screen.getByText('Étkezéshez')).toBeInTheDocument()
    expect(screen.getByText('3 kapcsolat')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Csirke + édesburgonya + spenót' })).toHaveAttribute('href', expect.stringMatching(/^\/fuel\/recipes\//))
    expect(container.querySelector('use[href="#i-recept"]')).toBeInTheDocument()
  })
})

describe('Stack read pages — honest states', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  test('az étkezési oldal találat nélkül magyarázó empty state-et mutat', async () => {
    server.use(
      http.get(`${API_BASE}/api/pantry`, () => HttpResponse.json({ ingredients: [], stash: [] })),
      http.get(`${API_BASE}/api/fuel/protocol`, () => HttpResponse.json({ active: null, history: [] })),
    )
    renderPage('/fuel/stack/meals')
    expect(await screen.findByText('Nincs még étkezési kapcsolat')).toBeInTheDocument()
    expect(screen.getByText('0 kapcsolat')).toBeInTheDocument()
  })
})

test('a timeline megőrzi a displaced, skipped, pinned és disabled állapotokat', () => {
  const base = {
    occurrenceId: 'one', pantryItemId: 'p', persistedZone: 'pre_workout' as const,
    name: 'PWO', dose: '10g', pinned: true, placementSource: 'rule' as const, reason: null,
    dailyTotalHint: null, taken: false, skippedToday: true, displacedToday: true,
  }
  const slots: StackDaySlot[] = [{ zone: 'pre_workout', time: '17:00', label: 'Edzés előtt', anchorNote: null, entries: [base] }]
  render(<StackTimeline slots={slots} onToggle={() => {}} onOpen={() => {}} />)
  expect(screen.getByText('ma nincs edzés')).toBeInTheDocument()
  expect(screen.getByText('ma kimarad')).toBeInTheDocument()
  expect(screen.getByText('kézi')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'PWO bevétel jelölése' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'PWO beállítások' })).toBeInTheDocument()
})
