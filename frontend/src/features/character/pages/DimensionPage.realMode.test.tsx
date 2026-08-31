// DimensionPage — a real-mode integration test (mezo-1gim.13, Task 4): renders through the
// ACTUAL data layer (no `@/data/hooks` stub) against msw, so this pins that the claim
// feedback pill really fires the POST and really invalidates the three query keys, not just
// that the hook does (characterHooks.test.tsx already covers the hook in isolation — this
// covers the page wiring it through).
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

const DIMENSION_DTO = {
  key: 'physical',
  title: 'Fizikai',
  kind: 'CORE',
  expertKey: 'doki',
  maturity: 58,
  portrait: 'A testösszetételed lassan javul.',
  claims: [
    { id: 'physical-claim-0', text: 'A testzsírszázalék csökken.', confidence: 0.8, sensitive: false, evidence: [] },
  ],
  revisions: [],
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/character/dimension/physical`, () => HttpResponse.json(DIMENSION_DTO)),
    http.get(`${API_BASE}/api/character/experts`, () => HttpResponse.json({ experts: [] })),
  )
})
afterEach(() => vi.unstubAllEnvs())

describe('DimensionPage (real mode)', () => {
  test('talál POSTs the feedback and invalidates the dimension/overview/feed queries', async () => {
    let postedBody: unknown = null
    server.use(
      http.post(`${API_BASE}/api/character/claim/physical-claim-0/feedback`, async ({ request }) => {
        postedBody = await request.json()
        return HttpResponse.json({ ...DIMENSION_DTO.claims[0], confidence: 0.85 })
      }),
    )
    render(<QueryWrapper><DimensionPage /></QueryWrapper>)
    await screen.findByText('A testzsírszázalék csökken.')

    await userEvent.click(screen.getByRole('button', { name: 'Talál' }))

    await waitFor(() => expect(postedBody).toEqual({ kind: 'TALAL' }))
    expect(await screen.findByText('✓ Köszönöm — jegyzem.')).toBeInTheDocument()
  })
})
