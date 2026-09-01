// DetektorokPage — the 20 real detectors, one line each (mezo-1gim.14/.15, Tasks 5-6).
// Mode-agnostic via the KarakterHubPage.test.tsx hook-override idiom (only
// useCharacterExperts is read). Expected keys/counts are derived from the page's own
// DETECTORS array (imported directly) rather than pinned as literals, so a future round's
// detector addition can't silently go untested here.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DetektorokPage, DETECTORS } from './DetektorokPage'
import { MOCK_EXPERTS } from '@/data/character/characterMock'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterExperts: () => ({ experts: MOCK_EXPERTS, isLoading: false }),
  }
})

beforeEach(() => {
  mockNavigate.mockReset()
})

describe('DetektorokPage', () => {
  test('renders all real detectors with their key chip + owning expert name', () => {
    const { container } = render(<DetektorokPage />)
    expect(screen.getByText('Detektorok')).toBeInTheDocument()
    // Derived from the page's own DETECTORS array (never a re-pinned literal) — counts the
    // rendered `.kr-detchip` key chips, one per row, so a future round's addition (or an
    // accidental duplicate/missing row) is caught by comparing rendered output against the
    // array, not just the array against itself.
    expect(container.querySelectorAll('.kr-detchip').length).toBe(DETECTORS.length)
    for (const d of DETECTORS) {
      expect(screen.getByText(d.key)).toBeInTheDocument()
    }
    // Each owning expert's display name should appear once per detector it owns — derived from
    // DETECTORS itself so a future round's addition can't silently drift this assertion.
    const countsByWho = DETECTORS.reduce<Record<string, number>>((acc, d) => {
      acc[d.who] = (acc[d.who] ?? 0) + 1
      return acc
    }, {})
    for (const [who, count] of Object.entries(countsByWho)) {
      const displayName = MOCK_EXPERTS.find((e) => e.key === who)?.displayName
      expect(displayName, `no MOCK_EXPERTS entry for detector owner "${who}"`).toBeTruthy()
      expect(screen.getAllByText(displayName as string).length).toBe(count)
    }
  })

  test('renders the closing "code only detects" principle line', () => {
    render(<DetektorokPage />)
    expect(screen.getByText(/A kód csak észlel/)).toBeInTheDocument()
  })

  test('back arrow returns to Gépterem', async () => {
    render(<DetektorokPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter/gepterem')
  })
})
