import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NapHubPage } from '@/features/today/pages/NapHubPage'

const store = vi.hoisted(() => ({
  save: vi.fn(), pending: false, error: false, retry: vi.fn(),
  slots: [{ time: '08:00', state: 'done', note: null, values: null }, { time: '12:00', state: 'now', note: null, values: null }],
}))
vi.mock('@/data/hooks', () => ({
  useTodayScenario: () => ({ anchorMode: false }),
  useCheckins: () => ({ checkins: store.slots, saveCheckIn: store.save, isPending: store.pending, isError: store.error, refetch: store.retry }),
  useFuelDay: () => ({ fuel: { consumed: { kcal: 900 }, targets: { kcal: 2000 }, meals: [] }, isPending: false }),
  useJournalNotes: () => ({ data: [], isPending: false }),
  useActivities: () => ({ data: [], isPending: false }),
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
  await userEvent.click(screen.getByRole('button', { name: 'Check-in', exact: true  }))
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
  setup(); await userEvent.click(screen.getByRole('button', { name: 'Check-in', exact: true  }))
  expect(screen.getByText('destination:/nap/checkin')).toBeInTheDocument(); store.slots = prev
})

it('waits for persisted slots before offering capture and exposes retry on read failure', async () => {
  store.pending = true
  const view = setup()
  expect(screen.getByRole('button', { name: 'Check-in', exact: true  })).toBeDisabled()
  view.unmount(); store.pending = false; store.error = true
  setup()
  expect(screen.getByRole('button', { name: 'Check-in', exact: true  })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Check-in újratöltése' }))
  expect(store.retry).toHaveBeenCalled(); store.error = false
})
