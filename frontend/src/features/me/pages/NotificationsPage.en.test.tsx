import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationsPage } from '@/features/me/pages/NotificationsPage'
import { NotificationCategoryRow } from '@/features/me/components/NotificationCategoryRow'
import { QueryWrapper } from '@/test/queryWrapper'
import { setLang } from '@/shared/i18n'
import { catalogs } from '@/shared/i18n/messages'
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_META } from '@/data/types'
import type { PushSubscriptionState } from '@/data/types'

// Notifications in English: the page heading, the section labels and representative rows verbatim from
// the approved prototype (`vilagos/en.js` bert()); the derived texts follow the language at runtime.
const hooks = vi.hoisted(() => ({ usePushSubscription: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/hooks')>()),
  usePushSubscription: hooks.usePushSubscription,
}))

function push(overrides: Partial<PushSubscriptionState> = {}): PushSubscriptionState {
  return {
    supported: true, standalone: true, permission: 'default', enabled: false, busy: false, error: null,
    subscribe: vi.fn().mockResolvedValue(true), unsubscribe: vi.fn().mockResolvedValue(undefined),
    sendTest: vi.fn().mockResolvedValue({ attempted: 1, sent: 1 }), ...overrides,
  }
}
const renderPage = () => render(<QueryWrapper><MemoryRouter><NotificationsPage /></MemoryRouter></QueryWrapper>)

beforeEach(() => setLang('en', { persist: false }))
afterEach(() => setLang('hu', { persist: false }))

describe('Notifications in English', () => {
  it('heading, master switch, section labels and category rows', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    expect(screen.getByText('Notification settings')).toBeInTheDocument()
    expect(screen.getByText('iPhone · allowed')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Push notifications' })).toBeInTheDocument()
    expect(await screen.findByText('When Mezo speaks')).toBeInTheDocument()
    expect(screen.getByText('Reminders')).toBeInTheDocument()
    expect(screen.getByText('Events from the brain')).toBeInTheDocument()
    expect(screen.getByText('Daily load')).toBeInTheDocument()
    expect(screen.getByText(/^\d+ \/ day$/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Morning briefing' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Before a workout' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Patterns' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send a test notification' })).toBeInTheDocument()
    expect(screen.getByText('Events from the brain are triggered by what happens, so they are not in the daily load preview.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(23))
  })

  it('the install gate and the status lines are English', () => {
    hooks.usePushSubscription.mockReturnValue(push({ supported: true, standalone: false }))
    const { unmount } = renderPage()
    expect(screen.getByText('home screen')).toBeInTheDocument()
    expect(screen.getByText('iOS:')).toBeInTheDocument()
    unmount()

    hooks.usePushSubscription.mockReturnValue(push({ permission: 'denied', error: 'vapid-missing' }))
    renderPage()
    expect(screen.getByText('Blocked on this device — you can allow it again in the iOS settings.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('This build has no push key')
  })

  it('the test-push result is kept as numbers and follows the language at runtime', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted', sendTest: vi.fn().mockResolvedValue({ attempted: 2, sent: 1 }) }))
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Send a test notification' }))
    const result = await screen.findByText('Sent to 1/2 devices.')
    act(() => setLang('hu', { persist: false }))
    expect(result).toHaveTextContent('Elküldve 1/2 eszközre.')
  })

  it('the derived sub-lines are English (wake-up anchor, window opens)', async () => {
    hooks.usePushSubscription.mockReturnValue(push({ enabled: true, permission: 'granted' }))
    renderPage()
    await screen.findByText('When Mezo speaks')
    expect(screen.getByText(/^\d{2}:\d{2} · wake-up anchor$/)).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}:\d{2} · window opens$/)).toBeInTheDocument()
  })

  it('a row with a lead chip reads "−30 min"', () => {
    render(<NotificationCategoryRow pref={{ category: 'gym', enabled: true, leadMinutes: 30 }} onToggle={() => {}} />)
    expect(screen.getByText('−30 min')).toBeInTheDocument()
  })
})

describe('the Hungarian category texts', () => {
  it('stay exactly what NOTIFICATION_CATEGORY_META says, for every category, and English has them all', () => {
    for (const key of NOTIFICATION_CATEGORIES) {
      expect(catalogs.hu.settings.notifications.categories[key]).toEqual({
        label: NOTIFICATION_CATEGORY_META[key].label,
        description: NOTIFICATION_CATEGORY_META[key].description,
      })
      expect(catalogs.en.settings.notifications.categories[key].label).not.toBe('')
    }
  })
})
