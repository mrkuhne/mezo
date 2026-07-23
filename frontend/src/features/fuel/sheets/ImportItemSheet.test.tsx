import type { ReactNode } from 'react'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PantryImportInput, PantryScrapeDraft } from '@/data/types'
import { MOCK_SCRAPE_DRAFT, MOCK_PHOTO_DRAFT } from '@/data/fuel/pantry'

// Link/Fotó-mode override idiom (mirrors FuelMaiPage.logMeal.test): every hook the sheet pulls
// from @/data/hooks stays real (mock mode) via the importOriginal spread; only scrapeItem /
// photoExtract / importItem are swapped when their `hoisted` slot is set — so they're inert for
// the OFF-search tests and the Link/Fotó happy-path tests below (which exercise the real canned
// fixtures), and drive the needsReview / rejection / null-draft branches and the origin-marker
// assertion that the canned fixtures can't reach on their own.
const hoisted = vi.hoisted(() => ({
  scrape: null as null | ((url: string) => Promise<PantryScrapeDraft | null>),
  photo: null as null | ((p: File, p2?: File) => Promise<PantryScrapeDraft | null>),
  importItem: null as null | ((input: PantryImportInput) => Promise<void>),
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    usePantryActions: () => {
      const real = actual.usePantryActions()
      return {
        ...real,
        ...(hoisted.scrape ? { scrapeItem: hoisted.scrape } : {}),
        ...(hoisted.photo ? { photoExtract: hoisted.photo } : {}),
        ...(hoisted.importItem ? { importItem: hoisted.importItem } : {}),
      }
    },
  }
})

import { ImportItemSheet } from '@/features/fuel/sheets/ImportItemSheet'

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => {
  hoisted.scrape = null
  hoisted.photo = null
  hoisted.importItem = null
  vi.unstubAllEnvs()
})

test('input phase has the search field and the inert quick-import chips', () => {
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })
  expect(screen.getByText('Új tétel a Kamrába')).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/skyr/)).toBeInTheDocument()
  expect(screen.getByText('HAMAROSAN · gyors-import')).toBeInTheDocument()
  // Címke fotó chip is gone (mezo-d8tr): photo import graduated to its own Fotó mode.
  expect(screen.queryByRole('button', { name: /Címke fotó/ })).not.toBeInTheDocument()
  // Remaining quick-import affordances stay inert (P8+): disabled, no handler.
  expect(screen.getByRole('button', { name: /Vonalkód-szkenner/ })).toBeDisabled()
})

test('search runs the mock OFF lookup and lands on the preview with a confirmable draft', async () => {
  // fireEvent (not userEvent) on purpose: userEvent v14 deadlocks under fake timers.
  vi.useFakeTimers()
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.change(screen.getByPlaceholderText(/skyr/), { target: { value: 'joghurt' } })
  // Exact name: the Link-mode toggle button reads 'Keresés (OFF)', so /Keresés/ is now ambiguous.
  fireEvent.click(screen.getByRole('button', { name: 'Keresés' }))
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
  fireEvent.click(screen.getByRole('button', { name: 'Keresés' }))
  await act(async () => { vi.advanceTimersByTime(800) })
  vi.useRealTimers()

  fireEvent.click(screen.getByRole('button', { name: /Polcra/ }))
  await waitFor(() => expect(onClose).toHaveBeenCalled())
})

// ---- Link mode (URL scrape wizard, mezo-8vum) ---------------------------------------------

const MYPROTEIN_URL = 'https://www.myprotein.hu/p/impact-whey/10530943/'

test('toggling to Link mode shows the URL input and the Beolvasás CTA', () => {
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.click(screen.getByRole('button', { name: 'Link' }))

  expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByPlaceholderText(/https/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Beolvasás/ })).toBeInTheDocument()
})

test('Beolvasás scrapes the URL and previews the mock draft with a myprotein.hu source badge', async () => {
  vi.useFakeTimers()
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.click(screen.getByRole('button', { name: 'Link' }))
  fireEvent.change(screen.getByPlaceholderText(/https/), { target: { value: MYPROTEIN_URL } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))

  await act(async () => { vi.advanceTimersByTime(700) }) // mock scrape demo delay (600ms)
  vi.useRealTimers()

  // Canned MOCK_SCRAPE_DRAFT lands as the editable draft; source badge shows the derived vendor.
  expect(screen.getByLabelText('Tétel neve')).toHaveValue('Impact Whey Protein · vanília')
  expect(screen.getByText('myprotein.hu')).toBeInTheDocument()
})

test('a needsReview draft renders the AI-uncertainty warning line', async () => {
  hoisted.scrape = () => Promise.resolve({ ...MOCK_SCRAPE_DRAFT, needsReview: true })
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.click(screen.getByRole('button', { name: 'Link' }))
  fireEvent.change(screen.getByPlaceholderText(/https/), { target: { value: MYPROTEIN_URL } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))

  expect(await screen.findByText(/Az AI nem teljesen biztos a számokban/)).toBeInTheDocument()
})

test('a scrape rejection shows the fetch-error copy and returns to the input phase', async () => {
  hoisted.scrape = () => Promise.reject(new Error('network'))
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.click(screen.getByRole('button', { name: 'Link' }))
  fireEvent.change(screen.getByPlaceholderText(/https/), { target: { value: 'https://www.myprotein.hu/p/x' } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))

  expect(await screen.findByText(/Az oldal beolvasása nem sikerült/)).toBeInTheDocument()
  // back to input: the URL field is on screen again
  expect(screen.getByPlaceholderText(/https/)).toBeInTheDocument()
})

test('a null draft (no nutrition on the page) renders the empty state', async () => {
  hoisted.scrape = () => Promise.resolve(null)
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.click(screen.getByRole('button', { name: 'Link' }))
  fireEvent.change(screen.getByPlaceholderText(/https/), { target: { value: 'https://unknown.example/x' } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))

  expect(await screen.findByText(/nem találtam tápértéket/)).toBeInTheDocument()
})

// ---- Fotó mode (label-photo AI extraction, mezo-d8tr) -------------------------------------

test('photo mode: selecting a label photo enables Beolvasás and lands on the shared preview', async () => {
  vi.useFakeTimers()
  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })

  fireEvent.click(screen.getByRole('button', { name: 'Fotó' }))
  expect(screen.getByRole('button', { name: /Beolvasás/ })).toBeDisabled()

  const file = new File(['x'], 'label.jpg', { type: 'image/jpeg' })
  fireEvent.change(screen.getByLabelText('Címke fotó'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))

  await act(async () => { vi.advanceTimersByTime(700) }) // mock photoExtract demo delay
  expect(screen.getByDisplayValue('Skyr · epres')).toBeInTheDocument() // MOCK_PHOTO_DRAFT preview
  vi.useRealTimers()
})

test('photo mode: confirm passes the origin marker to importItem', async () => {
  vi.useFakeTimers()
  const importSpy = vi.fn().mockResolvedValue(undefined)
  hoisted.photo = () => Promise.resolve(MOCK_PHOTO_DRAFT)
  hoisted.importItem = importSpy

  render(<ImportItemSheet onClose={() => {}} />, { wrapper: wrapper() })
  fireEvent.click(screen.getByRole('button', { name: 'Fotó' }))
  fireEvent.change(screen.getByLabelText('Címke fotó'),
    { target: { files: [new File(['x'], 'label.jpg', { type: 'image/jpeg' })] } })
  fireEvent.click(screen.getByRole('button', { name: /Beolvasás/ }))
  await act(async () => { await vi.runAllTimersAsync() })

  fireEvent.click(screen.getByRole('button', { name: /Polcra/ }))
  await act(async () => { await vi.runAllTimersAsync() })

  expect(importSpy).toHaveBeenCalledWith(expect.objectContaining({ origin: 'photo', source: 'photo' }))
  vi.useRealTimers()
})
