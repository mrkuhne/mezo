import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryWrapper } from '@/test/queryWrapper'
import type { FeedPost } from '@/features/insights/logic/teamFeed'
import { FeedReplySheet } from './FeedReplySheet'

const base: FeedPost = {
  id: 'pattern:p1', kind: 'kerdes', author: 'falat', occurredAt: '2026-09-23T10:00:00', title: 'Késői vacsora',
  body: 'A késői vacsora után rosszabb az éjszakád.', sourceRoute: '/mezo/patterns/k', waiting: true,
}

function ChatProbe() {
  const { state } = useLocation()
  return <div>chat:{(state as { compose?: string } | null)?.compose}</div>
}

const renderSheet = (post: FeedPost, mode: 'tell' | 'down' = 'tell') =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<FeedReplySheet target={{ post, mode }} onClose={() => {}} />} />
        <Route path="/mezo/chat" element={<ChatProbe />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

describe('FeedReplySheet (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('karakter-poszt: a meglévő szálba küld, utána a három lépés látszik', async () => {
    renderSheet({ ...base, id: 'character:x', thread: { sourceType: 'OBSERVATION', sourceId: '00000000-0000-0000-0000-000000000004', sourceIndex: 0 } })
    expect(screen.getByRole('dialog', { name: 'Elmesélem' })).toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Válasz küldése' })
    expect(send).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox', { name: 'A válaszod' }), 'Későig dolgoztam.')
    await userEvent.click(send)
    expect(await screen.findByText(/A válaszod a témánál marad/)).toBeInTheDocument()
  })

  test('a Nem így érzem visszakérdez', () => {
    renderSheet(base, 'down')
    expect(screen.getByRole('dialog', { name: 'Mi nem stimmel?' })).toBeInTheDocument()
    expect(screen.getByText(/Falat kérdezi/)).toBeInTheDocument()
  })

  test('saját szál nélkül őszintén a beszélgetésbe visz, a poszt szövegével', async () => {
    renderSheet(base)
    expect(screen.getByText(/még nincs külön válasz-szál/)).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'A válaszod' }), 'Szerintem a stressz.')
    await userEvent.click(screen.getByRole('button', { name: 'Tovább a beszélgetésbe' }))
    expect(await screen.findByText(/chat:Késői vacsora/)).toHaveTextContent('Szerintem a stressz.')
  })
})
