// DimensionPage — a real-mode integration test (mezo-1gim.13, Task 4; strengthened fix round 1
// per reviewer finding #3). Renders through the ACTUAL data layer (no `@/data/hooks` stub)
// against msw, so this pins that the claim feedback pill really fires the POST, really
// invalidates the dimension query (proven by a SECOND GET actually landing, serving CHANGED
// data the UI then reflects — not just a local-state assertion that would still pass with
// `invalidateQueries` deleted), and — reviewer finding #2 — that a REJECTED mutation never
// fakes success and never triggers a spurious refetch.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DimensionPage } from './DimensionPage'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn(), useParams: () => ({ key: 'physical' }) }
})

const CLAIM = { id: 'physical-claim-0', text: 'A testzsírszázalék csökken.', confidence: 0.8, sensitive: false, evidence: [] }
const DIMENSION_V1 = {
  key: 'physical', title: 'Fizikai', kind: 'CORE', expertKey: 'doki', maturity: 58,
  portrait: 'A testösszetételed lassan javul.', claims: [CLAIM], revisions: [],
}
// What a real refetch (post-invalidation) would honestly serve — a server that actually
// re-read the dossier after the feedback landed, distinguishable from V1 in the rendered UI.
const DIMENSION_V2 = { ...DIMENSION_V1, portrait: 'FRISSÍTVE — a csapat újraolvasta az állítást.' }

let dimensionFetchCount = 0

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  dimensionFetchCount = 0
  server.use(
    http.get(`${API_BASE}/api/character/dimension/physical`, () => {
      dimensionFetchCount += 1
      return HttpResponse.json(dimensionFetchCount === 1 ? DIMENSION_V1 : DIMENSION_V2)
    }),
    http.get(`${API_BASE}/api/character/experts`, () => HttpResponse.json({ experts: [] })),
  )
})
afterEach(() => vi.unstubAllEnvs())

describe('DimensionPage (real mode)', () => {
  test('talál POSTs the feedback and a REAL refetch actually happens — the UI reflects the newly-served data', async () => {
    let postedBody: unknown = null
    server.use(
      http.post(`${API_BASE}/api/character/claim/physical-claim-0/feedback`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json({ ...CLAIM, confidence: 0.85 })
      }),
    )
    render(<QueryWrapper><DimensionPage /></QueryWrapper>)
    await screen.findByText('A testzsírszázalék csökken.')
    expect(dimensionFetchCount).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'Talál' }))

    await waitFor(() => expect(postedBody).toEqual({ kind: 'TALAL' }))
    expect(await screen.findByText('✓ Köszönöm — jegyzem.')).toBeInTheDocument()
    // The proof invalidateQueries actually ran: a SECOND GET landed (not just a local-state
    // flip), and the page renders what THAT fetch served — not a locally-cached/fabricated value.
    await waitFor(() => expect(dimensionFetchCount).toBe(2))
    expect(await screen.findByText('FRISSÍTVE — a csapat újraolvasta az állítást.')).toBeInTheDocument()
  })

  describe('a rejected mutation (msw 500) never fakes success and never triggers a refetch', () => {
    test('talál: 500 leaves the pills usable, no thanks face, no second GET', async () => {
      server.use(http.post(`${API_BASE}/api/character/claim/physical-claim-0/feedback`, () => new HttpResponse(null, { status: 500 })))
      render(<QueryWrapper><DimensionPage /></QueryWrapper>)
      await screen.findByText('A testzsírszázalék csökken.')

      await userEvent.click(screen.getByRole('button', { name: 'Talál' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Talál' })).not.toBeDisabled())
      expect(screen.queryByText('✓ Köszönöm — jegyzem.')).not.toBeInTheDocument()
      expect(dimensionFetchCount).toBe(1)
    })

    test('nem igaz: 500 leaves the claim active — no retired face, no second GET', async () => {
      server.use(http.post(`${API_BASE}/api/character/claim/physical-claim-0/feedback`, () => new HttpResponse(null, { status: 500 })))
      render(<QueryWrapper><DimensionPage /></QueryWrapper>)
      await screen.findByText('A testzsírszázalék csökken.')

      await userEvent.click(screen.getByRole('button', { name: 'Nem igaz' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Nem igaz' })).not.toBeDisabled())
      expect(screen.queryByText('nyugdíjazva — a csapat nem viszi tovább')).not.toBeInTheDocument()
      expect(dimensionFetchCount).toBe(1)
    })

    test('pontosítom: 500 keeps the textarea open with the typed correction, no second GET', async () => {
      server.use(http.post(`${API_BASE}/api/character/claim/physical-claim-0/feedback`, () => new HttpResponse(null, { status: 500 })))
      render(<QueryWrapper><DimensionPage /></QueryWrapper>)
      await screen.findByText('A testzsírszázalék csökken.')

      await userEvent.click(screen.getByRole('button', { name: 'Pontosítom' }))
      const textarea = screen.getByPlaceholderText('Mit pontosítanál?')
      await userEvent.type(textarea, 'nem pontos')
      await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))

      await waitFor(() => expect(screen.getByRole('button', { name: 'Küldés' })).not.toBeDisabled())
      expect(screen.getByPlaceholderText('Mit pontosítanál?')).toHaveValue('nem pontos')
      expect(dimensionFetchCount).toBe(1)
    })
  })
})
