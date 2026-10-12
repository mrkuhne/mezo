import type { ReactNode } from 'react'
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { KamraItemDetailPage, inputFromItem } from '@/features/fuel/pages/KamraItemDetailPage'
import { usePantry } from '@/data/hooks'
import { ingredients } from '@/data/fuel/pantry'
import { pantryWhen } from '@/features/fuel/logic/pantryProvenance'
import type { PantryItem } from '@/data/types'

// KamraItemDetailPage reads usePantry (a dual-mode TanStack query). Pin mock mode.
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

// Renders the detail page for `id` under a shared QueryClient so deleteItem and the
// read hook see the same ['pantry'] cache.
function renderDetail(id: string, qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/fuel/kamra/${id}`]}>
        <Routes>
          <Route path="/fuel/kamra/:id" element={<KamraItemDetailPage />} />
          <Route path="/fuel/kamra" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const newQc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

test('the back control goes to the Kamra (Folyadék: the frame draws it; without a frame the page draws its pill)', () => {
  // Inside the app frame the title bar draws back (history, fallback /fuel/kamra) and carries the item's name
  // as the title. Rendered alone, the page keeps its own „‹ Kamra" pill, named by where it goes.
  const { container } = renderDetail('ing-csirkemell', newQc())
  const back = screen.getByRole('button', { name: 'Vissza a Kamrába' })
  expect(back).toHaveTextContent('‹ Kamra')
  expect(back).toHaveClass('fo-backpill')
  expect(container.querySelector('.glass, .fmx-page, .fkx-detail')).toBeNull()
})

// Folyadék anatómia (mezo-n4wf5.5, prototípus `kamraItem()`): hős (márka · kcal / 100 g · ítélet-mondat ·
// „Mi van 100 grammban?") → Makrók (három fiola: a gramm a szám, a szint az energia-rész) → Minőség · 100 g (sorok).
test('renders a food item with the hero kcal, the verdict, the macro vials and the per-100 g quality rows', () => {
  // ing-csirkemell · Csirkemell · friss — macros 110/23/0/1.5, protein category.
  const { container } = renderDetail('ing-csirkemell', newQc())
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(within(hero).getByText('110')).toBeInTheDocument()            // kcal a hősben
  expect(within(hero).getByText('kcal / 100 g')).toBeInTheDocument()
  expect(hero).toHaveTextContent('23 g fehérje van 100 grammjában.')
  // a 100 g-os összetétel sávja: mindhárom makró megvan
  expect(within(hero).getByText('Mi van 100 grammban?')).toBeInTheDocument()
  expect(hero.querySelector('.fx-leg')).toHaveTextContent('Egyéb (víz, rost…)75,5 g')
  // a fiolák a tétel saját összetételét mondják
  const macros = screen.getByRole('heading', { name: /Makrók$/ }).nextElementSibling as HTMLElement
  expect(within(macros).getByText('23 g')).toBeInTheDocument() // fehérje
  expect(within(macros).getByText('87% energia')).toBeInTheDocument()
  expect(macros.querySelector('svg circle')).toBeNull() // nincs gyűrű: a mennyiség szint
  // a per-100 g minőség-sorok
  const quality = screen.getByRole('heading', { name: /Minőség · 100 g$/ }).nextElementSibling as HTMLElement
  expect(within(quality).getByText('Cukor')).toBeInTheDocument()
  expect(within(quality).getByText('Só')).toBeInTheDocument()
  expect(within(quality).getByText('Telített zsír')).toBeInTheDocument()
  expect(within(quality).getByText('Feldolgozottság')).toBeInTheDocument()
})

// A „Mi van 100 grammban?" sáv csak teljes makró-hármasnál rajzolható; a hiányzó makró „—" / „nincs adat".
test('a missing macro hides the 100 g bar and shows the honest dash on its vial', () => {
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [{ ...ingredients[0], id: 'part', macros: { kcal: 110, p: 23, c: 0, f: null } }],
    stash: [], imports: [], suggestions: [],
  })
  const { container } = renderDetail('part', qc)
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(within(hero).queryByText('Mi van 100 grammban?')).toBeNull()
  expect(hero).toHaveTextContent('Ehhez a tételhez csak részben van tápérték.')
  const macros = screen.getByRole('heading', { name: /Makrók$/ }).nextElementSibling as HTMLElement
  expect(within(macros).getByText('nincs adat')).toBeInTheDocument()
  expect(within(macros).getByText('—')).toBeInTheDocument()
})

// Tápérték nélküli étel (prototípus `kamra.lekvar`): „—", a saját mondata, se Makrók, se Minőség, se Logolás.
test('a food item without any macro says so and offers no log button', () => {
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [{ ...ingredients[0], id: 'bare', brand: null, category: null, macros: undefined }],
    stash: [], imports: [], suggestions: [],
  })
  const { container } = renderDetail('bare', qc)
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(hero).toHaveTextContent('Ehhez a tételhez még nincs tápérték.')
  expect(hero).toHaveTextContent('A forrás nem adott értéket. A Szerkesztésnél kézzel beírhatod.')
  expect(hero.querySelector('.fp-n')!.textContent).toBe('—kcal / 100 g')
  expect(screen.queryByRole('heading', { name: /Makrók$/ })).toBeNull()
  expect(screen.queryByRole('heading', { name: /Minőség/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /logolás/i })).toBeNull()
  expect(screen.getByText('nincs márka megadva')).toBeInTheDocument()
})

// B14 ellenpárja (mezo-hygp): az eltávolított import-feed helyett a per-tétel EREDET a
// részletlap forrás-kártyáján él — a felvétel MÓDJA és az IDŐPONTJA is.
test('a kamraelem részletlapja mutatja a forrást és az időt', () => {
  renderDetail('ing-csirkemell', newQc())
  const src = screen.getByRole('region', { name: /Forrás/i })
  expect(within(src).getByText(/fotó|link|katalógus|kézi/i)).toBeInTheDocument()
  expect(within(src).getByText(/^Így került a polcra: (fotó|link|katalógus|kézi)$/)).toBeInTheDocument()
  // a seed `scrapedAt`-je (ISO, ahogy a szerver küldi) a felvétel ideje — a lap a nyelv szerint írja ki, kitalált dátum nincs
  expect(ingredients[0].scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  expect(within(src).getByText(new RegExp(`· ${pantryWhen(ingredients[0].scrapedAt)!.replace(/\./g, '\\.')}$`))).toBeInTheDocument()
})

// A szerver ISO-időpontot küld (adat): a dátum és az óra itt készül, a nyelv szerint.
test('ISO scrapedAt is formatted on the client (month, day, time)', () => {
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [{ ...ingredients[0], id: 'iso', scrapedAt: '2026-05-20T09:14:00' }],
    stash: [], imports: [], suggestions: [],
  })
  renderDetail('iso', qc)
  const src = screen.getByRole('region', { name: /Forrás/i })
  expect(within(src).getByText(/· máj\. 20\. · 09:14$/)).toBeInTheDocument()
})

test('időpont nélküli tételnél a forrás-kártya megmondja, hogy nincs rögzítve', () => {
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [{ ...ingredients[0], id: 'no-when', scrapedAt: undefined }],
    stash: [], imports: [], suggestions: [],
  })
  renderDetail('no-when', qc)
  const src = screen.getByRole('region', { name: /Forrás/i })
  expect(within(src).getByText(/az időpont nincs rögzítve/)).toBeInTheDocument()
})

test('a nutrient the seed never recorded renders the honest dash, not a fabricated 0', () => {
  // ing-kreatin carries macros (all zero, real values) but no fiberG/sugarG/saltG/
  // saturatedFatG at all — every per-100 g Minőség row with a missing fact must show "—".
  renderDetail('ing-kreatin', newQc())
  const quality = screen.getByRole('heading', { name: /Minőség ·/ }).nextElementSibling as HTMLElement
  expect(within(quality).getAllByText('—').length).toBeGreaterThanOrEqual(3)
})

test('a missing id shows the not-found fallback', () => {
  // The title („Nincs ilyen tétel") lives in the frame; the page says what happened and offers the way back.
  renderDetail('does-not-exist', newQc())
  expect(screen.getByText(/Lehet, hogy közben levetted a polcról\./)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Vissza a Kamrába' }).length).toBeGreaterThanOrEqual(1)
})

test('Szerkesztés opens the edit drawer prefilled', async () => {
  renderDetail('ing-csirkemell', newQc())
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  // The editor opens with the item name prefilled.
  expect(await screen.findByText('Tétel szerkesztése')).toBeInTheDocument()
  expect((screen.getByLabelText(/név/i) as HTMLInputElement).value).toMatch(/Csirkemell/)
})

test('opens LogFlowPage pre-filled when "+ Logolás" is tapped', async () => {
  renderDetail('ing-csirkemell', newQc())
  fireEvent.click(await screen.findByRole('button', { name: 'Logolás · mai étkezésbe' }))
  expect(await screen.findByText('Mit ettél?')).toBeInTheDocument()
})

test('Törlés is two-tap (Kamra v2): the first press only arms confirmation, no delete yet', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(true))

  renderDetail('ing-csirkemell', qc)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))

  // Armed: the button re-labels itself as the prototype's re-arm copy, nothing deleted yet.
  expect(await screen.findByRole('button', { name: /Biztos\? Még egy érintés a törléshez/ })).toBeInTheDocument()
  expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(true)
  expect(screen.queryByTestId('location')).toBeNull()
})

test('Törlés deletes the food item (raw id) on the SECOND tap and navigates back to the list', async () => {
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(true))

  renderDetail('ing-csirkemell', qc)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
  await userEvent.click(screen.getByRole('button', { name: /Biztos\?/ }))

  // The food ingredient (raw id, no 'stash-' prefix) actually leaves the cache.
  await waitFor(() => expect(result.current.ingredients.some(i => i.id === 'ing-csirkemell')).toBe(false))
  // ...and the page navigated back to the list — live-updating the shared usePantry() cache
  // means the list's hero/stats/rows all reflect the deletion with no extra plumbing.
  expect(screen.getByTestId('location').textContent).toBe('/fuel/kamra')
})

test('Törlés on a stash supplement deletes via the unprefixed backend id (second tap)', async () => {
  // Regression cover for the 'stash-' prefix strip (mezo-9xu lineage): the stash card
  // id is 'stash-<id>' but deleteItem must hit '<id>'.
  const qc = newQc()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePantry(), { wrapper })
  const stashId = result.current.stash.find(s => !result.current.ingredients.some(i => i.stashRefId === s.id))!.id

  renderDetail(`stash-${stashId}`, qc)
  await userEvent.click(screen.getByRole('button', { name: 'Törlés' }))
  await userEvent.click(screen.getByRole('button', { name: /Biztos\?/ }))

  await waitFor(() => expect(result.current.stash.some(s => s.id === stashId)).toBe(false))
  expect(screen.getByTestId('location').textContent).toBe('/fuel/kamra')
})

test('a supplement in today\'s protocol shows the "a kiegészítőid között" cross-link and its time-slot sentence', () => {
  // Kreatin is both an Ingredient (stashRefId: 'kreatin') AND a stash-derived stack
  // occurrence anchored to the 'wake' zone — the chip must resolve via stashRefId,
  // not the displayed backend id (they differ for this dual-represented item).
  // „a stackben" → „a kiegészítőid között" (wording table, mezo-n4wf5.5); the hero says ONE sentence per time slot.
  const { container } = renderDetail('ing-kreatin', newQc())
  expect(screen.getByText(/^a kiegészítőid között · Ébredés \d{2}:\d{2}$/)).toBeInTheDocument()
  expect(container.querySelector('.fo-hero')).toHaveTextContent('Ébredés után szeded.')
  expect(container.textContent).not.toMatch(/stack|idején szeded/i)
})

test('"Receptekben" chips surface the real recipes that use this ingredient (audit gap #5)', () => {
  // ing-csirkemell is used by 'Csirke + édesburgonya + spenót' in the mock seed —
  // usedInRecipes is a bare count on the contract; this cross-references the live
  // Recipe.ingredients instead of trusting that stale counter.
  renderDetail('ing-csirkemell', newQc())
  expect(screen.getByText('Csirke + édesburgonya + spenót')).toBeInTheDocument()
})

test('a pantry item with no recipe references hides the "Receptekben" section entirely', () => {
  renderDetail('ing-kreatin', newQc())
  expect(screen.queryByText(/Receptekben/)).not.toBeInTheDocument()
})

test('a dose/protocol supplement with an always-present but all-null macros object hides "+ Logolás" (mezo-qooi)', () => {
  // Real-mode shape: PantryMapper.toSupplementResponse always builds a macros object now, so a
  // pure dose item (kreatin/D3/gyógyszer) arrives as { kcal: null, p: null, c: null, f: null } —
  // truthy, not absent. `{item.macros && ...}` would show the CTA on every such row; the gate
  // must check hasAnyMacro (all-null => no macro data => nothing to log).
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [],
    stash: [{
      id: 'dose-only', name: 'D3-vitamin', brand: 'Now Foods', type: 'supplement', category: 'supplement',
      dose: '2000 NE', form: 'kapszula', stock: null, stockUnit: null,
      protocol: 'napi 1x', timing: 'reggel', taken: false,
      macros: { kcal: null, p: null, c: null, f: null },
    }],
    imports: [], suggestions: [],
  })
  const { container } = renderDetail('stash-dose-only', qc)
  const hero = container.querySelector('.fo-hero') as HTMLElement
  expect(within(hero).getByText('2000 NE')).toBeInTheDocument() // the dose is the hero's numeral
  expect(hero).toHaveTextContent('Nincs időzítve.')
  expect(screen.queryByRole('button', { name: /logolás/i })).not.toBeInTheDocument()
  // no macro → the hero's primary button opens Supplements instead; no Makrók / Minőség blocks
  expect(within(hero).getByRole('button', { name: 'Kiegészítők megnyitása' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Makrók$/ })).toBeNull()
})

test('inputFromItem omits null macros instead of sending an explicit null (mezo-6omv)', () => {
  // The DTO cannot distinguish an omitted field from an explicit null — applyDefinitionPartial
  // reads "absent" as "leave unchanged", so a null macro sent back as `kcal: null` would blank a
  // shared definition every other user reads. Only the field-by-field `!= null` guard in
  // inputFromItem prevents that; a version that unconditionally spreads the macros object would
  // ship `proteinG: null` / `carbsG: null` and regress mezo-6omv silently.
  const item: PantryItem = {
    id: 'x', name: 'Partial Macros Item', brand: 'Acme', source: 'manual', category: 'food', kind: 'food',
    macros: { kcal: 120, p: null, c: null, f: 0 },
  }
  const input = inputFromItem(item)
  expect(input.kcal).toBe(120)
  expect(input.fatG).toBe(0) // a real recorded zero must survive, not be treated as "absent"
  expect(input).not.toHaveProperty('proteinG')
  expect(input).not.toHaveProperty('carbsG')
})

const baseItem: PantryItem = {
  id: 'x', name: 'Null Fields Item', brand: 'Acme', source: 'manual', category: 'food', kind: 'food',
  price: 500, priceUnit: '/db', pkg: '1kg',
}

test('inputFromItem omits the fields the definition does not carry (mezo-xaq5)', () => {
  // `category` used to be assigned unconditionally, so a null category put "" on the wire — not
  // a legal enum value. `pkg`/`priceUnit` carry the real 403 risk: definitionDiffers has no
  // null-normalization for them, so an echoed "" trips PANTRY_CATALOG_NOT_EDITABLE.
  const input = inputFromItem({ ...baseItem, brand: null, category: null, pkg: null, priceUnit: null, price: null })
  expect(input).not.toHaveProperty('brand')
  expect(input).not.toHaveProperty('category')
  expect(input).not.toHaveProperty('pkg')
  expect(input).not.toHaveProperty('priceUnit')
  expect(input).not.toHaveProperty('price')
})

test('inputFromItem keeps a genuinely zero price (mezo-xaq5)', () => {
  const input = inputFromItem({ ...baseItem, price: 0, priceUnit: '/db' })
  expect(input.price).toBe(0)
  expect(input.priceUnit).toBe('/db')
})

test('a shared-catalog item shows "közös · <author>" on its own line and locks the edit sheet\'s definition fields', async () => {
  const qc = newQc()
  qc.setQueryData(['pantry'], {
    ingredients: [{ ...ingredients[0], id: 'shared-1', catalogId: 'cat-skyr', sharedFrom: { authorName: 'Anna' }, catalogEditable: false }],
    stash: [], imports: [], suggestions: [],
  })
  renderDetail('shared-1', qc)
  expect(screen.getByText('közös · Anna')).toHaveClass('fp-shared')
  await userEvent.click(screen.getByRole('button', { name: /Szerkesztés/ }))
  expect(await screen.findByText('Tétel szerkesztése')).toBeInTheDocument()
  expect(screen.getByLabelText(/név/i)).toBeDisabled()
})
