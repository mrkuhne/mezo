import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { RECOVERY_QUERY_KEY } from '@/data/train/recoveryHooks'
import { mockOpen, recoveryEmpty } from '@/data/train/recoveryMock'
import type { RecoveryState } from '@/data/train/recoveryApi'
import { addDays, localDateString } from '@/shared/lib/dates'

const store = vi.hoisted(() => ({
  save: vi.fn(), pending: false, error: false, retry: vi.fn(),
  notes: [] as object[],
  slots: [{ time: '08:00', state: 'done', note: null, values: null }, { time: '12:00', state: 'now', note: null, values: null }],
  tick: new Date('2026-09-17T14:00:00'),
}))
vi.mock('@/data/hooks', () => ({
  useTodayScenario: () => ({ anchorMode: false }),
  useCheckins: () => ({ checkins: store.slots, saveCheckIn: store.save, isPending: store.pending, isError: store.error, refetch: store.retry }),
  useFuelDay: () => ({ fuel: { consumed: { kcal: 900 }, targets: { kcal: 2000 }, meals: [] }, isPending: false }),
  useJournalNotes: () => ({ data: store.notes, isPending: false }),
  useActivities: () => ({ data: [], isPending: false }),
  // NapzarasCard's own hooks (mezo-yjzhw.4): at the default 14:00 tick the card renders
  // nothing; the 20:30 test below opens its window. Today is an open, in-progress day with
  // the training done — `normalizeDayEvaluation` is the identity here, so this is the
  // normalized shape.
  useRitualDay: () => ({ data: { closed: false }, isPending: false }),
  useDayEvaluation: () => ({
    data: {
      date: '2026-09-17', state: 'in_progress', score: null, base: null, adjustment: null,
      narrative: [], highlights: [], context: [],
      dimensions: [
        { id: 'training', label: 'Edzés', weight: 0.2, score: 100, status: 'DONE', facts: [{ label: 'edzés', value: '1/1' }], note: null },
        { id: 'nutrition', label: 'Táplálkozás', weight: 0.3, score: 45, status: 'IN_PROGRESS', facts: [], note: null },
      ],
    },
    isPending: false,
  }),
  normalizeDayEvaluation: (raw: unknown) => raw,
}))
vi.mock('@/features/today/logic/useNeeds', () => ({ useNeeds: () => ({ states: [] }) }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({ useMinuteTick: () => store.tick }))
vi.mock('@/features/today/logic/useDayFace', () => ({ useDayFace: () => ({ face: 'nap' }) }))
vi.mock('@/features/today/components/NapPersonalInsight', () => ({ NapPersonalInsight: () => <div>Valódi megfigyelés</div> }))
vi.mock('@/features/today/components/NapFuelGraphic', () => ({ NapFuelGraphic: () => <div>Makrók</div> }))
vi.mock('@/features/today/sheets/CheckInSheet', () => ({ CheckInSheet: ({ slotIdx, onSave, onClose }: { slotIdx: number; onSave: (d: object) => void; onClose: () => void }) => <div role="dialog">slot:{slotIdx}<button onClick={() => { onSave({ state: 'done', note: 'Megérkeztem' }); onClose() }}>Mentés</button></div> }))
vi.mock('@/features/me/sheets/JournalSheet', () => ({ JournalSheet: () => <div role="dialog">Napló írása</div> }))
vi.mock('@/features/today/sheets/ActivityLogSheet', () => ({ ActivityLogSheet: () => <div role="dialog">Aktivitás rögzítése</div> }))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({ useVoiceInput: () => ({ state: 'idle', toggle: vi.fn() }) }))
// Kímélő mód (mezo-q4xt2.2): the slot reads the recovery state through the real hooks in mock
// mode — a fresh client per render, optionally seeded with an open period.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())
function setup(recovery?: RecoveryState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (recovery) client.setQueryData([...RECOVERY_QUERY_KEY, localDateString()], recovery)
  return render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={['/nap']}><Routes>
    <Route path="/nap" element={<NapHubPage />} />
    {['/nap/gyors', '/mezo/chat', '/nap/eletjel', '/nap/checkin'].map(path => <Route key={path} path={path} element={<div>destination:{path}</div>} />)}
  </Routes></MemoryRouter></ToastProvider></QueryClientProvider>)
}
it('opens the next check-in directly and saves to that slot', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: 'Check-in'  }))
  expect(screen.getByRole('dialog')).toHaveTextContent('slot:1')
  await userEvent.click(screen.getByText('Mentés'))
  expect(store.save).toHaveBeenCalledWith(1, expect.objectContaining({ state: 'done', note: 'Megérkeztem' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it.each([['Napló', 'Napló írása'], ['Aktivitás', 'Aktivitás rögzítése']])('opens %s capture directly', async (name, dialog) => {
  setup(); await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
  expect(screen.getByRole('dialog')).toHaveTextContent(dialog)
})
it.each([['Gyors logolás', '/nap/gyors'], ['Chat', '/mezo/chat'], ['Életjelek', '/nap/eletjel']])('routes %s to existing flow', async (name, path) => {
  setup(); await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
  expect(screen.getByText(`destination:${path}`)).toBeInTheDocument()
})
it('keeps completed check-ins reachable without overwriting one', async () => {
  const prev = store.slots; store.slots = prev.map(s => ({ ...s, state: 'done' }))
  setup(); await userEvent.click(screen.getByRole('button', { name: 'Check-in'  }))
  expect(screen.getByText('destination:/nap/checkin')).toBeInTheDocument(); store.slots = prev
})

it('waits for persisted slots before offering capture and exposes retry on read failure', async () => {
  store.pending = true
  const view = setup()
  expect(screen.getByRole('button', { name: 'Check-in'  })).toBeDisabled()
  view.unmount(); store.pending = false; store.error = true
  setup()
  expect(screen.getByRole('button', { name: 'Check-in'  })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Check-in újratöltése' }))
  expect(store.retry).toHaveBeenCalled(); store.error = false
})

it('the orbit nodes are bare Titanium 3D icons (call-site names for the ambiguous clay glyphs)', () => {
  const { container } = setup()
  const art = (label: string) => screen.getByRole('button', { name: label }).querySelector('use')?.getAttribute('href')
  expect(art('Check-in')).toBe('#t-checkin')
  expect(art('Gyors logolás')).toBe('#t-quick')
  expect(art('Napló')).toBe('#t-journal')
  expect(art('Aktivitás')).toBe('#t-steps')
  expect(art('Chat')).toBe('#t-chat')
  // the orbit is the frameless hero: no glass anywhere in it
  expect(container.querySelector('.nap-center-orbit .glass')).toBeNull()
  expect(container.querySelector('.nap-center-orbit')).not.toHaveClass('glass')
})
it('Mai pillanatok rows stay flat and carry a 3D icon per kind', async () => {
  store.notes = [{ id: 'n1', occurredOn: '2026-09-17', text: 'Jó nap', createdAt: '2026-09-17T09:00:00' }]
  const { container } = setup()
  const row = container.querySelector('.nap-center-timeline li button') as HTMLElement
  expect(row).toHaveAttribute('data-kind', 'journal')
  expect(row.querySelector('use')).toHaveAttribute('href', '#t-journal')
  expect(row).toHaveTextContent('Jó nap')
  expect(container.querySelector('.nap-center-timeline .glass')).toBeNull()
  store.notes = []
})

it('at 20:30 the evening napzárás card renders on the page with the day\'s chips', () => {
  store.tick = new Date('2026-09-17T20:30:00')
  try {
    setup()
    expect(screen.getByText('Tegyük le a napot.')).toBeInTheDocument()
    expect(screen.getByText('edzés 1/1')).toBeInTheDocument()
    expect(screen.getByText('1/6 terület kész')).toBeInTheDocument()
  } finally {
    store.tick = new Date('2026-09-17T14:00:00')
  }
})

describe('NapHubPage — Kérdezd a csapatot (mezo-u3712)', () => {
  test('a Nap alján a belépő a Diagnózis oldalra visz', () => {
    setup()
    const link = screen.getByRole('link', { name: /Kérdezd a csapatot/ })
    expect(link).toHaveAttribute('href', '/mezo/diagnozis')
    expect(link).toHaveClass('glass')
  })
})

describe('NapHubPage — kímélő mód (mezo-q4xt2.2)', () => {
  const open = () => mockOpen(recoveryEmpty, { category: 'ILLNESS', estimate: 'FEW_DAYS', startDate: addDays(localDateString(), -1) })

  test('no period: the „Nem vagyok jól" pill under the heading → Mi történt? → Beteg vagyok → 2–3 nap → the Hogy vagy? card', async () => {
    const { container } = setup()
    const pill = screen.getByRole('button', { name: 'Nem vagyok jól' })
    // it sits between the heading and the orbit
    const hub = container.querySelector('.nap-center')!
    const order = [...hub.children].map((c) => c.className)
    expect(order.findIndex((c) => c.includes('nap-kmentry'))).toBe(order.findIndex((c) => c.includes('nap-center-heading')) + 1)
    await userEvent.click(pill)
    await userEvent.click(await screen.findByRole('button', { name: 'Beteg vagyok' }))
    await userEvent.click(screen.getByRole('button', { name: '2–3 nap' }))
    await userEvent.click(screen.getByRole('button', { name: 'Kímélő mód bekapcsolása' }))
    expect(await screen.findByText('Kímélő mód bekapcsolva')).toBeInTheDocument()
    expect(await screen.findByText('Hogy vagy?')).toBeInTheDocument()
    expect(document.querySelector('.nap-kmtop small')?.textContent?.replace(/\s+/g, ' ')).toBe('Kímélő mód · 1. nap · becslés: 2–3 nap')
    expect(screen.queryByRole('button', { name: 'Nem vagyok jól' })).not.toBeInTheDocument()
  })

  test('an open period: the card sits above the evening napzárás card, whose gym chip reads „edzés · kímélő mód"', () => {
    store.tick = new Date('2026-09-17T20:30:00')
    try {
      const { container } = setup(open())
      const card = container.querySelector('.nap-kmcard')!
      const zcard = container.querySelector('.nap-zcard')!
      expect(card.compareDocumentPosition(zcard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(screen.getByText('edzés · kímélő mód')).toBeInTheDocument()
      expect(screen.queryByText('edzés 1/1')).not.toBeInTheDocument()
    } finally {
      store.tick = new Date('2026-09-17T14:00:00')
    }
  })
})
