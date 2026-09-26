// ============================================================
// Mezo · FuelMealBlocks tests (Fuel Titanium S1b, mezo-33k6 — fagyasztott manifeszt
// A10 · A11 · A14). A lane-t a VALÓDI builder adja (`buildWindowLane`), a
// fuelSwimlane.test.ts `slot()`/`meal()` fixture-stílusában: ha a VM szerződése
// elmozdul, ezek a tesztek törnek, nem egy kézzel írt literál hazudik zöldet.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { FuelMeal, FuelSlot } from '@/data/types'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import { buildWindowLane } from '@/features/fuel/logic/fuelSwimlane'
import { doneMealRows } from '@/features/fuel/logic/keretHero'
import { FuelMealBlocks } from '@/features/fuel/components/FuelMealBlocks'

const BUDGET: DayBudget = {
  kcal: 2400, p: 180, c: 240, f: 72,
  energy: { base: 2000, planned: 400, extra: 0, balance: 0, target: 2400 },
}

const meal = (over: Partial<FuelMeal> = {}): FuelMeal => ({
  id: 'meal-1', slot: 'breakfast', title: 'Skyr-bowl zabbal', score: 0.88,
  kcal: 420, p: 36, c: 48, f: 9, fiberG: 8,
  mealItems: [], items: [], tags: [],
  loggedAt: '2026-09-12T07:40:00', mealDate: '2026-09-12',
  breakdown: { confidence: 0.8, summary: null, tagline: null, dimensions: [], improve: [], tools: [] },
  ...over,
} as FuelMeal)

const slot = (over: Partial<FuelSlot> = {}): FuelSlot => ({
  time: '07:30', kind: 'meal', label: 'Reggeli', slotKey: 'breakfast', state: 'pending',
  kcal: 400, p: 30, c: 40, f: 10,
  ...over,
})

/** A nap négy tervezett blokkja: a reggeli be van logolva, a többi nyitott/jövő. */
function fixture({ missed = false }: { missed?: boolean } = {}) {
  const slots: FuelSlot[] = [
    slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', mealName: 'Skyr-bowl zabbal', kcal: 420, plannedTime: '07:30' }),
    slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: missed ? 'missed' : 'now' }),
    slot({ time: '16:30', label: 'Uzsonna', slotKey: 'snack', state: 'pending' }),
    slot({ time: '19:30', label: 'Vacsora', slotKey: 'dinner', state: 'pending' }),
  ]
  const meals = [meal()]
  return {
    lane: buildWindowLane({ slots, budget: BUDGET, meals }),
    meals: doneMealRows(meals, slots),
    dayKcal: BUDGET.kcal,
  }
}

const props = (over: Record<string, unknown> = {}) => ({
  ...fixture(over as { missed?: boolean }),
  fiberTargetG: 30,
  onLogInto: vi.fn(),
  onOpenMeal: vi.fn(),
  onOpenScore: vi.fn(),
  ...over,
})

// A10/A14 (mezo-33k6): a nap TERVEZETT blokkjai a lista, és minden blokk a saját
// étkezési ablakát viseli — nem külön idővonal-sáv, hanem a blokk címe alatti csík.
test('minden tervezett blokk megjelenik a saját ablak-csíkjával', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const blocks = container.querySelectorAll('.fmx-block')
  expect(blocks).toHaveLength(4)
  expect(Array.from(blocks).map(b => b.querySelector('.fmx-block-name')!.textContent))
    .toEqual(['Reggeli', 'Ebéd', 'Uzsonna', 'Vacsora'])
  for (const b of blocks) expect(b.querySelector('.fmx-window')).not.toBeNull()
})

// Az owner döntése: a SORBAN nincs kcal — a keret a blokk gyűrűjén ül.
test('a blokk gyűrűje viszi a keretet, az étkezés-sor nem ismétli meg', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const done = container.querySelector('.fmx-block.is-done')!
  expect(done.querySelector('.fmx-budget-ring')).not.toBeNull()
  expect(done.querySelector('.fmx-meal-row')!.textContent).not.toMatch(/kcal/)
})

// A logolás a blokkba történik — ez a fő útvonal.
test('az üres blokk koppintása a saját ablakával indítja a naplózást', async () => {
  const onLogInto = vi.fn()
  render(<FuelMealBlocks {...props({ onLogInto })} />)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna/ }))
  expect(onLogInto).toHaveBeenCalledTimes(1)
  expect(onLogInto.mock.calls[0][0].slotKey).toBe('snack')
})

// A11 (mezo-jb84): a pontszám-chipnek SAJÁT célja van — az AI értékelés. Ez a teszt korábban
// a részletekre kötötte, azaz magát a hibát rögzítette: a chip azért mozog, hogy az értékelésre
// hívjon, és élesben mégis ugyanoda vitt, mint a sor többi része.
test('a pont-chip az AI értékelésre visz, a sor pedig a részletekre', async () => {
  const onOpenMeal = vi.fn()
  const onOpenScore = vi.fn()
  render(<FuelMealBlocks {...props({ onOpenMeal, onOpenScore })} />)
  await userEvent.click(screen.getByRole('button', { name: /AI értékelés/ }))
  expect(onOpenScore).toHaveBeenCalledWith('meal-1')
  expect(onOpenMeal).not.toHaveBeenCalled()
})

// mezo-l2gp0: a grammsor helyén négy mini gyűrű — P/Ch/Zs az étkezés energia-arányát teli
// (36/48/9 g → 144/192/81 kcal → 35/46/19%), a rost a napi adag részét (8/30 → 27%).
// A gramm marad a szám a gyűrűben; felirat továbbra sincs, a hue + clay ikon az azonosság.
test('a makró-gyűrűk az étkezés energia-arányát telítik, a rost a napi adagot', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const rings = container.querySelector('.fmx-block.is-done .fmx-mrings')!
  const cells = Array.from(rings.querySelectorAll('.fmx-mring'))
  expect(cells.map(c => c.querySelector('b')!.textContent)).toEqual(['36g', '48g', '9g', '8g'])
  const arcs = cells.map(c => (c.querySelector('.fl') as SVGCircleElement | null)?.style.getPropertyValue('--p') ?? null)
  expect(arcs).toEqual(['35', '46', '19', '27'])
  expect(rings.getAttribute('aria-label')).toBe(
    'fehérje 36 g, az étkezés energiájának 35%-a; '
    + 'szénhidrát 48 g, az étkezés energiájának 46%-a; '
    + 'zsír 9 g, az étkezés energiájának 19%-a; '
    + 'rost 8 g, a napi adag 27%-a',
  )
  // Felirat nincs a képernyőn — a szavak csak a felolvasónak szólnak.
  expect(rings.textContent).not.toMatch(/fehérje|szénhidrát|zsír|rost/i)
  expect(rings.querySelectorAll('.fmx-mcell > svg, .fmx-mcell .clay')).not.toHaveLength(0)
})

// Őszinte-null: hiányzó makró → "—" és nincs ív; csonka összetételre arány sem számolódik.
test('a hiányzó makró gondolatjel a gyűrűben, és ilyenkor egyik íve sincs aránynak', () => {
  const rows = [{
    mealId: 'meal-1', name: 'Skyr-bowl zabbal', time: '07:40', kcal: 420,
    proteinG: 36, carbsG: null, fatG: null, fiberG: null, plannedTime: '07:30', scorePct: 88,
  }]
  const { container } = render(<FuelMealBlocks {...props({ meals: rows })} />)
  const rings = container.querySelector('.fmx-block.is-done .fmx-mrings')!
  const cells = Array.from(rings.querySelectorAll('.fmx-mring'))
  expect(cells.map(c => c.querySelector('b')!.textContent)).toEqual(['36g', '—', '—', '—'])
  expect(rings.querySelectorAll('.fl')).toHaveLength(0)
  expect(rings.getAttribute('aria-label')).toBe(
    'fehérje 36 g; szénhidrát nincs adat; zsír nincs adat; rost nincs adat',
  )
})

// A név teljes szélességben él, az AI pont az alsó sorban a gyűrűk mellett (owner, v2).
test('az étkezés-sor: név felül, alul a gyűrűk és a pont-chip egy sorban', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const row = container.querySelector('.fmx-block.is-done .fmx-meal-row')!
  const bottom = row.querySelector('.fmx-meal-bottom')!
  expect(bottom.querySelector('.fmx-mrings')).not.toBeNull()
  expect(bottom.querySelector('.fmx-score')).not.toBeNull()
  expect(row.textContent).not.toMatch(/kcal/)
})

// Őszinte-null + szégyenmentesség: kihagyott ablak nem hibaállapot.
test('a kihagyott ablak semlegesen jelenik meg, pontszám nélkül', () => {
  const { container } = render(<FuelMealBlocks {...props({ missed: true })} />)
  const missed = container.querySelector('.fmx-block.is-missed')!
  expect(missed.querySelector('.fmx-score')).toBeNull()
  expect(missed.textContent).not.toMatch(/elrontott|kihagytad|hiba/i)
})

// Az ablak-csík a blokk ANKER idejét rajzolja ki, és a logolt étkezés jelölője rajta ül —
// a sáv szélei a tervezett időből származnak, nem találgatott „optimális" sávból.
test('az ablak-csík a blokk saját idejét viszi, a logolt étkezés jelölőjével', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const done = container.querySelector('.fmx-block.is-done')!
  const bar = done.querySelector('.fmx-window')!
  expect(bar.getAttribute('aria-label')).toContain('07:40')
  expect(bar.querySelectorAll('.fmx-window-at')).toHaveLength(1)
})

// mezo-l2gp0: az óra gomb — az idő nem szöveg a kártyán, hanem koppintásra nyíló üvegdoboz.
test('az óra gomb csak logolt blokkon él, és a doboz a logolás idejét mutatja', async () => {
  render(<FuelMealBlocks {...props()} />)
  const clocks = screen.getAllByRole('button', { name: /logolás ideje/i })
  expect(clocks).toHaveLength(1) // 4 blokkból 1 logolt
  await userEvent.click(clocks[0])
  const dialog = screen.getByRole('dialog')
  expect(dialog.querySelector('.fmx-timebox-time')!.textContent).toBe('07:40')
  expect(dialog.querySelector('.fmx-timebox-sub')!.textContent).toBe('Reggeli · Skyr-bowl zabbal')
  expect(dialog.textContent).toContain('Terv szerint')
  expect(dialog.textContent).toContain('~07:30')
})

test('az óra-doboz zárható Rendbennel és Escape-pel is', async () => {
  render(<FuelMealBlocks {...props()} />)
  await userEvent.click(screen.getByRole('button', { name: /logolás ideje/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Rendben' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /logolás ideje/i }))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
})

// Őszinte-null: ablak nélküli extra logon nincs terv-idő → a sor elmarad, nem becslünk.
test('terv-idő nélkül a "Terv szerint" sor elmarad', async () => {
  const rows = [{
    mealId: 'meal-1', name: 'Skyr-bowl zabbal', time: '07:40', kcal: 420,
    proteinG: 36, carbsG: 48, fatG: 9, fiberG: 8, plannedTime: null, scorePct: 88,
  }]
  render(<FuelMealBlocks {...props({ meals: rows })} />)
  await userEvent.click(screen.getByRole('button', { name: /logolás ideje/i }))
  expect(screen.getByRole('dialog').textContent).not.toContain('Terv szerint')
})

// ── A vércukor-chip a Mai soron (mezo-ya2wp) ────────────────────────────────────────────────
// A jóváhagyott prototípus rendje: a mini görbe a pontszám-chiptől BALRA áll, és ugyanazt a
// dobozt nyitja, amit a részletek oldal negyedik kártyája.
test('a vércukor-chip a pont-chip bal oldalán áll, és a sáv színét viseli', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const bottom = container.querySelector('.fmx-block.is-done .fmx-meal-bottom')!
  const chip = bottom.querySelector('.fmx-glu-chip')!
  expect(chip).not.toBeNull()
  // A fixture-étkezés (48 g ch, 8 g rost, 36 g fehérje) alacsony sávot ad.
  expect(chip.className).toContain('lvl-low')
  expect(chip.getAttribute('aria-label')).toBe('Vércukor-válasz: alacsony')
  // A sorrend a lényeg: gyűrűk → vércukor → pontszám.
  // (Üveg, mezo-me75u.1: the two chips ride in one `.fmx-meal-chips` group so they wrap together.)
  const order = Array.from(bottom.querySelectorAll('.fmx-mrings, .fmx-glu-chip, .fmx-score'))
    .map(el => el.className.split(' ')[0])
  expect(order).toEqual(['fmx-mrings', 'fmx-glu-chip', 'fmx-score'])
  // A chip a görbét hordja, nem számot — glikémiás index sehol.
  expect(chip.querySelector('.fmx-glu-mini')).not.toBeNull()
  expect(chip.textContent).toBe('')
})

test('a vércukor-chip ugyanazt az üvegdobozt nyitja, amit a részletek oldal', async () => {
  render(<FuelMealBlocks {...props()} />)
  await userEvent.click(screen.getByLabelText('Vércukor-válasz: alacsony'))
  expect(await screen.findByText('Vércukor-válasz · várható hatás')).toBeInTheDocument()
  // A doboz a sáv SZAVÁT mutatja nagyban — szám nincs, és „glikémiás index" sincs.
  expect(screen.getByText('alacsony')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/glikémiás index/i)
})

// Őszinte-null: szénhidrát-adat nélkül nincs sáv, tehát chip sincs — nem találgatunk.
test('szénhidrát-adat nélkül a vércukor-chip elmarad', () => {
  const rows = [{
    mealId: 'meal-1', name: 'Skyr-bowl zabbal', time: '07:40', kcal: 420,
    proteinG: 36, carbsG: null, fatG: null, fiberG: null, sugarG: null,
    plannedTime: '07:30', scorePct: 88,
  }]
  const { container } = render(<FuelMealBlocks {...props({ meals: rows })} />)
  expect(container.querySelector('.fmx-glu-chip')).toBeNull()
  // A pont-chip viszont marad a helyén.
  expect(container.querySelector('.fmx-meal-bottom .fmx-score')).not.toBeNull()
})

// Az óra a kalória-gyűrű mellé költözött (owner 2026-09-16): a két kör egy csoport a jobb szélen.
test('a blokk fejlécében az óra és a kcal-gyűrű egy jobbszéli csoportban áll', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const head = container.querySelector('.fmx-block.is-done .fmx-block-head')!
  const end = head.querySelector('.fmx-block-end')!
  expect(end.querySelector('.fmx-clock')).not.toBeNull()
  expect(end.querySelector('.fmx-budget-ring')).not.toBeNull()
  // A név a csoporton KÍVÜL marad, hogy szabadon terjeszkedhessen.
  expect(end.querySelector('.fmx-block-name')).toBeNull()
})
