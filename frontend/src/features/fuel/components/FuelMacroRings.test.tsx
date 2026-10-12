// ============================================================
// Mezo · FuelMacroRings tests (Fuel Titanium S1a, mezo-33k6 — manifest row A2; Folyadék F5,
// mezo-n4wf5.5: the rings became five VIALS). The owner-approved macro identity is the contract
// here: meat / grain / avocado / leaf / water, each vial in its own colour, filled to its share of
// the day's target, honest-null on an unknown target.
// ============================================================
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import type { RingVM } from '@/features/fuel/logic/keretHero'
import { FuelMacroRings } from '@/features/fuel/components/FuelMacroRings'

const RINGS: RingVM[] = [
  { key: 'p', label: 'fehérje', pct: 95, value: '148 g', target: '155 g', color: '#e0796a' },
  { key: 'c', label: 'szénhidrát', pct: 71, value: '224 g', target: '316 g', color: '#d8a44a' },
  { key: 'f', label: 'zsír', pct: 79, value: '58 g', target: '73 g', color: '#d8c14a' },
  { key: 'fiber', label: 'rost', pct: 73, value: '22 g', target: '30 g', color: '#7fc36b' },
  { key: 'water', label: 'víz', pct: 46, value: '1,9 l', target: '4 l', color: '#6fb6d8' },
]

// A2: the owner's macro identity — one glyph per vial, standing in its tube, each vial in its own colour.
test('öt kémcső, mindegyik a saját ikonjával és színével', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  const vials = container.querySelectorAll('.fo-vial')
  expect(vials).toHaveLength(5)
  expect(Array.from(vials).map(c => c.querySelector('.fo-tube use')?.getAttribute('href'))).toEqual([
    '#t-meat', '#t-carb', '#t-avocado', '#t-fiber', '#t-water',
  ])
  expect((vials[0] as HTMLElement).style.getPropertyValue('--c')).toBe('var(--fx-protein)')
  expect((vials[4] as HTMLElement).style.getPropertyValue('--c')).toBe('var(--fx-water)')
  // a number is a level: no ring anywhere
  expect(container.querySelector('circle')).toBeNull()
})

test('minden kémcső a cél arányáig telik, a szám a mennyiség, alatta a cél', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  const first = container.querySelector('.fo-vial') as HTMLElement
  expect((first.querySelector('.fo-tube .l') as HTMLElement).style.getPropertyValue('--p')).toBe('95%')
  expect(first.querySelector('b')).toHaveTextContent('148')
  expect(first.querySelector('small')).toHaveTextContent('fehérje/ 155 g')
  // the litre keeps its decimal, the unit stands with the target
  const water = container.querySelectorAll('.fo-vial')[4]
  expect(water.querySelector('b')).toHaveTextContent('1,9')
  expect(water.querySelector('small')).toHaveTextContent('víz/ 4 l')
})

// Honest-null: without a target there is no level and no fabricated zero.
test('ismeretlen célnál a kémcső száraz marad, nem nullát mutat', () => {
  const { container } = render(
    <FuelMacroRings rings={[{ ...RINGS[0], pct: 0, value: '—', target: '—' }]} />,
  )
  expect(container.querySelector('.fo-vial b')).toHaveTextContent('—')
  expect((container.querySelector('.fo-tube .l') as HTMLElement).style.getPropertyValue('--p')).toBe('0%')
})

test('a sor csoportként nevezi meg magát, és a szénhidrát szűk kijelzőre rövid nevet is hord', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  expect(screen.getByRole('group', { name: 'Makrók, rost és víz' })).toBeInTheDocument()
  expect(container.querySelector('.fa-w')).toHaveTextContent('szénhidrát')
  expect(container.querySelector('.fa-s')).toHaveTextContent('Szénh.')
})

// Kímélő mód / sérülés: the protein vial carries the „fő cél" mark.
test('a fő cél jelét csak a kijelölt kémcső viseli', () => {
  const { container, rerender } = render(<FuelMacroRings rings={RINGS} />)
  expect(container.querySelector('.fa-mac.lead')).toBeNull()
  expect(screen.queryByText('fő cél')).toBeNull()
  rerender(<FuelMacroRings rings={RINGS} leadKey="p" />)
  expect(container.querySelector('.fa-mac.lead')).not.toBeNull()
  expect(container.querySelectorAll('.fo-vial')[0].querySelector('.fo-tube em')).toHaveTextContent('fő cél')
  expect(container.querySelectorAll('.fo-tube em')).toHaveLength(1)
})

// The water vial is the hub's ONLY water-logging door — with `onWater` it is a real button;
// without it the row is fully passive.
test('onWater nélkül egyetlen kémcső sem gomb', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  expect(container.querySelectorAll('button')).toHaveLength(0)
})

test('onWater-rel a víz kémcsöve gomb, és koppintásra hív', async () => {
  const onWater = vi.fn()
  render(<FuelMacroRings rings={RINGS} onWater={onWater} />)
  expect(screen.getAllByRole('button')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Víz logolása · 1,9 l / 4 l' }))
  expect(onWater).toHaveBeenCalledTimes(1)
})
