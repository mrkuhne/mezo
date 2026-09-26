// ============================================================
// Mezo · FuelMealBlocks tests (Fuel Titanium S1b, mezo-33k6 — fagyasztott manifeszt
// A10 · A11 · A14; mezo-6g52f Task 7: az étkezési óra veszi át az ablak-csík helyét).
// A lane-t a VALÓDI builder adja (`buildWindowLane`), a fuelSwimlane.test.ts
// `slot()`/`meal()` fixture-stílusában: ha a VM szerződése elmozdul, ezek a tesztek
// törnek, nem egy kézzel írt literál hazudik zöldet.
// ============================================================
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { FuelMeal, FuelSlot } from '@/data/types'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import { buildWindowLane } from '@/features/fuel/logic/fuelSwimlane'
import { doneMealRows } from '@/features/fuel/logic/keretHero'
import { FuelMealBlocks } from '@/features/fuel/components/FuelMealBlocks'
import { QueryWrapper } from '@/test/queryWrapper'

const BUDGET: DayBudget = {
  kcal: 2400, p: 180, c: 240, f: 72,
  energy: { base: 2000, planned: 400, extra: 0, balance: 0, target: 2400 },
}

const day = { wake: '06:40', bed: '23:00', nowHHmm: '10:52', training: null }

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
  windowFrom: '07:00', windowTo: '09:20', windowReasons: [], budgetKcal: 400, plannedTime: '07:30',
  ...over,
})

/** A nap négy tervezett blokkja: a reggeli be van logolva, a többi nyitott/jövő. */
function fixture({ missed = false }: { missed?: boolean } = {}) {
  const slots: FuelSlot[] = [
    slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', mealName: 'Skyr-bowl zabbal', kcal: 420, plannedTime: '07:30', windowFrom: '07:00', windowTo: '09:20', budgetKcal: 400 }),
    slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: missed ? 'missed' : 'now', windowFrom: '11:45', windowTo: '13:15', budgetKcal: 700 }),
    slot({ time: '16:30', label: 'Uzsonna', slotKey: 'snack', state: 'pending', windowFrom: '16:00', windowTo: '17:00', budgetKcal: 250 }),
    slot({ time: '19:30', label: 'Vacsora', slotKey: 'dinner', state: 'pending', windowFrom: '18:45', windowTo: '20:15', budgetKcal: 650 }),
  ]
  const meals = [meal()]
  return {
    lane: buildWindowLane({ slots, budget: BUDGET, meals }),
    meals: doneMealRows(meals, slots),
    day,
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

// A10/A14/mezo-6g52f: a nap TERVEZETT blokkjai a lista, és minden blokk a saját
// étkezési óráját viseli — nem külön idővonal-sáv/ablak-csík.
test('every block carries the meal clock, logged or not, and no window strip', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const blocks = container.querySelectorAll('.fmx-block')
  expect(blocks.length).toBeGreaterThan(0)
  blocks.forEach(b => expect(b.querySelector('.fmx-mclock')).not.toBeNull())
  expect(container.querySelector('.fmx-window')).toBeNull()
})

test('a pre-log block shows the recommended line; a logged block shows no time line', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const open = container.querySelector('.fmx-block.is-open')!
  expect(open.querySelector('.fmx-when')?.textContent).toMatch(/Ajánlott \d\d:\d\d–\d\d:\d\d/)
  const logged = container.querySelector('.fmx-block.glass')!
  expect(logged.querySelector('.fmx-when')).toBeNull()
})

test('the clock opens the clock box', async () => {
  render(<FuelMealBlocks {...props()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /ajánlott ablak|logolva/ })[0])
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

// Az owner döntése: a SORBAN nincs kcal — a keret a blokk gyűrűjén ül.
test('a blokk gyűrűje viszi a keretet, az étkezés-sor nem ismétli meg', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const done = container.querySelector('.fmx-block.is-done')!
  expect(done.querySelector('.fmx-budget-ring')).not.toBeNull()
  expect(done.querySelector('.fmx-meal-row')!.textContent).not.toMatch(/kcal/)
})

test('the kcal ring measures the meal budget, with an overflow lap past 100%', () => {
  const slots: FuelSlot[] = [
    slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', mealName: 'Nagy reggeli', kcal: 1120, plannedTime: '07:30', windowFrom: '07:00', windowTo: '09:20', budgetKcal: 780 }),
  ]
  const meals = [meal({ kcal: 1120 })]
  const { container } = render(<FuelMealBlocks lane={buildWindowLane({ slots, budget: BUDGET, meals })}
    meals={doneMealRows(meals, slots)} day={day} fiberTargetG={30}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const ring = container.querySelector('.fmx-block.glass .fmx-budget-ring')!
  // huInt groups thousands with a space (huNum.ts) — 1120 kcal reads "1 120".
  expect(ring.getAttribute('aria-label')).toBe('Logolva: 1 120 / 780 kcal (144%)')
  expect(ring.querySelector('.fmx-br-over')).not.toBeNull()
})

// mezo-6g52f minor d: az overflow-ív csak a >3%-os túllépésnél jelenik meg (BudgetRing `over > 3`)
// — a kerekítés okozta pár %-os zajt nem jelezzük túllépésnek.
test('the overflow lap only appears past the >3% threshold, not right at 100%', () => {
  const ringFor = (kcal: number, budgetKcal: number) => {
    const slots: FuelSlot[] = [
      slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', mealName: 'Reggeli', kcal, plannedTime: '07:30', windowFrom: '07:00', windowTo: '09:20', budgetKcal }),
    ]
    const meals = [meal({ kcal })]
    const { container } = render(<FuelMealBlocks lane={buildWindowLane({ slots, budget: BUDGET, meals })}
      meals={doneMealRows(meals, slots)} day={day} fiberTargetG={30}
      onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
    return container.querySelector('.fmx-block.glass .fmx-budget-ring')!
  }
  // 102% — within the 3%-tolerance, no overflow lap.
  expect(ringFor(102, 100).querySelector('.fmx-br-over')).toBeNull()
  // 110% — past the tolerance, overflow lap present.
  expect(ringFor(110, 100).querySelector('.fmx-br-over')).not.toBeNull()
})

// A logolás a blokkba történik — ez a fő útvonal.
test('az üres blokk koppintása a saját ablakával indítja a naplózást', async () => {
  const onLogInto = vi.fn()
  render(<FuelMealBlocks {...props({ onLogInto })} />)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna.*logolás ide/ }))
  expect(onLogInto).toHaveBeenCalledTimes(1)
  expect(onLogInto.mock.calls[0][0].slotKey).toBe('snack')
})

// A11 (mezo-jb84): a pontszám-chipnek SAJÁT célja van — az AI értékelés.
test('a pont-chip az AI értékelésre visz, a sor pedig a részletekre', async () => {
  const onOpenMeal = vi.fn()
  const onOpenScore = vi.fn()
  render(<FuelMealBlocks {...props({ onOpenMeal, onOpenScore })} />)
  await userEvent.click(screen.getByRole('button', { name: /AI értékelés/ }))
  expect(onOpenScore).toHaveBeenCalledWith('meal-1')
  expect(onOpenMeal).not.toHaveBeenCalled()
})

test('the score is an unboxed button with the crystal icon', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const score = container.querySelector('.fmx-meal-chips .fmx-score')!
  expect(score.tagName).toBe('BUTTON')
  expect(score.classList.contains('is-unboxed')).toBe(true)
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
    proteinG: 36, carbsG: null, fatG: null, fiberG: null, sugarG: null,
    plannedTime: '07:30', scorePct: 88, timing: null,
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

// ── A vércukor-chip a Mai soron (mezo-ya2wp), sáv-szóval (mezo-6g52f) ──────────────────────
test('the blood-sugar chip carries the band word, never a number', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const chip = container.querySelector('.fmx-glu-chip')
  if (chip) expect(chip.textContent).toMatch(/^(Alacsony|Közepes|Magas)$/)
})

test('a vércukor-chip a pont-chip bal oldalán áll, a sáv színét és szavát viseli', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const bottom = container.querySelector('.fmx-block.is-done .fmx-meal-bottom')!
  const chip = bottom.querySelector('.fmx-glu-chip')!
  expect(chip).not.toBeNull()
  // A fixture-étkezés (48 g ch, 8 g rost, 36 g fehérje) alacsony sávot ad.
  expect(chip.className).toContain('lvl-low')
  expect(chip.getAttribute('aria-label')).toBe('Vércukor-válasz: alacsony')
  // A sorrend a lényeg: gyűrűk → vércukor → pontszám.
  const order = Array.from(bottom.querySelectorAll('.fmx-mrings, .fmx-glu-chip, .fmx-score'))
    .map(el => el.className.split(' ')[0])
  expect(order).toEqual(['fmx-mrings', 'fmx-glu-chip', 'fmx-score'])
  // A chip a görbét ÉS a sáv szavát hordja, számot soha — glikémiás index sehol.
  expect(chip.querySelector('.fmx-glu-mini')).not.toBeNull()
  expect(chip.textContent).toBe('Alacsony')
})

test('a vércukor-chip ugyanazt az üvegdobozt nyitja, amit a részletek oldal', async () => {
  // A doboz lekéri az étkezés coach-verdiktjét (AI vércukor-tippek) — ehhez kell a query-kliens.
  render(<FuelMealBlocks {...props()} />, { wrapper: QueryWrapper })
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
    plannedTime: '07:30', scorePct: 88, timing: null,
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
  expect(end.querySelector('.fmx-mclock')).not.toBeNull()
  expect(end.querySelector('.fmx-budget-ring')).not.toBeNull()
  // A név a csoporton KÍVÜL marad, hogy szabadon terjeszkedhessen.
  expect(end.querySelector('.fmx-block-name')).toBeNull()
})

// ── mezo-6g52f R1: a „Logolás ide" alsó sora a SAJÁT ablakából számol, nem a tile.state-ből ──
// A tile.state 'now' a nap ELSŐ lognélküli ablakára igaz — akkor is, ha AZ az ablak csak
// később nyílik. A gomb szövege nem hazudhat „most nyitva"-t egy 17:45–18:45-ös ablakra 13:30-kor.
test('a „Logolás ide" gomb a saját ablakából számol, nem a tile.state "now"-jából', () => {
  const slots: FuelSlot[] = [
    slot({ time: '17:45', label: 'Vacsora', slotKey: 'dinner', state: 'now', windowFrom: '17:45', windowTo: '18:45', budgetKcal: 650 }),
  ]
  const meals: FuelMeal[] = []
  const { container } = render(<FuelMealBlocks
    lane={buildWindowLane({ slots, budget: BUDGET, meals })}
    meals={doneMealRows(meals, slots)} day={{ ...day, nowHHmm: '13:30' }} fiberTargetG={30}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const block = container.querySelector('.fmx-block')!
  expect(block.textContent).not.toMatch(/most nyitva|most van itt/i)
  expect(block.querySelector('.fmx-block-log small')!.textContent).toBe('még ráér')
})

// ── mezo-6g52f R4: múltbéli napon nincs „most" jel sehol az órán ─────────────────────────────
test('nowHHmm null (múltbéli nap) esetén nincs nyitott óra és nincs "most nyitva" szöveg', () => {
  const { container } = render(<FuelMealBlocks {...props({ day: { ...day, nowHHmm: null } })} />)
  expect(container.querySelector('.fmx-mclock.is-open')).toBeNull()
  expect(container.textContent).not.toMatch(/most nyitva/i)
})
