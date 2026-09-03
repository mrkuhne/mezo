import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { NotificationsPage } from '@/features/me/pages/NotificationsPage'
import { QueryWrapper } from '@/test/queryWrapper'
import { API_BASE } from '@/data/_client/api'
import { notificationPrefSeed } from '@/data/notification/notificationMock'
import { server } from '@/test/msw/server'
import type { PushSubscriptionState } from '@/data/types'

// usePushSubscription's `supported`/`standalone` come straight off the real browser
// (matchMedia/serviceWorker/PushManager) — not something MSW or mock-mode can drive. Mock the
// hook directly, per the house pattern (RitualCard.test.tsx), so every branch below is
// deterministic regardless of ambient VITE_USE_MOCK.
const hooks = vi.hoisted(() => ({ usePushSubscription: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  usePushSubscription: hooks.usePushSubscription,
}))

function push(overrides: Partial<PushSubscriptionState> = {}): PushSubscriptionState {
  return {
    supported: true,
    standalone: true,
    permission: 'default',
    enabled: false,
    busy: false,
    error: null,
    subscribe: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    sendTest: vi.fn().mockResolvedValue({ attempted: 1, sent: 1 }),
    ...overrides,
  }
}

function renderPage() {
  return render(
    <QueryWrapper>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryWrapper>,
  )
}

describe('NotificationsPage', () => {
  it('shows the iOS install instruction instead of a toggle when not standalone', () => {
    // jsdom is never standalone → the gate replaces the master toggle (a toggle that
    // cannot work must not be offered).
    hooks.usePushSubscription.mockReturnValue(push({ supported: false, standalone: false }))
    renderPage()
    expect(screen.getByText(/kezdőképernyő/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('supported but not standalone (a Safari tab) still shows the gate, not the toggle', () => {
    hooks.usePushSubscription.mockReturnValue(push({ supported: true, standalone: false }))
    renderPage()
    expect(screen.getByText(/kezdőképernyő/i)).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    // the gate REPLACES the toggle — it must never sit beside a live one.
    expect(screen.queryByRole('button', { name: /Teszt értesítés küldése/ })).not.toBeInTheDocument()
  })

  it('standalone + supported renders the master toggle, off by default, with the honest status line', () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: false, permission: 'default' }))
    renderPage()
    expect(screen.queryByText(/kezdőképernyő/i)).not.toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: 'Push értesítések' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Nincs engedélyezve')).toBeInTheDocument()
  })

  it('a denied permission shows the denied status line and a disabled, unchecked toggle — not an enabled-looking control', () => {
    const p = push({ permission: 'denied', enabled: false })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    expect(
      screen.getByText('Az eszközön letiltva — az iOS beállításokban engedélyezhető újra.'),
    ).toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: 'Push értesítések' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    // Visible-but-inert (mezo-h4wp.6.1 review fix): denied is user-recoverable via iOS
    // settings, so the switch stays present but is honestly marked dead via `disabled`,
    // never a fully-interactive-looking no-op.
    expect(toggle).toBeDisabled()
  })

  it('clicking the toggle while permission is denied does not attempt to (re-)subscribe', async () => {
    const p = push({ permission: 'denied', enabled: false })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    await userEvent.click(screen.getByRole('switch', { name: 'Push értesítések' }))
    expect(p.subscribe).not.toHaveBeenCalled()
  })

  it('clicking the toggle while busy does not attempt to subscribe/unsubscribe again', async () => {
    const p = push({ busy: true, enabled: false })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    const toggle = screen.getByRole('switch', { name: 'Push értesítések' })
    expect(toggle).toBeDisabled()
    await userEvent.click(toggle)
    expect(p.subscribe).not.toHaveBeenCalled()
    expect(p.unsubscribe).not.toHaveBeenCalled()
  })

  it('the test-push button is absent before subscribing (enabled: false)', () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: false }))
    renderPage()
    expect(screen.queryByRole('button', { name: /Teszt értesítés küldése/ })).not.toBeInTheDocument()
  })

  it('once enabled, shows "iPhone · engedélyezve" and the test-push button', () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    expect(screen.getByText('iPhone · engedélyezve')).toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: 'Push értesítések' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Teszt értesítés küldése' })).toBeInTheDocument()
  })

  it('tapping the toggle when enabled calls unsubscribe(); when disabled calls subscribe()', async () => {
    const onOff = push({ enabled: true, permission: 'granted' })
    hooks.usePushSubscription.mockReturnValue(onOff)
    const { unmount } = renderPage()
    await userEvent.click(screen.getByRole('switch', { name: 'Push értesítések' }))
    expect(onOff.unsubscribe).toHaveBeenCalledTimes(1)
    unmount()

    const off = push({ enabled: false })
    hooks.usePushSubscription.mockReturnValue(off)
    renderPage()
    await userEvent.click(screen.getByRole('switch', { name: 'Push értesítések' }))
    expect(off.subscribe).toHaveBeenCalledTimes(1)
  })

  it('the test-push button reports the send result and is disabled while busy', async () => {
    const p = push({ enabled: true, permission: 'granted', busy: true })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    expect(screen.getByRole('button', { name: 'Teszt értesítés küldése' })).toBeDisabled()
  })

  it('a vapid-missing error names the build misconfiguration rather than blaming the device', () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: false, error: 'vapid-missing' }))
    renderPage()
    // The exact state a fresh deploy hits — the copy must not invite a pointless retry.
    expect(screen.getByRole('alert')).toHaveTextContent(/push-kulcsot/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/alkalmazásoldali hiba/i)
  })

  it('a register-failed error is reported instead of the toggle silently snapping back', () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: false, error: 'register-failed' }))
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent(/a szerver nem vette nyilvántartásba/i)
    // ...and the honest status line still says it is off, so the two never contradict each other.
    expect(screen.getByText('Nincs engedélyezve')).toBeInTheDocument()
  })

  it('a generic failure gets the generic line, and no error at all renders no alert', () => {
    hooks.usePushSubscription.mockReturnValue(push({ error: 'failed' }))
    const { unmount } = renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('Az értesítések beállítása nem sikerült. Próbáld újra.')
    unmount()

    hooks.usePushSubscription.mockReturnValue(push({ error: null }))
    renderPage()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the send result after a successful test push', async () => {
    const p = push({ enabled: true, permission: 'granted', sendTest: vi.fn().mockResolvedValue({ attempted: 2, sent: 1 }) })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Teszt értesítés küldése' }))
    expect(await screen.findByText('Elküldve 1/2 eszközre.')).toBeInTheDocument()
  })

  // ── N2/N3: settings category list + preview header (mezo-h4wp.6.2/.3) ──────────────────────
  it('renders all 22 categories grouped into the three sections (prose, reminder, brain), plus the master toggle', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    expect(await screen.findByText('Mezo megszólal')).toBeInTheDocument()
    expect(screen.getByText('Emlékeztetők')).toBeInTheDocument()
    expect(screen.getByText('Az agy eseményei')).toBeInTheDocument()
    // 1 master toggle + 22 category rows (7 prose + 7 reminder + 8 brain, +1 intervention mezo-b3pp.19).
    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(23))
  })

  it('toggling a category row calls setPref, flipping just that row', async () => {
    // A STATEFUL fake backend for the pref endpoints: real mode's onSettled invalidates and
    // refetches after the write, so a stateless GET (always the pristine seed) would silently
    // revert the optimistic flip — harmless to register in mock mode too (never reached).
    let state = notificationPrefSeed.map((p) => ({ ...p }))
    server.use(
      http.get(`${API_BASE}/api/notification/pref`, () => HttpResponse.json({ prefs: state })),
      http.put(`${API_BASE}/api/notification/pref`, async ({ request }) => {
        const body = (await request.json()) as { prefs: typeof state }
        state = state.map((p) => body.prefs.find((x) => x.category === p.category) ?? p)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    // "Déli jegyzet" (midday) defaults OFF — an honest, unambiguous OFF→ON assertion.
    const row = await screen.findByRole('switch', { name: 'Déli jegyzet' })
    expect(row).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(row)
    await waitFor(() => expect(row).toHaveAttribute('aria-checked', 'true'))
    // A different, untouched row must not have flipped along with it.
    expect(screen.getByRole('switch', { name: 'Reggeli briefing' })).toHaveAttribute('aria-checked', 'true')
  })

  it('the install gate replaces the WHOLE screen — no category rows, no preview header', () => {
    hooks.usePushSubscription.mockReturnValue(push({ supported: false, standalone: false }))
    renderPage()
    expect(screen.queryByText('Mezo megszólal')).not.toBeInTheDocument()
    expect(screen.queryByText('Emlékeztetők')).not.toBeInTheDocument()
    expect(screen.queryByText('Napi terhelés')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('renders the live volume-preview header with a daily count, above the master toggle', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: false, permission: 'default' }))
    renderPage()
    expect(await screen.findByText('Napi terhelés')).toBeInTheDocument()
    // Anchored to digits-then-"/ nap" so it never also matches the fuel_slot row's derived
    // sub-line ("{count} slot / nap"), which lands on the SAME "/ nap" substring.
    expect(screen.getByText(/^\d+ \/ nap$/)).toBeInTheDocument()
  })

  // Fix round 1 (mezo-h4wp.6.3 review): the category rows show LIVE per-day sub-lines derived
  // from the same anchors the preview header uses, not just the static meta description.
  it('derives live sub-lines for rows backed by data the page already has', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    await screen.findByText('Mezo megszólal')
    // ritual's opensAt / lights_out's bedTime come straight from the mock ritual day + sleep goal
    // (see test/msw + mock seeds) — asserting the STATIC fallback text is absent proves the row
    // is showing something derived, not the generic copy.
    expect(screen.queryByText('A napzárás-ablak nyílásakor')).not.toBeInTheDocument()
    expect(screen.queryByText('Az esti alvás-horgonynál')).not.toBeInTheDocument()
  })

  it('renders the "Az agy eseményei" section with a row labeled "Minták"', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    expect(await screen.findByText('Az agy eseményei')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Minták' })).toBeInTheDocument()
  })

  // The volume preview (NotificationPreviewHeader) cannot forecast the 6 feed-anchored
  // categories (they have no FE-resolvable anchor, notificationForecast.ts's exhaustive switch
  // returns null for all of them) — this static line discloses that gap instead of silently
  // under-counting.
  it('discloses that the feed-anchored categories are excluded from the volume preview', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    await screen.findByText('Az agy eseményei')
    expect(
      screen.getByText('Eseményvezérelt — nem szerepel a napi terhelés előnézetben.'),
    ).toBeInTheDocument()
  })

  // ── Mozaik re-face (mezo-d20.6.8): washed tiles, clay icons, rise stagger ──────────────────
  it('renders category rows as washed tiles carrying the category clay icon (gym lead-chip row)', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    const gymRow = (await screen.findByRole('switch', { name: 'Edzés előtt' })).closest('.ntf-catrow')
    expect(gymRow).not.toBeNull()
    expect(gymRow).toHaveClass('rise')
    // the gym-only lead chip sits inside the same washed row, not a plain list row.
    expect(gymRow?.querySelector('.ntf-leadch')).toHaveTextContent(/−\d+ perc/)
    expect(gymRow?.querySelector('svg')).not.toBeNull()
  })

  it('a disabled category row wears the .off dimming class', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    // "Déli jegyzet" (midday) defaults OFF (see the toggle test above).
    const row = (await screen.findByRole('switch', { name: 'Déli jegyzet' })).closest('.ntf-catrow')
    expect(row).toHaveClass('off')
  })

  it('the master push row is a washed tile with a clay icon, not a plain card', () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: false, permission: 'default' }))
    renderPage()
    const master = screen.getByRole('switch', { name: 'Push értesítések' }).closest('.ntf-masterrow')
    expect(master).not.toBeNull()
    expect(master?.querySelector('svg')).not.toBeNull()
  })

  // ── mezo-d20.11 (1:1 fidelity audit) ──────────────────────────────────────────────────────
  // ADR 0032: the page had NO header at all — no title, no way back. The prototype
  // (#page-ertesites) gives it the `‹ Értesítések` chip and a hero stating today's planned
  // volume. mezo-nol0: the noun moved to the feed page, so this settings page's own hero/back
  // chip now read `Értesítés-beállítások` / `‹ Értesítések` instead of the shared `Értesítések`.
  it('wears the prototype header and hero, with a way back', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    const { container } = renderPage()
    expect(await screen.findByText('Értesítés-beállítások')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
    expect(screen.getByText('‹ Értesítések')).toBeInTheDocument()
    expect(container.querySelector('.mz-bignum')).not.toBeNull()
  })

  // The install gate REPLACES the page — before mezo-d20.11 that left the user on a screen with
  // no title and no way back at all. The gate keeps the scaffold, but no hero bignum: on a
  // platform where nothing can fire, a planned-volume number would be a number about nothing.
  it('the install gate keeps the header and the way back, without a volume number', () => {
    hooks.usePushSubscription.mockReturnValue(push({ supported: false, standalone: false }))
    const { container } = renderPage()
    expect(screen.getByText('Értesítés-beállítások')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vissza' })).toBeInTheDocument()
    expect(container.querySelector('.mz-bignum')).toBeNull()
    // …and it is no longer the only Én page with zero entrance choreography (audit group A).
    expect(container.querySelector('.mz-play .rise')).not.toBeNull()
  })
})
