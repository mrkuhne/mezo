import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { NapCheckinPage } from '@/features/today/pages/NapCheckinPage'
import { NapHubPage } from '@/features/today/pages/NapHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'

// Check-in detail page (mezo-d20.2.5) in the Folyadék look (mezo-n4wf5.2, prototypes/vilagos/nap.js
// `checkin()`): the hero is the day's four vials; below, the four slots as rows in ONE card. Done
// slots carry their answers as capsules, the NEXT fillable slot is the current row and opens the
// real CheckInSheet flow from the page.

// Mode-agnostic checkins stub: the mock seed and the real-mode day-build (wall-clock
// dependent!) differ, so the slot set is pinned here. saveCheckIn mutates a shared store
// so the page re-renders exactly like the real hook's optimistic overlay.
const ckStore = vi.hoisted(() => {
  const seed = () => [
    { time: '06:30', state: 'done', values: { energy: 7, stress: 3, body: 6, mental: 7 }, note: 'Nyugodt ébredés · pihenve' },
    { time: '10:00', state: 'done', values: { energy: 8, stress: 4, body: 7, mental: 8 }, note: null },
    { time: '14:00', state: 'now', values: null, note: null },
    { time: '20:00', state: 'pending', values: null, note: null },
  ]
  const listeners = new Set<() => void>()
  let slots = seed()
  return {
    get slots() { return slots },
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l) },
    save(idx: number, data: object) {
      slots = slots.map((s, i) => (i === idx ? { ...s, ...data } : s))
      listeners.forEach((l) => l())
    },
    reset() { slots = seed(); listeners.forEach((l) => l()) },
  }
})
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useSyncExternalStore } = await import('react')
  return {
    ...actual,
    useCheckins: () => ({
      checkins: useSyncExternalStore(ckStore.subscribe, () => ckStore.slots),
      saveCheckIn: (idx: number, data: object) => ckStore.save(idx, data),
    }),
  }
})

beforeEach(() => ckStore.reset())

function renderPage(initialEntries: string[] = ['/nap/checkin']) {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
            <Routes>
              <Route path="/nap" element={<NapHubPage />} />
              <Route path="/nap/checkin" element={<NapCheckinPage />} />
              <Route path="/elsewhere" element={<div>elsewhere-page</div>} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

const vials = () => Array.from(document.querySelectorAll('.fo-hero .fo-vial')) as HTMLElement[]
const slotRows = () => Array.from(document.querySelectorAll('.nck2-slot')) as HTMLElement[]

test('the hero reads the day: the verdict for the slot due now, and the four vials', async () => {
  renderPage()
  expect(await screen.findByText('A nap négy pillanata')).toBeInTheDocument()
  expect(screen.getByText('A délutáni most esedékes. Fél perc.')).toBeInTheDocument()
  // the afternoon plan (8 items + the question of the day)
  expect(await screen.findByText('9 koppintás. Öt alapkérdés után bármikor kiléphetsz.')).toBeInTheDocument()
  // Folyadék: a light page, the old skin is gone
  expect(document.querySelector('.fo-page.nck2-page')).not.toBeNull()
  expect(document.querySelector('.glass, .uv-halo, .mz-page')).toBeNull()
  const v = vials()
  expect(v).toHaveLength(4)
  // two done slots: filled to answered / asked, marked „kész", with the tick
  expect(v[0]).toHaveTextContent('kész')
  expect(v[0].querySelector('b')).toHaveTextContent('4/10')
  expect((v[0].querySelector('.fo-tube .l') as HTMLElement).style.getPropertyValue('--p')).toBe('40%')
  expect(v[0].querySelector('use')?.getAttribute('href')).toBe('#t-tick')
  expect(v[0]).toHaveTextContent('Reggel')
  expect(v[0]).toHaveTextContent('06:30')
  expect(v[1].querySelector('b')).toHaveTextContent('4/8')
  // the slot due now, then the later one
  expect(v[2]).toHaveTextContent('esedékes')
  expect(v[2].querySelector('b')).toHaveTextContent('most')
  expect(v[2].querySelector('use')?.getAttribute('href')).toBe('#t-checkin')
  expect(v[3]).toHaveTextContent('később')
  expect(v[3].querySelector('b')).toHaveTextContent('–')
  expect(v[3].querySelector('use')?.getAttribute('href')).toBe('#t-clock')
  // only the current vial is a control
  expect(v.map((x) => x.tagName)).toEqual(['DIV', 'DIV', 'BUTTON', 'DIV'])
  expect(screen.getByText(/A kimaradt check-in nem vész el: pótold bármikor, a társ nem büntet\./)).toBeInTheDocument()
})

test('done slots render their answers as capsules; non-done slots show NO cells', async () => {
  renderPage()
  await screen.findByText('Mai pillanatképek')
  const rows = slotRows()
  expect(rows).toHaveLength(4)
  expect(rows[0]).toHaveTextContent('06:30')
  expect(within(rows[0]).getByText('Reggel')).toBeInTheDocument()
  expect(within(rows[1]).getByText('Délelőtt')).toBeInTheDocument()
  // exactly the 2 done slots carry a capsule row (honest states: nothing fabricated)
  expect(document.querySelectorAll('.nck2-cells')).toHaveLength(2)
  expect(screen.getAllByText('Energia')).toHaveLength(2)
  // a capsule is filled to the answer on the 10 scale: energy 7 → 70 %
  const energy = within(rows[0]).getByText('Energia').closest('.fo-mini') as HTMLElement
  expect(energy.querySelector('b')).toHaveTextContent('7')
  expect((energy.querySelector('.t i') as HTMLElement).style.height).toBe('70%')
  // the saved note surfaces on its row; a done slot without one reads „Kitöltve"
  expect(screen.getByText('Nyugodt ébredés · pihenve')).toBeInTheDocument()
  expect(within(rows[1]).getByText('Kitöltve')).toBeInTheDocument()
  // a done slot is marked by the „Kész" status pill, one per done slot
  expect(document.querySelectorAll('.nck2-slot .fo-st.ok')).toHaveLength(2)
  expect(screen.getAllByText('Kész')).toHaveLength(2)
  // the guide's anchor stays on the first row
  expect(rows[0]).toHaveAttribute('data-kalauz-anchor', 'checkin-sor')
})

test('the future slot renders muted as "később esedékes" and is not interactive', async () => {
  renderPage()
  await screen.findByText('Mai pillanatképek')
  const evening = slotRows()[3]
  expect(evening).toHaveClass('later')
  expect(evening).toHaveTextContent('20:00')
  expect(within(evening).getByText('Este')).toBeInTheDocument()
  expect(within(evening).getByText('Később')).toBeInTheDocument()
  // Check-in 2.0: the evening plan's size (11 items + the question of the day)
  expect(await screen.findByText('később esedékes · 12 kérdés')).toBeInTheDocument()
  expect(within(evening).queryByRole('button')).toBeNull()
  // the fill affordance: the hero's button and the current row's — nothing on the other rows
  expect(screen.getAllByRole('button', { name: 'Kitöltöm' })).toHaveLength(2)
  expect(within(slotRows()[2]).getAllByRole('button', { name: 'Kitöltöm' })).toHaveLength(1)
})

/** Walk the open sheet: answer the first step with 8, skip the rest, save. */
async function fillAndSave() {
  expect(await screen.findByRole('heading', { name: 'Hogy vagy?' })).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('radio', { name: '8' }))
  await screen.findByText(/02 \/ 09/)
  while (!screen.queryByText(/Mentés · /)) {
    await userEvent.click(screen.getByRole('button', { name: /Kihagy/ }))
  }
  await userEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
}

test('the current slot opens the real CheckInSheet and a save flips the day to three done', async () => {
  renderPage()
  expect(await screen.findByText('Délután · most esedékes')).toBeInTheDocument()
  // Check-in 2.0: the afternoon plan (8 items + the question of the day)
  expect(await screen.findByText('hogy vagy most? · 9 koppintás, kb. fél perc')).toBeInTheDocument()
  expect(slotRows()[2]).toHaveClass('now')
  await userEvent.click(within(slotRows()[2]).getByRole('button', { name: 'Kitöltöm' }))
  await fillAndSave()
  // the slot row settled: no fill affordance left for it, its answers render as capsules
  await waitFor(() => expect(document.querySelectorAll('.nck2-cells')).toHaveLength(3))
  expect(screen.queryByText('Délután · most esedékes')).not.toBeInTheDocument()
  expect(document.querySelectorAll('.nck2-slot .fo-st.ok')).toHaveLength(3)
  // the hero moved on to the evening, which is not due yet
  expect(screen.getByText('A következő: este, 20:00. Fél perc.')).toBeInTheDocument()
  expect(screen.getByText('Este · következik')).toBeInTheDocument()
  expect(vials()[3]).toHaveTextContent('jön')
})

test('the hero button and the current vial open the same slot', async () => {
  renderPage()
  await screen.findByText('Délután · most esedékes')
  await userEvent.click(within(document.querySelector('.fo-hero-acts') as HTMLElement).getByRole('button', { name: 'Kitöltöm' }))
  expect(await screen.findByText('Check-in · Délután · 14:00')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárás' }))
  await waitFor(() => expect(screen.queryByText('Check-in · Délután · 14:00')).not.toBeInTheDocument())
  await userEvent.click(vials()[2])
  expect(await screen.findByText('Check-in · Délután · 14:00')).toBeInTheDocument()
})

test('all four done: the hero says so and leads back to the day', async () => {
  ckStore.save(2, { state: 'done', values: { energy: 6 } })
  ckStore.save(3, { state: 'done', values: { energy: 5 } })
  renderPage(['/nap', '/nap/checkin'])
  expect(await screen.findByText('Mind a négy megvan mára.')).toBeInTheDocument()
  expect(screen.getByText('A válaszaid beépülnek a holnapi napodba.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Kitöltöm' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Vissza a mai napra' })).toBeInTheDocument()
})

test('Check-in 2.0 rows: every answered item as a capsule, skipped ones none, and the quick-exit line', async () => {
  ckStore.save(0, {
    values: {
      energy: 7, mood: 8, stress: 3, body: 6, mental: null, rested: 6, soreness: 5,
      pain: { regions: ['TERD'], intensity: 4 }, motivation: 8, hunger: 5,
    },
    askedItems: ['energy', 'mood', 'stress', 'body', 'mental', 'rested', 'soreness', 'pain', 'motivation', 'hunger'],
  })
  ckStore.save(1, {
    values: { energy: 8, mood: 7, stress: 4, body: 7, mental: 8, craving: { value: 5, kinds: ['EDES'] } },
    quickExit: true,
  })
  renderPage()
  await screen.findByText('Mai pillanatképek')
  const [morning, late] = Array.from(document.querySelectorAll('.nck2-cells'))
  // the skipped „Fejtisztaság" has no capsule: 9 of the 10 asked
  expect(morning.querySelectorAll('.fo-mini')).toHaveLength(9)
  expect(Array.from(morning.querySelectorAll('small')).map((s) => s.textContent)).toEqual(
    ['Energia', 'Hangulat', 'Stressz', 'Test', 'Pihent', 'Izomláz', 'Fájdalom', 'Kedv', 'Éhség'])
  expect(morning).toHaveTextContent('Térd 4')
  // a reported pain fills to its intensity, in the warn colour
  const pain = within(morning as HTMLElement).getByText('Fájdalom').closest('.fo-mini') as HTMLElement
  expect(pain.style.getPropertyValue('--c')).toBe('var(--fo-warn)')
  expect((pain.querySelector('.t i') as HTMLElement).style.height).toBe('40%')
  expect(late).toHaveTextContent('Édes 5')
  expect(late).toHaveTextContent('Sóvárgás')
  expect(screen.getAllByText('Most csak ennyi · az alap megvan')).toHaveLength(1)
  // the morning vial: 9 answered of the 10 the plan asks
  expect(vials()[0].querySelector('b')).toHaveTextContent('9/10')
})

test('the back chip navigates back', async () => {
  renderPage(['/elsewhere', '/nap/checkin'])
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('elsewhere-page')).toBeInTheDocument()
})

// Titánium Nap/Mai (mezo-mhum, manifest C2): a check-in CSEMPE lekerült a nyitóoldalról — a
// belépő a gyors-felvevő és a társ létrája („Hogy vagy most?"), a felület maga változatlan.
// Ami ebből ide tartozik és tovább él: az útvonal FELOLDÓDIK és a saját oldalt adja, nem a
// régi sheetet — pontosan az, amit ez a teszt eredetileg őrzött.
test('/nap/checkin resolves to the full page, never the old sheet (manifest C2)', async () => {
  renderPage(['/nap/checkin'])
  expect(await screen.findByText('A nap négy pillanata')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Hogy vagy?' })).not.toBeInTheDocument()
})
