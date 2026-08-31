// DetektorokPage — the 5 real detectors, one line each (mezo-1gim.14, Task 5). Mode-agnostic
// via the KarakterHubPage.test.tsx hook-override idiom (only useCharacterExperts is read).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { DetektorokPage } from './DetektorokPage'
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
  test('renders all 5 real detectors with their key chip + owning expert name', () => {
    render(<DetektorokPage />)
    expect(screen.getByText('Detektorok')).toBeInTheDocument()
    for (const key of ['logging-gap', 'under-logging', 'checkin-gap', 'journal-silence', 'journal-note']) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
    // journal-note is really pszichologus-owned, not the prototype's guess of any other expert.
    expect(screen.getAllByText('Pszichológus').length).toBeGreaterThan(0)
    // logging-gap and journal-silence are really drill-owned (verified against detector source).
    expect(screen.getAllByText('Drill').length).toBeGreaterThanOrEqual(2)
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
