import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { NotificationsPage } from '@/features/me/pages/NotificationsPage'
import { QueryWrapper } from '@/test/queryWrapper'
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

  it('a denied permission shows the denied status line and an unchecked toggle, not an enabled-looking control', () => {
    const p = push({ permission: 'denied', enabled: false })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    expect(
      screen.getByText('Az eszközön letiltva — az iOS beállításokban engedélyezhető újra.'),
    ).toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: 'Push értesítések' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('clicking the toggle while permission is denied does not attempt to (re-)subscribe', async () => {
    const p = push({ permission: 'denied', enabled: false })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    await userEvent.click(screen.getByRole('switch', { name: 'Push értesítések' }))
    expect(p.subscribe).not.toHaveBeenCalled()
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

  it('shows the send result after a successful test push', async () => {
    const p = push({ enabled: true, permission: 'granted', sendTest: vi.fn().mockResolvedValue({ attempted: 2, sent: 1 }) })
    hooks.usePushSubscription.mockReturnValue(p)
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Teszt értesítés küldése' }))
    expect(await screen.findByText('Elküldve 1/2 eszközre.')).toBeInTheDocument()
  })
})
