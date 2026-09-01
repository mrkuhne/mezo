// Mezo · FuelLogNewPage — /fuel/log/uj, a logolás saját oldala (mezo-bq2t).
// A harness a FuelLogPage.test.tsx-ét követi: a planner a befagyasztott mock-seedből nem ad
// tetszőleges ablakokat, ezért a useFuelTimeline-t crafted planre cseréljük — az ablak-kulcsokat
// NEM hardcode-oljuk, hanem az app saját `${time}-${label}` szabályával képezzük a crafted
// slotokból (fuelSwimlane.tileKey). Minden MÁS hook valódi marad (mock mód) az importOriginal
// spreaddel; a VITE_USE_MOCK stub miatt a fájl valós módban is ugyanezt méri.
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import type { FuelPlanToday, FuelSlot } from '@/data/types'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString } from '@/shared/lib/dates'

const hoisted = vi.hoisted(() => ({ plan: null as FuelPlanToday | null }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useFuelTimeline: () =>
      hoisted.plan
        ? {
            plan: hoisted.plan,
            budget: { kcal: 2400, p: 180, c: 240, f: 73, energy: hoisted.plan.energy },
            blocks: [],
            weightKg: 82,
            energyBreakdown: null,
            wake: '06:45',
            bed: '23:00',
            nowHHmm: '13:30',
            getScoredMeal: () => null,
          }
        : actual.useFuelTimeline(),
  }
})

import { FuelLogNewPage } from '@/features/fuel/pages/FuelLogNewPage'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.plan = null
  vi.unstubAllEnvs()
})

const baseCtx = {
  workout: { type: '', start: '—', end: '—', duration: 0 },
  volleyball: { start: '—', end: '—', noneToday: true },
  bedtime: '23:00', kitchenClose: '21:30', caffeineCutoff: '14:00',
  energy: { base: 2400, activity: 0, balance: 0, target: 2400 },
}

// Az uzsonna-ablak, amire a deep linkek mutatnak. A kulcsot az app saját szabálya adja,
// nem egy találgatott string.
const UZSONNA: FuelSlot = {
  time: '16:30', kind: 'meal', label: 'Uzsonna', slotKey: 'snack', state: 'pending',
  kcal: 380, p: 26, c: 34, f: 15,
}
const keyOf = (s: FuelSlot) => `${s.time}-${s.label}`

let router: ReturnType<typeof createMemoryRouter>
const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>

function renderAt(entry: string) {
  router = createMemoryRouter(
    [
      { path: '/fuel/log/uj', element: <FuelLogNewPage /> },
      { path: '/fuel/log', element: <div>LOG PAGE PROBE</div> },
    ],
    { initialEntries: [entry] },
  )
  return render(<RouterProvider router={router} />, { wrapper })
}
const currentPath = () => router.state.location.pathname + router.state.location.search

test('az ablak-kulcsból fejlécet és rögzített slotot old fel', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt(`/fuel/log/uj?w=${encodeURIComponent(keyOf(UZSONNA))}`)
  expect(await screen.findByText('Uzsonna')).toBeInTheDocument()
  expect(screen.getByText('16:30 · ablak')).toBeInTheDocument()
  expect(screen.getByText('Logolás')).toBeInTheDocument()
  // fixedSlot → nincs MIKOR szegmens
  expect(screen.queryByRole('button', { name: 'Reggeli' })).not.toBeInTheDocument()
})

test('ismeretlen ablak-kulcsnál ablakon kívüli módra esik vissza', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt('/fuel/log/uj?w=99:99-Nincs')
  expect(await screen.findByText('Ablakon kívül')).toBeInTheDocument()
  expect(screen.getByText('szabad tétel · te választod a mikort')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})

test('hiányzó w-nél is ablakon kívüli mód, sosem fabrikál ablakot', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt('/fuel/log/uj')
  expect(await screen.findByText('Ablakon kívül')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reggeli' })).toBeInTheDocument()
})

test('múltbeli napon Pótlás-hangulatot és a nap-figyelmeztetést mutatja', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  const y = addDays(localDateString(), -1)
  renderAt(`/fuel/log/uj?d=${y}`)
  expect(await screen.findByText('Pótlás')).toBeInTheDocument()
  expect(screen.getByText(/napra könyvelődik/)).toBeInTheDocument()
})

test('jövőbeli d-t mára clampel', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt(`/fuel/log/uj?d=${addDays(localDateString(), 3)}`)
  expect(await screen.findByText('Logolás')).toBeInTheDocument()
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
})

test('értelmezhetetlen d-t mára clampel', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt('/fuel/log/uj?d=nem-datum')
  expect(await screen.findByText('Logolás')).toBeInTheDocument()
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
})

test('MAX_BACK-en túli múltbeli d-t mára clampel', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt('/fuel/log/uj?d=2020-01-01')
  expect(await screen.findByText('Logolás')).toBeInTheDocument()
  expect(screen.queryByText('Pótlás')).not.toBeInTheDocument()
})

test('ai=1 nyitott AI panellel indul', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt('/fuel/log/uj?ai=1')
  expect(await screen.findByLabelText('Mit ettél?')).toBeInTheDocument()
})

test('Mégse a listára visz vissza ugyanarra a napra', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  const y = addDays(localDateString(), -1)
  renderAt(`/fuel/log/uj?d=${y}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Mégse' }))
  expect(currentPath()).toBe(`/fuel/log?d=${y}`)
  expect(screen.getByText('LOG PAGE PROBE')).toBeInTheDocument()
})

test('Mégse mai napon a lista alap-URL-jére visz', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt('/fuel/log/uj')
  await userEvent.click(await screen.findByRole('button', { name: 'Mégse' }))
  expect(currentPath()).toBe('/fuel/log')
})

test('a ‹ Vissza fejléc-gomb is a listára visz', async () => {
  hoisted.plan = { ...baseCtx, slots: [UZSONNA] }
  renderAt('/fuel/log/uj')
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(currentPath()).toBe('/fuel/log')
})
