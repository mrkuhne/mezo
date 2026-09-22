import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, test, expect, afterEach } from 'vitest'
import { BoopMemoriesPage } from '@/features/insights/pages/BoopMemoriesPage'
import { MemoryDayPage } from '@/features/insights/pages/MemoryDayPage'

const state = vi.hoisted(() => ({ pending: false, error: false }))
afterEach(() => { state.pending = false; state.error = false })

vi.mock('@/data/hooks', () => ({
  useMemoir: () => ({ memoir: null }),
  useMemoirArchive: () => ({ data: [], isPending: false, isError: false }),
  useMemorySummaries: () => ({ summaries: [{ date: '2026-09-19', narrative: 'Egy valódi nap története.', embedded: true }], isPending: state.pending, isError: state.error, degraded: false }),
  useSimilarDays: () => ({ results: null, isFetching: false, failed: false, degraded: false }),
}))

test('daily memories and search are reachable without a memory overview or memoir', () => {
  render(<MemoryRouter><BoopMemoriesPage /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /2026-09-19/ })).toHaveAttribute('href', '/mezo/emlekek/2026-09-19')
  expect(screen.getByLabelText('Hasonló nap keresése')).toBeInTheDocument()
})

test.each([['2026-09-19', 'Egy valódi nap története.'], ['2026-09-18', 'Ehhez a naphoz még nincs elkészült emlék.']])('date route %s resolves its own summary', (date, text) => {
  render(<MemoryRouter initialEntries={[`/mezo/emlekek/${date}`]}><Routes><Route path="/mezo/emlekek/:date" element={<MemoryDayPage />} /></Routes></MemoryRouter>)
  expect(screen.getByText(text)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Emlékek/ })).toHaveAttribute('href', '/mezo/emlekek')
})


test('an unresolved or failed summary never reads as a missing day', () => {
  state.error = true
  render(<MemoryRouter initialEntries={['/mezo/emlekek/2026-09-18']}><Routes><Route path="/mezo/emlekek/:date" element={<MemoryDayPage />} /></Routes></MemoryRouter>)
  expect(screen.getByText('Nem sikerült betölteni a napi emléket.')).toBeInTheDocument()
  expect(screen.queryByText('Ehhez a naphoz még nincs elkészült emlék.')).not.toBeInTheDocument()
})

test('hub keeps memoir and search available when summaries fail', () => {
  state.error = true
  render(<MemoryRouter><BoopMemoriesPage /></MemoryRouter>)
  expect(screen.getByText('Nem sikerült betölteni a napi emlékeket.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Memoár olvasása/ })).toHaveAttribute('href', '/mezo/memoir')
  expect(screen.getByLabelText('Hasonló nap keresése')).toBeInTheDocument()
})
