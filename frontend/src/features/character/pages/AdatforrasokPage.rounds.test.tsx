// AdatforrasokPage — with a planned round (mezo-1gim.15, Task 8). Round 4 landed for real, so
// `INVENTORY_ROUNDS` is now empty in production (see AdatforrasokPage.test.tsx's honest-empty
// assertion). The "clicking a round navigates" behavior still needs coverage though — mocking
// `@/features/character/inventory` with a synthetic round the way `KorPage.test.tsx` does keeps
// that coverage alive without pinning it to any real, ever-shrinking round content. `vi.mock` is
// file-scoped, hence the separate file.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AdatforrasokPage } from './AdatforrasokPage'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('@/features/character/inventory', () => ({
  INVENTORY_READS: [],
  INVENTORY_LATER: [],
  INVENTORY_ROUNDS: [{ n: 7, title: 'Teszt kör', items: [{ t: 'x' }] }],
}))

beforeEach(() => {
  mockNavigate.mockReset()
})

describe('AdatforrasokPage — with a planned round', () => {
  test('clicking a round navigates to its kör mini-page (path param, not ?kor=), and the all-landed line is absent', async () => {
    render(<AdatforrasokPage />)
    await userEvent.click(screen.getByRole('tab', { name: 'Tervezett' }))
    expect(screen.queryByText('Mind a négy kör bekötve.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Teszt kör'))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem/adatforrasok/kor/7')
  })
})
