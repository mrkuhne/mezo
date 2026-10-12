import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { RecipeWorkshopPage } from '@/features/fuel/pages/RecipeWorkshopPage'
import { mockWorkshopTurn } from '@/data/fuel/workshopMock'

// The turn hook is the page's ONE side-effecting dependency; stubbing it here keeps the
// 600 ms demo delay out of the suite and lets the failure path be driven deterministically.
// Everything else (pantry, recipes) runs on the ordinary mock-mode cache.
const { turnImpl, createSpy, updateSpy } = vi.hoisted(() => ({
  turnImpl: vi.fn(), createSpy: vi.fn(), updateSpy: vi.fn(),
}))
vi.mock('@/data/fuel/workshopHooks', () => ({ useWorkshop: () => ({ workshopTurn: turnImpl }) }))
// The write path is spied so a save can be asserted field-by-field (the cache mutators would
// only show the ENRICHED recipe); everything else in recipeHooks stays real.
vi.mock('@/data/fuel/recipeHooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/data/fuel/recipeHooks')>()
  return { ...actual, useRecipeActions: () => ({ create: createSpy, update: updateSpy, remove: vi.fn() }) }
})

// Logolt étkezésből recept (mezo-n9wgg): a `?fromMeal` seed a nap étkezéseit ugyanúgy oldja fel,
// mint a részletező lap — `useFuelDay` itt egy valódi alakú napot ad.
const { FROM_MEAL_DAY } = vi.hoisted(() => {
  const base = { score: null, kcal: 0, p: 0, c: 0, f: 0, items: [], tags: [], loggedAt: '2026-09-24T12:00:00', mealDate: '2026-09-24' }
  const zabLine = { source: 'pantry', refId: 'ing-zab', amount: 60, unit: 'g', name: 'Zabpehely', contribution: { kcal: 223, p: 8, c: 36, f: 4 } }
  return {
    FROM_MEAL_DAY: {
      targets: { kcal: 2400, p: 180, c: 240, f: 72, water: 3000 },
      consumed: { kcal: 0, p: 0, c: 0, f: 0, water: 0 },
      pacing: { msg: '' }, micronutrients: [], supplements: [],
      meals: [
        { ...base, id: 'meal-mixed', slot: 'breakfast', title: 'Reggeli tál', mealItems: [
          zabLine,
          { source: 'estimate', refId: '', amount: 1, unit: 'adag', name: 'Házi lekvár', contribution: { kcal: 60, p: 0, c: 15, f: 0 } },
        ] },
        { ...base, id: 'meal-pantry', slot: 'lunch', title: 'Zabos tál', mealItems: [
          zabLine,
          { source: 'pantry', refId: 'ing-turo', amount: 150, unit: 'g', name: 'Túró', contribution: { kcal: 150, p: 25, c: 6, f: 3 } },
        ] },
      ],
    },
  }
})
vi.mock('@/data/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return { ...actual, useFuelDay: () => ({ fuel: FROM_MEAL_DAY, isPending: false, isError: false, refetch: () => {} }) }
})

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  turnImpl.mockReset()
  createSpy.mockReset()
  updateSpy.mockReset()
  turnImpl.mockImplementation(async (req: Parameters<typeof mockWorkshopTurn>[0]) => mockWorkshopTurn(req))
})
afterEach(() => vi.unstubAllEnvs())

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderPage(entry = '/fuel/recipes/muhely') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/fuel/recipes/muhely" element={<RecipeWorkshopPage />} />
          <Route path="/fuel/recipes" element={<LocationProbe />} />
          <Route path="/fuel/recipes/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function sendFirstTurn(text = 'Csirkés ebédet kérek') {
  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), text)
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await screen.findByDisplayValue('Citromos-joghurtos csirketál')
}

test('a turn renders the draft on the canvas — pantry rows + the BECSLÉS row — and the save gate holds', async () => {
  renderPage()
  await sendFirstTurn()

  // pantry line names land as rows, the AI line carries the MealComposer becslés tag
  expect(screen.getByText('Csirkemell · friss')).toBeInTheDocument()
  expect(screen.getByText('Citrom + fűszerek')).toBeInTheDocument()
  // the tag reads just „becslés" — and the estimate line HAS a kcal (its own estimate), it is not a dash
  expect(screen.getByText('becslés')).toBeInTheDocument()
  expect(screen.queryByText(/✨/)).toBeNull()
  const est = screen.getByText('Citrom + fűszerek').closest('.fx-ln') as HTMLElement
  expect(est.querySelector('.fx-lnk')).toHaveTextContent('15kcal')

  // …and while it is there, `draftToInput` returns null → the hero says why, save disabled
  expect(screen.getByText('Egy sor még becslés, addig nem menthető.')).toBeInTheDocument()
  expect(screen.getByText('Cseréld kamra-tételre vagy töröld a sort.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mentés a Receptek közé' })).toBeDisabled()
  // the canvas is the kit page: the hero with the pot, the dock a card of the page (no floating bar)
  expect(document.querySelector('.fo-page.fc-page > .fo-hero .fx-pot')).not.toBeNull()
  expect(document.querySelector('.fo-page.fc-page > .fo-card .fc-dock')).not.toBeNull()
  expect(document.querySelector('.wsh-bottom, .glass, .fmx-subhead')).toBeNull()
})

test('Csere swaps the estimate line for a pantry item — the gate opens and saving lands on the list', async () => {
  renderPage()
  await sendFirstTurn()

  await userEvent.click(screen.getByRole('button', { name: 'Csere kamra-tételre' }))
  expect(await screen.findByText('Kamra · csere a becsült sor helyett')).toBeInTheDocument()
  const pick = await screen.findAllByRole('button', { name: /hozzáadása$/ })
  await userEvent.click(pick[0])

  await waitFor(() => expect(screen.queryByText('becslés')).not.toBeInTheDocument())
  expect(screen.queryByText(/addig nem menthető/)).not.toBeInTheDocument()
  expect(screen.getByText('Menthető: minden sor a kamrádból jön.')).toBeInTheDocument()

  const save = screen.getByRole('button', { name: 'Mentés a Receptek közé' })
  expect(save).toBeEnabled()
  await userEvent.click(save)
  expect(await screen.findByTestId('location')).toHaveTextContent('/fuel/recipes')
})

test('a failed turn keeps the message and offers Újra / Szerkesztés (F7.5 bubble)', async () => {
  turnImpl.mockRejectedValue(new Error('boom'))
  renderPage()

  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Valami gyors vacsora')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))

  expect(await screen.findByText('A Műhely most nem elérhető. Az üzeneted megvan.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Szerkesztés' }))
  expect(screen.getByLabelText('Üzenet a Műhelynek')).toHaveValue('Valami gyors vacsora')
})

test('a preset chip sets the goal and sends its own instruction turn', async () => {
  renderPage()
  await sendFirstTurn()

  await userEvent.click(screen.getByRole('button', { name: 'Magas fehérje' }))
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(2))
  expect(turnImpl.mock.calls[1][0].goal).toBe('high_protein')
  // the goal rides on the canvas: the hero's label names it, and its pill is pressed
  expect(await screen.findByText('Vázlat · Magas fehérje')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Magas fehérje' })).toHaveAttribute('aria-pressed', 'true')
})

// M1 (mezo-uavr wipe class): a ?recipeId session that never touches a goal preset must save the
// SEED recipe's role — silently demoting a pre_workout template to `standard` is exactly the kind
// of quiet wipe the base-meta carry-through exists to prevent.
test('an untouched goal keeps the seeded recipe’s role (and the rest of its base meta) on save', async () => {
  renderPage('/fuel/recipes/muhely?recipeId=rec-1')
  // rec-1 seeds the canvas; a turn runs WITHOUT any preset tap
  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Tegyél bele több fehérjét')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(1))

  // a seeded draft is all pantry lines (recipeToDraft), so the save gate is already open
  await userEvent.click(screen.getByRole('button', { name: /Recept frissítése/ }))
  expect(updateSpy).toHaveBeenCalledTimes(1)
  expect(createSpy).not.toHaveBeenCalled()
  const [id, input] = updateSpy.mock.calls[0]
  expect(id).toBe('rec-1')
  expect(input.role).toBe('pre_workout')
  expect(input.slot).toBe('Reggeli')
  expect(input.tags).toEqual(['pre-workout', 'high-protein', 'slow-release'])
  expect(input.starred).toBe(true)
  expect(input.prepMins).toBe(5)
  expect(input.cookMins).toBe(3)
})

// M2: the retried payload must carry the failed message ONCE — as `message`, never also inside
// `history` (the trim is a state update the sending closure cannot see).
test('Újra re-sends the failed message without duplicating it into the history payload', async () => {
  turnImpl.mockRejectedValueOnce(new Error('boom'))
  turnImpl.mockImplementation(async (req: Parameters<typeof mockWorkshopTurn>[0]) => mockWorkshopTurn(req))
  renderPage()

  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Valami gyors vacsora')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await screen.findByText('A Műhely most nem elérhető. Az üzeneted megvan.')

  await userEvent.click(screen.getByRole('button', { name: 'Újra' }))
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(2))
  const payload = turnImpl.mock.calls[1][0]
  expect(payload.message).toBe('Valami gyors vacsora')
  expect(payload.history.filter((m: { text: string }) => m.text === 'Valami gyors vacsora')).toHaveLength(0)
})

// M3: the est rescale base is the amount the line ARRIVED with, so an empty field on the way
// through (select-all-retype) can never strand the row at 0 kcal.
test('an estimate amount cleared to 0 and retyped rescales from the original base, not from 0', async () => {
  renderPage()
  await sendFirstTurn()

  // the seed estimate line is 1 adag / 15 kcal
  const field = screen.getByLabelText('Citrom + fűszerek mennyisége')
  await userEvent.clear(field)
  await userEvent.type(field, '200')
  expect(screen.getByText('3 000')).toBeInTheDocument()

  await userEvent.clear(field)      // passes through amount 0 — est must survive untouched
  await userEvent.type(field, '300')
  expect(screen.getByText('4 500')).toBeInTheDocument()
})

// ── S4 (mezo-hygp): az ÉLŐ ELŐNÉZET. Owner-döntés: a Műhelyben előre látszik, milyen lesz a
// recept — UGYANAZOKKAL a blokkokkal, amiket a recept-részletlap (és az étkezés-részletlap)
// rajzol, mert különben nem ugyanazt kapod, amit ígértünk. ───────────────────────────────

test('a vázlat előnézete a recept-részletlap blokkjait mutatja', async () => {
  renderPage()
  await sendFirstTurn()
  // 1 Hozzávalók (the editable lines) → 2 Makrók és minőség (the shared blocks: vials, tiles, the four facts)
  // → 3 Elkészítés → 4 Kérj módosítást (the dock)
  for (const name of [/^1\s*Hozzávalók · \d+$/, /^2\s*Makrók és minőség$/, /^3\s*Elkészítés · \d+ lépés$/, /^4\s*Kérj módosítást$/]) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument()
  }
  expect(screen.getByRole('group', { name: 'A vázlat energiájának megoszlása' })).toBeInTheDocument()
  expect(screen.getByText('Alapanyag-arány')).toBeInTheDocument()
  expect(screen.getByText('Rost')).toBeInTheDocument()
})

// Őszinte-null: az AI NEM talál ki tápanyag-tényt — amire nincs kamra-sor, az „—".
test('kamra-tény nélküli sor nem ad számot a minőség-lapkáknak', async () => {
  renderPage()
  await sendFirstTurn()
  // a becsült sornak (Citrom + fűszerek) nincs NOVA-ja, ezért az Alapanyag-arány őszintén „—"
  const base = screen.getByText('Alapanyag-arány').parentElement as HTMLElement
  expect(within(base).getByText('—')).toBeInTheDocument()
  expect(within(base).getByText('nincs adat')).toBeInTheDocument()
  // …and the page says why the numbers are missing
  expect(screen.getByText(/A becsült sor nem ad minőség-tényt/)).toBeInTheDocument()
})

test('a mikrotápanyag-blokk csak a négy tárolt tényt viszi, vitamint nem', async () => {
  renderPage()
  await sendFirstTurn()
  const micro = screen.getByText('Rost').closest('section') as HTMLElement
  for (const label of ['Rost', 'Cukor', 'Só', 'Telített zsír']) {
    expect(within(micro).getByText(label)).toBeInTheDocument()
  }
  const rows = [...micro.querySelectorAll('.fo-row')]
  expect(rows).toHaveLength(4)
  expect(rows.some(row => /vitamin/i.test(row.textContent ?? ''))).toBe(false)
})

// B1 owner-DROP: link-alapú RECEPT-import nincs (a kamra URL-importja ettől független).
test('a Műhelyben nincs link-alapú recept-import', () => {
  const { container } = renderPage()
  expect(screen.queryByLabelText(/recept linkje/i)).toBeNull()
  expect(container.textContent).not.toMatch(/recept linkje|URL-ből/i)
})

// A cél-csempék a kiinduló vásznon állnak (a prototípus `wsx-goals`-a), és egy koppintás a
// saját utasítás-körét küldi el.
test('az üres vászon cél-csempéket ad, és egy csempe elindítja a saját körét', async () => {
  renderPage()
  expect(screen.getAllByRole('button', { name: /Magas fehérje/ }).length).toBeGreaterThan(0)
  await userEvent.click(screen.getAllByRole('button', { name: /Magas fehérje/ })[0])
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(1))
  expect(turnImpl.mock.calls[0][0].goal).toBe('high_protein')
})

// ── Logolt étkezésből recept (mezo-n9wgg) ──────────────────────────────────────────────────────

test('?fromMeal seeds the canvas from the logged meal — the estimate line holds the save gate', async () => {
  renderPage('/fuel/recipes/muhely?fromMeal=meal-mixed')
  expect(await screen.findByDisplayValue('Reggeli tál')).toBeInTheDocument()
  expect(screen.getByText('Házi lekvár')).toBeInTheDocument()
  expect(screen.getByText('becslés')).toBeInTheDocument()
  expect(screen.getByText('Vázlat · logolt étkezésből')).toBeInTheDocument()
  expect(screen.getByText('Egy sor még becslés, addig nem menthető.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mentés a Receptek közé' })).toBeDisabled()
})

test('an all-pantry logged meal saves as a NEW recipe (create, never update)', async () => {
  renderPage('/fuel/recipes/muhely?fromMeal=meal-pantry')
  await screen.findByDisplayValue('Zabos tál')
  expect(screen.getByText('Új receptként mentjük; a logolt étkezésed nem változik.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Mentés a Receptek közé' }))
  expect(updateSpy).not.toHaveBeenCalled()
  expect(createSpy).toHaveBeenCalledTimes(1)
  const [input] = createSpy.mock.calls[0]
  expect(input).toMatchObject({ name: 'Zabos tál', category: 'lunch', servings: 1 })
  expect(input.ingredients).toEqual([
    { pantryItemId: 'ing-zab', amount: 60, unit: 'g' },
    { pantryItemId: 'ing-turo', amount: 150, unit: 'g' },
  ])
  expect(await screen.findByTestId('location')).toHaveTextContent('/fuel/recipes')
})

test('an unknown ?fromMeal opens the empty workshop', () => {
  renderPage('/fuel/recipes/muhely?fromMeal=nope')
  expect(screen.queryByDisplayValue('Zabos tál')).toBeNull()
  expect(screen.getByLabelText('Üzenet a Műhelynek')).toBeInTheDocument()
  // the empty canvas: the empty pot, the opening question, how it works
  expect(screen.getByText('Mit főzzünk ki?')).toBeInTheDocument()
  expect(screen.getByText('Receptműhely · üres fazék')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /Így dolgozunk/ })).toBeInTheDocument()
})

// The dock's states (prototype `muhely.dolgozik`, `.kamrabol`, sheet `thread`).
test('busy says so and locks the goals; the last reply opens the conversation', async () => {
  let release: (() => void) | undefined
  turnImpl.mockImplementationOnce((req: Parameters<typeof mockWorkshopTurn>[0]) =>
    new Promise(resolve => { release = () => resolve(mockWorkshopTurn(req)) }))
  renderPage()
  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Csirkés ebédet kérek')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  expect(await screen.findByText('A Műhely dolgozik…')).toBeInTheDocument()
  expect(screen.getByText('Készül az első vázlat.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Magas fehérje' })).toBeDisabled()
  release?.()
  await screen.findByDisplayValue('Citromos-joghurtos csirketál')
  expect(screen.queryByText('A Műhely dolgozik…')).toBeNull()

  await userEvent.click(screen.getByRole('button', { name: /^A beszélgetés megnyitása/ }))
  const sheet = await screen.findByRole('dialog', { name: 'Amiről eddig beszéltünk' })
  expect(within(sheet).getByText('Műhely · beszélgetés')).toBeInTheDocument()
  expect(within(sheet).getByText('TE')).toBeInTheDocument()
  expect(within(sheet).getByText('MŰHELY')).toBeInTheDocument()
  expect(within(sheet).getByText('Csirkés ebédet kérek')).toBeInTheDocument()
})

test('a pantry item marked for the next round rides in the message, and can be left out again', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: 'Kamra' }))
  expect(await screen.findByText('Kamra · a következő körbe')).toBeInTheDocument()
  const adds = await screen.findAllByRole('button', { name: /hozzáadása$/ })
  const first = adds[0].getAttribute('aria-label')!.replace(/ hozzáadása$/, '')
  const second = adds[1].getAttribute('aria-label')!.replace(/ hozzáadása$/, '')
  await userEvent.click(adds[0])
  await userEvent.click(adds[1])
  await userEvent.click(screen.getByRole('button', { name: 'Kész' }))
  await userEvent.click(await screen.findByRole('button', { name: `${second} elvétele a következő körből` }))
  await userEvent.type(screen.getByLabelText('Üzenet a Műhelynek'), 'Ebből főzzünk')
  await userEvent.click(screen.getByRole('button', { name: 'Küldés' }))
  await waitFor(() => expect(turnImpl).toHaveBeenCalledTimes(1))
  expect(turnImpl.mock.calls[0][0].message).toBe(`Ebből főzzünk\n(Kamrából: ${first})`)
})
