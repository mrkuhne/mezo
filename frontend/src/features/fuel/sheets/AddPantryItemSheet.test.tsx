import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AddPantryItemSheet } from '@/features/fuel/sheets/AddPantryItemSheet'
import { usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

describe('AddPantryItemSheet', () => {
  it('submits a food item: appends to the shared pantry cache, then closes', async () => {
    // ONE shared QueryClient so the sheet's mutation (setQueryData on ['pantry'])
    // is visible to a co-rendered usePantry() read — assert a REAL effect, not
    // just that onClose fired.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const onClose = vi.fn()
    const NEW_NAME = 'Brokkoli-add-sheet-teszt'

    const { result } = renderHook(() => usePantry(), { wrapper })
    const before = result.current.ingredients.length
    expect(result.current.ingredients.some(i => i.name === NEW_NAME)).toBe(false)

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={onClose} />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText(/név/i), { target: { value: NEW_NAME } })
    fireEvent.change(screen.getByLabelText(/kcal/i), { target: { value: '34' } })
    fireEvent.click(screen.getByRole('button', { name: /polcra|mentés/i }))

    // The new ingredient actually landed in the cache that usePantry reads.
    await waitFor(() => {
      expect(result.current.ingredients.length).toBe(before + 1)
    })
    const added = result.current.ingredients.find(i => i.name === NEW_NAME)
    expect(added).toBeDefined()
    expect(added?.macros.kcal).toBe(34)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render when closed', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open={false} onClose={vi.fn()} />
      </QueryClientProvider>,
    )
    expect(screen.queryByLabelText(/név/i)).not.toBeInTheDocument()
  })

  it('edit mode prefills name and saves via updateItem', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const onClose = vi.fn()
    const { result } = renderHook(() => usePantry(), { wrapper })
    const target = result.current.ingredients[0]
    const EDITED = 'Átnevezett-tétel-teszt'

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet open onClose={onClose} editId={target.id} initial={{ kind: 'food', name: target.name }} />
      </QueryClientProvider>,
    )
    expect((screen.getByLabelText(/név/i) as HTMLInputElement).value).toBe(target.name)
    fireEvent.change(screen.getByLabelText(/név/i), { target: { value: EDITED } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => {
      expect(result.current.ingredients.find(i => i.id === target.id)?.name).toBe(EDITED)
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('edit mode: a supplement ADAG (per) change round-trips to the stash', async () => {
    // Repro of the reported "25g→100g reverts" bug: editing a supplement's ADAG must
    // persist to the stash item's `per` through updateItem.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const onClose = vi.fn()
    const { result } = renderHook(() => usePantry(), { wrapper })
    const target = result.current.stash[0]

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet
          open
          onClose={onClose}
          editId={target.id}
          initial={{ kind: 'supplement', name: target.name, per: 25, unit: 'g' }}
        />
      </QueryClientProvider>,
    )
    const perInput = screen.getByPlaceholderText('100') as HTMLInputElement
    expect(perInput.value).toBe('25')
    fireEvent.change(perInput, { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => {
      expect(result.current.stash.find(s => s.id === target.id)?.per).toBe(100)
    })
  })

  it('edit mode saves changed extended-nutrition + price fields via updateItem', async () => {
    // The expanded editor edits EVERY value — assert a non-macro field (Rost) and
    // price actually land in the cache through updateItem.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    const onClose = vi.fn()
    const { result } = renderHook(() => usePantry(), { wrapper })
    const target = result.current.ingredients[0]

    render(
      <QueryClientProvider client={qc}>
        <AddPantryItemSheet
          open
          onClose={onClose}
          editId={target.id}
          initial={{ kind: 'food', name: target.name, kcal: target.macros.kcal }}
        />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText(/^rost$/i), { target: { value: '4.5' } })
    fireEvent.change(screen.getByLabelText(/ár \(ft\)/i), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: /mentés/i }))

    await waitFor(() => {
      const edited = result.current.ingredients.find(i => i.id === target.id)
      expect(edited?.fiberG).toBe(4.5)
      expect(edited?.price).toBe(999)
    })
    expect(onClose).toHaveBeenCalled()
  })
})
