import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NapHubPage } from '@/features/today/pages/NapHubPage'

const store = vi.hoisted(() => ({
  save: vi.fn(), pending: false, error: false, retry: vi.fn(),
  notes: [] as object[],
  slots: [{ time: '08:00', state: 'done', note: null, values: null }, { time: '12:00', state: 'now', note: null, values: null }],
}))
vi.mock('@/data/hooks', () => ({
  useTodayScenario: () => ({ anchorMode: false }),
  useCheckins: () => ({ checkins: store.slots, saveCheckIn: store.save, isPending: store.pending, isError: store.error, refetch: store.retry }),
  useFuelDay: () => ({ fuel: { consumed: { kcal: 900 }, targets: { kcal: 2000 }, meals: [] }, isPending: false }),
  useJournalNotes: () => ({ data: store.notes, isPending: false }),
  useActivities: () => ({ data: [], isPending: false }),
  // NapzarasCard's own hooks (mezo-yjzhw.4): the mocked 14:00 tick below is outside the
  // evening window, so the card renders nothing here regardless of these values — kept
  // trivially "not closed" so a future window change doesn't crash this suite.
  useRitualDay: () => ({ data: { closed: false }, isPending: false }),
  useDayEvaluation: () => ({ data: undefined, isPending: true }),
  normalizeDayEvaluation: (raw: unknown) => raw,
}))
vi.mock('@/features/today/logic/useNeeds', () => ({ useNeeds: () => ({ states: [] }) }))
vi.mock('@/features/today/logic/useMinuteTick', () => ({ useMinuteTick: () => new Date('2026-09-17T14:00:00') }))
vi.mock('@/features/today/logic/useDayFace', () => ({ useDayFace: () => ({ face: 'nap' }) }))
vi.mock('@/features/today/components/NapPersonalInsight', () => ({ NapPersonalInsight: () => <div>Valódi megfigyelés</div> }))
vi.mock('@/features/today/components/NapFuelGraphic', () => ({ NapFuelGraphic: () => <div>Makrók</div> }))
vi.mock('@/features/today/sheets/CheckInSheet', () => ({ CheckInSheet: ({ slotIdx, onSave, onClose }: { slotIdx: number; onSave: (d: object) => void; onClose: () => void }) => <div role="dialog">slot:{slotIdx}<button onClick={() => { onSave({ state: 'done', note: 'Megérkeztem' }); onClose() }}>Mentés</button></div> }))
vi.mock('@/features/me/sheets/JournalSheet', () => ({ JournalSheet: () => <div role="dialog">Napló írása</div> }))
vi.mock('@/features/today/sheets/ActivityLogSheet', () => ({ ActivityLogSheet: () => <div role="dialog">Aktivitás rögzítése</div> }))
vi.mock('@/features/insights/logic/useVoiceInput', () => ({ useVoiceInput: () => ({ state: 'idle', toggle: vi.fn() }) }))
function setup() {
  return render(<MemoryRouter initialEntries={['/nap']}><Routes>
    <Route path="/nap" element={<NapHubPage />} />
    {['/nap/gyors', '/mezo/chat', '/nap/eletjel', '/nap/checkin'].map(path => <Route key={path} path={path} element={<div>destination:{path}</div>} />)}
  </Routes></MemoryRouter>)
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
