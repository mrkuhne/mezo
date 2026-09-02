import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { NapMezoPage } from '@/features/today/pages/NapMezoPage'
import { MezoThreadProvider } from '@/features/today/MezoThreadProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString } from '@/shared/lib/dates'

// jsdom implements no scrollIntoView at all — install a spy so the mount-centring call (and,
// crucially, whether it re-fires) is observable (DayStrip.test.tsx precedent).
function stubScrollIntoView() {
  const spy = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true, writable: true, value: spy,
  })
  return spy
}

// The intervention-push deeplink (mezo-b3pp.36): the push carries `?n=<card uuid>&d=<the
// card's OWN generation day>`. For a card deferred across midnight `d` is the day BEFORE the
// push arrives — only THAT day's feed contains the card. This suite runs in REAL mode with
// MSW serving two days' feeds: `useCompanionFeed` returns `[]` synchronously in mock mode, so
// a mock-mode assertion here would pass vacuously (it would never actually fetch anything).
//
// `useNeeds`/`useMinuteTick` are stubbed the same way NapMezoPage.test.tsx stubs them — this
// suite is about the deeplink merge, not the Életjel-nudge derivation, and leaving the real
// `useNeeds` in would drag in a dozen more real-mode endpoints for no assertion here cares
// about.
vi.mock('@/features/today/logic/useNeeds', () => ({
  useNeeds: () => ({ states: [], isPending: false }),
}))

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  localStorage.clear()
})
afterEach(() => {
  vi.unstubAllEnvs()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

const TODAY = localDateString()
const YDAY = addDays(TODAY, -1)

const deepLinkedCard = {
  id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',
  date: YDAY,
  kind: 'intervention',
  eyebrow: 'Mezo közbelépett',
  body: ['Éjfél után írtál — ez a kártya innen maradt.'],
  refs: [],
  generatedAt: `${YDAY}T23:58:00Z`,
}
const yesterdayOther = {
  id: 'bbbbbbbb-2222-4111-8111-bbbbbbbbbbbb',
  date: YDAY,
  kind: 'evening',
  eyebrow: 'Esti összegzés',
  body: ['Tegnapi napzáró.'],
  refs: [],
  generatedAt: `${YDAY}T21:00:00Z`,
}
const todayMorning = {
  id: 'cccccccc-3333-4111-8111-cccccccccccc',
  date: TODAY,
  kind: 'morning',
  eyebrow: 'Reggeli briefing',
  body: ['Mai napod fonala.'],
  refs: [],
  generatedAt: `${TODAY}T06:30:00Z`,
}

/** Serves a per-day fixed feed keyed by the `date` query param — the two days' feeds never
 *  cross-contaminate, mirroring the real endpoint's contract. */
function serveFeeds(byDate: Record<string, unknown[]>) {
  server.use(http.get(`${API_BASE}/api/proactive/feed`, ({ request }) => {
    const date = new URL(request.url).searchParams.get('date') ?? ''
    return HttpResponse.json(byDate[date] ?? [])
  }))
}

function renderAt(path: string) {
  return render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <MezoThreadProvider>
          <Routes>
            <Route path="/nap/uzenetek" element={<NapMezoPage />} />
          </Routes>
        </MezoThreadProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

test('surfaces the deep-linked card when d names an earlier day, alongside today\'s own thread', async () => {
  serveFeeds({ [YDAY]: [deepLinkedCard, yesterdayOther], [TODAY]: [todayMorning] })
  renderAt(`/nap/uzenetek?n=${deepLinkedCard.id}&d=${YDAY}`)

  // the deep-linked card's body is in the document
  expect(await screen.findByText(/Éjfél után írtál/)).toBeInTheDocument()
  // today's own card is STILL rendered — the deeplink ADDS, it does not swap the thread
  expect(await screen.findByText(/Mai napod fonala/)).toBeInTheDocument()
  // yesterday's OTHER card (not the linked id) must not leak into the thread
  expect(screen.queryByText(/Tegnapi napzáró/)).not.toBeInTheDocument()

  // the deep-linked card gets the same feedback-chip wiring as any persisted feed row
  const card = (await screen.findByText(/Éjfél után írtál/)).closest('.nap-mzmsg') as HTMLElement
  expect(within(card).getByText('Segített?')).toBeInTheDocument()
  expect(within(card).getByRole('button', { name: /Segített/ })).toBeInTheDocument()
})

test('renders normally when the deeplink names today — no duplicate card', async () => {
  serveFeeds({ [TODAY]: [todayMorning] })
  renderAt(`/nap/uzenetek?n=${todayMorning.id}&d=${TODAY}`)

  expect(await screen.findByText(/Mai napod fonala/)).toBeInTheDocument()
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(1)
})

test('renders normally when there is no deeplink', async () => {
  serveFeeds({ [TODAY]: [todayMorning] })
  renderAt('/nap/uzenetek')

  expect(await screen.findByText(/Mai napod fonala/)).toBeInTheDocument()
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(1)
})

test('ignores a deeplink whose card is not in that day\'s feed — no crash, no placeholder, today intact', async () => {
  serveFeeds({ [YDAY]: [yesterdayOther], [TODAY]: [todayMorning] })
  renderAt(`/nap/uzenetek?n=00000000-0000-4000-8000-000000000000&d=${YDAY}`)

  expect(await screen.findByText(/Mai napod fonala/)).toBeInTheDocument()
  expect(screen.queryByText(/Tegnapi napzáró/)).not.toBeInTheDocument()
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(1)
})

// Finding 3: the hero count must be TODAY's own message count, never inflated by a prepended
// cross-day linked card.
test('the hero count excludes a prepended cross-day linked card', async () => {
  serveFeeds({ [YDAY]: [deepLinkedCard, yesterdayOther], [TODAY]: [todayMorning] })
  renderAt(`/nap/uzenetek?n=${deepLinkedCard.id}&d=${YDAY}`)

  await screen.findByText(/Éjfél után írtál/)
  // Two cards render (the linked one + today's own), but today's OWN thread is one message.
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(2)
  expect(await screen.findByText('1 üzenet · a napod fonala')).toBeInTheDocument()
})

// mezo-ho9k: ?n= must always land on the Üzenetek tab, overriding even an explicit
// ?tab=eletjelek — and the target card renders expanded (full body), not collapsed.
test('a deeplink ?tab=eletjelek mellett is az Üzenetek tabra érkezik, a cél-kártya kibontva (mezo-ho9k)', async () => {
  serveFeeds({ [TODAY]: [todayMorning] })
  renderAt(`/nap/uzenetek?n=${todayMorning.id}&d=${TODAY}&tab=eletjelek`)

  expect(await screen.findByRole('tab', { name: /Üzenetek/ })).toHaveAttribute('aria-selected', 'true')
  // a cél-kártya teljes (nem összecsukott sor): a törzse látszik
  expect(await screen.findByText(/Mai napod fonala/)).toBeInTheDocument()
})

// Finding 2: the common case is SAME-day — `n` names a row already inside today's own thread.
// It must not be duplicated as a second card, and it must still get scrolled/highlighted.
test('scrolls to the existing row for a same-day deeplink, without duplicating it', async () => {
  const scrollIntoView = stubScrollIntoView()
  serveFeeds({ [TODAY]: [todayMorning] })
  renderAt(`/nap/uzenetek?n=${todayMorning.id}&d=${TODAY}`)

  const card = (await screen.findByText(/Mai napod fonala/)).closest('.nap-mzmsg') as HTMLElement
  expect(document.querySelectorAll('.nap-mzmsg')).toHaveLength(1)
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
  expect(scrollIntoView.mock.instances[0]).toBe(card)
  expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ block: 'center' })
})

// Finding 1: the scroll must fire ONCE per linked card, not on every re-render — a bare object
// identity in the effect's dependency array (the pre-fix `linkedItem`) would re-fire it on any
// unrelated state change, e.g. a feedback vote landing elsewhere in the thread.
test('does not re-fire the scroll when an unrelated part of the thread re-renders', async () => {
  const scrollIntoView = stubScrollIntoView()
  serveFeeds({ [YDAY]: [deepLinkedCard, yesterdayOther], [TODAY]: [todayMorning] })
  // A mutable "stored" list so the vote's own PUT is reflected by the next GET — otherwise the
  // default MSW handler's honest-empty GET would win the mutation's invalidate-refetch race and
  // silently revert the optimistic write, which is not what this test is about (Finding 1).
  let stored: unknown[] = []
  server.use(
    http.get(`${API_BASE}/api/companion/feedback`, () => HttpResponse.json(stored)),
    http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
      const body = (await request.json()) as { artifactId: string; verdict: string; reason?: string | null }
      const saved = { ...body, reason: body.reason ?? null, updatedAt: '2026-08-21T12:00:00Z' }
      stored = [saved]
      return HttpResponse.json(saved)
    }),
  )
  const user = userEvent.setup()
  renderAt(`/nap/uzenetek?n=${deepLinkedCard.id}&d=${YDAY}`)

  await screen.findByText(/Éjfél után írtál/)
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))

  // Vote on TODAY's own card (not the linked one) — useFeedback's optimistic write re-renders
  // the page. The linked card's scroll must not fire again.
  const todayCard = (await screen.findByText(/Mai napod fonala/)).closest('.nap-mzmsg') as HTMLElement
  await user.click(within(todayCard).getByRole('button', { name: /Segített/ }))
  await waitFor(() => expect(within(todayCard).getByRole('button', { name: /Segített/ })).toHaveAttribute('aria-pressed', 'true'))

  expect(scrollIntoView).toHaveBeenCalledTimes(1)
})
