import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { CatalogSearchSheet } from '@/features/fuel/sheets/CatalogSearchSheet'
import { usePantry } from '@/data/hooks'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

test('searches the shared catalog and puts a hit on the shelf', async () => {
  const qc = newQc()
  const onClose = vi.fn()
  render(<QueryClientProvider client={qc}><CatalogSearchSheet onClose={onClose} /></QueryClientProvider>)
  expect(screen.getByText('Hozzáadás a közösből')).toBeInTheDocument()

  await userEvent.type(screen.getByPlaceholderText('Keresés név vagy márka szerint'), 'skyr')
  await waitFor(() => expect(screen.getByText('Skyr natúr')).toBeInTheDocument())
  expect(screen.getByText(/Anna/)).toBeInTheDocument() // author chip on a user-authored row

  await userEvent.click(screen.getByRole('button', { name: /Polcra/ }))
  const { result } = renderHook(() => usePantry(), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(result.current.ingredients.some(i => i.catalogId === 'cat-skyr')).toBe(true))
  // the row now reads "a polcon" instead of offering Polcra again
  await waitFor(() => expect(screen.getByText('a polcon')).toBeInTheDocument())
})

test('kind chips narrow the search; the master row shows "mezo" instead of an author', async () => {
  render(<QueryClientProvider client={newQc()}><CatalogSearchSheet onClose={() => {}} /></QueryClientProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Supp' }))
  await waitFor(() => expect(screen.getByText('Creatine Monohydrate')).toBeInTheDocument())
  expect(screen.queryByText('Skyr natúr')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Étel' }))
  await userEvent.type(screen.getByPlaceholderText('Keresés név vagy márka szerint'), 'bulgur')
  await waitFor(() => expect(screen.getByText('Bulgur Raw Kifli')).toBeInTheDocument())
  expect(screen.getByText('mezo')).toBeInTheDocument()
})
