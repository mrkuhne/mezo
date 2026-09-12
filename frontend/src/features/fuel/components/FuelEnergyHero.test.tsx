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

// The keretHero.test.ts fixture style, with a consumed figure that leaves a round 2 060.
const BUDGET: DayBudget = { kcal: 2400, p: 160, c: 260, f: 80, energy: { base: 2000, activity: 400, balance: 0, target: 2400 } }

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
  expect(container.querySelector('.fmx-gauge use')!.getAttribute('href')).toBe('#i-fuel')
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
  expect(within(screen.getByRole('dialog')).getByText('—')).toBeInTheDocument()
})

// A túlevett nap nem szégyenít: a szám előjelet vált, a keretezés semleges marad.
test('túllépett keretnél a szám negatív, a szöveg nem minősít', () => {
  const over = vm({ consumed: { kcal: 3000, p: 0, c: 0, f: 0 } })
  const { container } = render(<FuelEnergyHero vm={over} />)
  expect(container.querySelector('.fmx-hero-remaining')!.textContent).toMatch(/^−/)
  expect(container.textContent).not.toMatch(/elrontott|túlevés|hiba/i)
})

// A15: ha a szülő a MEGLÉVŐ, Énnel közös energia-magyarázatot kezeli, a chip azt hívja, és
// a helyi üvegdoboz nem nyílik ki — egy felület, nem kettő.
test('onOpenEnergy-vel a chip a szülőt hívja, nem a helyi dobozt', async () => {
  let opened = 0
  render(<FuelEnergyHero vm={vm()} onOpenEnergy={() => { opened += 1 }} />)
  await userEvent.click(screen.getByRole('button', { name: /Miből jön össze/ }))
  expect(opened).toBe(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
