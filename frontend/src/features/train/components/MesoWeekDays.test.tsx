import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MesoWeekDays } from '@/features/train/components/MesoWeekDays'
import { mesocycles } from '@/data/train/train'
import { RECOVERY_QUERY_KEY } from '@/data/train/queryKeys'
import type { RecoveryState } from '@/data/train/recoveryApi'
import { localDateString } from '@/shared/lib/dates'
import { weekDateIso } from '@/features/train/logic/weekAgenda'

// Kímélő mód S2 (mezo-q4xt2.2; Folyadék F3 prototype vilagos/edzes.js `dayCard`): the Terv week list mutes
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
  const rows = [...container.querySelectorAll('.ep-dc.quiet.km')]
  expect(rows.map((r) => r.querySelector('strong')?.textContent)).toEqual([
    'Kímélő mód · Legs A kimarad',
    'Kímélő mód · Volleyball · meccs kimarad',
  ])
  // today's protected row says so in its eyebrow (prototype `dayCard`: „{nap} · ma")
  expect(rows.map((r) => r.querySelector('small')?.textContent)).toEqual(['Kedd · ma', 'Szombat'])
  for (const r of rows) expect(r.querySelector('use')?.getAttribute('href')).toBe('#t-digestion')
  expect(screen.getByText('pihenőnap')).toBeInTheDocument()
  // the past protected Monday keeps its own row (prototype `dayCard`: today onwards only)
  expect(screen.getByRole('button', { name: /^Hétfő · Push/ })).toBeInTheDocument()
})

test('no protected dates: the week is unchanged', () => {
  const { container } = renderWith({ period: null, protectedDates: [], comeback: null })
  expect(container.querySelector('.ep-dc.km')).toBeNull()
})

// Owner decision 2026-10-10 (prototype `dayCard`): only TODAY is a full day card — body, three facts, muscle
// chips; every other training day is ONE row with the facts as a line.
test('only today is a full day card; every other training day is one row', () => {
  const { container } = renderWith({ period: null, protectedDates: [], comeback: null })
  const full = [...container.querySelectorAll('button.ep-dc.now')]
  expect(full).toHaveLength(1)
  expect(full[0]).toHaveAccessibleName('Kedd · Legs A · ma')
  expect(full[0].querySelector('.ex-body')).not.toBeNull()
  expect(full[0].querySelectorAll('.f3 i')).toHaveLength(3)
  expect(full[0].querySelectorAll('.chs > span').length).toBeGreaterThan(0)
  const rows = [...container.querySelectorAll('button.ep-dc.row')]
  expect(rows).toHaveLength(4) // Hét, Sze, Csü, Pén
  for (const r of rows) {
    expect(r.querySelector('.ex-body')).toBeNull()
    expect(r.querySelector('.f3')).toBeNull()
    expect(r.querySelector('em')?.textContent).toMatch(/^\d+ szett · ~\d+ perc · \d+ gyakorlat$/)
  }
})

// A plan that has not started has no „today": the planned face of the plan page draws every day as a „Jön" row.
test('an upcoming plan has no today card and no protected rows', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData([...RECOVERY_QUERY_KEY, localDateString()], { period, protectedDates: [1].map((i) => weekDateIso(i)), comeback: null })
  const { container } = render(
    <QueryClientProvider client={client}>
      <MesoWeekDays meso={meso} upcoming onOpenDay={() => {}} />
    </QueryClientProvider>,
  )
  expect(container.querySelector('.ep-dc.now')).toBeNull()
  expect(container.querySelector('.ep-dc.km')).toBeNull()
  expect(container.querySelectorAll('button.ep-dc.row')).toHaveLength(5)
  expect(screen.queryByText('Ma')).toBeNull()
})
