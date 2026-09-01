// AdatforrasokPage — Bekötve | Tervezett segmented control over static inventory content
// (mezo-1gim.14, Task 5). No data hooks — the content is entirely static, so no hook mock
// is needed (unlike the other Karakter pages' hook-override idiom).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AdatforrasokPage } from './AdatforrasokPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  mockNavigate.mockReset()
})

describe('AdatforrasokPage', () => {
  test('defaults to the Bekötve segment — the sage card of read cadences', () => {
    render(<AdatforrasokPage />)
    expect(screen.getByText('Adatforrások')).toBeInTheDocument()
    expect(screen.getByText('Éjszakai kör')).toBeInTheDocument()
    // '14 nap' is no longer a unique chip text (round 1's five new reads reuse it) — assert at
    // least one instance instead of a single unique match.
    expect(screen.getAllByText('14 nap').length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: 'Bekötve' })).toHaveAttribute('aria-selected', 'true')
  })

  test('switching to Tervezett shows the 2-round index + the later tail line', async () => {
    render(<AdatforrasokPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tervezett' }))
    // Rounds 1 ("Edzés & test") and 2 ("Fuel & ciklus") landed for real via mezo-1gim.15 and no
    // longer appear here — they moved to INVENTORY_READS (see AdatforrasokPage.tsx's Bekötve
    // segment). The remaining two rounds keep their original n (3/4), starting with
    // "Psziché & viselkedés-meta".
    expect(screen.getByText('Psziché & viselkedés-meta')).toBeInTheDocument()
    expect(screen.getAllByText('8 tétel').length).toBe(2)
    expect(screen.getByText('Kapcsolatok & AI-meta')).toBeInTheDocument()
    expect(screen.getByText('+ még 2 terület később')).toBeInTheDocument()
  })

  test('clicking a round navigates to its kör mini-page (path param, not ?kor=)', async () => {
    render(<AdatforrasokPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tervezett' }))
    await userEvent.click(screen.getByText('Psziché & viselkedés-meta'))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/adatforrasok/kor/3')
  })

  test('back arrow returns to Gépterem', async () => {
    render(<AdatforrasokPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem')
  })
})
