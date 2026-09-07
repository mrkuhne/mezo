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
  // C2 (mezo-sp9w branch-review): mock mode's synchronous resolution is exactly why the archive
  // reopen-on-top bug was invisible to every existing test — real mode has a genuine loading
  // frame between picking a new id and its detail arriving. Setting an id in here makes THIS
  // mock reproduce that frame on demand, so the race can actually be exercised.
  loadingId: null as string | null,
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useCharacterExperts: () => ({ experts: hoisted.experts, isLoading: false }),
    useCharacterConferences: () => ({ conferences: hoisted.conferences, isLoading: false }),
    useCharacterConference: (id: string | null) => ({
      conference: id != null && id !== hoisted.loadingId ? hoisted.detail[id] ?? null : null,
      isLoading: id != null && id === hoisted.loadingId,
    }),
  }
})

function tree(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/me/karakter/konzilium" element={<KonziliumPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderAt(path: string) {
  return render(tree(path))
}

beforeEach(() => {
  hoisted.experts = MOCK_EXPERTS
  hoisted.conferences = MOCK_CONFERENCES
  hoisted.detail = { ...MOCK_CONFERENCE_DETAIL, b0: MOCK_BOOTSTRAP_CONFERENCE }
  hoisted.loadingId = null
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

  // Fix round 1 (mezo-sp9w, review finding 7): a bad deep link must not strand the reader — the
  // archive has to stay reachable, and there must still be exactly one back control.
  test('egy nem található konzíliumnál is elérhető marad az archívum, és marad pontosan egy vissza', async () => {
    renderAt('/me/karakter/konzilium?id=nope')
    expect(screen.getAllByRole('button', { name: 'Vissza' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Korábbi tanácskozások' }))
    expect(await screen.findByText('6')).toBeInTheDocument() // kr-arccnt: all 6 mock conferences
  })

  // Fix round 1 (mezo-sp9w, review finding 6): the stepper's arrows were only ever tested for
  // their disabled state, never for actually switching the shown council.
  test('a korábbi nyílra kattintva az előző konzílium tartalma jelenik meg', async () => {
    renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: 'Korábbi tanácskozás' }))
    expect(await screen.findByRole('button', { name: /augusztus 23/ })).toBeInTheDocument()
  })

  // Fix round 1 (mezo-sp9w, review finding 6 + 3): picking a different council from the archive
  // must both switch the shown council and reset a chronological view back to the overview —
  // exercising the actual navigation path, not just its affordances.
  test('az archívumban másik konzíliumot választva a nézet vált és visszaáll áttekintésre', async () => {
    renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: 'Beszélgetés' }))
    expect(screen.getByText('Javaslatok')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /augusztus 30/ }))
    await userEvent.click(await screen.findByRole('button', { name: /augusztus 23/ }))

    expect(await screen.findByRole('button', { name: /augusztus 23/ })).toBeInTheDocument()
    expect(screen.getByText('Hogyan zajlott')).toBeInTheDocument()
    expect(screen.queryByText('Javaslatok')).not.toBeInTheDocument()
  })

  // Fix round 1 (mezo-sp9w, review finding 1): an empty-but-present thread envelope (the
  // council's proposal round yielded nothing) must fall back to the prose transcript exactly
  // like a missing `deliberation`, not render a round map full of zeros and no content at all.
  test('üres deliberation-tömbnél a próza-átirat jelenik meg, nem üres lap', () => {
    hoisted.detail = {
      ...hoisted.detail,
      w1: { ...MOCK_CONFERENCE_DETAIL.w1, deliberation: [], deliberationSource: 'STORED' },
    }
    renderAt('/me/karakter/konzilium?id=w1')

    expect(screen.getByText(/hétvégi lépésszám tartósan alacsonyabb/)).toBeInTheDocument()
    expect(screen.queryByText('Hogyan zajlott')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Beszélgetés' })).not.toBeInTheDocument()
  })

  // Fix round 1 (mezo-sp9w, review finding 4): this coverage was deleted with the old list page
  // even though the behaviour it asserted — the prose fallback's phase labels, the chair's
  // display name, and the closing honesty line — was never retired. Only the neighbouring
  // outcome card's label changed ("Kimenet" → "Mi változott a dossziédban").
  test('nincs strukturált szál: próza-átirat fázis-címkékkel, az elnök nevével és az őszinteségi mondattal', () => {
    hoisted.detail = {
      ...hoisted.detail,
      w2: { ...MOCK_CONFERENCE_DETAIL.w2, deliberation: null, deliberationSource: null },
    }
    renderAt('/me/karakter/konzilium?id=w2')

    expect(screen.getByText('Mi változott a dossziédban')).toBeInTheDocument()
    expect(screen.getByText('bekerült')).toBeInTheDocument()
    expect(screen.getByText('nyugdíjazva')).toBeInTheDocument()
    expect(screen.getByText('portré átírva')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // CLAIM_ACCEPTED count

    expect(screen.getByText('Javaslatok')).toBeInTheDocument()
    expect(screen.getByText('A Szkeptikus')).toBeInTheDocument()
    expect(screen.getByText('Döntés')).toBeInTheDocument()
    expect(screen.getByText('Mezo')).toBeInTheDocument() // the chair's display name

    expect(screen.getByText(/A fenti a valódi beszélgetés/)).toBeInTheDocument()
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

  // C1 (mezo-sp9w branch-review): a MONTHLY conference can legitimately carry a STORED thread
  // envelope with no reactions at all — MONTHLY never runs a cross-talk round. `deliberationSource
  // === 'STORED'` alone would have told the reader the round ran and nobody spoke; the fix also
  // requires `kind === 'WEEKLY'`. `m1` (M1's new fixture) is exactly this shape.
  test('havi konzíliumnál a tárolt, reakció nélküli szál nem-létező körként jelenik meg, nem nullaként', () => {
    renderAt('/me/karakter/konzilium?id=m1')
    expect(screen.getByText('nem volt ilyen kör')).toBeInTheDocument()
    expect(screen.queryByText('0 hozzászólás')).not.toBeInTheDocument()
  })

  // Same bug, the other kind that never runs cross-talk: BOOTSTRAP. The shipped demo bootstrap
  // fixture has no `deliberation` at all (it falls back to the prose transcript), so this
  // overrides it locally with a STORED, reaction-less envelope to exercise the branch directly.
  test('bootstrap konzíliumnál a tárolt, reakció nélküli szál nem-létező körként jelenik meg, nem nullaként', () => {
    hoisted.detail = {
      ...hoisted.detail,
      b0: {
        ...MOCK_BOOTSTRAP_CONFERENCE,
        deliberationSource: 'STORED',
        deliberation: [
          {
            dimensionKey: 'physical',
            title: 'Kezdő állítások — Fizikai',
            items: [
              {
                index: 0, expertKey: 'doki', text: 'A testzsírszázalék lassan csökken, a testsúly stagnál.',
                kind: 'NEW', claimId: null, sensitive: false, reactions: [],
                skeptic: { verdict: 'KEEP', argument: 'A teljes történet alátámasztja.' },
                chair: { accepted: true, confidence: 0.8, reason: 'Felveszem.' },
              },
            ],
          },
        ],
      },
    }
    renderAt('/me/karakter/konzilium?id=b0')
    expect(screen.getByText('nem volt ilyen kör')).toBeInTheDocument()
    expect(screen.queryByText('0 hozzászólás')).not.toBeInTheDocument()
  })

  // C2 (mezo-sp9w branch-review): picking a meeting from the archive must not let the sheet
  // reappear once the newly-picked meeting's detail arrives. Mock mode alone can't reproduce
  // this (it resolves synchronously) — `hoisted.loadingId` recreates the genuine loading frame
  // real mode has between the pick and the new detail landing.
  test('archívumból választva a lap nem nyílik vissza, ha közben betöltési kör történt', async () => {
    const { rerender } = renderAt('/me/karakter/konzilium')
    await userEvent.click(screen.getByRole('button', { name: /augusztus 30/ }))
    expect(await screen.findByText('Korábbi tanácskozások')).toBeInTheDocument()

    hoisted.loadingId = 'w1'
    await userEvent.click(await screen.findByRole('button', { name: /augusztus 23/ }))
    // The detail query is now "loading" — the page returns null for a frame, unmounting the
    // sheet's own DOM before its close animation could ever report back.
    expect(screen.queryByText('Korábbi tanácskozások')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vissza' })).not.toBeInTheDocument()

    // The loading frame ends — the new conference's detail lands. `rerender` on the same tree
    // (not a fresh `renderAt`) is deliberate: it forces KonziliumPage to re-run with the updated
    // mock, exactly like a real query settling would, without losing the navigation state a
    // brand new render would reset.
    hoisted.loadingId = null
    rerender(tree('/me/karakter/konzilium'))
    expect(await screen.findByRole('button', { name: /augusztus 23/ })).toBeInTheDocument()
    expect(screen.queryByText('Korábbi tanácskozások')).not.toBeInTheDocument()
  })
})
