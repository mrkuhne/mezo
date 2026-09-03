import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { AUTO_DELAY_MS, TutorialProvider, useTutorial } from '@/features/tutorial/TutorialProvider'
import { WELCOME_VERSION } from '@/features/tutorial/registry/welcome'
import { readLocalProgress, writeLocalProgress } from '@/shared/lib/tutorialSeen'
import { API_BASE } from '@/data/_client/api'
import { isMockMode } from '@/data/_client/mode'
import { server } from '@/test/msw/server'
import { QueryWrapper } from '@/test/queryWrapper'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

/** jsdom-ban nincs matchMedia — olyat teszünk be, ami `reduce`-ot mond (AUTO_DELAY_MS → 0). */
function stubReducedMotion() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
}

const resetHandle: { current: (() => Promise<void>) | null } = { current: null }

function Probe() {
  const t = useTutorial()
  resetHandle.current = t.resetAll
  const navigate = useNavigate()
  return (
    <div>
      <span data-testid="current">{t.current?.id ?? '-'}</span>
      <span data-testid="unseen">{String(t.isUnseen('fuel'))}</span>
      <button onClick={() => t.open('fuel')}>nyisd</button>
      <button onClick={() => navigate('/train')}>train</button>
      <button onClick={() => navigate('/fuel')}>fuel</button>
      <button onClick={() => navigate('/nap')}>nap</button>
      {/* /nap/rutin: T2 subpage, ebben a szeletben nincs saját kalauz-bejegyzése — a
          „kalauz nélküli route" fixture-je (Task 2 ugyanezt a route-ot választotta
          az AppHeader.test.tsx-ben, ugyanezért). */}
      <button onClick={() => navigate('/nap/rutin')}>elsewhere</button>
    </div>
  )
}

const renderAt = (path: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[path]}>
        <TutorialProvider>
          <Routes><Route path="*" element={<Probe />} /></Routes>
        </TutorialProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )

const renderAtStrict = (path: string) =>
  render(
    <StrictMode>
      <QueryWrapper>
        <MemoryRouter initialEntries={[path]}>
          <TutorialProvider>
            <Routes><Route path="*" element={<Probe />} /></Routes>
          </TutorialProvider>
        </MemoryRouter>
      </QueryWrapper>
    </StrictMode>,
  )

const flush = () => act(() => { vi.advanceTimersByTime(700) })

test('/fuel első belépésre a késleltetés után felugrik, és a megjelenéskor már látottnak számít', async () => {
  renderAt('/fuel')
  expect(screen.getByTestId('current')).toHaveTextContent('fuel')
  expect(screen.queryByRole('dialog')).toBeNull()
  flush()
  expect(await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
  expect(screen.getByTestId('unseen')).toHaveTextContent('false')
  expect(readLocalProgress().fuel?.version).toBe(1)
  expect(readLocalProgress().fuel?.completedAt).toBeNull()
})

test('StrictMode alatt (mount → cleanup → re-run) is felugrik hideg oldalbetöltésre', async () => {
  renderAtStrict('/fuel')
  expect(screen.getByTestId('current')).toHaveTextContent('fuel')
  flush()
  expect(await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})

test('Kihagyom → dismissedAtStep; nem ugrik fel újra ugyanabban a sessionben, sem route-visszatérésre', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await user.click(await screen.findByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  await act(async () => { vi.advanceTimersByTime(500) })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(readLocalProgress().fuel?.dismissedAtStep).toBe(1)
  await user.click(screen.getByRole('button', { name: 'train' }))
  await user.click(screen.getByRole('button', { name: 'fuel' }))
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('látott kalauz nem ugrik fel, de a „?" (open) bármikor nyit', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'nyisd' }))
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})

test('regi verzió látva → az új verzió újra felugrik', async () => {
  writeLocalProgress({ fuel: { version: 0, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/fuel')
  flush()
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
})

test('kalauz nélküli route-on nincs felugrás és current null', () => {
  renderAt('/nap/rutin')
  flush()
  expect(screen.getByTestId('current')).toHaveTextContent('-')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('a kapcsolat-chip navigál, a kalauz completedAt-tal zár', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: '5. kártya' }))
  await user.click(screen.getByRole('button', { name: /^Súly/ }))
  // A kapcsolat-chip most az animált close()-t hívja (a Sheet kilépő animációja után fut az
  // onClose) — a fallback-timer (EXIT_MS + 80ms) alatt kell várni, mielőtt a state leképeződik.
  await act(async () => { vi.advanceTimersByTime(400) })
  await waitFor(() => expect(readLocalProgress().fuel?.completedAt).not.toBeNull())
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByTestId('current')).toHaveTextContent('-') // /me/weight-en vagyunk
})

// mezo-gb1s.3 regresszió: reduced-motion alatt az auto-open késleltetése 0, a Sheet kilépő
// animációja viszont továbbra is 300 ms. A kapcsolat-chip előbb navigál, csak utána indítja az
// animált close()-t — így a cél-route auto-kalauza a MÉG KILÉPŐ sheetbe nyílt bele: a cél kapott
// seenAt-ot ÉS (a 300 ms-nál lefutó onClose-ból, ami az azóta átírt openIdRef-et olvasta)
// completedAt-ot, anélkül hogy megjelent volna — a forrás pedig sosem kapta meg a sajátját.
test('reduced motion + kalauzos route-ra mutató chip: a cél-kalauz nem záródik némán, a forrás kapja a completedAt-ot', async () => {
  stubReducedMotion()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })
  await user.click(screen.getByRole('button', { name: '5. kártya' }))
  await user.click(screen.getByRole('button', { name: /^Edzés/ })) // → /train, aminek VAN kalauza
  await act(async () => { vi.advanceTimersByTime(400) })
  const p = readLocalProgress()
  expect(p.train?.completedAt ?? null).toBeNull() // sosem jelent meg → nem lehet „végigolvasva"
  expect(p.fuel?.completedAt).not.toBeNull() // a forrás kalauz kapja a done-t
})

test('route-váltás nyitott, érintetlen kalauzon dismissedAtStep: 0-t ír', async () => {
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog')
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  // Kalauz nélküli route-ra megyünk (nem /train-re — annak Task 4 óta van saját
  // kalauza), hogy az assert ne csak a nyitás 700ms-es késleltetése miatt legyen zöld.
  await user.click(screen.getByRole('button', { name: 'elsewhere' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(readLocalProgress().fuel?.dismissedAtStep).toBe(0)
  expect(readLocalProgress().fuel?.completedAt).toBeNull()
})

test('szerver-merge: a szerveren látott másik kalauz beolvad, és a csak-lokális visszaíródik PUT-tal (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // ez a teszt kifejezetten a real-mode útvonalat (GET/PUT MSW-n át) vizsgálja
  if (isMockMode()) return // mock módban a QueryClient hordozza az állapotot, nincs külön szerver-oldal
  let putBody: unknown = null
  server.use(
    http.get(`${API_BASE}/api/tutorial/progress`, () =>
      HttpResponse.json({ progress: { nap: { version: 1, seenAt: '2026-08-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } } }),
    ),
    http.put(`${API_BASE}/api/tutorial/progress`, async ({ request }) => {
      putBody = await request.json()
      return HttpResponse.json({ progress: (putBody as { progress: unknown }).progress })
    }),
  )
  writeLocalProgress({ fuel: { version: 1, seenAt: '2026-09-01T10:00:00.000Z', completedAt: null, dismissedAtStep: null } })
  renderAt('/nap/rutin')
  flush()
  await waitFor(() => {
    const p = readLocalProgress()
    expect(p.nap).toBeDefined()
    expect(p.fuel).toBeDefined()
  })
  await waitFor(() => expect(putBody).not.toBeNull())
  expect((putBody as { progress: Record<string, unknown> }).progress).toHaveProperty('nap')
  expect((putBody as { progress: Record<string, unknown> }).progress).toHaveProperty('fuel')
  expect(screen.queryByRole('dialog')).toBeNull() // /nap/rutin-on nincs kalauz, és a fuel amúgy is látott
})

test('StrictMode alatt egy Kihagyom-zárás pontosan EGY PUT-ot küld (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // a setState-updaterek pure-sága ezt csak real módban lehet mérni: a PUT-ot a mock-mód QueryClient-je nyeli el
  if (isMockMode()) return
  let putCount = 0
  server.use(
    http.put(`${API_BASE}/api/tutorial/progress`, async ({ request }) => {
      putCount += 1
      const body = (await request.json()) as { progress: unknown }
      return HttpResponse.json({ progress: body.progress })
    }),
  )
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAtStrict('/fuel')
  flush()
  await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })
  await waitFor(() => expect(putCount).toBeGreaterThanOrEqual(1)) // az open() seenAt-PUT-ja
  putCount = 0
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  // Kihagyom → animált close(): a Sheet kilépő animációja (fallback: EXIT_MS + 80ms) után fut az
  // onClose, ami a `close` callbacket hívja — StrictMode ezt is duplán futtatná, ha nem lenne pure.
  await act(async () => { vi.advanceTimersByTime(400) })
  await waitFor(() => expect(readLocalProgress().fuel?.dismissedAtStep).toBe(0))
  expect(putCount).toBe(1)
})

test('PUT-hiba esetén a lokális írás (seenAt) marad az igazság, a sheet nem törik (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false') // ez a teszt kifejezetten a real-mode PUT-hiba útvonalat vizsgálja
  if (isMockMode()) return
  server.use(http.put(`${API_BASE}/api/tutorial/progress`, () => HttpResponse.json({}, { status: 500 })))
  renderAt('/fuel')
  flush()
  await screen.findByRole('dialog', { name: 'Kalauz · Fuel' })
  await waitFor(() => expect(readLocalProgress().fuel).toBeDefined())
  expect(readLocalProgress().fuel?.version).toBe(1)
  expect(screen.getByRole('dialog', { name: 'Kalauz · Fuel' })).toBeInTheDocument()
})

// ── T0 welcome (mezo-gb1s.4, S2b spec §4.2) ─────────────────────────────────────
// A sheet jelenlétét NEM a `Kalauz · <label>` szövegre kérdezzük: a KalauzSheet két elembe is
// kiírja (.mz-eyebrow és az .sr-only cím), tehát egy getByText(/^Kalauz · /) „multiple elements"
// hibát dobna. Az egyedi horgony a pötty-sáv aria-labelje: `Kártyák`.
const SEEN = '2026-08-30T10:00:00.000Z'
const welcomeSeen = () => ({ welcome: { version: WELCOME_VERSION, seenAt: SEEN, completedAt: SEEN, dismissedAtStep: null } })

test('a legelső /nap betöltéskor a welcome felugrik, és a /nap kalauza NEM', async () => {
  renderAt('/nap')
  expect(await screen.findByRole('dialog')).toHaveAccessibleName('Szia, Mezo vagyok.')
  // A /nap auto-open timere el sem indult (a route-effekt guardja), tehát 600 ms után sincs sheet.
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
})

test('„látva = megjelent": a welcome bejegyzés a megnyitás pillanatában íródik', async () => {
  renderAt('/nap')
  await screen.findByRole('dialog')
  await waitFor(() => expect(readLocalProgress().welcome?.seenAt).toEqual(expect.any(String)))
  expect(readLocalProgress().welcome?.version).toBe(WELCOME_VERSION)
  expect(readLocalProgress().welcome?.completedAt).toBeNull()
})

test('az Induljunk completedAt-ot ír, és utána NEM láncol a /nap kalauzába', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Induljunk' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(readLocalProgress().welcome?.completedAt).toEqual(expect.any(String)))
  // S2b-6: a route-effekt ugyanarra a pathname-re nem fut újra — a /nap kalauza most nem jön.
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
})

test('a Kihagyom dismissedAtStep-et ír, és a welcome nem jön vissza', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderAt('/nap')
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: 'Tovább' }))
  await user.click(screen.getByRole('button', { name: 'Kihagyom' }))
  await waitFor(() => expect(readLocalProgress().welcome?.dismissedAtStep).toBe(1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('látott welcome mellett a /nap kalauza normálisan felugrik', async () => {
  writeLocalProgress(welcomeSeen())
  renderAt('/nap')
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(await screen.findByLabelText('Kártyák')).toBeInTheDocument()
  expect(screen.queryByText('Szia, Mezo vagyok.')).not.toBeInTheDocument()
})

test('a függő welcome MÁS route kalauzát nem nyomja el', async () => {
  renderAt('/train')
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(await screen.findByLabelText('Kártyák')).toBeInTheDocument()
})

test('reduced-motion alatt is a welcome nyer a 0 ms-os /nap auto-open ellen', async () => {
  stubReducedMotion()
  renderAt('/nap')
  await act(async () => { vi.advanceTimersByTime(50) })
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Szia, Mezo vagyok.')
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
})

// A megnyitó effekt `persist`-et hív, a StrictMode pedig mount → cleanup → re-run sorrendben
// futtatja — a két futás KÖZÖTT nincs render, tehát sem a `welcomeStatus` state, sem a
// `progressRef` nem frissült. A state-re támaszkodó kapu így kétszer engedne át egy-egy külön
// `new Date()`-tel; a Provider eager ref-latche zárja ezt (a `close`/`openIdRef` mintája).
test('StrictMode alatt a welcome megnyitása pontosan EGY seenAt-írást ad', async () => {
  const written: string[] = []
  const orig = Storage.prototype.setItem
  Storage.prototype.setItem = function (key: string, value: string) {
    if (key.includes('kalauz') && value.includes('welcome')) written.push(JSON.parse(value).welcome.seenAt)
    return orig.call(this, key, value)
  }
  try {
    renderAtStrict('/nap')
    await screen.findByRole('dialog')
    await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
    expect(written).toHaveLength(1)
  } finally {
    Storage.prototype.setItem = orig
  }
})

// Új eszköz: üres localStorage, a szerver viszont MÁR tud a welcome-ról. Ez az egyetlen ok,
// amiért a megnyitó effekt megvárja a `!isPending`-et — de a `progressRef` csak RENDERKOR
// frissül, a merge-effekt és a welcome-effekt pedig UGYANABBAN a passzív-effekt flush-ban fut
// (react-query egy renderben billenti az isPending-et és adja a datát). A welcome-effekt tehát
// nem támaszkodhat a refre: a szerver-mapet magának kell összefésülnie, különben (1) felvillan,
// és (2) a `persist` bázisa a merge ELŐTTI map, ami visszaírja a csonkolt állapotot.
test('új eszköz: a szerver szerint látott welcome nem villan fel, és a merge-elt mapet nem csorbítja (real mode)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  if (isMockMode()) return
  const entry = (v: number) => ({ version: v, seenAt: SEEN, completedAt: SEEN, dismissedAtStep: null })
  server.use(
    http.get(`${API_BASE}/api/tutorial/progress`, () =>
      HttpResponse.json({ progress: { welcome: entry(WELCOME_VERSION), fuel: entry(1), nap: entry(1) } }),
    ),
    http.put(`${API_BASE}/api/tutorial/progress`, async ({ request }) => {
      const body = (await request.json()) as { progress: unknown }
      return HttpResponse.json({ progress: body.progress })
    }),
  )
  renderAt('/nap') // a localStorage üres — a globális beforeEach törli
  await waitFor(() => expect(Object.keys(readLocalProgress()).length).toBeGreaterThan(0))
  await act(async () => { vi.advanceTimersByTime(AUTO_DELAY_MS + 50) })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument() // nincs felvillanás
  const p = readLocalProgress()
  expect(p.fuel).toBeDefined() // a merge-elt map többi bejegyzése megmaradt
  expect(p.nap).toBeDefined()
  expect(p.welcome?.seenAt).toBe(SEEN) // az eredeti seenAt él, nem írtuk felül frissel
})

// ── resetAll (mezo-gb1s.2) ──────────────────────────────────────────────────
test('resetAll: kiüríti az állapotot, zárja a nyitottat, és a welcome újra esedékes lesz', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  writeLocalProgress(welcomeSeen())
  renderAt('/fuel')
  await user.click(screen.getByText('nyisd'))
  expect(await screen.findByLabelText('Kártyák')).toBeInTheDocument()
  await act(async () => { await resetHandle.current!() })
  expect(screen.queryByLabelText('Kártyák')).not.toBeInTheDocument()
  expect(readLocalProgress()).toEqual({})
  // A reset a `welcomeStatusRef`-et is visszaállítja `'pending'`-re (nem csak a state-et) —
  // enélkül a /nap-ra visszatérve a megnyitó effekt eager latchje ('done'-t olvasva a refből)
  // örökre elnyomná a welcome-ot. A rákövetkező /nap-belépés a bizonyíték.
  await user.click(screen.getByRole('button', { name: 'nap' }))
  expect(await screen.findByRole('dialog')).toHaveAccessibleName('Szia, Mezo vagyok.')
})

test('resetAll: a DELETE hibája FELSZÍNRE kerül, nem nyeli el némán', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  if (isMockMode()) return
  let hits = 0
  server.use(http.delete(`${API_BASE}/api/tutorial/progress`, () => {
    hits += 1
    return new HttpResponse(null, { status: 500 })
  }))
  renderAt('/fuel')
  await expect(act(async () => { await resetHandle.current!() })).rejects.toThrow(/HTTP 500/)
  expect(hits).toBe(1)
})
