// ============================================================
// Mezo · FuelEnergyHero tests (Fuel Titanium S1a, mezo-33k6 — manifest rows A1 + A15).
// The hero's ONE message is the REMAINING kcal; the math behind it opens on tap, in the
// glass box (owner decision: not a drawer). Honest-null and adherence-neutral copy are
// contracts, not polish.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { buildKeretHero } from '@/features/fuel/logic/keretHero'
import type { DayBudget } from '@/features/fuel/logic/buildDayPlan'
import { FuelEnergyHero } from '@/features/fuel/components/FuelEnergyHero'
import { huInt } from '@/shared/lib/huNum'

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

// A1 (mezo-33k6): a hero egyetlen üzenete a MARADÉK — az a domináns szám.
test('a maradék kcal a domináns szám, a tál az ívben ül', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  expect(container.querySelector('.fmx-hero-remaining')).toHaveTextContent('2 060')
  // Üveg (mezo-me75u.1): the bowl is the 3D sprite's (fuel-uveg.html).
  expect(container.querySelector('.fmx-gauge use')!.getAttribute('href')).toBe('#t-bowl')
})

// A2: a gyűrűsor a hero része — öt cella, a makró-identitás sorrendjében.
test('a hero alatt ott az öt makró-gyűrű', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  expect(container.querySelectorAll('.fmx-cell')).toHaveLength(5)
})

// A15: az egyenlet NEM fiók — üvegdobozban nyílik, és csak koppintásra.
test('a koppintós chip üvegdobozban nyitja meg az egyenletet', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  const box = screen.getByRole('dialog')
  expect(box.className).toContain('glass')
  for (const label of ['Alap', 'Mozgás', 'Étel', 'Marad']) {
    expect(within(box).getByText(label)).toBeInTheDocument()
  }
})

test('az üvegdoboz bezárható', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Bezárom' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

// Őszinte-null: statikus keretnél nincs kitalált mozgás-szám.
test('statikus keretnél a mozgás sora gondolatjel', async () => {
  render(<FuelEnergyHero vm={vm({ staticEnergy: true })} />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  // Alap and Célod read a bare „—", Mozgás keeps its operator („+ —").
  expect(within(screen.getByRole('dialog')).getAllByText('—')).toHaveLength(2)
  expect(within(screen.getByRole('dialog')).getByText('+ —')).toBeInTheDocument()
})

// mezo-32m82: a Célod sor zárja az egyenletet — Alap + Mozgás ± Célod − Étel = Marad.
const CUT: DayBudget = { kcal: 3171, p: 160, c: 260, f: 80, energy: { base: 2356, planned: 570, extra: 572, balance: -327, target: 3171 } }

test('fogyásnál a Célod sor saját előjellel (−) és a fogyási szöveggel áll, és az egyenlet kijön', async () => {
  const hero = vm({ budget: CUT, consumed: { kcal: 800, p: 0, c: 0, f: 0 } })
  render(<FuelEnergyHero vm={hero} trajectory="cut" />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  const box = screen.getByRole('dialog')
  const nodes = [...box.querySelectorAll('.fmx-node')]
  expect(nodes.map(n => n.querySelector('strong')!.textContent)).toEqual(['Alap', 'Mozgás', 'Célod', 'Étel', 'Marad'])
  const goal = nodes[2]
  expect(goal.querySelector('b')!.textContent).toBe(`− ${huInt(-CUT.energy.balance)}`)
  expect(within(goal as HTMLElement).getByText('a fogyási célod napi része')).toBeInTheDocument()
  // Mozgás = planned + extra, and the extra credit is named in its sub copy.
  expect(nodes[1].querySelector('b')!.textContent).toBe(`+ ${huInt(CUT.energy.planned + CUT.energy.extra)}`)
  expect(within(nodes[1] as HTMLElement).getByText('a heti edzésterved mai része + terven kívüli mozgás')).toBeInTheDocument()
  // Closure off the rendered VM: base + activity + balance − eaten = remaining.
  expect(hero.chips!.base + hero.chips!.activity + hero.chips!.balance - hero.consumedKcal).toBe(hero.remainingKcal)
  // Üveg: Alap wears the flame (the BMR sprite), Célod the target ring — Titanium sprites, no emoji.
  expect(nodes[0].querySelector('use')!.getAttribute('href')).toBe('#t-flame')
  expect(goal.querySelector('use')!.getAttribute('href')).toBe('#t-ring')
})

test('tömegelésnél a Célod sor + előjelű', async () => {
  const bulk: DayBudget = { ...CUT, kcal: 3176, energy: { base: 2356, planned: 570, extra: 0, balance: 250, target: 3176 } }
  render(<FuelEnergyHero vm={vm({ budget: bulk })} trajectory="bulk" />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  const goal = [...screen.getByRole('dialog').querySelectorAll('.fmx-node')][2]
  expect(goal.querySelector('b')!.textContent).toBe('+ 250')
  expect(within(goal as HTMLElement).getByText('a tömegelési célod napi része')).toBeInTheDocument()
})

test('tartásnál nulla egyenleggel nincs Célod sor', async () => {
  const keep: DayBudget = { ...CUT, kcal: 2926, energy: { base: 2356, planned: 570, extra: 0, balance: 0, target: 2926 } }
  render(<FuelEnergyHero vm={vm({ budget: keep })} trajectory="maintain" />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  expect(within(screen.getByRole('dialog')).queryByText('Célod')).not.toBeInTheDocument()
})

// A túlevett nap nem szégyenít. A jóváhagyott hero-ban az ELŐJEL a feliratban van
// („A KERET FELETT"), a szám pedig az abszolút érték — egy „−300 kcal a keret felett" kettős
// tagadás lenne, képernyőolvasón is. A semlegesség marad a lényeg.
test('túllépett keretnél a felirat mondja meg az irányt, és nem minősít', () => {
  const over = vm({ consumed: { kcal: 3000, p: 0, c: 0, f: 0 } })
  const { container } = render(<FuelEnergyHero vm={over} />)
  const lead = container.querySelector('.fmx-hero-side.is-lead')!
  expect(lead.querySelector('small')!.textContent).toBe('A KERET FELETT')
  expect(lead.querySelector('.fmx-hero-remaining')!.textContent).not.toMatch(/−/)
  expect(container.querySelector('.fmx-hero-remaining')!.getAttribute('aria-label'))
    .toMatch(/kcal a keret felett$/)
  expect(container.textContent).not.toMatch(/elrontott|túlevés|hiba/i)
})

// mezo-jb84: a chip MINDIG a saját üvegdobozát nyitja — korábban `onOpenEnergy` mellett a
// szülő régi lapja jött fel helyette. A szülő felülete nem veszik el: a doboz ajtaja hívja.
test('a chip a saját dobozát nyitja, a szülő felületét pedig a doboz ajtaja', async () => {
  let opened = 0
  render(<FuelEnergyHero vm={vm()} onOpenEnergy={() => { opened += 1 }} />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(opened).toBe(0)
  await userEvent.click(screen.getByRole('button', { name: /Részletesen, honnan jön a keret/ }))
  expect(opened).toBe(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('ajtó nélkül a doboz nem kínál részletes utat', async () => {
  render(<FuelEnergyHero vm={vm()} />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  expect(screen.queryByRole('button', { name: /Részletesen/ })).not.toBeInTheDocument()
})

// A13 (mezo-33k6): egy MÚLTBELI napot nézve a „ma" szó hazugság lenne — a lapozás
// bevezetésével a hero szövege is a nézett naphoz igazodik, a képernyőolvasóé is.
test('múltbeli napon a hero nem mondja azt, hogy „ma”', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} past />)
  expect(container.textContent).not.toMatch(/\bma\b/)
  const labels = Array.from(container.querySelectorAll('.fmx-hero-side strong'))
    .map(e => e.getAttribute('aria-label'))
  expect(labels.some(l => /ettél aznap$/.test(l ?? ''))).toBe(true)
  expect(labels.some(l => /fért még bele$/.test(l ?? ''))).toBe(true)
})

test('a mai napon marad a „ma” megfogalmazás', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  const labels = Array.from(container.querySelectorAll('.fmx-hero-side strong'))
    .map(e => e.getAttribute('aria-label'))
  expect(labels.some(l => /ettél ma$/.test(l ?? ''))).toBe(true)
  expect(labels.some(l => /fér még bele ma$/.test(l ?? ''))).toBe(true)
})

// A jóváhagyott h1 elrendezés: HÁROM rész egy sorban, a két szám AZONOS méretben.
test('a hero három részes: ettél · műszer · még belefér', () => {
  const { container } = render(<FuelEnergyHero vm={vm()} />)
  const sides = container.querySelectorAll('.fmx-hero-side')
  expect(sides).toHaveLength(2)
  expect(sides[0].querySelector('small')!.textContent).toBe('KCAL·T ETTÉL')
  expect(sides[1].querySelector('small')!.textContent).toBe('MÉG BELEFÉR')
  expect(container.querySelector('.fmx-hero-pair .fmx-gauge')).not.toBeNull()
})
