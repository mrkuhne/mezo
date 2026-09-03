import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { tokenStore, TOKEN_KEY } from '@/data/_client/tokenStore'
import { authEvents, type SignOutReason } from '@/data/_client/authEvents'
import { authApi, type MeResponse } from '@/data/auth/authApi'
import { mockMe } from '@/data/auth/authMock'
import { ME_QUERY_KEY } from '@/data/hooks'
import { clearAllNightWake } from '@/features/me/logic/nightTrace'
import { setCurrentUserId } from '@/shared/lib/userScope'
import { deriveFromError, deriveFromMe, type AuthPhase } from '@/app/auth/authState'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage'

/** Backoff between boot attempts (mezo-l0k0 semantics kept from the old owner bootstrap). */
const BOOT_RETRY_DELAYS_MS = [500, 1500, 4000]
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const SIGN_OUT_NOTICE: Record<SignOutReason, string | undefined> = {
  expired: 'A munkameneted lejárt, jelentkezz be újra.',
  disabled: 'Ezt a fiókot letiltották.',
  manual: undefined,
}

/**
 * Boot gate (S1, mezo-qw37.1): decides between the auth pages and the app from the persisted
 * token + GET /api/auth/me. Mock mode short-circuits to the app. Renders the auth pages itself
 * (outside the router) so they carry no app chrome.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const mock = isMockMode()
  // Mock mode's phase starts at 'ready' below, so `children` mount on THIS render pass —
  // React runs descendant effects before the parent's own `useEffect`, so writing the scope
  // there (as the real-mode path does, safely, because its phase starts 'pending') would let
  // every child's first render/mount observe `currentUserId() === null` and read/write
  // `mezo.anon.*` instead of `mezo.<mockId>.*`. Writing it here, during render, means it is
  // already set before any descendant renders. Idempotent (same value every render) so a
  // render-time side effect is safe here, same as `tokenStore`'s own render-time reads.
  if (mock) setCurrentUserId(mockMe.id)
  const client = useQueryClient()
  const [phase, setPhase] = useState<AuthPhase>(mock ? 'ready' : 'pending')
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [attemptNonce, setAttemptNonce] = useState(0)

  // Bumped every time a sign-out fires (mid-boot or otherwise). The boot loop below captures
  // the value it started with and refuses to write setQueryData/setPhase once it no longer
  // matches — otherwise a sign-out that arrives while the loop is asleep between retries (or
  // mid-flight on `me()`) gets silently reverted by the loop's own next successful attempt,
  // which would both repopulate the just-cleared cache and bounce the phase back to 'ready'.
  const signOutGen = useRef(0)

  // Boot: no token → login; token → me (with backoff on network failure).
  useEffect(() => {
    // Mock mode's scope write moved to render time above (Task 9 review Finding 1) — this
    // branch just short-circuits the boot fetch, same as before.
    if (mock) return
    // Correct by construction today (a fresh page load starts the module at userId === null,
    // and every path that could leave a stale id — onSignedOut, mock render — resets it), but
    // this effect re-runs on `attemptNonce`, so make the invariant local rather than relying on
    // that reasoning holding forever.
    if (tokenStore.get() == null) { setCurrentUserId(null); setPhase('signedOut'); return }
    let cancelled = false
    const startGen = signOutGen.current
    const superseded = () => cancelled || signOutGen.current !== startGen
    setPhase('pending')
    ;(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const me = await authApi.me()
          if (superseded()) return
          client.setQueryData(ME_QUERY_KEY, me)
          setCurrentUserId(me.id)
          setPhase(deriveFromMe(me))
          return
        } catch (err) {
          if (superseded()) return
          const next = deriveFromError(err)
          if (next === 'signedOut') { setPhase('signedOut'); return }
          console.error(`Auth boot failed (attempt ${attempt + 1})`, err)
          if (attempt >= BOOT_RETRY_DELAYS_MS.length) { setPhase('failed'); return }
          await sleep(BOOT_RETRY_DELAYS_MS[attempt])
          if (superseded()) return
        }
      }
    })()
    return () => { cancelled = true }
  }, [mock, attemptNonce, client])

  // A dead session announced by apiFetch/apiSse or a manual logout. Clearing the cache here
  // (not only the token) is the account-isolation boundary for the AUTOMATIC paths — expired
  // and disabled only cleared the token before this, so on a shared device the next signed-in
  // account could still read the previous account's cached meals/weight/check-ins until
  // something happened to refetch them. login/register/logout already clear via
  // useAuthActions; this covers the two paths that don't go through it.
  useEffect(() => authEvents.onSignedOut((reason) => {
    // clearAllNightWake (mezo-qw37.6) targets the CURRENT scope's keys, so it must run before
    // setCurrentUserId(null) rebases the scope to `anon` — otherwise it would clear nothing of
    // the signing-out account's trace and leave it for the next account on a shared device.
    clearAllNightWake()
    setCurrentUserId(null)
    signOutGen.current += 1
    client.clear()
    setNotice(SIGN_OUT_NOTICE[reason])
    setAuthView('login')
    setPhase('signedOut')
  }), [client])

  // Cross-tab account switch (mezo-qw37.1 review, Finding 1): the `storage` event fires only in
  // OTHER tabs than the one that changed localStorage, which is exactly what is wanted here — a
  // tab sitting on `ready` learns that ITS OWN token key changed underneath it (another tab
  // signed out, or signed out and back in as a different account) and drops to the login screen.
  // Without this, tab 2 keeps rendering the first account's cached data while `authHeader()`
  // silently starts attaching the SECOND account's token to any request tab 2 makes.
  useEffect(() => {
    if (mock) return
    let lastToken = tokenStore.get()
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY || e.newValue === lastToken) return
      lastToken = e.newValue
      authEvents.emitSignedOut('expired')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [mock])

  // Called after login/register (whose useAuthActions call already client.clear()s then seeds
  // ME_QUERY_KEY via setQueryData — see authHooks.ts) and after a forced password change (whose
  // changePassword only invalidateQueries, so no fetch happens without a mounted observer).
  // Preferring a fresh, non-invalidated cache entry means the common login/register path never
  // makes a THIRD /api/auth/me call at all — so a network blip on it can no longer strand an
  // already-authenticated user back on the login form (it simply never happens). The
  // change-password path still needs the network call, because invalidateQueries leaves the
  // OLD (mustChangePassword: true) value sitting in the cache rather than clearing it.
  const onAuthenticated = async () => {
    setNotice(undefined)
    const state = client.getQueryState<MeResponse>(ME_QUERY_KEY)
    const cached = state && !state.isInvalidated ? state.data : undefined
    if (cached) { setCurrentUserId(cached.id); setPhase(deriveFromMe(cached)); return }
    try {
      const me = await authApi.me()
      client.setQueryData(ME_QUERY_KEY, me)
      setCurrentUserId(me.id)
      setPhase(deriveFromMe(me))
    } catch (err) {
      if (deriveFromError(err) === 'signedOut') { setPhase('signedOut'); return }
      // The credentials WERE just accepted (we only get here after a successful
      // login/register/change-password) — a network blip on this verification call must not
      // strand the user on the auth form as long as a token is still on hand.
      // Not touching the scope here is safe, not an oversight: login/register always take the
      // `cached` branch above (useAuthActions pre-seeds ME_QUERY_KEY), so this catch is only
      // reachable from change-password — a flow that starts from an ALREADY correctly-scoped
      // signed-in user (mustChangePassword phase), so the scope here is already the right id,
      // not stale. Do not add a scope write to this branch without re-deriving the id from
      // somewhere, since `me` is out of scope on this path.
      setPhase(tokenStore.get() != null ? 'ready' : 'signedOut')
    }
  }

  if (phase === 'pending') return null
  if (phase === 'signedOut') {
    return authView === 'login'
      ? <LoginPage notice={notice} onSuccess={onAuthenticated} onRegister={() => setAuthView('register')} />
      : <RegisterPage onSuccess={onAuthenticated} onBack={() => setAuthView('login')} />
  }
  if (phase === 'mustChangePassword') return <ChangePasswordPage forced onSuccess={onAuthenticated} />
  if (phase === 'failed') {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--surface-base, #FDFAF4)', color: 'var(--text-primary, #2B2118)' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Nem érem el a szervert</p>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 8, color: 'var(--text-secondary, #6E6257)' }}>
            Az app nem tud bejelentkezni — lehet, hogy a backend épp újraindul. Adatot most nem tudsz menteni.
          </p>
          <button type="button" className="cta-primary" style={{ marginTop: 16, padding: '10px 28px' }} onClick={() => setAttemptNonce((n) => n + 1)}>
            Újra
          </button>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
