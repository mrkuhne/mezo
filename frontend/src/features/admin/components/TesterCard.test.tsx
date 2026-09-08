import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import type { AdminUserInsightResponse } from '@/data/admin/adminInsightsApi'
import { TesterCard } from '@/features/admin/components/TesterCard'

const NOW = new Date('2026-09-08T12:00:00Z')

function makeUser(overrides: Partial<AdminUserInsightResponse>): AdminUserInsightResponse {
  return {
    id: 'u1', email: 'anna@test.local', name: 'Anna', role: 'USER', status: 'ACTIVE',
    createdAt: '2026-08-02T18:20:00Z', onboardedAt: '2026-08-02T18:35:00Z', lastSeenAt: '2026-09-07T12:00:00Z',
    lastActivityAt: '2026-09-07T12:00:00Z', rowCount: 356, vectorCount: 140, cost30dUsd: 3.21, activeDays30d: 11,
    activityByDay: Array.from({ length: 90 }, (_, i) => (i > 80 ? i % 4 : 0)),
    feedbackUp: 5, feedbackDown: 1,
    ...overrides,
  }
}

function renderCard(user: AdminUserInsightResponse) {
  return render(
    <MemoryRouter>
      <TesterCard user={user} now={NOW} />
    </MemoryRouter>,
  )
}

describe('TesterCard', () => {
  it('renders the avatar initial, name, cost, status chip and a link to the detail page', () => {
    const { container } = renderCard(makeUser({}))
    expect(screen.getByText('Anna')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument() // avatar initial
    expect(screen.getByText('$3.21')).toBeInTheDocument()
    expect(screen.getByText('Aktív')).toBeInTheDocument() // 1 day ago -> aktiv
    const link = container.querySelector('a.ad-testercard')
    expect(link).toHaveAttribute('href', '/admin/users/u1')
  })

  it('renders exactly 90 heat-strip cells', () => {
    const { container } = renderCard(makeUser({}))
    expect(container.querySelectorAll('.ad-heat i')).toHaveLength(90)
  })

  it('shows "utoljára: X napja" for a real last-activity date', () => {
    renderCard(makeUser({ lastActivityAt: '2026-09-01T12:00:00Z' })) // 7 days before NOW
    expect(screen.getByText('utoljára: 7 napja')).toBeInTheDocument()
  })

  it('shows the honest "még nem aktív" line and status chip for a never-active user, no invented day count', () => {
    renderCard(makeUser({ lastActivityAt: null, activityByDay: Array(90).fill(0) }))
    expect(screen.getByText('még nem aktív')).toBeInTheDocument()
    expect(screen.getByText('Még nem aktív')).toBeInTheDocument()
  })

  it('renders the feedback balance with up/down glyphs when there is real feedback', () => {
    renderCard(makeUser({ feedbackUp: 14, feedbackDown: 2 }))
    expect(screen.getByText('▲14')).toBeInTheDocument()
    expect(screen.getByText('▼2')).toBeInTheDocument()
  })

  it('mutes the feedback balance when both counts are 0', () => {
    const { container } = renderCard(makeUser({ feedbackUp: 0, feedbackDown: 0 }))
    const balance = container.querySelector('.helped')
    expect(balance).toHaveClass('ad-mut')
  })

  it('mutes the cost figure when 30d cost is 0', () => {
    const { container } = renderCard(makeUser({ cost30dUsd: 0 }))
    const cost = screen.getByText('$0.00')
    expect(cost).toHaveClass('ad-mut')
    expect(container).toBeTruthy()
  })
})
