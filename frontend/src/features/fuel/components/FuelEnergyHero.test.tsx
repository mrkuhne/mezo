// ============================================================
// Mezo · FuelEnergyHero tests (Fuel Titanium S1a, mezo-33k6 — manifest rows A1 + A15; Folyadék F5,
// mezo-n4wf5.5: the gauge ring became the day's BOWL, the hero says its verdict in one sentence, the
// equation opens in a light sheet). The hero's message is what still fits; the math behind it opens
// on tap. Honest-null and adherence-neutral copy are contracts, not polish.
// ============================================================
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import type { ExpenditureWeeklyCard } from '@/data/fuel/expenditureApi'
import { asPastDayHero, buildKeretHero } from '@/features/fuel/logic/keretHero'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import { FuelEnergyHero } from '@/features/fuel/components/FuelEnergyHero'
import { fmtGrouped } from '@/shared/lib/format'

// The weekly-learning sheet (mezo-3n2so) reads its mark/dismiss hooks; stubbed so the hero tests
// stay provider-free and mode-independent.
vi.mock('@/data/fuel/expenditureHooks', () => ({
  useIntakeDayMark: () => ({ setMark: vi.fn(), clearMark: vi.fn(), pending: false }),
  useDismissWeeklyCard: () => ({ dismiss: vi.fn() }),
}))

// The keretHero.test.ts fixture style, with a consumed figure that leaves a round 2 060.
const BUDGET: DayBudget = { kcal: 2400, p: 160, c: 260, f: 80, energy: { base: 2000, planned: 400, extra: 0, balance: 0, target: 2400 } }

const vm = (over: Partial<Parameters<typeof buildKeretHero>[0]> = {}) =>
  buildKeretHero({
    budget: BUDGET,
    staticEnergy: false,
    consumed: { kcal: 340, p: 32, c: 50, f: 10 },
    meals: [],
    water: { currentMl: 1200, targetMl: 2400 },
    slots: [],
    nowHHmm: '12:00',
    fiberTargetG: 30,
    ...over,
  })

const WHY = /^Miből (jön|jött) össze\?/
/** Opens the equation sheet from the hero's link and hands back the dialog. */
async function openEq() {
  await userEvent.click(screen.getByRole('button', { name: WHY }))
  return screen.getByRole('dialog')
}
/** The equation rows in order (the closing „Marad" box last). */
const rowsOf = (box: HTMLElement) => [...box.querySelectorAll<HTMLElement>('.fa-eqrow, .fa-tot')]
const titleOf = (row: Element) => row.querySelector('strong')!.textContent
/** A row's value: the kit row's `.v`, the „Marad" box's own numeral. */
const valueOf = (row: Element) => (row.querySelector('.v') ?? row.querySelector(':scope > b'))!.textContent
const right = (c: HTMLElement) => c.querySelector('.fx-bg-n.r')!
const verdict = (c: HTMLElement) => c.querySelector('.fo-hero-verdict')!

// A1 (mezo-33k6): the hero's message is what still FITS — beside the bowl, and in the verdict sentence.
test('a maradék kcal a tál mellett áll, és a hős mondatban mondja ki a maradékot és a hiányzó fehérjét', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  expect(right(container).querySelector('b')).toHaveTextContent('2 060')
  expect(verdict(container)).toHaveTextContent('Még 2 060 kcal fér bele, 128 g fehérje hiányzik.')
  // a bowl, never a ring
  expect(container.querySelector('.fa-hero .fx-bowl-svg')).not.toBeNull()
  expect(container.querySelector('circle')).toBeNull()
  expect(container.querySelector('.glass, [class*="fmx-"]')).toBeNull()
})

test('ha a fehérje megvan, a mondat ezt mondja', () => {
  const { container } = render(<FuelEnergyHero vm={vm({ consumed: { kcal: 340, p: 160, c: 50, f: 10 } })} />)
  expect(verdict(container)).toHaveTextContent('Még 2 060 kcal fér bele, a fehérje megvan.')
})

// A2: the macro row is part of the hero face — five vials under section 1.
test('a hero alatt ott az öt makró-kémcső, az 1-es szakaszban', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  expect(screen.getByRole('heading', { name: /Mai makrók/ })).toHaveTextContent('1')
  expect(container.querySelectorAll('.fa-mac .fo-vial')).toHaveLength(5)
})

test('a víz-megjegyzés csak akkor áll ott, ha a víz kémcsöve tényleg ajtó, és csak ma', () => {
  const { rerender } = render(<FuelEnergyHero vm={vm()} />)
  expect(screen.queryByText('A Víz koppintható: onnan logolsz.')).toBeNull()
  rerender(<FuelEnergyHero vm={vm()} onWater={vi.fn()} />)
  expect(screen.getByText('A Víz koppintható: onnan logolsz.')).toBeInTheDocument()
  rerender(<FuelEnergyHero vm={vm()} onWater={vi.fn()} past />)
  expect(screen.queryByText('A Víz koppintható: onnan logolsz.')).toBeNull()
})

test('a hős egyetlen fő gombja a logolás; nélküle csak a link áll a folyadékon', async () => {
  const onLog = vi.fn()
  const { rerender, container } = render(<FuelEnergyHero vm={vm()} />)
  expect(container.querySelectorAll('.fo-hero-acts .fo-btn')).toHaveLength(0)
  rerender(<FuelEnergyHero vm={vm()} onLog={onLog} />)
  await userEvent.click(screen.getByRole('button', { name: 'Étkezés logolása' }))
  expect(onLog).toHaveBeenCalledOnce()
  rerender(<FuelEnergyHero vm={vm()} onLog={onLog} past />)
  expect(screen.getByRole('button', { name: 'Pótlás erre a napra' })).toBeInTheDocument()
})

// A15: the equation is not a drawer on the page — it opens in a sheet, and only on a tap.
test('a „Miből jön össze?" link világos lapon nyitja meg az egyenletet', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  const box = await openEq()
  expect(box.className).toContain('fo-sheet')
  expect(box.className).not.toContain('glass')
  expect(within(box).getByRole('heading', { name: '2 060 kcal fér még bele ma' })).toBeInTheDocument()
  expect(rowsOf(box).map(titleOf)).toEqual(['Alap', 'Mozgás', 'Étel', 'Marad'])
})

test('a tál maga is gomb: ugyanazt a lapot nyitja', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  await userEvent.click(screen.getByRole('button', { name: '340 / 2 400 kcal' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('az egyenlet-lap bezárható', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  await openEq()
  await userEvent.click(screen.getByRole('button', { name: 'Bezárom' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

// mezo-zz91i: a learned base swaps the Alap row's sub copy; the formula wording goes.
test('tanult alapnál az Alap sor a súlytrendből tanulást mondja, nem a képletet', async () => {
  const LEARNED: DayBudget = { ...BUDGET, energy: { ...BUDGET.energy, source: 'learned' } }
  render(<FuelEnergyHero vm={vm({ budget: LEARNED })} />)
  const base = rowsOf(await openEq())[0]
  expect(base.querySelector('small')!.textContent).toBe('a súlytrendedből és az evésedből tanulva')
})

test('formula alapnál az Alap sor az életmód-szöveget mondja', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  const base = rowsOf(await openEq())[0]
  expect(base.querySelector('small')!.textContent).toBe('az alapanyagcseréd és az életmódod')
})

// Honest-null: on a static budget there is no fabricated movement number.
test('statikus keretnél a mozgás sora gondolatjel, és a lábjegyzet megmondja, miért nincs bontás', async () => {
  render(<FuelEnergyHero vm={vm({ staticEnergy: true })} onOpenEnergy={vi.fn()} />)
  const box = await openEq()
  // Alap reads a bare „—", Mozgás keeps its operator („+ —"); no goal → no Célod row at all.
  expect(within(box).getAllByText('—')).toHaveLength(1)
  expect(within(box).queryByText('Célod')).not.toBeInTheDocument()
  expect(within(box).getByText('+ —')).toBeInTheDocument()
  expect(box).toHaveTextContent('Nincs aktív célod vagy friss testadatod, ezért a keret a beállított napi kereted: 2 400 kcal. Bontás ilyenkor nincs.')
  // nothing to explain in detail without a breakdown
  expect(within(box).queryByRole('button', { name: /Részletesen/ })).not.toBeInTheDocument()
})

// mezo-32m82: the Célod row closes the equation — Alap + Mozgás ± Célod − Étel = Marad.
const CUT: DayBudget = { kcal: 3171, p: 160, c: 260, f: 80, energy: { base: 2356, planned: 570, extra: 572, balance: -327, target: 3171 } }

test('fogyásnál a Célod sor saját előjellel (−) és a fogyási szöveggel áll, és az egyenlet kijön', async () => {
  const hero = vm({ budget: CUT, consumed: { kcal: 800, p: 0, c: 0, f: 0 } })
  render(<FuelEnergyHero vm={hero} trajectory="cut" />)
  const rows = rowsOf(await openEq())
  expect(rows.map(titleOf)).toEqual(['Alap', 'Mozgás', 'Célod', 'Étel', 'Marad'])
  const goal = rows[2]
  expect(valueOf(goal)).toBe(`− ${fmtGrouped(-CUT.energy.balance)}`)
  expect(within(goal).getByText('a fogyási célod napi része')).toBeInTheDocument()
  // Mozgás = planned + extra, and the extra credit is named in its sub copy.
  expect(valueOf(rows[1])).toBe(`+ ${fmtGrouped(CUT.energy.planned + CUT.energy.extra)}`)
  expect(within(rows[1]).getByText('ma logolt mozgásod + terven kívüli')).toBeInTheDocument()
  expect(valueOf(rows[3])).toBe('− 800')
  expect(valueOf(rows[4])).toBe(`${fmtGrouped(hero.remainingKcal)}kcal`)
  // Closure off the rendered VM: base + activity + balance − eaten = remaining.
  expect(hero.chips!.base + hero.chips!.activity + hero.chips!.balance - hero.consumedKcal).toBe(hero.remainingKcal)
  // one glyph per row, from the sprite
  expect(rows.slice(0, 4).map(r => r.querySelector('use')!.getAttribute('href'))).toEqual(['#t-flame', '#t-dumbbell', '#t-ring', '#t-bowl'])
})

// mezo-tb3s2: the Mozgás row names today's logged movement, and — when a planned session is still
// unlogged — previews how much the budget would grow.
const PENDING: DayBudget = { kcal: 2670, p: 160, c: 260, f: 80, energy: { base: 2480, planned: 190, extra: 0, balance: -400, target: 2670, pending: 460 } }

test('a Mozgás sor a ma logolt mozgást nevezi meg, és a pending sort mutatja', async () => {
  render(<FuelEnergyHero vm={vm({ budget: PENDING })} />)
  const activity = rowsOf(await openEq())[1]
  expect(activity.querySelector('small')!.firstChild!.textContent).toBe('ma logolt mozgásod')
  expect(within(activity).getByText('még jön +460, ha megcsinálod')).toBeInTheDocument()
})

test('nincs pending sor, ha nincs mit belogolni', async () => {
  const { unmount } = render(<FuelEnergyHero vm={vm({ budget: BUDGET })} />)
  await openEq()
  expect(screen.queryByText(/még jön/)).not.toBeInTheDocument()
  unmount()
})

test('pending sor múltbeli napon sem jelenik meg', async () => {
  render(<FuelEnergyHero vm={vm({ budget: PENDING })} past />)
  await openEq()
  expect(screen.queryByText(/még jön/)).not.toBeInTheDocument()
})

test('az egyenlet-lap a lábjegyzetet mutatja', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  await openEq()
  expect(screen.getByText('A keretet az alapigényed, a súlycélod és a mai mozgásod együtt adja; a keret akkor nő, amikor logolod az edzést.')).toBeInTheDocument()
})

test('tömegelésnél a Célod sor + előjelű', async () => {
  const bulk: DayBudget = { ...CUT, kcal: 3176, energy: { base: 2356, planned: 570, extra: 0, balance: 250, target: 3176 } }
  render(<FuelEnergyHero vm={vm({ budget: bulk })} trajectory="bulk" />)
  const goal = rowsOf(await openEq())[2]
  expect(valueOf(goal)).toBe('+ 250')
  expect(within(goal).getByText('a tömegelési célod napi része')).toBeInTheDocument()
})

test('egy célos felhasználó múltbeli napján a Célod sor őszintén „—", és a lap a lezárt nap szavaival beszél', async () => {
  render(<FuelEnergyHero vm={asPastDayHero(vm({ budget: CUT }))} past trajectory="cut" onOpenEnergy={vi.fn()} />)
  const box = await openEq()
  const rows = rowsOf(box)
  expect(titleOf(rows[2])).toBe('Célod')
  expect(valueOf(rows[2])).toBe('—')
  expect(within(box).getByRole('heading', { name: /kcal fért még bele$/ })).toBeInTheDocument()
  expect(within(rows[1]).getByText('aznap logolt mozgásod')).toBeInTheDocument()
  expect(within(rows[3]).getByText('amit aznap logoltál')).toBeInTheDocument()
  expect(within(rows[4]).getByText('a nap keretének maradéka')).toBeInTheDocument()
  expect(box).toHaveTextContent('Egy lezárt napnál csak az étel és a nap kerete ismert')
  expect(within(box).queryByRole('button', { name: /Részletesen/ })).not.toBeInTheDocument()
})

test('tartásnál a nem nulla maradék (BMR-padló) mellett nincs „tartás" felirat', async () => {
  const floored: DayBudget = { ...CUT, kcal: 2956, energy: { base: 2356, planned: 570, extra: 0, balance: 30, target: 2956 } }
  render(<FuelEnergyHero vm={vm({ budget: floored })} trajectory="maintain" />)
  const goal = rowsOf(await openEq())[2]
  expect(valueOf(goal)).toBe('+ 30')
  expect(goal.querySelector('small')).toBeNull()
  expect(goal.textContent).not.toMatch(/tartás/)
})

test('tartásnál nulla egyenleggel nincs Célod sor', async () => {
  const keep: DayBudget = { ...CUT, kcal: 2926, energy: { base: 2356, planned: 570, extra: 0, balance: 0, target: 2926 } }
  render(<FuelEnergyHero vm={vm({ budget: keep })} trajectory="maintain" />)
  expect(within(await openEq()).queryByText('Célod')).not.toBeInTheDocument()
})

// An over-eaten day does not shame. The SIGN is in the words („a keret felett"), the number is the
// absolute value — „−300 kcal a keret felett" would be a double negative. Neutral stays the point.
test('túllépett keretnél a felirat mondja meg az irányt, és nem minősít', () => {
  const over = vm({ consumed: { kcal: 3000, p: 0, c: 0, f: 0 } })
  const { container } = render(<FuelEnergyHero vm={over} />)
  expect(right(container).querySelector('small')!.textContent).toBe('a keret felett')
  expect(right(container).querySelector('b')!.textContent).toBe('600')
  expect(verdict(container)).toHaveTextContent('Ma 600 kcal-lal a keret felett vagy.')
  expect(container.textContent).not.toMatch(/−/)
  expect(container.textContent).not.toMatch(/elrontott|túlevés|hiba/i)
})

// mezo-jb84: the link ALWAYS opens the equation sheet; the parent's shared surface is the sheet's door.
test('a link a saját lapját nyitja, a szülő felületét pedig a lap ajtaja', async () => {
  let opened = 0
  render(<FuelEnergyHero vm={vm()} onOpenEnergy={() => { opened += 1 }} />)
  await openEq()
  expect(opened).toBe(0)
  await userEvent.click(screen.getByRole('button', { name: 'Részletesen, honnan jön a keret' }))
  expect(opened).toBe(1)
  // the equation sheet is gone at once — two sheets never stand on each other
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('ajtó nélkül a lap nem kínál részletes utat', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  await openEq()
  expect(screen.queryByRole('button', { name: /Részletesen/ })).not.toBeInTheDocument()
})

// A13 (mezo-33k6): on a PAST day the word „ma" would be a lie — the hero's copy follows the viewed day.
test('múltbeli napon a hero nem mondja azt, hogy „ma”', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} past onLog={vi.fn()} />)
  expect(container.textContent).not.toMatch(/(^|[^\p{L}])ma([^\p{L}]|$)/iu)
  expect(container.querySelector('.fo-hero-lbl')).toHaveTextContent('Ezen a napon')
  expect(verdict(container)).toHaveTextContent('2 060 kcal maradt a nap keretéből.')
  expect(container.querySelector('.fo-hero-sub')).toHaveTextContent('Amit most logolsz, erre a napra könyvelődik.')
  expect(right(container).querySelector('small')!.textContent).toBe('fért még bele')
  expect(screen.getByRole('button', { name: 'Miből jött össze?' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /A nap makrói/ })).toBeInTheDocument()
})

test('múltbeli, a keret feletti napon a mondat múlt időben áll, „ma” nélkül', () => {
  const { container } = render(<FuelEnergyHero vm={vm({ consumed: { kcal: 2700, p: 0, c: 0, f: 0 } })} past />)
  expect(verdict(container)).toHaveTextContent('Aznap 300 kcal-lal a keret felett voltál.')
})

test('a mai napon marad a „ma” megfogalmazás', async () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  expect(container.querySelector('.fo-hero-lbl')).toHaveTextContent('Ma eddig')
  expect(within(await openEq()).getByRole('heading', { name: /fér még bele ma$/ })).toBeInTheDocument()
})

// The approved layout: THREE parts in one row — eaten · the bowl filled to the budget · what still fits.
test('a hero három részes: ettél · tál · még belefér', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  const gauge = container.querySelector('.fa-hero .fx-bg')!
  expect(Array.from(gauge.children).map(c => c.className)).toEqual(['fx-bg-n', 'fx-bg-bowl', 'fx-bg-n r'])
  expect(gauge.children[0]).toHaveTextContent('340kcal-t ettél')
  expect(gauge.children[1]).toHaveTextContent('keret 2 400 kcal')
  expect(gauge.children[2]).toHaveTextContent('2 060még belefér')
})

// ── mezo-3n2so: weekly learning — a dot on the link, the Alap row a button, the „Heti tanulás" sheet ──
const WEEKLY: ExpenditureWeeklyCard = {
  weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'updated', confidence: 'high',
  appliedBaseKcal: 2480, posteriorSdKcal: 150, stepKcal: 60, usableDays: 4, weighInDays: 4,
  minUsableDays: 4, minWeighInDays: 2,
  excludedDays: [{ date: '2026-09-23', kcal: 1180, reason: 'suspicious' }],
}
const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)
/** The weekly dot (area D's `WeeklyLearningDot`): a decorative child of the link. */
const dotOf = (c: HTMLElement) => c.querySelector('.fa-eql [aria-hidden="true"]') as HTMLElement | null

test('heti kártyával a mai napon pötty ül a „Miből jön össze?” linken', () => {
  const { container } = inRouter(<FuelEnergyHero vm={vm()} weeklyCard={WEEKLY} />)
  const dot = dotOf(container)
  expect(dot).not.toBeNull()
  expect(dot!.className).not.toMatch(/hold/)
  // the dot is a signal only — the link's name does not change
  expect(screen.getByRole('button', { name: 'Miből jön össze?' })).toBeInTheDocument()
})

test('kevés adatnál a pötty üres', () => {
  const { container } = inRouter(<FuelEnergyHero vm={vm()} weeklyCard={{ ...WEEKLY, status: 'holding' }} />)
  expect(dotOf(container)!.className).toMatch(/hold/)
})

test('kártya nélkül, vagy múltbeli napon nincs pötty', () => {
  const { container, unmount } = inRouter(<FuelEnergyHero vm={vm()} weeklyCard={null} />)
  expect(dotOf(container)).toBeNull()
  unmount()
  const past = inRouter(<FuelEnergyHero vm={vm()} past weeklyCard={WEEKLY} />)
  expect(dotOf(past.container)).toBeNull()
})

test('múltbeli napon az Alap sor nem gomb, és nem kínál heti tanulást', async () => {
  inRouter(<FuelEnergyHero vm={vm()} past weeklyCard={WEEKLY} />)
  const box = await openEq()
  expect(within(box).queryByRole('button', { name: /heti tanulás/ })).not.toBeInTheDocument()
  expect(box.textContent).not.toMatch(/heti tanulás/)
})

test('heti kártyával az Alap sor egy gomb, és a „Heti tanulás” lapot nyitja', async () => {
  inRouter(<FuelEnergyHero vm={vm()} weeklyCard={WEEKLY} />)
  const box = await openEq()
  const alap = within(box).getByRole('button', { name: /^Alap 2 000 kcal — heti tanulás: \+60 kcal, megnyitás$/ })
  expect(alap.className).toContain('is-weekly')
  expect(alap.querySelector('strong [aria-hidden="true"]')).not.toBeNull()
  expect(alap.querySelector('small')!.textContent).toBe('az alapanyagcseréd és az életmódod · heti tanulás ›')
  // Reverse parity: the value and the other rows are untouched.
  expect(valueOf(alap)).toBe('2 000')
  expect(rowsOf(box).map(titleOf)).toEqual(['Alap', 'Mozgás', 'Étel', 'Marad'])
  await userEvent.click(alap)
  // The equation sheet closed behind it — one dialog at a time, and it is the weekly one.
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.getByRole('dialog').className).not.toContain('fa-eq')
})

test('heti kártya nélkül az Alap sor változatlan (nem gomb)', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  const base = rowsOf(await openEq())[0]
  expect(base.tagName).toBe('DIV')
  expect(base.querySelector('small')!.textContent).toBe('az alapanyagcseréd és az életmódod')
})

// ── Kihagyás S3 (mezo-q4xt2.3): the neutral skipped share ──────────────────────────────────────
const skipVm = (over: Partial<ReturnType<typeof vm>> = {}) => ({
  ...vm(),
  consumedKcal: 650, remainingKcal: 670, skippedKcal: 420, skippedLabels: ['Uzsonna'], ...over,
}) as ReturnType<typeof vm>

test('skippedKcal draws the faint dashed band above the liquid; the remaining numeral and label stay calm', () => {
  const { container } = render(<FuelEnergyHero vm={skipVm()} />)
  const band = container.querySelector('.fa-hero .fx-bowl-skip') as SVGPathElement
  expect(band).not.toBeNull()
  expect(band.getAttribute('stroke-dasharray')).toBe('4 4')
  expect(right(container).querySelector('b')).toHaveTextContent('670')
  expect(right(container).querySelector('small')).toHaveTextContent('még belefér')
  expect(screen.getByRole('button', { name: '650 / 2 400 kcal, ebből 420 kcal kihagyva' })).toBeInTheDocument()
  expect(container.querySelector('[class*="over"], [class*="warn"]')).toBeNull()
})

test('no skipped kcal → no band and no line', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  expect(container.querySelector('.fx-bowl-skip')).toBeNull()
  expect(container.querySelector('.fa-skl')).toBeNull()
  expect(container.querySelector('.fx-bg-bowl')!.getAttribute('aria-label')).not.toMatch(/kihagyva/)
})

test('even a small skipped share is named — the line and the bowl say the same', () => {
  const { container } = render(<FuelEnergyHero vm={skipVm({ skippedKcal: 30 })} />)
  expect(container.querySelector('.fx-bowl-skip')).not.toBeNull()
  expect(container.querySelector('.fa-skl')).toHaveTextContent('Uzsonna kihagyva · 30 kcal kiesett a napból')
})

test('the line names the skipped windows and opens the equation sheet with a „Kihagyva" row before „Marad"', async () => {
  render(<FuelEnergyHero vm={skipVm()} />)
  const line = screen.getByRole('button', { name: /Uzsonna kihagyva · 420 kcal kiesett a napból/ })
  expect(line.querySelector('b')).toHaveTextContent('Uzsonna kihagyva')
  await userEvent.click(line)
  const box = screen.getByRole('dialog')
  expect(within(box).getByText('Kihagyva')).toBeInTheDocument()
  expect(box).toHaveTextContent('kihagyott étkezés · nem kerül át máshová')
  expect(box).toHaveTextContent('− 420')
  const names = rowsOf(box).map(titleOf)
  expect(names.indexOf('Kihagyva')).toBe(names.length - 2)
  expect(box.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc/i)
})

// ── Kihagyás S3 (mezo-q4xt2.3): gentle mode on the hero ────────────────────────────────────────
const SHAME_RX = /elrontott|túlléptél|hiba|rossz|bukta|kudarc/i

test('ESTIMATE: muted hero, and over the budget it says „a keret körül" — never „felett"', async () => {
  const over = vm({ consumed: { kcal: 2700, p: 100, c: 250, f: 80 } })
  const { container } = render(<FuelEnergyHero vm={over} mode="ESTIMATE" />)
  expect(container.querySelector('.fa-hero')).toHaveClass('est')
  expect(right(container).querySelector('small')).toHaveTextContent('a keret körül')
  expect(right(container).querySelector('b')).toHaveTextContent('300')
  expect(verdict(container)).toHaveTextContent('Ma nagyjából a keret körül jársz.')
  // the bowl never turns amber on a travel day
  expect(container.innerHTML).not.toContain('--fo-warn')
  const box = await openEq()
  expect(within(box).getByRole('heading', { name: '300 kcal a keret körül' })).toBeInTheDocument()
  expect(container.textContent + box.textContent).not.toMatch(/felett/i)
})

test('ESTIMATE with room left reads „kb. ennyi fér még"', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} mode="ESTIMATE" />)
  expect(right(container).querySelector('small')).toHaveTextContent('kb. ennyi fér még')
  expect(verdict(container)).toHaveTextContent('Kb. 2 060 kcal fér még bele ma.')
})

test('no mode: unchanged — még belefér / a keret felett, not muted, no focus vial', () => {
  const { container, rerender } = render(<FuelEnergyHero vm={vm()} />)
  expect(right(container).querySelector('small')).toHaveTextContent('még belefér')
  expect(container.querySelector('.fa-hero')).not.toHaveClass('est')
  expect(container.querySelector('.fa-mac.lead')).toBeNull()
  rerender(<FuelEnergyHero vm={vm({ consumed: { kcal: 2700, p: 100, c: 250, f: 80 } })} />)
  expect(right(container).querySelector('small')).toHaveTextContent('a keret felett')
  // over the budget the bowl's liquid is amber
  expect(container.querySelector('.fa-hero')!.innerHTML).toContain('--fo-warn')
})

test('MAINTENANCE: the protein vial is the focus („fő cél"), the others are not', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} mode="MAINTENANCE" />)
  expect(container.querySelector('.fa-mac.lead')).not.toBeNull()
  const marks = container.querySelectorAll('.fa-mac .fo-tube em')
  expect(marks).toHaveLength(1)
  expect(marks[0]).toHaveTextContent('fő cél')
  expect(marks[0].closest('.fo-vial')!.querySelector('use')!.getAttribute('href')).toBe('#t-meat')
})

test('a skipped window never flips the hero to „a keret felett" when eaten is under the target', async () => {
  const slots = [{ time: '16:30', kind: 'meal', label: 'Uzsonna', slotKey: 'snack', state: 'skipped', budgetKcal: 600 }] as never
  const { container } = render(<FuelEnergyHero vm={vm({ consumed: { kcal: 2000, p: 1, c: 1, f: 1 }, slots })} />)
  expect(right(container).querySelector('small')).toHaveTextContent('még belefér')
  expect(right(container).querySelector('b')).toHaveTextContent(/^0$/)
  expect(container.textContent).not.toMatch(/felett/i)
  const box = await openEq()
  expect(within(box).getByRole('heading', { name: '0 kcal fér még bele ma' })).toBeInTheDocument()
  expect(valueOf(within(box).getByText('Marad').closest('.fa-tot')!)).toMatch(/^0/)
  expect(box.textContent).not.toMatch(/felett/)
})

test('eaten 2500 over a 2400 target with a 600 skip: over by exactly 100', () => {
  const slots = [{ time: '16:30', kind: 'meal', label: 'Uzsonna', slotKey: 'snack', state: 'skipped', budgetKcal: 600 }] as never
  const { container } = render(<FuelEnergyHero vm={vm({ consumed: { kcal: 2500, p: 1, c: 1, f: 1 }, slots })} />)
  expect(right(container).querySelector('small')).toHaveTextContent('a keret felett')
  expect(right(container).querySelector('b')).toHaveTextContent(/^100$/)
  expect(verdict(container)).toHaveTextContent('Ma 100 kcal-lal a keret felett vagy.')
})

test('MAINTENANCE with a cut whose deficit was dropped: the Célod row says „szünetel, amíg a sérülés tart · 0"', async () => {
  const dropped = vm({ budget: { ...BUDGET, energy: { ...BUDGET.energy!, balance: 0 } } })
  render(<FuelEnergyHero vm={dropped} mode="MAINTENANCE" trajectory="cut" />)
  const goal = within(await openEq()).getByText('Célod').closest('.fa-eqrow') as HTMLElement
  expect(goal).toHaveTextContent('szünetel, amíg a sérülés tart')
  expect(valueOf(goal)).toMatch(/^0$/)
})

test('MAINTENANCE with a bulk surplus: Célod shows the served +250, no „szünetel"', async () => {
  const surplus = vm({ budget: { ...BUDGET, energy: { ...BUDGET.energy!, balance: 250 } } })
  render(<FuelEnergyHero vm={surplus} mode="MAINTENANCE" trajectory="bulk" />)
  const goal = within(await openEq()).getByText('Célod').closest('.fa-eqrow') as HTMLElement
  expect(goal).not.toHaveTextContent('szünetel')
  expect(valueOf(goal)).toBe('+ 250')
})

test('the recovery note slot sits between the hero and the macros; no shame words in any mode', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} mode="ESTIMATE" note={<p className="probe">jegyzet</p>} />)
  const hero = container.querySelector('.fa-hero')!
  const note = container.querySelector('.probe')!
  const macros = container.querySelector('.fa-mac')!
  expect(hero.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(hero.contains(note)).toBe(false)
  expect(note.compareDocumentPosition(macros) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  for (const mode of ['ESTIMATE', 'MAINTENANCE'] as const) {
    const r = render(<FuelEnergyHero vm={vm({ consumed: { kcal: 2700, p: 1, c: 1, f: 1 } })} mode={mode} />)
    expect(r.container.textContent).not.toMatch(SHAME_RX)
    r.unmount()
  }
})
