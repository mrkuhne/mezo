import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import JelekPage from '@/features/me/pages/JelekPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function renderWithProviders(el: React.ReactElement) {
  return render(<QueryWrapper><MemoryRouter initialEntries={['/me/goals/signals']}>
    <Routes><Route path="/me/goals/signals" element={el} /><Route path="/me/goals" element={<div>HUB</div>} /></Routes>
  </MemoryRouter></QueryWrapper>)
}

describe('JelekPage', () => {
  it('a hero az élő források arányát mondja', async () => {
    renderWithProviders(<JelekPage />)
    expect(await screen.findByText('Jelek')).toBeInTheDocument()
    // 10 élő a 28-ból (MOCK_LIVENESS) — a hero számpárja.
    expect(await screen.findByLabelText('10 élő forrás a 28-ból')).toBeInTheDocument()
  })

  it('az élő forrást a napszámával és a tápált pillérek chipjeivel mutatja', async () => {
    renderWithProviders(<JelekPage />)
    const row = await screen.findByRole('listitem', { name: /Alváshossz/ })
    expect(row).toHaveTextContent('7 / 7 nap')
    expect(row).toHaveTextContent('Alvás ≥ 7 óra')
  })

  it('az alvó forrás az Alszik szekcióba kerül, nem tűnik el', async () => {
    renderWithProviders(<JelekPage />)
    const row = await screen.findByRole('listitem', { name: /Akut:krónikus terhelés/ })
    expect(row).toHaveTextContent('nincs adat 7 napja')
  })

  it('kimondja a záró elvet', async () => {
    renderWithProviders(<JelekPage />)
    expect(await screen.findByText(/Nincs külső forrás/)).toBeInTheDocument()
  })
})
