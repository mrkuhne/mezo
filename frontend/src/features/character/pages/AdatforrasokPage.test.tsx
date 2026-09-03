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

  test('switching to Tervezett shows the honest all-landed line + the later tail', async () => {
    render(<AdatforrasokPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tervezett' }))
    // Rounds 1-4 all landed for real via mezo-1gim.15 — INVENTORY_ROUNDS is empty, so the
    // segment says so instead of rendering a phantom round index.
    expect(screen.getByText('Mind a négy kör bekötve.')).toBeInTheDocument()
    expect(screen.queryByText(/\. KÖR/)).not.toBeInTheDocument()
    expect(screen.getByText('+ még 4 terület később')).toBeInTheDocument()
  })

  test('back arrow returns to Gépterem', async () => {
    render(<AdatforrasokPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem')
  })
})
