import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { tokenStore } from '@/data/_client/tokenStore'
import { authEvents, type SignOutReason } from '@/data/_client/authEvents'
import { authApi } from '@/data/auth/authApi'
import { ME_QUERY_KEY } from '@/data/auth/authHooks'
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
  const client = useQueryClient()
  const [phase, setPhase] = useState<AuthPhase>(mock ? 'ready' : 'pending')
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [attemptNonce, setAttemptNonce] = useState(0)

  // Boot: no token → login; token → me (with backoff on network failure).
  useEffect(() => {
    if (mock) return
    if (tokenStore.get() == null) { setPhase('signedOut'); return }
    let cancelled = false
    setPhase('pending')
    ;(async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const me = await authApi.me()
          client.setQueryData(ME_QUERY_KEY, me)
          if (!cancelled) setPhase(deriveFromMe(me))
          return
        } catch (err) {
          const next = deriveFromError(err)
          if (next === 'signedOut') { if (!cancelled) setPhase('signedOut'); return }
          console.error(`Auth boot failed (attempt ${attempt + 1})`, err)
          if (attempt >= BOOT_RETRY_DELAYS_MS.length) { if (!cancelled) setPhase('failed'); return }
          await sleep(BOOT_RETRY_DELAYS_MS[attempt])
          if (cancelled) return
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
    client.clear()
    setNotice(SIGN_OUT_NOTICE[reason])
    setAuthView('login')
    setPhase('signedOut')
  }), [client])

  const onAuthenticated = async () => {
    setNotice(undefined)
    const me = await authApi.me()
    client.setQueryData(ME_QUERY_KEY, me)
    setPhase(deriveFromMe(me))
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
