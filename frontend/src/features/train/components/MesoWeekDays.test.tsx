import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MesoWeekDays } from '@/features/train/components/MesoWeekDays'
import { mesocycles } from '@/data/train/train'
import { RECOVERY_QUERY_KEY } from '@/data/train/queryKeys'
import type { RecoveryState } from '@/data/train/recoveryApi'
import { localDateString } from '@/shared/lib/dates'
import { weekDateIso } from '@/features/train/logic/weekAgenda'

// Kímélő mód S2 (mezo-q4xt2.2, prototype elo/edzes.html `dayCard` kmday): the Terv week list mutes
// every protected training/sport day — „Kímélő mód · {session} kimarad" with the category icon.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-29T12:00:00')) // a Tuesday (Kedd)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

const meso = mesocycles[0]

function renderWith(state: RecoveryState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData([...RECOVERY_QUERY_KEY, localDateString()], state)
  return render(
    <QueryClientProvider client={client}>
      <MesoWeekDays meso={meso} onOpenDay={() => {}} />
    </QueryClientProvider>,
  )
}

const period = {
  id: 'p', category: 'STOMACH' as const, estimate: 'FEW_DAYS' as const, startDate: weekDateIso(0), expectedEnd: null,
  endedOn: null, dayIndex: 1, estimateExpired: false, checkedInToday: false, releasedDates: [], releasedUnlightened: [], return: null,
}

test('protected training and sport days from today on read „Kímélő mód · … kimarad" with the category icon; rest and past days stay', () => {
  // Hét (Push, past), Kedd (Legs A, today), Szo (Volleyball · meccs, sport) and Vas (Rest) protected.
  const { container } = renderWith({ period, protectedDates: [0, 1, 5, 6].map((i) => weekDateIso(i)), comeback: null })
  const rows = [...container.querySelectorAll('.tv-dayrest.is-km')]
  expect(rows.map((r) => r.querySelector('em')?.textContent)).toEqual([
    'Kímélő mód · Legs A kimarad',
    'Kímélő mód · Volleyball · meccs kimarad',
  ])
  for (const r of rows) expect([...r.querySelectorAll('use')].at(-1)?.getAttribute('href')).toBe('#t-digestion')
  expect(screen.getByText('pihenőnap')).toBeInTheDocument()
  // the past protected Monday keeps its own card (prototype `dayCard`: today onwards only)
  expect(screen.getByText('Push')).toBeInTheDocument()
})

test('no protected dates: the week is unchanged', () => {
  const { container } = renderWith({ period: null, protectedDates: [], comeback: null })
  expect(container.querySelector('.tv-dayrest.is-km')).toBeNull()
})
