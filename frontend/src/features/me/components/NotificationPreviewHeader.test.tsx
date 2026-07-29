import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NotificationPreviewHeader } from '@/features/me/components/NotificationPreviewHeader'
import type { NotificationForecast } from '@/features/me/logic/notificationForecast'

function forecast(overrides: Partial<NotificationForecast> = {}): NotificationForecast {
  return { total: 0, perHour: Array.from({ length: 24 }, () => 0), denseWindows: [], ...overrides }
}

describe('NotificationPreviewHeader', () => {
  it('renders the daily count and a 24-bucket sparkline', () => {
    const perHour = Array.from({ length: 24 }, () => 0)
    perHour[7] = 2
    perHour[17] = 1
    render(<NotificationPreviewHeader forecast={forecast({ total: 3, perHour })} />)
    expect(screen.getByText('3 / nap')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^spark-bar-/)).toHaveLength(24)
  })

  it('shows an honest zero state when every category is off — no fabricated count', () => {
    render(<NotificationPreviewHeader forecast={forecast()} />)
    expect(screen.getByText('0 / nap')).toBeInTheDocument()
    expect(screen.queryByTestId('dense-window-warning')).not.toBeInTheDocument()
  })

  it('shows the dense-window warning line only when the forecast reports one', () => {
    render(
      <NotificationPreviewHeader
        forecast={forecast({ total: 2, denseWindows: [{ fromHHmm: '21:00', toHHmm: '21:10', count: 2 }] })}
      />,
    )
    const warning = screen.getByTestId('dense-window-warning')
    expect(warning).toHaveTextContent('21:00')
    expect(warning).toHaveTextContent('21:10')
    expect(warning).toHaveTextContent('2 értesítés')
  })
})
