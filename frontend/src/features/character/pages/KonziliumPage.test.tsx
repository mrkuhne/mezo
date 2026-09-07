// KonziliumPage — döntés-első felület: `?id=` nélkül a legutóbbi konzílium, léptető + archívum
// lap a korábbiakhoz, Áttekintés/Beszélgetés nézetváltó (mezo-sp9w).
// Mode-agnostic via the DimensionsPage.test.tsx hook-override idiom.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { KonziliumPage } from './KonziliumPage'
import { MOCK_BOOTSTRAP_CONFERENCE, MOCK_CONFERENCES, MOCK_CONFERENCE_DETAIL, MOCK_EXPERTS } from '@/data/character/characterMock'
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
  hoisted.detail = { ...MOCK_CONFERENCE_DETAIL, b0: MOCK_BOOTSTRAP_CONFERENCE }
  mockNavigate.mockReset()
})

describe('KonziliumPage — üres archívum', () => {
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

describe('KonziliumPage — döntés-első nézet', () => {
  test('id nélkül a legutóbbi konzílium nyílik, nem lista', () => {
    renderAt('/me/karakter/konzilium')
    expect(screen.getByText('Hogyan zajlott')).toBeInTheDocument()
    expect(screen.queryByText(/vissza a listához/)).not.toBeInTheDocument()
  })

  test('pontosan egy visszalépő vezérlő van a lapon', () => {
    renderAt('/me/karakter/konzilium')
    expect(screen.getAllByRole('button', { name: 'Vissza' })).toHaveLength(1)
  })

  test('a legutóbbi konzíliumon a későbbi-nyíl le van tiltva', () => {
    renderAt('/me/karakter/konzilium')
    expect(screen.getByRole('button', { name: 'Későbbi tanácskozás' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Korábbi tanácskozás' })).toBeEnabled()
  })

  test('a legrégebbi konzíliumon a korábbi-nyíl le van tiltva', () => {
    renderAt('/me/karakter/konzilium?id=b0')
    expect(screen.getByRole('button', { name: 'Korábbi tanácskozás' })).toBeDisabled()
  })

  test('a dátum-gomb megnyitja az archívum lapot', async () => {
    renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: /augusztus 30/ }))
    expect(await screen.findByText('Korábbi tanácskozások')).toBeInTheDocument()
  })

  test('a Beszélgetés váltó a kör-nézetre vált', async () => {
    renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: 'Beszélgetés' }))
    expect(screen.getByText('Javaslatok')).toBeInTheDocument()
    expect(screen.queryByText('Hogyan zajlott')).not.toBeInTheDocument()
  })

  test('visszafejtett szálnál a kereszt-vita kör nem létezőként jelenik meg', () => {
    renderAt('/me/karakter/konzilium?id=w1')
    expect(screen.getByText('nem volt ilyen kör')).toBeInTheDocument()
  })

  test('an unknown id renders an honest not-found face, never a crash', () => {
    renderAt('/me/karakter/konzilium?id=nope')
    expect(screen.getByText(/nem található/)).toBeInTheDocument()
  })

  test('a conference with a deliberation renders threads, collapsed', async () => {
    hoisted.detail = { ...hoisted.detail, w2: MOCK_CONFERENCE_DETAIL.w2 }
    renderAt('/me/karakter/konzilium?id=w2')

    expect(screen.getByText('Fizikai')).toBeInTheDocument()
    expect(screen.queryByText(/Három adatpont kevés/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Fizikai/ }))
    expect(screen.getByText(/Három adatpont kevés/)).toBeInTheDocument()
  })

  test('a conference without a deliberation still renders the prose transcript', () => {
    hoisted.detail = { ...hoisted.detail, b0: MOCK_BOOTSTRAP_CONFERENCE }
    renderAt('/me/karakter/konzilium?id=b0')

    expect(screen.getByText(/A teljes eddigi történet beolvasva/)).toBeInTheDocument()
  })
})
