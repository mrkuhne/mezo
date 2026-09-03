// CsapatPage — the 9 persona cards (mezo-1gim.13, Task 5). Mode-agnostic via the
// DimensionsPage.test.tsx hook-override idiom (stubs @/data/hooks directly, so the same test
// exercises both mock and real mode the same way the sibling Task 4 pages do).
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { CsapatPage } from './CsapatPage'
import { MOCK_EXPERTS } from '@/data/character/characterMock'
import type { CharacterExpertDto } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const hoisted = vi.hoisted(() => ({ experts: [] as CharacterExpertDto[] }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useCharacterExperts: () => ({ experts: hoisted.experts, isLoading: false }) }
})

beforeEach(() => {
  hoisted.experts = MOCK_EXPERTS
  mockNavigate.mockReset()
})

describe('CsapatPage', () => {
  test('renders all 9 persona cards, each with its displayName', () => {
    render(<CsapatPage />)
    MOCK_EXPERTS.forEach((e) => {
      expect(screen.getByText(e.displayName)).toBeInTheDocument()
    })
  })

  test('an EXPERT card shows its voiceLine subtitle, watch line (prefixed "mit figyel:") and role chip', () => {
    render(<CsapatPage />)
    const doki = MOCK_EXPERTS.find((e) => e.key === 'doki')!
    expect(screen.getByText(doki.voiceLine)).toBeInTheDocument()
    expect(screen.getByText(`mit figyel: ${doki.watch.join(' · ')}`)).toBeInTheDocument()
    expect(screen.getByText(doki.role)).toBeInTheDocument()
  })

  test('the Szkeptikus card gets the graphite variant, its watch line with no "mit figyel:" prefix, no role chip', () => {
    const { container } = render(<CsapatPage />)
    const szkeptikus = MOCK_EXPERTS.find((e) => e.key === 'szkeptikus')!
    expect(container.querySelector('.kr-persocard.szkeptikus')).toBeInTheDocument()
    expect(screen.getByText(szkeptikus.watch.join(' · '))).toBeInTheDocument()
    expect(screen.queryByText(`mit figyel: ${szkeptikus.watch.join(' · ')}`)).not.toBeInTheDocument()
  })

  test('the Mezo card gets the coral-gradient variant with the real s-orb, and prints its subtitle only ONCE (role duplicates voiceLine in the DTO)', () => {
    const { container } = render(<CsapatPage />)
    const mezo = MOCK_EXPERTS.find((e) => e.key === 'mezo')!
    expect(container.querySelector('.kr-persocard.mezo')).toBeInTheDocument()
    expect(screen.getAllByText(mezo.role)).toHaveLength(1)
  })

  // Final-review fix (I4): characterMock's mezo.watch used to be `[]`, silently hiding the
  // watch line the real CharacterService.experts() DTO actually serves for Mezo — an
  // untested drift between mock and backend truth. Pinned here so it can't regress quietly.
  test('the Mezo card renders its watch line (mock/backend fidelity, no "mit figyel:" prefix for CHAIR)', () => {
    render(<CsapatPage />)
    const mezo = MOCK_EXPERTS.find((e) => e.key === 'mezo')!
    expect(mezo.watch.length).toBeGreaterThan(0)
    expect(screen.getByText(mezo.watch.join(' · '))).toBeInTheDocument()
  })

  test('a back chip returns to the Karakter hub', async () => {
    render(<CsapatPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter')
  })
})
