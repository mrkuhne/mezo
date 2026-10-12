// ============================================================
// Mezo · FuelMealBlocks tests (Fuel Titanium S1b, mezo-33k6 — fagyasztott manifeszt
// A10 · A11 · A14; mezo-6g52f Task 7: az étkezési óra veszi át az ablak-csík helyét;
// Folyadék F5, mezo-n4wf5.5: a blokk fehér kártya, a keret-gyűrű az ablak csészéje, a négy
// mini gyűrű négy kapszula, a pont- és a vércukor-chip a közös Fuel-darab).
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

// A10/A14/mezo-6g52f: the day's PLANNED blocks are the list, and every block wears its own clock —
// no separate timeline strip.
test('every block carries the meal clock, logged or not, and no window strip', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const blocks = container.querySelectorAll('.fa-blk')
  expect(blocks.length).toBeGreaterThan(0)
  blocks.forEach(b => expect(b.querySelector('.fa-clock .fx-dial')).not.toBeNull())
  expect(container.querySelector('.fmx-window')).toBeNull()
  // the old skin is gone from the markup
  expect(container.querySelector('.glass, [class*="fmx-"]')).toBeNull()
})

test('a pre-log block shows the recommended line; a logged block shows no time line', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const open = container.querySelector('.fa-blk.open')!
  expect(open.querySelector('.fa-when')?.textContent).toMatch(/Ajánlott \d\d:\d\d–\d\d:\d\d/)
  const logged = container.querySelector('.fa-blk.is-logged')!
  expect(logged.querySelector('.fa-when')).toBeNull()
})

test('the clock opens the clock box', async () => {
  render(<FuelMealBlocks {...props()} />)
  await userEvent.click(screen.getAllByRole('button', { name: /ajánlott ablak|logolva/ })[0])
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

// Owner: NO kcal in the row — the budget sits on the block's cup.
test('a blokk csészéje viszi a keretet, az étkezés-sor nem ismétli meg', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const done = container.querySelector('.fa-blk.is-done')!
  expect(done.querySelector('.fa-bhd .fx-cup')).not.toBeNull()
  expect(done.querySelector('.fa-meal')!.textContent).not.toMatch(/kcal/)
})

test('the cup measures the meal budget, amber once it runs over', () => {
  const slots: FuelSlot[] = [
    slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', mealName: 'Nagy reggeli', kcal: 1120, plannedTime: '07:30', windowFrom: '07:00', windowTo: '09:20', budgetKcal: 780 }),
  ]
  const meals = [meal({ kcal: 1120 })]
  const { container } = render(<FuelMealBlocks lane={buildWindowLane({ slots, budget: BUDGET, meals })}
    meals={doneMealRows(meals, slots)} day={day} fiberTargetG={30}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const cup = container.querySelector('.fa-blk.is-logged .fx-cup')!
  // thousands are grouped with a space — 1120 kcal reads "1 120".
  expect(cup.getAttribute('aria-label')).toBe('Logolva: 1 120 / 780 kcal (144%)')
  expect(cup.classList.contains('over')).toBe(true)
  expect(cup).toHaveTextContent('1 120/ 780')
})

// mezo-6g52f minor d: the over state only starts past a >3% overshoot — rounding noise is no overshoot.
test('the over state only appears past the >3% threshold, not right at 100%', () => {
  const cupFor = (kcal: number, budgetKcal: number) => {
    const slots: FuelSlot[] = [
      slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', mealName: 'Reggeli', kcal, plannedTime: '07:30', windowFrom: '07:00', windowTo: '09:20', budgetKcal }),
    ]
    const meals = [meal({ kcal })]
    const { container } = render(<FuelMealBlocks lane={buildWindowLane({ slots, budget: BUDGET, meals })}
      meals={doneMealRows(meals, slots)} day={day} fiberTargetG={30}
      onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
    return container.querySelector('.fa-blk.is-logged .fx-cup')!
  }
  expect(cupFor(102, 100).classList.contains('over')).toBe(false)
  expect(cupFor(110, 100).classList.contains('over')).toBe(true)
})

// An unlogged window's cup is empty with the dashed budget line, and the number is the budget.
test('az üres ablak csészéje a keretet mutatja', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const cup = container.querySelector('.fa-blk.open .fx-cup')!
  expect(cup.getAttribute('aria-label')).toBe('Keret: 700 kcal')
  expect(cup).toHaveTextContent('700keret')
})

// Logging goes INTO the block — the main road.
test('az üres blokk koppintása a saját ablakával indítja a naplózást', async () => {
  const onLogInto = vi.fn()
  render(<FuelMealBlocks {...props({ onLogInto })} />)
  await userEvent.click(screen.getByRole('button', { name: /Uzsonna.*logolás ide/ }))
  expect(onLogInto).toHaveBeenCalledTimes(1)
  expect(onLogInto.mock.calls[0][0].slotKey).toBe('snack')
})

// Approved 2026-10-12: „Logolás ide" is the filled button only on the window that is open NOW.
test('a „Logolás ide" csak a most nyitott ablakon teli gomb, máshol körvonalas', () => {
  render(<FuelMealBlocks {...props({ day: { ...day, nowHHmm: '12:00' } })} />)
  expect(screen.getByRole('button', { name: /Ebéd.*logolás ide/ }).classList.contains('ghost')).toBe(false)
  expect(screen.getByRole('button', { name: /Uzsonna.*logolás ide/ }).classList.contains('ghost')).toBe(true)
  expect(screen.getByRole('button', { name: /Vacsora.*logolás ide/ }).classList.contains('ghost')).toBe(true)
})

// A11 (mezo-jb84): the score chip has its OWN target — Mezo's rating.
test('a pont-chip Mezo értékelésére visz, a sor pedig a részletekre', async () => {
  const onOpenMeal = vi.fn()
  const onOpenScore = vi.fn()
  render(<FuelMealBlocks {...props({ onOpenMeal, onOpenScore })} />)
  await userEvent.click(screen.getByRole('button', { name: 'Mezo értékelése: 8,8' }))
  expect(onOpenScore).toHaveBeenCalledWith('meal-1')
  expect(onOpenMeal).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Skyr-bowl zabbal' }))
  expect(onOpenMeal).toHaveBeenCalledWith('meal-1')
})

test('the score is the shared chip: a button with the score glyph', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const score = container.querySelector('.fa-chips .fx-chip.sc')!
  expect(score.tagName).toBe('BUTTON')
  expect(score.querySelector('use')!.getAttribute('href')).toBe('#t-score')
  expect(score).toHaveTextContent('8,8')
})

test('a fresh log without a score reads „folyamatban" and is not a button', () => {
  const rows = [{ ...fixture().meals[0], scorePct: null }]
  const { container } = render(<FuelMealBlocks {...props({ meals: rows })} />)
  const pend = container.querySelector('.fa-chips .fx-chip.sc.pend')!
  expect(pend.tagName).toBe('SPAN')
  expect(pend).toHaveTextContent('folyamatban')
})

// mezo-l2gp0: four small capsules — P/C/F filled to the meal's OWN energy share
// (36/48/9 g → 144/192/81 kcal → 35/46/19%), fibre to the share of the day's amount (8/30 → 27%).
// The gram is the number; a level, never a ring.
const levels = (cells: Element) => Array.from(cells.querySelectorAll('.fo-mini .t i')).map(i => (i as HTMLElement).style.height)

test('a kapszulák az étkezés energia-arányáig telnek, a rost a napi adagig', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const cells = container.querySelector('.fa-blk.is-done .fx-cells')!
  expect(Array.from(cells.querySelectorAll('.fo-mini b')).map(c => c.textContent)).toEqual(['36 g', '48 g', '9 g', '8 g'])
  expect(levels(cells)).toEqual(['35%', '46%', '19%', '27%'])
  expect(cells.getAttribute('aria-label')).toBe(
    'fehérje 36 g, az étkezés energiájának 35%-a; szénhidrát 48 g, 46%; zsír 9 g, 19%; rost 8 g, a napi adag 27%-a',
  )
  expect(Array.from(cells.querySelectorAll('.fo-mini small')).map(c => c.textContent)).toEqual(['feh.', 'szénh.', 'zsír', 'rost'])
  expect(cells.querySelector('circle')).toBeNull()
})

// Honest-null: a missing macro is „—" and then NO capsule shows a share (a truncated composition has none).
test('a hiányzó makró gondolatjel a kapszulában, és ilyenkor egyik szintje sincs aránynak', () => {
  const rows = [{
    mealId: 'meal-1', name: 'Skyr-bowl zabbal', time: '07:40', kcal: 420,
    proteinG: 36, carbsG: null, fatG: null, fiberG: null, sugarG: null,
    plannedTime: '07:30', scorePct: 88, timing: null,
  }]
  const { container } = render(<FuelMealBlocks {...props({ meals: rows })} />)
  const cells = container.querySelector('.fa-blk.is-done .fx-cells')!
  expect(Array.from(cells.querySelectorAll('.fo-mini b')).map(c => c.textContent)).toEqual(['36 g', '—', '—', '—'])
  expect(levels(cells)).toEqual(['0%', '0%', '0%', '0%'])
  expect(cells.getAttribute('aria-label')).toBe(
    'fehérje 36 g; szénhidrát nincs adat; zsír nincs adat; rost nincs adat',
  )
})

// The name lives full width; the capsules and the chips share the row under it (owner, v2).
test('az étkezés-sor: név felül, alul a kapszulák és a chipek egy sorban', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const row = container.querySelector('.fa-blk.is-done .fa-meal')!
  expect(row.firstElementChild!.className).toBe('fa-mn')
  const bottom = row.querySelector('.fa-mb')!
  expect(bottom.querySelector('.fx-cells')).not.toBeNull()
  expect(bottom.querySelector('.fx-chip.sc')).not.toBeNull()
  expect(row.textContent).not.toMatch(/kcal/)
})

// Honest-null + shame-free: a missed window is no error state.
test('a kimaradt ablak semlegesen jelenik meg, pontszám nélkül', () => {
  const { container } = render(<FuelMealBlocks {...props({ missed: true })} />)
  const missed = container.querySelector('.fa-blk.is-missed')!
  expect(missed.querySelector('.fx-chip.sc')).toBeNull()
  expect(missed.textContent).not.toMatch(/elrontott|kihagytad|hiba/i)
})

// ── the blood sugar chip on the Mai row (mezo-ya2wp), a band word (mezo-6g52f) ──────────────────
test('the blood-sugar chip carries the band word, never a number', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const chip = container.querySelector('.fa-chips .fx-chip:not(.sc)')!
  expect(chip.textContent).toMatch(/^(Alacsony|Közepes|Magas)$/)
})

test('a vércukor-chip a pont-chip bal oldalán áll, a sáv színét és szavát viseli', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const bottom = container.querySelector('.fa-blk.is-done .fa-mb')!
  const chip = bottom.querySelector('.fx-chip:not(.sc)')!
  expect(chip).not.toBeNull()
  // the fixture meal (48 g carbs, 8 g fibre, 36 g protein) gives the low band
  expect(chip.classList.contains('low')).toBe(true)
  expect(chip.getAttribute('aria-label')).toBe('Vércukor-válasz: alacsony')
  // the order is the point: capsules → blood sugar → score
  const order = Array.from(bottom.querySelectorAll('.fx-cells, .fx-chip')).map(el => el.className)
  expect(order).toEqual(['fx-cells', 'fx-chip low', 'fx-chip sc'])
  // the chip carries the curve AND the band word, never a number
  expect(chip.querySelector('.fx-gmini')).not.toBeNull()
  expect(chip.textContent).toBe('Alacsony')
})

test('a vércukor-chip a vércukor-lapot nyitja ugyanarra az étkezésre', async () => {
  // the sheet fetches the meal's verdict (the tips) — it needs the query client
  render(<FuelMealBlocks {...props()} />, { wrapper: QueryWrapper })
  expect(screen.queryByRole('dialog')).toBeNull()
  await userEvent.click(screen.getByLabelText('Vércukor-válasz: alacsony'))
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/glikémiás index/i)
})

// Honest-null: no carbohydrate data → no band, so no chip either — nothing is guessed.
// The clock box's „A vércukor-válasz részletei" link (prototype `ora` sheet): from a LOGGED block's clock it swaps the
// clock box for the blood-sugar sheet of the same meal; an unlogged block's clock has no such link.
test('a logolt blokk órájából a vércukor-válasz részletei a vércukor-lapra visznek', async () => {
  render(<FuelMealBlocks {...props()} />, { wrapper: QueryWrapper })
  await userEvent.click(screen.getByRole('button', { name: 'Reggeli · logolva 07:40' }))
  const clock = await screen.findByRole('dialog')
  expect(clock).toHaveAccessibleName('Reggeli')
  await userEvent.click(screen.getByRole('button', { name: 'A vércukor-válasz részletei' }))
  const sheets = await screen.findAllByRole('dialog')
  expect(sheets).toHaveLength(1)
  expect(sheets[0].className).toContain('fe-glu')
})
test('a nem logolt blokk órájában nincs vércukor-link', async () => {
  render(<FuelMealBlocks {...props()} />, { wrapper: QueryWrapper })
  await userEvent.click(screen.getByRole('button', { name: /^Ebéd.*ajánlott ablak/ }))
  await screen.findByRole('dialog')
  expect(screen.queryByRole('button', { name: 'A vércukor-válasz részletei' })).toBeNull()
})

test('szénhidrát-adat nélkül a vércukor-chip elmarad', () => {
  const rows = [{
    mealId: 'meal-1', name: 'Skyr-bowl zabbal', time: '07:40', kcal: 420,
    proteinG: 36, carbsG: null, fatG: null, fiberG: null, sugarG: null,
    plannedTime: '07:30', scorePct: 88, timing: null,
  }]
  const { container } = render(<FuelMealBlocks {...props({ meals: rows })} />)
  expect(container.querySelector('.fa-chips .fx-chip:not(.sc)')).toBeNull()
  // the score chip stays where it is
  expect(container.querySelector('.fa-mb .fx-chip.sc')).not.toBeNull()
})

// The head: glyph · name · the clock · the cup, in one row; the name is free to grow.
test('a blokk fejlécében a név után az óra és a csésze áll', () => {
  const { container } = render(<FuelMealBlocks {...props()} />)
  const head = container.querySelector('.fa-blk.is-done .fa-bhd')!
  expect(Array.from(head.children).map(c => c.className.split(' ')[0])).toEqual(['fo-bub', 'g', 'fa-clock', 'fx-cup'])
  expect(head.querySelector('.g strong')).toHaveTextContent('Reggeli')
  expect(head.querySelector('.fo-bub use')!.getAttribute('href')).toBe('#t-sun')
})

// Behaviour change 1 (owner 2026-10-12): a window-less extra log is its own block, titled by the logic
// („Ablakon kívül · HH:mm"), with a plain kcal number where the cup would be.
test('az ablakon kívüli log saját blokk: a címe az érkező címke, csésze helyett sima kcal', () => {
  const slots: FuelSlot[] = [
    slot({ time: '10:05', kind: 'snack', label: 'Ablakon kívül · 10:05', slotKey: 'snack', state: 'done', mealId: 'meal-1', mealName: 'Whey + banán', kcal: 356,
      windowFrom: undefined, windowTo: undefined, budgetKcal: undefined, plannedTime: undefined }),
  ]
  const meals = [meal({ slot: 'snack', title: 'Whey + banán', kcal: 356, loggedAt: '2026-09-12T10:05:00' })]
  const { container } = render(<FuelMealBlocks lane={buildWindowLane({ slots, budget: BUDGET, meals })}
    meals={doneMealRows(meals, slots)} day={day} fiberTargetG={30}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const block = screen.getByRole('region', { name: 'Ablakon kívül · 10:05' })
  expect(block.querySelector('.fa-bhd strong')).toHaveTextContent('Ablakon kívül · 10:05')
  const cup = block.querySelector('.fx-cup')!
  expect(cup).toHaveTextContent('356kcal')
  expect(cup.querySelector('.fo-fill')).toBeNull()
  expect(container.querySelector('.fa-when')).toBeNull()
  expect(container.textContent).not.toContain('Logolás ide')
})

// ── mezo-6g52f R1: the second line of „Logolás ide" counts from its OWN window, not from tile.state ──
// tile.state 'now' is true for the day's FIRST unlogged window — even when THAT window only opens
// later. The button must not say „most nyitva" about a 17:45–18:45 window at 13:30.
test('a „Logolás ide" gomb a saját ablakából számol, nem a tile.state "now"-jából', () => {
  const slots: FuelSlot[] = [
    slot({ time: '17:45', label: 'Vacsora', slotKey: 'dinner', state: 'now', windowFrom: '17:45', windowTo: '18:45', budgetKcal: 650 }),
  ]
  const meals: FuelMeal[] = []
  const { container } = render(<FuelMealBlocks
    lane={buildWindowLane({ slots, budget: BUDGET, meals })}
    meals={doneMealRows(meals, slots)} day={{ ...day, nowHHmm: '13:30' }} fiberTargetG={30}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  const block = container.querySelector('.fa-blk')!
  expect(block.textContent).not.toMatch(/most nyitva|most van itt/i)
  expect(block.querySelector('.fa-log small')!.textContent).toBe('még ráér')
  expect(block.querySelector('.fa-log')!.classList.contains('ghost')).toBe(true)
})

// ── mezo-6g52f R4: on a past day there is no „now" anywhere ─────────────────────────────────────
test('nowHHmm null (múltbéli nap) esetén nincs élő óra és nincs "most nyitva" szöveg', () => {
  const { container } = render(<FuelMealBlocks {...props({ day: { ...day, nowHHmm: null } })} />)
  expect(container.querySelector('.fa-clock.live')).toBeNull()
  expect(container.textContent).not.toMatch(/most nyitva/i)
})

test('the clock of the window that is open now is ringed; a logged block never is', () => {
  const { container } = render(<FuelMealBlocks {...props({ day: { ...day, nowHHmm: '12:00' } })} />)
  const live = container.querySelectorAll('.fa-clock.live')
  expect(live).toHaveLength(1)
  expect(live[0].getAttribute('aria-label')).toBe('Ebéd · ajánlott ablak 11:45–13:15')
  expect(container.querySelector('.fa-blk.is-logged .fa-clock')!.getAttribute('aria-label')).toBe('Reggeli · logolva 07:40')
})

// ── Kihagyás S3 (mezo-q4xt2.3): Kihagyom / the skipped card ────────────────────────────────────
const SHAME = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i

function skipFixture({ skipped = false, reason = 'NOT_HUNGRY' as const } = {}) {
  const slots: FuelSlot[] = [
    slot({ time: '12:30', label: 'Ebéd', slotKey: 'lunch', state: 'now', windowFrom: '11:45', windowTo: '13:15', budgetKcal: 700, skipKey: 'lunch#1' }),
    slot({
      time: '16:30', label: 'Uzsonna', slotKey: 'snack', state: skipped ? 'skipped' : 'pending',
      windowFrom: '16:00', windowTo: '17:00', budgetKcal: 420, skipKey: 'snack#1',
      ...(skipped ? { skip: { id: 'sk-1', reasonCategory: reason, reasonText: null } } : {}),
    }),
  ]
  return { lane: buildWindowLane({ slots, budget: BUDGET, meals: [] }), meals: [], day: { ...day, nowHHmm: '12:40' } }
}

const skipping = (over: Record<string, unknown> = {}) => ({
  date: '2026-09-12', today: '2026-09-12', fuelMode: null,
  onSkip: vi.fn(), onReason: vi.fn(), onUndo: vi.fn(), onAte: vi.fn(), ...over,
})

test('an unlogged pending tile offers „Kihagyom" with an accessible name, and the tap hands over the tile', async () => {
  const sk = skipping()
  render(<FuelMealBlocks {...props(skipFixture())} skipping={sk} />)
  const btn = screen.getByRole('button', { name: /Uzsonna kihagyása/ })
  expect(btn).toHaveTextContent('Kihagyom')
  // a quiet text link beside „Logolás ide", in the same action row
  expect(btn.classList.contains('fo-lk')).toBe(true)
  expect(btn.parentElement!.querySelector('.fa-log')).not.toBeNull()
  await userEvent.click(btn)
  expect(sk.onSkip).toHaveBeenCalledWith(expect.objectContaining({ skipKey: 'snack#1' }))
})

test('the button reads „Kihagytam" on a past day and once the window is over', () => {
  const { unmount } = render(<FuelMealBlocks {...props({ ...skipFixture(), day: { ...day, nowHHmm: null } })}
    skipping={skipping({ date: '2026-09-11' })} />)
  expect(screen.getByRole('button', { name: /Uzsonna kihagyása/ })).toHaveTextContent('Kihagytam')
  unmount()
  render(<FuelMealBlocks {...props({ ...skipFixture(), day: { ...day, nowHHmm: '17:30' } })} skipping={skipping()} />)
  expect(screen.getByRole('button', { name: /Uzsonna kihagyása/ })).toHaveTextContent('Kihagytam')
  expect(screen.getByRole('button', { name: /Ebéd kihagyása/ })).toHaveTextContent('Kihagytam')
})

test('no skip button without the actions, on a GUIDANCE day, or older than 7 days', () => {
  const { unmount } = render(<FuelMealBlocks {...props(skipFixture())} />)
  expect(screen.queryByText('Kihagyom')).toBeNull()
  unmount()
  const g = render(<FuelMealBlocks {...props(skipFixture())} skipping={skipping({ fuelMode: 'GUIDANCE' })} />)
  expect(screen.queryByText('Kihagyom')).toBeNull()
  g.unmount()
  render(<FuelMealBlocks {...props(skipFixture())} skipping={skipping({ date: '2026-09-01' })} />)
  expect(screen.queryByText(/Kihagy/)).toBeNull()
})

test('a skipped tile shows the quiet card: reason, kcal line, three actions — and no Logolás ide / cup', async () => {
  const sk = skipping()
  const { container } = render(<FuelMealBlocks {...props(skipFixture({ skipped: true }))} skipping={sk} />)
  const block = container.querySelector('.fa-blk.is-skipped')!
  expect(block).not.toBeNull()
  expect(block.getAttribute('aria-label')).toBe('Uzsonna · kihagyva')
  expect(block.querySelector('.fa-bhd .fo-st')).toHaveTextContent('kihagyva')
  expect(block.querySelector('.fx-cup')).toBeNull()
  expect(block).toHaveTextContent('Kihagyva · Nem vagyok éhes')
  expect(block).toHaveTextContent('420 kcal kiesett a napból. A többi étkezésed nem lett nagyobb.')
  expect(block.querySelector('.fa-skipped .fx-tip use')?.getAttribute('href')).toBe('#t-nohunger')
  expect(block.textContent).not.toContain('Logolás ide')
  expect(screen.queryByRole('button', { name: /Uzsonna kihagyása/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Másik ok' }))
  expect(sk.onReason).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Visszavonom' }))
  expect(sk.onUndo).toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Mégis ettem' }))
  expect(sk.onAte).toHaveBeenCalledWith(expect.objectContaining({ skipKey: 'snack#1' }))
})

test('a skip without a reason reads „ok nélkül" and offers „Okot adok"', () => {
  render(<FuelMealBlocks {...props(skipFixture({ skipped: true, reason: 'NONE' as never }))} skipping={skipping()} />)
  expect(screen.getByText('Kihagyva · ok nélkül')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Okot adok' })).toBeInTheDocument()
})

test('no shame vocabulary, no warn/over class in any skip state', () => {
  for (const fx of [skipFixture(), skipFixture({ skipped: true }), skipFixture({ skipped: true, reason: 'NONE' as never })]) {
    const { container, unmount } = render(<FuelMealBlocks {...props({ ...fx, day: { ...day, nowHHmm: '17:30' } })} skipping={skipping()} />)
    expect(container.textContent).not.toMatch(SHAME)
    expect(container.querySelector('.is-skipped.is-missed, .is-skipped .fx-cup.over, [class*="warn"], .fo-st.bad')).toBeNull()
    unmount()
  }
})

// ── Kihagyás S3 (mezo-q4xt2.3): the gentle-mode blocks ─────────────────────────────────────────
test('GUIDANCE: no cup, no Ajánlott/pótolható, plain kcal when logged, calm sub-labels, no Kihagyom', () => {
  const { container } = render(<FuelMealBlocks {...props({ day: { ...day, nowHHmm: '17:30' } })}
    fuelMode="GUIDANCE" skipping={skipping({ fuelMode: 'GUIDANCE' })} />)
  expect(container.querySelector('.fx-cup .fo-fill')).toBeNull()
  // the logged breakfast shows its kcal plain; an empty window shows no number at all
  expect(container.querySelector('.fa-blk.is-logged .fx-cup')).toHaveTextContent('420kcal')
  expect(container.querySelector('.fa-blk.open .fx-cup')).toBeNull()
  // unlogged windows: no „Ajánlott …" line — the calm sentence instead
  expect(container.textContent).not.toMatch(/Ajánlott|pótolható/)
  expect(screen.getAllByText('Ha megy, egyél. Nincs mihez mérni.').length).toBeGreaterThan(0)
  // the log button's second line is „ha ettél, beírhatod", even in an open window
  const lunch = screen.getByRole('button', { name: /Ebéd.*logolás ide/ })
  expect(lunch).toHaveTextContent('ha ettél, beírhatod')
  expect(screen.queryByText(/Kihagy/)).toBeNull()
  expect(container.textContent).not.toMatch(SHAME)
})

test('GUIDANCE: an already skipped slot reads „Nem számít mulasztásnak. Jobbulást!" — nothing „kiesett"', () => {
  const { container } = render(<FuelMealBlocks {...props(skipFixture({ skipped: true }))} fuelMode="GUIDANCE"
    skipping={skipping({ fuelMode: 'GUIDANCE' })} />)
  const block = container.querySelector('.fa-blk.is-skipped')!
  expect(block).toHaveTextContent('Nem számít mulasztásnak. Jobbulást!')
  expect(block.textContent).not.toMatch(/kiesett|nem lett nagyobb/)
  expect(screen.getByRole('button', { name: 'Visszavonom' })).toBeInTheDocument()
})

test.each(['MAINTENANCE', 'ESTIMATE'] as const)('%s: a closed unlogged window shows no „még pótolható" word, the log label softens; the cup stays', (mode) => {
  const { container } = render(<FuelMealBlocks {...props({ ...skipFixture(), day: { ...day, nowHHmm: '17:30' } })}
    fuelMode={mode} skipping={skipping({ fuelMode: mode })} />)
  expect(container.textContent).not.toMatch(/pótolható/)
  expect(screen.getByRole('button', { name: /Ebéd.*logolás ide/ })).toHaveTextContent('ha ettél, beírhatod')
  expect(container.querySelector('.fx-cup .fo-fill')).not.toBeNull()
  // the windows still offer Ajánlott and Kihagytam
  expect(container.querySelector('.fa-when')).toHaveTextContent('Ajánlott')
  expect(screen.getByRole('button', { name: /Uzsonna kihagyása/ })).toBeInTheDocument()
  expect(container.textContent).not.toMatch(SHAME)
})

test('no mode: the closed window keeps its „még pótolható" word (unchanged)', () => {
  render(<FuelMealBlocks {...props({ ...skipFixture(), day: { ...day, nowHHmm: '17:30' } })} skipping={skipping()} />)
  expect(screen.getAllByText('még pótolható').length).toBeGreaterThan(0)
})

// Kihagyás S3: on a gentle day (MAINTENANCE / ESTIMATE) the cup never says „over".
test.each([['MAINTENANCE'], ['ESTIMATE'], [null]] as const)('the cup\'s over state and percentage on a %s day', (mode) => {
  const slots: FuelSlot[] = [
    slot({ time: '07:40', label: 'Reggeli', slotKey: 'breakfast', state: 'done', mealId: 'meal-1', kcal: 900, windowFrom: '07:00', windowTo: '09:20', budgetKcal: 400 }),
  ]
  const meals = [meal({ kcal: 900 })]
  const { container } = render(
    <FuelMealBlocks lane={buildWindowLane({ slots, budget: BUDGET, meals })} meals={doneMealRows(meals, slots)} day={day}
      fiberTargetG={30} fuelMode={mode} onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />,
    { wrapper: QueryWrapper })
  const cup = container.querySelector('.fx-cup')!
  if (mode == null) {
    expect(cup.classList.contains('over')).toBe(true)
    expect(cup.getAttribute('aria-label')).toMatch(/%/)
  } else {
    expect(cup.classList.contains('over')).toBe(false)
    expect(cup.getAttribute('aria-label')).not.toMatch(/%/)
    expect(cup.querySelector('.fo-fill')).not.toBeNull()
  }
})

test('a day without windows names the gap instead of fabricating blocks', () => {
  const { container } = render(<FuelMealBlocks lane={{ tiles: [], nowKey: null }} meals={[]} day={day} fiberTargetG={30}
    onLogInto={vi.fn()} onOpenMeal={vi.fn()} onOpenScore={vi.fn()} />)
  expect(screen.getByText('Ma még nincs tervezett étkezési ablak. Logolj bármit, bármikor.')).toBeInTheDocument()
  expect(container.querySelector('.fa-blk')).toBeNull()
})
