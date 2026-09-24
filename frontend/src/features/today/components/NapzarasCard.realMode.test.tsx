import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { NapzarasCard } from '@/features/today/components/NapzarasCard'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

// Real mode, unmocked hooks (mezo-yjzhw.7): while today's ritual state is still loading, the
// Mai napzárás card renders NOTHING — a pending ritual reads as "not closed", which would flash
// the full card on a day that is already closed.
const NOW = new Date('2026-09-24T20:30:00')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

test('a closed day never flashes the full card while the ritual is loading', async () => {
  server.use(http.get(`${API_BASE}/api/ritual/day/:date`, async ({ params }) => {
    await delay(120)
    return HttpResponse.json({
      date: String(params.date), closed: true, closedAt: '2026-09-24T18:10:00Z',
      window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
    })
  }))
  const { container } = render(<QueryWrapper><MemoryRouter><NapzarasCard now={NOW} /></MemoryRouter></QueryWrapper>)
  // in flight: neither the full card nor the done row
  expect(container).toBeEmptyDOMElement()
  expect(screen.queryByText('Tegyük le a napot.')).toBeNull()
  // resolved as closed: the flat done row, and the full card never appeared
  expect(await screen.findByText('Letetted a napot')).toBeInTheDocument()
  expect(screen.queryByText('Tegyük le a napot.')).toBeNull()
})
