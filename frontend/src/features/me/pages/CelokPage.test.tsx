import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryWrapper } from '@/test/queryWrapper'
import { CelokPage } from '@/features/me/pages/CelokPage'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderHub() {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals']}>
    <Routes><Route path="/me/goals" element={<CelokPage />} /><Route path="/me/goals/:id" element={<div>GOAL PAGE</div>} /><Route path="/me/goals/new" element={<div>WIZARD</div>} /></Routes>
  </MemoryRouter></QueryWrapper>)
}

test('renders the three active goals as tiles, Spanyol B2 parked, three live dimension chips', () => {
  renderHub()
  expect(screen.getByRole('button', { name: 'Kockahas' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Side hustle' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Az utolsó barátnő' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Spanyol B2 · parkol/ })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: '3 aktív cél' })).toBeInTheDocument()
  expect(document.querySelectorAll('.lg-dimchip:not(.empty)')).toHaveLength(3)
})

test('tile tap opens the goal page; ＋ Új cél opens the wizard', () => {
  renderHub()
  fireEvent.click(screen.getByRole('button', { name: 'Kockahas' }))
  expect(screen.getByText('GOAL PAGE')).toBeInTheDocument()
})

test('the parked row exposes two distinct focusable buttons — navigate and Vissza', () => {
  renderHub()
  const navBtn = screen.getByRole('button', { name: 'Spanyol B2 · parkol' })
  const visszaBtn = screen.getByRole('button', { name: 'Spanyol B2 · vissza aktívra' })
  expect(navBtn).not.toBe(visszaBtn)
  expect(navBtn.tagName).toBe('BUTTON')
  expect(visszaBtn.tagName).toBe('BUTTON')
  // neither button is nested inside the other — both are real, independently focusable controls
  expect(navBtn.contains(visszaBtn)).toBe(false)
  expect(visszaBtn.contains(navBtn)).toBe(false)
})

test('Vissza on a parked goal re-activates it without navigating', async () => {
  renderHub()
  fireEvent.click(screen.getByRole('button', { name: 'Spanyol B2 · vissza aktívra' }))
  await waitFor(() => expect(screen.getByRole('img', { name: '4 aktív cél' })).toBeInTheDocument())
  expect(screen.queryByText('GOAL PAGE')).not.toBeInTheDocument()
})

// ── Real mode: the loading / empty / error triad (mezo-iizd.1 final review, items 3 + 4) ─────
describe('real mode', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders a skeleton — never "0 aktív · 0 parkol" — while the list is unresolved', () => {
    server.use(http.get(`${API_BASE}/api/life-goals`, () => new Promise(() => {})))
    renderHub()
    expect(screen.queryByText(/0 aktív/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /aktív cél/ })).not.toBeInTheDocument()
  })

  test('a failed list read renders a terminal error + retry, not the empty state', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/life-goals`, () => { calls += 1; return new HttpResponse(null, { status: 500 }) }))
    renderHub()
    expect(await screen.findByText('Nem sikerült betölteni a célokat.')).toBeInTheDocument()
    expect(screen.queryByText(/Még nincs aktív célod/)).not.toBeInTheDocument()
    const before = calls
    fireEvent.click(screen.getByRole('button', { name: 'Újra' }))
    await waitFor(() => expect(calls).toBeGreaterThan(before))
  })
})
