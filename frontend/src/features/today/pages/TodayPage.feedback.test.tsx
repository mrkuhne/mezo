// ============================================================
// Mezo · TodayPage feedback wiring (mezo-b3pp.15) — a companion-feed üzenetek 👍/👎 chipjei.
// Külön fájl, mert ez az EGYETLEN today-teszt, ami REAL módban fut: mock módban a
// `useCompanionFeed` szándékosan `[]`-t ad (Phase-1 byte parity), tehát a szálban csak a
// cimkézett demo-kártya áll — és arra NEM ülhet chip. A chip-renderelés önmagában a
// `MezoMessagesSheet.test.tsx` direkt komponens-tesztjének a dolga; itt a DRÓT a tét:
// a PUT payload artifactKind/artifactId/verdict/reason mezői.
// ============================================================
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { QueryWrapper } from '@/test/queryWrapper'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { TodayPage } from '@/features/today/pages/TodayPage'

const FEEDBACK_GROUP = 'Visszajelzés az üzenetről'
const FEED_ID = '33333333-3333-4333-8333-333333333333'

function tree() {
  return (
    <QueryWrapper>
      <LevelUpProvider>
        <MemoryRouter initialEntries={['/today']}>
          <TodayPage />
        </MemoryRouter>
      </LevelUpProvider>
    </QueryWrapper>
  )
}

/** One persisted morning message — the only artifact in the thread. */
const feedRow = {
  id: FEED_ID,
  date: '2026-08-21',
  kind: 'morning',
  eyebrow: 'Reggeli briefing',
  body: ['Jól aludtál, 7.4 óra.'],
  refs: [],
  generatedAt: '2026-08-21T05:45:00Z',
}

const openThread = async () => {
  await userEvent.click(await screen.findByRole('button', { name: /Mezo üzenetei/ }))
  return screen.getByRole('dialog', { name: 'Mezo üzenetei' })
}

describe('TodayPage — visszajelzés a companion-feed üzenetekre (real mód, mezo-b3pp.15)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([feedRow])))
  })
  afterEach(() => vi.unstubAllEnvs())

  test('👎 + indok a feed-üzenetre feed_message artifactKind-dal, a sor uuid-jével megy ki', async () => {
    const puts: unknown[] = []
    server.use(
      http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
        const body = await request.json()
        puts.push(body)
        return HttpResponse.json({ ...(body as object), updatedAt: '2026-08-21T12:00:00Z' })
      }),
    )
    render(tree())
    const sheet = await openThread()
    await waitFor(() =>
      expect(within(sheet).getByRole('group', { name: FEEDBACK_GROUP })).toBeInTheDocument(),
    )

    await userEvent.click(within(sheet).getByRole('button', { name: /Nem talált/ }))
    await userEvent.click(within(sheet).getByRole('button', { name: 'pontatlan' }))

    await waitFor(() => expect(puts).toHaveLength(1))
    // Pins the WIRE payload — a wrong artifactKind or artifactId would otherwise stay green.
    expect(puts[0]).toMatchObject({
      artifactKind: 'feed_message',
      artifactId: FEED_ID,
      verdict: 'down',
      reason: 'inaccurate',
    })
  })

  test('a feed-üzenet chipsora a szerver tárolt verdictjével nyílik', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () =>
        HttpResponse.json([
          {
            artifactKind: 'feed_message',
            artifactId: FEED_ID,
            verdict: 'up',
            reason: null,
            updatedAt: '2026-08-21T12:00:00Z',
          },
        ]),
      ),
    )
    render(tree())
    const sheet = await openThread()
    await waitFor(() =>
      expect(within(sheet).getByRole('button', { name: /Segített/ })).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  test('üres feed → csak a demo-kártya áll a szálban, chip nélkül (mezo-kr9v)', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/feed`, () => HttpResponse.json([])))
    render(tree())
    const sheet = await openThread()
    expect(within(sheet).getByText('Demo tartalom')).toBeInTheDocument()
    expect(within(sheet).queryByRole('group', { name: FEEDBACK_GROUP })).not.toBeInTheDocument()
  })
})
