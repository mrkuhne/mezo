import type { ReactNode } from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('input phase has the search field and the inert quick-import chips', () => {
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })
  expect(screen.getByText('Új tétel a Kamrába')).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/skyr/)).toBeInTheDocument()
  expect(screen.getByText('HAMAROSAN · gyors-import')).toBeInTheDocument()
  // Scan affordances stay inert (P8+): disabled, no handler.
  expect(screen.getByRole('button', { name: /Címke fotó/ })).toBeDisabled()
})

test('search runs the mock OFF lookup and lands on the preview with a confirmable draft', async () => {
  // fireEvent (not userEvent) on purpose: userEvent v14 deadlocks under fake timers.
  vi.useFakeTimers()
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.change(screen.getByPlaceholderText(/skyr/), { target: { value: 'joghurt' } })
  fireEvent.click(screen.getByRole('button', { name: /Keresés/ }))
  expect(screen.getByText('Keresés')).toBeInTheDocument() // searching phase

  await act(async () => { vi.advanceTimersByTime(800) }) // mock lookup demo delay
  vi.useRealTimers()

  // Fixture results listed; the first is pre-picked into the editable draft.
  expect(screen.getByText('Görög joghurt 10%')).toBeInTheDocument()
  expect(screen.getByText('Skyr natúr')).toBeInTheDocument()
  expect(screen.getByLabelText('Tétel neve')).toHaveValue('Görög joghurt 10%')
  expect(screen.getByLabelText('Kategória')).toBeInTheDocument()
})

test('Polcra imports the picked draft and closes the sheet', async () => {
  vi.useFakeTimers()
  const onClose = vi.fn()
  render(<ImportItemSheet onClose={onClose} />, { wrapper: wrapper() })

  fireEvent.change(screen.getByPlaceholderText(/skyr/), { target: { value: 'skyr' } })
  fireEvent.click(screen.getByRole('button', { name: /Keresés/ }))
  await act(async () => { vi.advanceTimersByTime(800) })
  vi.useRealTimers()

  fireEvent.click(screen.getByRole('button', { name: /Polcra/ }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})
