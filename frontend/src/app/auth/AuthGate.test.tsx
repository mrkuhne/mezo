import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE, setToken } from '@/data/_client/api'
import { TOKEN_KEY } from '@/data/_client/tokenStore'
import { AuthGate } from '@/app/auth/AuthGate'
import { QueryWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { authEvents } from '@/data/_client/authEvents'
import { currentUserId, setCurrentUserId } from '@/shared/lib/userScope'
import { mockMe } from '@/data/auth/authMock'

afterEach(() => { vi.unstubAllEnvs(); localStorage.clear(); setToken(null) })

const App = () => <div>APP</div>
const renderGate = () => render(<QueryWrapper><AuthGate><App /></AuthGate></QueryWrapper>)

test('mock mode renders the app immediately', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderGate()
  expect(screen.getByText('APP')).toBeInTheDocument()
})

test('no token → login page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
})

test('valid token → me → app', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  expect(await screen.findByText('APP')).toBeInTheDocument()
})

test('must-change-password → change-password page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: true, mustChangePassword: true, timezone: 'Europe/Budapest',
  })))
  setToken('t')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Új jelszó' })).toBeInTheDocument()
})

test('backend unreachable → degraded screen with retry', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.error()))
  setToken('t')
  renderGate()
  // BOOT_RETRY_DELAYS_MS (500/1500/4000ms) is exhausted before the degraded screen shows —
  // the default findBy timeout (1000ms) is too tight for that backoff.
  expect(await screen.findByText('Nem érem el a szervert', undefined, { timeout: 8000 })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Újra' })).toBeInTheDocument()
}, 10000)

test('a signedOut event while ready drops back to the login page', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  await screen.findByText('APP')
  setToken(null)
  authEvents.emitSignedOut('expired')
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
  expect(screen.getByText('A munkameneted lejárt, jelentkezz be újra.')).toBeInTheDocument()
})

// mezo-qw37.1 review Finding 1: a `storage` event fires only in OTHER tabs than the one that
// changed localStorage — exactly what is wanted here. Without this listener, a tab that stayed
// on `ready` while another tab signed out (and possibly a different account signed back in)
// would keep rendering stale cached data while silently attaching the new account's token to
// any request it makes.
test('a StorageEvent on the token key from another tab drops the gate to the login screen', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { wrapper, client } = makeHookWrapperWithClient()
  setToken('t')
  render(<AuthGate><App /></AuthGate>, { wrapper })
  await screen.findByText('APP')

  client.setQueryData(['someone', 'elses', 'meals'], { secret: true })

  window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY, newValue: 'other-accounts-token', oldValue: 't' }))

  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
  expect(client.getQueryData(['someone', 'elses', 'meals'])).toBeUndefined()
})

test('a StorageEvent for an unrelated key is ignored', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  await screen.findByText('APP')

  window.dispatchEvent(new StorageEvent('storage', { key: 'mezo-theme', newValue: 'dark' }))

  expect(screen.getByText('APP')).toBeInTheDocument()
})

test('login page → register link → register page and back', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  renderGate()
  await userEvent.click(await screen.findByRole('button', { name: 'Van meghívó kódod?' }))
  expect(await screen.findByRole('heading', { name: 'Regisztráció' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Vissza a belépéshez' }))
  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
})

// mezo-qw37.1 review carry-over (Task 9): the AUTOMATIC sign-out paths (expired/disabled) used
// to clear only the token, leaving every OTHER cached key (meals, weight, check-ins, …) behind
// for the next account on a shared device. AuthGate owns the onSignedOut subscription and the
// QueryClient, so it must clear the whole cache for EVERY reason, not just on manual logout.
test('a signedOut event clears the query cache for every reason, not just manual logout', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { wrapper, client } = makeHookWrapperWithClient()
  setToken('t')
  render(<AuthGate><App /></AuthGate>, { wrapper })
  await screen.findByText('APP')

  client.setQueryData(['someone', 'elses', 'meals'], { secret: true })
  expect(client.getQueryData(['someone', 'elses', 'meals'])).toEqual({ secret: true })

  setToken(null)
  authEvents.emitSignedOut('expired')
  await screen.findByRole('heading', { name: 'Bejelentkezés' })

  expect(client.getQueryData(['someone', 'elses', 'meals'])).toBeUndefined()
})

// mezo-qw37.1 review Finding 2: mezo-night-wake:* is real personal data (how many times, and
// when, the account woke overnight) and SleepLogSheet prefills the SUBMITTING account's sleep
// log from whatever sits under today's key — so on a shared device it must not survive past the
// account that recorded it, for every sign-out reason (expired/disabled/manual), not just logout.
test('a signedOut event for any reason clears the night-wake trace', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  await screen.findByText('APP')

  const key = `mezo.${currentUserId()}.night-wake:2026-07-24`
  localStorage.setItem(key, JSON.stringify({ count: 2, lastAt: 'x' }))

  setToken(null)
  authEvents.emitSignedOut('disabled')
  await screen.findByRole('heading', { name: 'Bejelentkezés' })

  expect(localStorage.getItem(key)).toBeNull()
})

const meFixture = { id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: true, mustChangePassword: false, timezone: 'Europe/Budapest' }

// Review finding 1 (Task 10): useAuthActions().login already client.clear()s then seeds
// ME_QUERY_KEY via setQueryData before LoginPage's onSuccess (= AuthGate.onAuthenticated) runs.
// onAuthenticated used to make its OWN third /api/auth/me call regardless — a network blip on
// THAT call rejected back into LoginPage.submit's catch and stranded an already-authenticated
// user on the login form. Fixed by preferring the fresh, non-invalidated cache entry: the
// second /api/auth/me call below (rigged to fail) must never actually be reached.
test('a network blip on the post-login verification call does not strand the user on the login form', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let meCalls = 0
  server.use(http.get(`${API_BASE}/api/auth/me`, () => {
    meCalls += 1
    return meCalls === 1 ? HttpResponse.json(meFixture) : HttpResponse.error()
  }))
  renderGate()
  await screen.findByRole('heading', { name: 'Bejelentkezés' })
  await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.c')
  await userEvent.type(screen.getByLabelText('Jelszó'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Belépés' }))
  expect(await screen.findByText('APP')).toBeInTheDocument()
  // Task 9 review Finding 2: this test reaches APP via onAuthenticated's CACHED branch (the
  // second me() call above is rigged to fail and must never be reached) — the actual path an
  // ordinary login/register takes, since useAuthActions pre-seeds ME_QUERY_KEY. Nothing else in
  // the suite asserts the scope gets set on this branch.
  expect(currentUserId()).toBe(meFixture.id)
})

// Review finding 2 (Task 10): the boot loop's own `cancelled` flag knows nothing about a
// sign-out arriving from the SEPARATE onSignedOut listener while `me()` is still in flight.
// Without a shared "superseded" marker, the loop's in-flight response would overwrite the
// signedOut phase the listener just set (and repopulate the cache it just cleared) once it
// resolves — reverting a sign-out that raced the boot fetch.
test('a signedOut event mid-boot is not reverted by the in-flight me() response', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let resolveMe: (() => void) | undefined
  server.use(http.get(`${API_BASE}/api/auth/me`, () => new Promise<Response>((resolve) => {
    resolveMe = () => resolve(HttpResponse.json(meFixture) as unknown as Response)
  })))
  setToken('t')
  renderGate()
  await waitFor(() => expect(resolveMe).toBeDefined())

  authEvents.emitSignedOut('expired')
  resolveMe!()

  expect(await screen.findByRole('heading', { name: 'Bejelentkezés' })).toBeInTheDocument()
  expect(screen.queryByText('APP')).not.toBeInTheDocument()
})

// Review finding 4 (Task 10): coverage regression versus the old QueryProvider.test.tsx, which
// clicked the degraded screen's Újra button and asserted the app recovered. Restored here
// against AuthGate directly.
test('the degraded screen recovers via Újra once the backend answers again', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let up = false
  server.use(http.get(`${API_BASE}/api/auth/me`, () => (up ? HttpResponse.json(meFixture) : HttpResponse.error())))
  setToken('t')
  renderGate()
  const retry = await screen.findByRole('button', { name: 'Újra' }, { timeout: 8000 })
  up = true
  await userEvent.click(retry)
  expect(await screen.findByText('APP')).toBeInTheDocument()
}, 15000)

// Task 9 (mezo-qw37.6): AuthGate is the single writer of the userScope namespace — mock mode
// scopes to the mock identity, a real sign-in scopes to the /api/auth/me id, and sign-out
// clears the scope back to anon so the NEXT account on a shared device never inherits it.
test('mock mode scopes storage to the mock identity', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  renderGate()
  expect(currentUserId()).toBe(mockMe.id)
})

// Task 9 review Finding 1: in mock mode `phase` starts at 'ready', so `children` mount on the
// FIRST render pass, while `renderGate()`'s own assertion above only proves the scope is set
// AFTER render() returns — which is true even if the write happens in a useEffect, because
// React flushes effects (parent's included) before render() hands control back. React runs
// descendant effects bottom-up BEFORE the parent's own effect, so a child that reads the scope
// during ITS render or mount — not after the whole tree has settled — is the only way to catch
// a write that happens too late. Task 10 migrates six storage read/writes into exactly that
// window (nightTrace, msgseen, sleep-escal-snooze, the nudge log, the morning snooze, the
// sticky tab), so a late write there would silently corrupt mock-mode namespacing.
function ScopeProbe({ onProbe }: { onProbe: (id: string | null) => void }) {
  onProbe(currentUserId())
  return <div>PROBED</div>
}

test('mock mode scope is set before children render (not only by the time render() returns)', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  // Guard against a leaked scope from an earlier test making this pass vacuously — start from
  // a value that is neither null nor mockMe.id, so the probe can only see mockMe.id if THIS
  // render actually set it before the child rendered.
  setCurrentUserId('some-other-stale-user')
  let probedDuringChildRender: string | null | 'never-called' = 'never-called'
  render(
    <QueryWrapper>
      <AuthGate>
        <ScopeProbe onProbe={(id) => { probedDuringChildRender = id }} />
      </AuthGate>
    </QueryWrapper>,
  )
  expect(screen.getByText('PROBED')).toBeInTheDocument()
  expect(probedDuringChildRender).toBe(mockMe.id)
})

test('valid token → me → the storage scope is the signed-in user; sign-out clears it', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  setToken('t')
  renderGate()
  await screen.findByText('APP')
  expect(currentUserId()).toBe('00000000-0000-0000-0000-000000000001') // the MSW /api/auth/me id
  setToken(null)
  authEvents.emitSignedOut('manual')
  await screen.findByRole('heading', { name: 'Bejelentkezés' })
  expect(currentUserId()).toBeNull()
})

test('onboarded=false → wizard; completing it re-reads me and lands in the app', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let onboarded = false
  server.use(
    http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
      id: '1', email: 'bela@test.local', name: 'Béla', role: 'USER', onboarded, mustChangePassword: false, timezone: 'Europe/Budapest',
    })),
    http.post(`${API_BASE}/api/auth/onboarding-complete`, () => { onboarded = true; return new HttpResponse(null, { status: 204 }) }),
  )
  setToken('t')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Első lépések' })).toBeInTheDocument()
  expect(screen.getByText('Szia, Béla!')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Férfi' }))
  await userEvent.type(screen.getByLabelText('Születési dátum'), '1993-05-14')
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  await userEvent.click(screen.getByRole('button', { name: 'Tovább' }))
  await userEvent.click(screen.getByRole('button', { name: 'Kezdjük' }))
  expect(await screen.findByText('APP')).toBeInTheDocument()
})

test('must-change-password outranks onboarding', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/auth/me`, () => HttpResponse.json({
    id: '1', email: 'a@b.c', name: 'A', role: 'USER', onboarded: false, mustChangePassword: true, timezone: 'Europe/Budapest',
  })))
  setToken('t')
  renderGate()
  expect(await screen.findByRole('heading', { name: 'Új jelszó' })).toBeInTheDocument()
})
