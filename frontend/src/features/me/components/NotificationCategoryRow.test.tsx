import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotificationCategoryRow } from '@/features/me/components/NotificationCategoryRow'
import type { NotificationPrefView } from '@/data/types'

function pref(overrides: Partial<NotificationPrefView> = {}): NotificationPrefView {
  return { category: 'gym', enabled: true, leadMinutes: 30, ...overrides }
}

describe('NotificationCategoryRow', () => {
  it('renders the category label from NOTIFICATION_CATEGORY_META, not hardcoded copy', () => {
    render(<NotificationCategoryRow pref={pref()} onToggle={() => {}} />)
    expect(screen.getByText('Edzés előtt')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Edzés előtt' })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows the lead-minute chip only for a category whose meta says showLeadChip AND while enabled', () => {
    const { rerender } = render(<NotificationCategoryRow pref={pref({ leadMinutes: 30 })} onToggle={() => {}} />)
    expect(screen.getByText('−30 perc')).toBeInTheDocument()

    // gym disabled → the chip disappears (a lead the backend won't apply must not be shown as live)
    rerender(<NotificationCategoryRow pref={pref({ enabled: false })} onToggle={() => {}} />)
    expect(screen.queryByText(/perc/)).not.toBeInTheDocument()
  })

  it('a category whose meta has showLeadChip: false never renders a chip, even with leadMinutes > 0', () => {
    // lights_out's meta carries showLeadChip: false — the ritual family's offset is resolved
    // through RitualService, so a lead chip here would control a number the backend ignores.
    render(<NotificationCategoryRow pref={pref({ category: 'lights_out', leadMinutes: 45, enabled: true })} onToggle={() => {}} />)
    expect(screen.queryByText(/perc/)).not.toBeInTheDocument()
  })

  it('fires onToggle when the switch is tapped', async () => {
    const onToggle = vi.fn()
    render(<NotificationCategoryRow pref={pref({ enabled: false })} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Edzés előtt' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('respects disabled — the switch cannot be tapped', async () => {
    const onToggle = vi.fn()
    render(<NotificationCategoryRow pref={pref()} onToggle={onToggle} disabled />)
    const toggle = screen.getByRole('switch', { name: 'Edzés előtt' })
    expect(toggle).toBeDisabled()
    await userEvent.click(toggle)
    expect(onToggle).not.toHaveBeenCalled()
  })

  // Fix round 1 (mezo-h4wp.6.3 review): the row must show a page-derived live sub-line when the
  // page has one, and fall back to the static NOTIFICATION_CATEGORY_META description otherwise.
  it('shows the caller-supplied derived subLine instead of the static meta description', () => {
    render(<NotificationCategoryRow pref={pref()} onToggle={() => {}} subLine="ma 17:00 · Láb nap" />)
    expect(screen.getByText('ma 17:00 · Láb nap')).toBeInTheDocument()
    expect(screen.queryByText('A mai edzés kezdete előtt')).not.toBeInTheDocument()
  })

  it('falls back to the static meta description when no subLine is supplied', () => {
    render(<NotificationCategoryRow pref={pref()} onToggle={() => {}} />)
    expect(screen.getByText('A mai edzés kezdete előtt')).toBeInTheDocument()
  })
})
