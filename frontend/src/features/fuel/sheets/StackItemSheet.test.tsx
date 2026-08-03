import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StackItemSheet } from '@/features/fuel/sheets/StackItemSheet'
import { useProtocol } from '@/data/fuel/stackHooks'
import type { StackDayEntry } from '@/features/fuel/logic/projectStackDay'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

/** A wrapper bound to ONE QueryClient so the sheet's mutations and a probe render of useProtocol()
 *  share the same cache — mirrors stackHooks.test.tsx's sharedWrapper(). */
function sharedWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, Wrapper }
}

function Probe({ onData }: { onData: (occ: ReturnType<typeof useProtocol>['occurrences']) => void }) {
  const { occurrences } = useProtocol()
  onData(occurrences)
  return null
}

const magnezEntry: StackDayEntry = {
  occurrenceId: 'occ-magnez',
  pantryItemId: 'magnez',
  persistedZone: 'evening',
  name: 'Magnézium-glicinát',
  dose: '300mg',
  pinned: false,
  placementSource: 'rule',
  reason: 'Magnézium este — GABA-moduláció, mélyalvás-támogatás.',
  dailyTotalHint: null,
  skippedToday: false,
  displacedToday: false,
  taken: false,
}

test('shows the auto-placement reason, no unpin button, when the occurrence is not pinned', () => {
  const { Wrapper } = sharedWrapper()
  render(<Wrapper><StackItemSheet entry={magnezEntry} onClose={() => {}} /></Wrapper>)
  expect(screen.getByText(magnezEntry.reason!)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Vissza autóra' })).not.toBeInTheDocument()
})

test('shows the pinned placement line + unpin button when the occurrence is pinned', () => {
  const { Wrapper } = sharedWrapper()
  const pinned: StackDayEntry = { ...magnezEntry, pinned: true, persistedZone: 'bedtime' }
  render(<Wrapper><StackItemSheet entry={pinned} onClose={() => {}} /></Wrapper>)
  expect(screen.getByText(/Ide raktad kézzel/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vissza autóra' })).toBeInTheDocument()
})

test('unpin calls unpinItem and closes the sheet', async () => {
  const { Wrapper } = sharedWrapper()
  const onClose = vi.fn()
  const pinned: StackDayEntry = { ...magnezEntry, pinned: true }
  render(<Wrapper><StackItemSheet entry={pinned} onClose={onClose} /></Wrapper>)
  await userEvent.click(screen.getByRole('button', { name: 'Vissza autóra' }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

test('tapping a zone chip calls moveItem with that zone and closes the sheet', async () => {
  const { qc, Wrapper } = sharedWrapper()
  let occ: ReturnType<typeof useProtocol>['occurrences'] = []
  const onClose = vi.fn()
  render(
    <Wrapper>
      <Probe onData={(o) => { occ = o }} />
      <StackItemSheet entry={magnezEntry} onClose={onClose} />
    </Wrapper>,
  )
  // 'Lefekvés' renders as a chip in BOTH the move-zone row and the "+ Még egy bevétel" add-zone
  // row — the FIRST one (DOM order) is the move-zone picker this test targets.
  await userEvent.click(screen.getAllByRole('button', { name: 'Lefekvés' })[0])
  await waitFor(() => expect(onClose).toHaveBeenCalled())
  await waitFor(() =>
    expect(occ.find(o => o.id === 'occ-magnez')).toMatchObject({ slotKey: 'bedtime', pinned: true, placementSource: 'user' }),
  )
  void qc // keep referenced for future cache assertions if needed
})

test('+ Még egy bevétel adds a second occurrence for the same pantry item', async () => {
  const { Wrapper } = sharedWrapper()
  let occ: ReturnType<typeof useProtocol>['occurrences'] = []
  render(
    <Wrapper>
      <Probe onData={(o) => { occ = o }} />
      <StackItemSheet entry={magnezEntry} onClose={() => {}} />
    </Wrapper>,
  )
  const before = occ.filter(o => o.pantryItemId === 'magnez').length
  await userEvent.click(screen.getByRole('button', { name: /Hozzáadás/ }))
  await waitFor(() =>
    expect(occ.filter(o => o.pantryItemId === 'magnez').length).toBe(before + 1),
  )
})

test('Eltávolítás a stackből calls removeAllFor and closes the sheet', async () => {
  const { Wrapper } = sharedWrapper()
  let occ: ReturnType<typeof useProtocol>['occurrences'] = []
  const onClose = vi.fn()
  render(
    <Wrapper>
      <Probe onData={(o) => { occ = o }} />
      <StackItemSheet entry={magnezEntry} onClose={onClose} />
    </Wrapper>,
  )
  await userEvent.click(screen.getByRole('button', { name: /Eltávolítás a stackből/ }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
  await waitFor(() => expect(occ.some(o => o.pantryItemId === 'magnez')).toBe(false))
})

test('renders the dailyTotalHint info line when set, omits it when null', () => {
  const { Wrapper } = sharedWrapper()
  const withHint: StackDayEntry = { ...magnezEntry, dailyTotalHint: 'ajánlott napi összmennyiség 300-400mg' }
  const { rerender } = render(<Wrapper><StackItemSheet entry={withHint} onClose={() => {}} /></Wrapper>)
  expect(screen.getByText('ajánlott napi összmennyiség 300-400mg')).toBeInTheDocument()
  rerender(<Wrapper><StackItemSheet entry={magnezEntry} onClose={() => {}} /></Wrapper>)
  expect(screen.queryByText('ajánlott napi összmennyiség 300-400mg')).not.toBeInTheDocument()
})
