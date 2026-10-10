import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NapRutinPage } from '@/features/today/pages/NapRutinPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ToastProvider } from '@/shared/ui/ToastProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import type { HabitCatalog, HabitItem } from '@/data/types'

// Rutin page (mezo-d20.2.3) in the Folyadék look (mezo-n4wf5.2, prototypes/vilagos/nap.js
// `rutin()`): hero = the lead chain group (verdict „Most jön: …", one linked drop per habit, the
// primary button acts on the next habit, the day links), one numbered card per group (tick · own
// icon · honest anchorCopy line · 28-day strength as a level), „A lánc ereje" facts (perfect days
// · lánc-erő · XP ma), the door to routine building. ?dp=reggel|napkozben|este picks the lead.

// Mode-agnostic data stubs — mock seeds and real-mode MSW fixtures differ, so the habit
// hooks are stubbed with a controlled day (QuickInputSheet.test pattern). One shared
// store so the tick's optimistic re-render reaches every hook instance.
const habitStore = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  let habits: unknown[] = []
  return {
    checked: [] as string[],
    unchecked: [] as string[],
    seed(h: unknown[]) { habits = h; this.checked = []; this.unchecked = []; listeners.forEach((l) => l()) },
    subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l) },
    snapshot: () => habits,
    setStatus(key: string, status: string) {
      habits = (habits as { key: string }[]).map((h) => (h.key === key ? { ...h, status } : h))
      listeners.forEach((l) => l())
    },
  }
})

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  const { useSyncExternalStore } = await import('react')
  return {
    ...actual,
    useHabitDay: () => ({
      habits: useSyncExternalStore(habitStore.subscribe, habitStore.snapshot),
      levelUps: [],
      mode: 'mock' as const,
    }),
    useHabitCatalog: () => ({
      catalog: {
        chains: [
          { id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
            // a keret-mezők a katalógus-olvasásból jönnek, nem a napi sorból (mezo-3zue.5)
            defs: [
              { habitKey: 'morning_pushups', framework: 'FOGG', celebration: 'ökölbe szorított kéz + „ez az”', anchorHabitKey: null },
              { habitKey: 'morning_sunlight', framework: null, celebration: null, anchorHabitKey: null },
              // mezo-3zue.6: a videó a fekvőtámaszra van kötve — ettől szólal meg a „Most jön" prompt
              { habitKey: 'morning_video', framework: 'FOGG', celebration: 'bólintok, hogy megvolt', anchorHabitKey: 'morning_pushups' },
            ],
          },
          { id: 'c-e', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true,
            defs: [{ habitKey: 'kitchen_close', framework: null, celebration: null }],
          },
          // A user-created DAY chain (mezo-025v). Its group only renders when the day view
          // actually carries rows for it, so every other test in this file is unaffected.
          { id: 'c-d', chainKey: 'MIDDAY', title: 'Napközbeni rutin', daypart: 'DAY', position: 3, isActive: true,
            defs: [{ habitKey: 'midday_walk', framework: null, celebration: null }],
          },
        ] as HabitCatalog['chains'],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    }),
    useHabitActions: () => ({
      check: (k: string) => { habitStore.checked.push(k); habitStore.setStatus(k, 'done'); return Promise.resolve(undefined) },
      uncheck: (k: string) => { habitStore.unchecked.push(k); habitStore.setStatus(k, 'pending'); return Promise.resolve(undefined) },
      pending: false,
      consumeLevelUps: vi.fn(),
    }),
    useHabitSummary: () => ({
      data: { perfectMorningDays30: 6, perfectEveningDays30: 4, habits: [] },
      isPending: false, isError: false, refetch: vi.fn(),
    }),
  }
})

const morningHabits: Partial<HabitItem>[] = [
  { key: 'wake_on_time', chain: 'MORNING', position: 1, title: 'Ébredés időben', why: '', anchorCopy: 'a lánc kezdete', mode: 'DERIVED', status: 'done', xp: 10, strengthPct: 82 },
  { key: 'morning_sunlight', chain: 'MORNING', position: 2, title: 'Reggeli napfény', why: '', anchorCopy: 'ébredés után', mode: 'MANUAL', status: 'done', xp: 5, strengthPct: 64 },
  { key: 'morning_pushups', chain: 'MORNING', position: 3, title: '50 fekvőtámasz', why: '', anchorCopy: 'napfény után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 48 },
  { key: 'morning_weigh_in', chain: 'MORNING', position: 4, title: 'Reggeli súlymérés', why: '', anchorCopy: 'fogmosás után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: 93 },
]
const eveningHabits: Partial<HabitItem>[] = [
  { key: 'kitchen_close', chain: 'EVENING', position: 1, title: 'Konyha zárva', why: '', anchorCopy: 'vacsora után', mode: 'MANUAL', status: 'pending', xp: 10, strengthPct: 68 },
  { key: 'bed_on_time', chain: 'EVENING', position: 2, title: 'Ágyban időben', why: '', anchorCopy: 'napzárás után', mode: 'DERIVED', status: 'pending', xp: 10, strengthPct: null },
]

/** A morning_pushups-ra KÖTÖTT sor (mezo-3zue.6) — MANUAL + pending, tehát valóban pipálható. */
const chainedVideo: Partial<HabitItem> = {
  key: 'morning_video', chain: 'MORNING', position: 5, title: 'Reggeli videó', why: '',
  anchorCopy: 'napfény után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 39,
}

beforeEach(() => habitStore.seed([...morningHabits, chainedVideo, ...eveningHabits]))

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

function renderPage(path = '/nap/rutin?dp=reggel') {
  return render(
    <QueryWrapper>
      <ToastProvider>
        <LevelUpProvider>
          <MemoryRouter initialEntries={['/nap', path]} initialIndex={1}>
            <Routes>
              <Route path="/nap" element={<div data-testid="hub-stub" />} />
              <Route path="/nap/rutin" element={<><NapRutinPage /><LocationProbe /></>} />
              <Route path="*" element={<LocationProbe />} />
            </Routes>
          </MemoryRouter>
        </LevelUpProvider>
      </ToastProvider>
    </QueryWrapper>,
  )
}

/** A habit's list row (the hero and the reward toast repeat the title, so scope to the row). */
const rowOf = (title: string) => screen.getAllByText(title)
  .map((e) => e.closest('.fo-card .fo-row'))
  .find((r): r is HTMLElement => r !== null)!
/** The row's tick. The hero drop of the same habit carries the same name, so scope to the row. */
const tick = (title: string) => within(rowOf(title)).getByRole('button', { name: title })
const findTick = async (title: string) => { await screen.findAllByText(title); return tick(title) }
const hero = () => document.querySelector('.fo-hero') as HTMLElement
const drops = () => Array.from(hero().querySelectorAll('.fo-dr')) as HTMLElement[]
const sections = () => Array.from(document.querySelectorAll('.fo-sec')).map((h) => h.textContent)

test('Folyadék page anatomy: back button, hero with the verdict + the drop chain, numbered sections, notes', async () => {
  renderPage()
  expect(await screen.findByRole('button', { name: 'Vissza' })).toBeInTheDocument()
  expect(document.querySelector('.fo-page.nr2-page')).not.toBeNull()
  // the old skin is gone: no glass, no mozaik page, no halo hero
  expect(document.querySelector('.glass, .mz-page, .uv-halo, .nap-hero')).toBeNull()
  // morning group: 2 of 5 done, the first open row is next
  expect(screen.getByText('Reggeli rutin · 2/5 kész')).toBeInTheDocument()
  expect(screen.getByText('Most jön: 50 fekvőtámasz.')).toBeInTheDocument()
  expect(screen.getByText('5 elem · lánc · napfény után')).toBeInTheDocument()
  // one drop per habit of the lead group: done · done · now · empty · empty
  expect(drops().map((d) => d.className.replace('fo-dr', '').trim())).toEqual(['d', 'd', 'now', '', ''])
  // every group is ONE card under its numbered heading, then the facts and the builder door
  expect(sections()).toEqual(['1Reggeli rutin · 2/5', '2Esti rutin · 0/2', '3A lánc ereje', '4Szerkesztés'])
  expect(screen.getByText('A sor végén a szám a szokás 28 napos ereje.')).toBeInTheDocument()
  expect(screen.getByText('A lánc-erő az elmúlt 28 nap következetessége: egy kihagyás nem nulláz, csak halványít.')).toBeInTheDocument()
  // the guide's anchor stays on the first group's card
  expect(rowOf('Ébredés időben').closest('.fo-card')).toHaveAttribute('data-kalauz-anchor', 'rutin-lista')
  expect(document.querySelectorAll('[data-kalauz-anchor="rutin-lista"]')).toHaveLength(1)
})

test('the facts carry perfect days, chain strength and today XP for the lead group', async () => {
  renderPage()
  expect(await screen.findByText('6/30')).toBeInTheDocument()
  expect(screen.getByText('tökéletes reggel')).toBeInTheDocument()
  // mean of 82/64/48/93/39 → 65%
  expect(screen.getByText('65%')).toBeInTheDocument()
  expect(screen.getByText('lánc-erő · 28 nap')).toBeInTheDocument()
  // done rows: 10 + 5 XP
  expect(screen.getByText('+15')).toBeInTheDocument()
  expect(screen.getByText('XP ma')).toBeInTheDocument()
})

test('?dp=este leads with the evening group (hero) and lists the morning group below', async () => {
  renderPage('/nap/rutin?dp=este')
  expect(await screen.findByText('Esti rutin · 0/2 kész')).toBeInTheDocument()
  expect(screen.getByText('Most jön: Konyha zárva.')).toBeInTheDocument()
  expect(screen.getByText('2 elem · lánc · vacsora után')).toBeInTheDocument()
  expect(drops()).toHaveLength(2)
  expect(screen.getByText('tökéletes este')).toBeInTheDocument()
  // the other group is still listed below
  expect(sections().slice(0, 2)).toEqual(['1Esti rutin · 0/2', '2Reggeli rutin · 2/5'])
  expect(screen.getByText('Ébredés időben')).toBeInTheDocument()
})

test('rows render honest anchorCopy lines and a strength level only where strength exists', async () => {
  renderPage()
  expect(await screen.findByText('a lánc kezdete')).toBeInTheDocument()
  expect(screen.getByText('ébredés után')).toBeInTheDocument()
  const weigh = rowOf('Reggeli súlymérés')
  expect(weigh.querySelector('.v')).toHaveTextContent('93%')
  expect((weigh.querySelector('.fo-level i') as HTMLElement).style.width).toBe('93%')
  // bed_on_time (evening, strengthPct null) renders NO percent and NO level
  const bedRow = rowOf('Ágyban időben')
  expect(bedRow.querySelector('.v')).toBeNull()
  expect(within(bedRow).queryByText(/%$/)).toBeNull()
  expect(bedRow.querySelector('.fo-level')).toBeNull()
})

test('a százalék a szint csúszásával EGYÜTT fut, nem ugrik (mezo-apwd)', async () => {
  renderPage()
  await screen.findByText('Reggeli súlymérés')
  const pct = () => rowOf('Reggeli súlymérés').querySelector('.v')
  expect(pct()).toHaveTextContent('93%')
  vi.useFakeTimers()
  try {
    // a napi sor frissül: a súlymérés 28 napos lánc-ereje 93 → 100
    act(() => habitStore.seed([
      ...morningHabits.map((h) => (h.key === 'morning_weigh_in' ? { ...h, strengthPct: 100 } : h)),
      ...eveningHabits,
    ]))
    // Ez a hibajelenség: a szám AZONNAL a 100%-ra ugrott, míg a szint még NR_GLIDE_MS-ig
    // csúszott az új szélességre — a kettő mozgása nem esett egybe.
    expect(pct()).toHaveTextContent('93%')
    act(() => { vi.advanceTimersByTime(400) })
    expect(pct()).toHaveTextContent('100%')
  } finally {
    vi.useRealTimers()
  }
})

test('a pending MANUAL row ticks through the habit check write', async () => {
  renderPage()
  await userEvent.click(await findTick('50 fekvőtámasz'))
  expect(habitStore.checked).toEqual(['morning_pushups'])
  // the row settles done: the kit tick is on, the row reads done
  const row = rowOf('50 fekvőtámasz')
  expect(row.querySelector('.fo-tk.on')).not.toBeNull()
  expect(within(row).getByRole('button', { name: '50 fekvőtámasz' })).toHaveAttribute('aria-pressed', 'true')
  expect(row).toHaveClass('done')
})

test('a done MANUAL row unticks (the prototype tick toggles both ways)', async () => {
  renderPage()
  await userEvent.click(await findTick('Reggeli napfény'))
  expect(habitStore.unchecked).toEqual(['morning_sunlight'])
  expect(habitStore.checked).toEqual([])
})

test('ADR 0010: a pending DERIVED row never self-completes — its tick opens the log surface', async () => {
  renderPage()
  await userEvent.click(await findTick('Reggeli súlymérés'))
  expect(habitStore.checked).toEqual([])
  expect(screen.getByTestId('loc')).toHaveTextContent('/me/weight')
})

test('a DERIVED row with no surface of its own is not interactive (honest hint, no dead button)', async () => {
  renderPage('/nap/rutin?dp=este')
  await screen.findByText('Ágyban időben')
  // bed_on_time is decided by tomorrow's sleep log → explainer line, no tick button, no drop button
  expect(screen.queryByRole('button', { name: 'Ágyban időben' })).toBeNull()
  expect(rowOf('Ágyban időben').querySelector('.fo-mk')).not.toBeNull()
  expect(screen.getByText('holnap reggel, az alvásnaplódból derül ki')).toBeInTheDocument()
})

test('a done DERIVED row stays settled — no uncheck from this page', async () => {
  renderPage()
  await screen.findByText('Ébredés időben')
  expect(screen.queryByRole('button', { name: 'Ébredés időben' })).toBeNull()
  // it still reads done: the green status mark
  expect(rowOf('Ébredés időben').querySelector('.fo-mk.d')).not.toBeNull()
  expect(habitStore.unchecked).toEqual([])
})

test('the back button navigates back', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(screen.getByTestId('hub-stub')).toBeInTheDocument()
})

// (mezo-7flr) The hub's Rutin TILE is gone — `/nap` is now a pure companion entry and the Rutin
// page is reached via the navigation, not a hub tile. The former "hub Rutin tile navigates to
// /nap/rutin?dp=<face>" test was deleted with the tile it exercised.

// ── the hero: the drop chain and the primary button act like the row's tick ─────

test('the hero primary button ticks the next MANUAL habit („Megvan, pipálom")', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Megvan, pipálom' }))
  expect(habitStore.checked).toEqual(['morning_pushups'])
  // the chain moved on: three done, and the prompted (chained) habit is next
  expect(screen.getByText('Reggeli rutin · 3/5 kész')).toBeInTheDocument()
  expect(await screen.findByText('Most jön: Reggeli videó.')).toBeInTheDocument()
})

test('a hero drop does exactly what its row tick does; a settled DERIVED drop is no button', async () => {
  renderPage()
  await screen.findByText('50 fekvőtámasz')
  const d = drops()
  // wake_on_time: done DERIVED → a picture, not a control
  expect(d[0].tagName).toBe('SPAN')
  expect(d[0]).toHaveAttribute('aria-label', 'Ébredés időben')
  // morning_pushups: pending MANUAL → the drop ticks it
  expect(d[2].tagName).toBe('BUTTON')
  expect(d[2]).toHaveAttribute('aria-label', '50 fekvőtámasz')
  await userEvent.click(d[2])
  expect(habitStore.checked).toEqual(['morning_pushups'])
  // morning_sunlight: done MANUAL → the drop unticks it
  await userEvent.click(drops()[1])
  expect(habitStore.unchecked).toEqual(['morning_sunlight'])
})

test('the primary button names what the next DERIVED habit opens', async () => {
  const derived = (key: string, title: string): Partial<HabitItem> => (
    { key, chain: 'MORNING', position: 1, title, why: '', anchorCopy: 'a', mode: 'DERIVED', status: 'pending', xp: 5, strengthPct: null })
  habitStore.seed([derived('daily_intention', 'Mai fókusz')])
  const view = renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Leírom' }))
  expect(await screen.findByRole('heading', { name: 'Mi ma a fókuszod?' })).toBeInTheDocument()
  expect(document.querySelector('.sheet.fo-sheet')).not.toBeNull()
  expect(document.querySelector('.sheet.glass')).toBeNull()
  expect(screen.getByText('Rutin · reggel · a mai szándék')).toBeInTheDocument()
  expect(screen.getByText('Legfeljebb 200 karakter. Este megkérdezzük, sikerült-e eszerint élned a napot.')).toBeInTheDocument()
  // the field is named by the sheet title, capped at 200; „Hozzáadom" waits for a sentence
  const field = screen.getByRole('textbox', { name: 'Mi ma a fókuszod?' })
  expect(field).toHaveAttribute('maxLength', '200')
  expect(screen.getByRole('button', { name: 'Mégse' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Hozzáadom' })).toBeDisabled()
  await userEvent.type(field, 'nyugodt tempó')
  expect(screen.getByRole('button', { name: 'Hozzáadom' })).toBeEnabled()
  view.unmount()

  habitStore.seed([derived('intention_reflect', 'Szándékkal éltem?')])
  const view2 = renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Válaszolok' }))
  expect(await screen.findByRole('heading', { name: 'Szándékkal élted a napot?' })).toBeInTheDocument()
  // the three answers, each a capsule
  expect(screen.getByRole('button', { name: 'Igen' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Részben' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nem' })).toBeInTheDocument()
  expect(document.querySelectorAll('.nck2-ref .fo-mini')).toHaveLength(3)
  view2.unmount()

  habitStore.seed([derived('morning_weigh_in', 'Reggeli súlymérés')])
  const view3 = renderPage()
  expect(await screen.findByRole('button', { name: 'Megnyitom' })).toBeInTheDocument()
  view3.unmount()

  habitStore.seed([derived('evening_ritual', 'Napzárás')])
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'Napzárás indítása' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/ritual')
})

test('a next habit with no surface of its own gets no primary button; all done reads „Mind megvan"', async () => {
  habitStore.seed([eveningHabits[1]]) // bed_on_time alone: decided by tomorrow's sleep log
  const view = renderPage('/nap/rutin?dp=este')
  expect(await screen.findByText('Most jön: Ágyban időben.')).toBeInTheDocument()
  expect(within(hero()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Előző nap', 'Következő nap'])
  view.unmount()

  habitStore.seed([{ ...eveningHabits[0], status: 'done' }])
  renderPage('/nap/rutin?dp=este')
  expect(await screen.findByText('Mind megvan. Szép munka.')).toBeInTheDocument()
  expect(screen.getByText('Holnap ugyanitt folytatódik.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Megvan, pipálom' })).toBeNull()
})

// ── 1:1 fidelity audit (mezo-d20.11) ────────────────────────────────────────────

test('every row carries the habit OWN icon in the row chip', async () => {
  renderPage()
  await screen.findByText('50 fekvőtámasz')
  const rows = document.querySelectorAll('.fo-card[data-kalauz-anchor="rutin-lista"] .fo-row')
  expect(rows.length).toBeGreaterThan(0)
  const hrefs = [...rows].map((r) => r.querySelector('.si use')?.getAttribute('href'))
  expect(hrefs).toContain('#t-weight')   // morning_weigh_in (i-suly)
  expect(hrefs).toContain('#t-dawn')     // wake_on_time (i-hajnal)
  expect(hrefs).toContain('#t-dumbbell') // morning_pushups (i-edzes)
  expect(new Set(hrefs).size).toBeGreaterThan(1) // NOT one fixed icon for every row
})

test('a habit carrying a linkUrl renders its title as that external link (the affordance the redesign lost)', async () => {
  habitStore.seed([
    { key: 'morning_video', chain: 'MORNING', position: 1, title: 'Reggeli videó', why: '', anchorCopy: 'kávé mellé', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 54, linkUrl: 'https://example.com/reggeli' },
  ])
  renderPage()
  const link = await screen.findByRole('link', { name: /Reggeli videó/ })
  expect(link).toHaveAttribute('href', 'https://example.com/reggeli')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
  // the tick stays its own control — the anchor never sits inside a button
  expect(link.closest('button')).toBeNull()
  expect(within(link.closest('.fo-row') as HTMLElement).getByRole('button', { name: 'Reggeli videó' })).toBeInTheDocument()
})

test('a habit with no linkUrl renders a plain title — no fabricated link', async () => {
  renderPage()
  await screen.findByText('50 fekvőtámasz')
  // the only link on the page is the „Rutinok szerkesztése" entry — no habit title is a link
  expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([expect.stringContaining('Rutinok szerkesztése')])
})

test('the strength level is the habit percent as a width (the kit Level, 8 px)', async () => {
  renderPage()
  await screen.findByText('50 fekvőtámasz')
  const level = rowOf('Ébredés időben').querySelector('.fo-level') as HTMLElement
  expect(level.style.getPropertyValue('--h')).toBe('8px')
  expect((level.querySelector('i') as HTMLElement).style.width).toBe('82%')
})

// ── logging as reward (mezo-3zue.5) ─────────────────────────────────────────────

// ── the daypart milestone rides the closing tick (mezo-sqe3) ────────────────────

test('a napszakot lezáró pipa toastja viszi a „Tökéletes este" mérföldkövet', async () => {
  const user = userEvent.setup()
  // egyetlen nyitott esti sor: ez a pipa zárja a napszakot
  habitStore.seed([{ ...eveningHabits[0] }])
  renderPage('/nap/rutin?dp=este')
  await user.click(await findTick('Konyha zárva'))
  expect(await screen.findByText(/Tökéletes este/)).toBeInTheDocument()
})

test('nyitva maradó napszaknál nincs mérföldkő', async () => {
  const user = userEvent.setup()
  renderPage('/nap/rutin?dp=este') // kitchen_close + bed_on_time, utóbbi nyitva marad
  await user.click(await findTick('Konyha zárva'))
  expect(await screen.findByText('Szokás · 1 / 2')).toBeInTheDocument()
  expect(screen.queryByText(/Tökéletes este/)).toBeNull()
})

test('ünnepléses szokás pipálása visszajátssza a saját mondatot', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await findTick('50 fekvőtámasz'))
  expect(await screen.findByText('ökölbe szorított kéz + „ez az”')).toBeInTheDocument()
})

test('ünneplés nélküli szokásnál a toast a régi marad', async () => {
  const user = userEvent.setup()
  renderPage('/nap/rutin?dp=este')
  await user.click(await findTick('Konyha zárva'))
  // a toast megjelenik, de ünneplés-sor nélkül — generikus fallback szándékosan nincs.
  // Az esti lánc a fixtúrában 2 sor (kitchen_close + bed_on_time), egyik sem done →
  // chainProgress = { done: 0, total: 2 } → az eyebrow „Szokás · 1 / 2".
  expect(await screen.findByText('Szokás · 1 / 2')).toBeInTheDocument()
  expect(screen.queryByText('ökölbe szorított kéz + „ez az”')).not.toBeInTheDocument()
})

// ── a habit stacking kifizetődése: a pipa promptolja a láncolt szokást (mezo-3zue.6) ──

test('a horgony pipálása kiemeli a rá kötött szokást a listán', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await findTick('50 fekvőtámasz'))
  const now = await screen.findByText('Most jön')
  // a kiemelés a láncolt soron ül, nem a pipálton
  const row = now.closest('.fo-row') as HTMLElement
  expect(within(row).getByText('Reggeli videó')).toBeInTheDocument()
  expect(row.classList.contains('now')).toBe(true)
  // a horgony-sor (anchorCopy) a címke után marad
  expect(row).toHaveTextContent('Most jön · napfény után')
})

test('a kiemelés eltűnik, amint a láncolt szokást is kipipálják', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await findTick('50 fekvőtámasz'))
  expect(await screen.findByText('Most jön')).toBeInTheDocument()
  await user.click(tick('Reggeli videó'))
  expect(screen.queryByText('Most jön')).toBeNull()
})

test('már kész láncolt szokásnál a pipa csendet hagy', async () => {
  const user = userEvent.setup()
  habitStore.seed([
    ...morningHabits,
    { ...chainedVideo, status: 'done' },
  ])
  renderPage()
  await user.click(await findTick('50 fekvőtámasz'))
  // a jutalom-toast szól, a prompt nem
  expect(await screen.findByText('ökölbe szorított kéz + „ez az”')).toBeInTheDocument()
  expect(screen.queryByText('Most jön')).toBeNull()
})

test('a jutalom-toast változatlan marad a prompt mellett', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(await findTick('50 fekvőtámasz'))
  expect(await screen.findByText('ökölbe szorított kéz + „ez az”')).toBeInTheDocument()
  expect(screen.getByText('Most jön')).toBeInTheDocument()
})

// ---- mezo-025v: a user-created DAY chain was editable under Én but unreachable from the day ----

const middayWalk: Partial<HabitItem> = {
  key: 'midday_walk', chain: 'MIDDAY', position: 1, title: 'Ebéd utáni séta', why: '',
  anchorCopy: 'ebéd után', mode: 'MANUAL', status: 'pending', xp: 5, strengthPct: 40,
}

test('a DAY-daypart chain renders its own group and its rows are tickable', async () => {
  habitStore.seed([...morningHabits, middayWalk])
  renderPage()
  expect(await screen.findByText('Napközbeni rutin · 0/1')).toBeInTheDocument()
  await userEvent.click(tick('Ebéd utáni séta'))
  expect(habitStore.checked).toContain('midday_walk')
})

test('the DAY group carries no perfect-day cell — the summary has no such counter', async () => {
  habitStore.seed([middayWalk])
  renderPage('/nap/rutin?dp=napkozben')
  expect(await screen.findByText('Napközbeni rutin · 0/1 kész')).toBeInTheDocument()
  // honesty rule: no fabricated "tökéletes nap" counter, while the real cells stay
  expect(screen.queryByText(/tökéletes/)).toBeNull()
  expect(screen.getByText('lánc-erő · 28 nap')).toBeInTheDocument()
  expect(screen.getByText('XP ma')).toBeInTheDocument()
})

// ---- mezo-x9c2: yesterday backfill — the two day links on the hero's liquid row ----

describe('yesterday backfill (mezo-x9c2)', () => {
  test('a missed MANUAL row is tickable on the yesterday view and calls check', async () => {
    habitStore.seed([
      { key: 'morning_sunlight', chain: 'MORNING', position: 1, title: 'Reggeli napfény',
        why: 'w', anchorCopy: 'a', mode: 'MANUAL', status: 'missed', xp: 5, strengthPct: 64 },
    ])
    renderPage()
    // ma: a missed sor nem kattintható (mai napon missed nem is létezhet — védőháló)
    expect(screen.queryByRole('button', { name: 'Reggeli napfény' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Előző nap' }))
    // the view says which day it shows
    expect(screen.getByText('Tegnap · Reggeli rutin · 0/1 kész')).toBeInTheDocument()
    expect(screen.getByText('Tegnap kimaradt: Reggeli napfény.')).toBeInTheDocument()
    expect(screen.getByText('XP tegnap')).toBeInTheDocument()
    await userEvent.click(tick('Reggeli napfény'))
    expect(habitStore.checked).toEqual(['morning_sunlight'])
  })

  test('a missed DERIVED row stays inert on the yesterday view', async () => {
    habitStore.seed([
      { key: 'morning_weigh_in', chain: 'MORNING', position: 1, title: 'Reggeli súlymérés',
        why: 'w', anchorCopy: 'a', mode: 'DERIVED', status: 'missed', xp: 10, strengthPct: 93 },
    ])
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Előző nap' }))
    expect(screen.queryByRole('button', { name: 'Reggeli súlymérés' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Megnyitom' })).not.toBeInTheDocument()
  })

  test('the prev link stops at yesterday: one step back disables it, the next link leads back to today', async () => {
    habitStore.seed([])
    renderPage()
    const prev = screen.getByRole('button', { name: 'Előző nap' })
    const next = screen.getByRole('button', { name: 'Következő nap' })
    expect(prev).toHaveTextContent('‹ Tegnap')
    // no future: on today the next link is off
    expect(next).toBeDisabled()
    await userEvent.click(prev)
    expect(prev).toBeDisabled()
    expect(next).toBeEnabled()
    expect(next).toHaveTextContent('Ma ›')
    await userEvent.click(next)
    expect(prev).toBeEnabled()
    expect(next).toBeDisabled()
  })
})

describe('„Rutinok szerkesztése" entry (mezo-lhqw7)', () => {
  test('the row under the lists opens the routine builder', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('link', { name: /Rutinok szerkesztése/ }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/nap/rutin/epites')
  })

  test('a day with no habits at all still shows the entry (a brand-new user can reach the builder)', async () => {
    habitStore.seed([])
    renderPage()
    expect(await screen.findByRole('link', { name: /Rutinok szerkesztése/ })).toHaveAttribute('href', '/nap/rutin/epites')
    // the honest empty day: no chain, no facts — a sentence and the way on
    expect(screen.getByText('Mára nincs rutinod.')).toBeInTheDocument()
    expect(sections()).toEqual(['1Szerkesztés'])
  })
})
