// KonziliumPage — conference list + `?id=` transcript view (mezo-1gim.13, Task 5).
// Mode-agnostic via the DimensionsPage.test.tsx hook-override idiom.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { KonziliumPage } from './KonziliumPage'
import { MOCK_CONFERENCES, MOCK_CONFERENCE_DETAIL, MOCK_EXPERTS } from '@/data/character/characterMock'
import type { CharacterConferenceResponse, CharacterConferenceSummary, CharacterExpertDto } from '@/data/character/characterApi'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const hoisted = vi.hoisted(() => ({
  experts: [] as CharacterExpertDto[],
  conferences: [] as CharacterConferenceSummary[],
  detail: {} as Record<string, CharacterConferenceResponse>,
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterExperts: () => ({ experts: hoisted.experts, isLoading: false }),
    useCharacterConferences: () => ({ conferences: hoisted.conferences, isLoading: false }),
    useCharacterConference: (id: string | null) => ({
      conference: id != null ? hoisted.detail[id] ?? null : null,
      isLoading: false,
    }),
  }
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/me/karakter/konzilium" element={<KonziliumPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hoisted.experts = MOCK_EXPERTS
  hoisted.conferences = MOCK_CONFERENCES
  hoisted.detail = MOCK_CONFERENCE_DETAIL
  mockNavigate.mockReset()
})

describe('KonziliumPage — list', () => {
  test('renders one row per conference, with a date and a HU kind badge — no fabricated outcome counts', () => {
    renderAt('/me/karakter/konzilium')
    expect(screen.getAllByRole('button', { name: /vasárnap|szept|aug|júl/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('HETI').length).toBe(2)
    expect(screen.getByText('HAVI')).toBeInTheDocument()
    expect(screen.getByText('BOOTSTRAP')).toBeInTheDocument()
  })

  test('an empty conference list renders the honest empty state, never a crash', () => {
    hoisted.conferences = []
    renderAt('/me/karakter/konzilium')
    expect(screen.getByText(/Egyelőre nincs konzílium/)).toBeInTheDocument()
  })

  test('a back chip returns to the Karakter hub', async () => {
    renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(mockNavigate).toHaveBeenCalledWith('/me/karakter')
  })
})

describe('KonziliumPage — transcript (?id=)', () => {
  test('opens the transcript for ?id=w2: outcome cells, phase labels, persona-railed turns, honesty note', () => {
    renderAt('/me/karakter/konzilium?id=w2')
    expect(screen.getByText('Kimenet')).toBeInTheDocument()
    expect(screen.getByText('elfogadva')).toBeInTheDocument()
    expect(screen.getByText('nyugdíjazva')).toBeInTheDocument()
    expect(screen.getByText('portré átírva')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // CLAIM_ACCEPTED count
    expect(screen.getByText('Javaslatok')).toBeInTheDocument()
    expect(screen.getByText('A Szkeptikus')).toBeInTheDocument()
    expect(screen.getByText('Döntés')).toBeInTheDocument()
    expect(screen.getByText('Doki')).toBeInTheDocument()
    expect(screen.getByText(/A fenti a valódi beszélgetés/)).toBeInTheDocument()
  })

  test('an unknown id renders an honest not-found face, never a crash', () => {
    renderAt('/me/karakter/konzilium?id=nope')
    expect(screen.getByText(/nem található/)).toBeInTheDocument()
  })

  test('‹ vissza a listához clears ?id and returns to the list', async () => {
    renderAt('/me/karakter/konzilium?id=w2')
    await userEvent.click(screen.getByRole('button', { name: /vissza a listához/ }))
    expect(screen.getByText('BOOTSTRAP')).toBeInTheDocument()
  })
})
