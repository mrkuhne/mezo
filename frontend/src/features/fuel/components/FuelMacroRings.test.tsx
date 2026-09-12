// ============================================================
// Mezo · FuelMacroRings tests (Fuel Titanium S1a, mezo-33k6 — manifest row A2).
// The owner-approved macro identity is the contract here: hús/gabona/avokádó/növény/víz,
// each icon ABOVE its own ring, each ring in its own color, honest-null on an unknown target.
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

// A2 (mezo-33k6): az owner által rögzített makró-identitás — hús/gabona/avokádó/növény/víz
// ikon a gyűrű FÖLÖTT, és minden gyűrű a saját színét viseli.
test('öt gyűrű, mindegyik a saját ikonjával a gyűrű fölött', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  const cells = container.querySelectorAll('.fmx-cell')
  expect(cells).toHaveLength(5)
  expect(Array.from(cells).map(c => c.querySelector('use')?.getAttribute('href'))).toEqual([
    '#i-hus', '#i-gabona', '#i-avokado', '#i-noveny', '#i-viz',
  ])
  // az ikon a gyűrű ELŐTT áll a DOM-ban — a vizuális „fölötte" ennek a CSS-párja
  for (const cell of cells) {
    expect(cell.firstElementChild!.className).toContain('fmx-ico')
  }
})

test('minden gyűrű a saját színét és töltöttségét kapja', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  const first = container.querySelector('.fmx-ring') as HTMLElement
  expect(first.style.getPropertyValue('--macro-color')).toBe('#e0796a')
  expect(first.style.getPropertyValue('--ring-progress')).toBe('95')
})

// Őszinte-null: cél nélkül nincs százalék és nincs kitalált nulla.
test('ismeretlen célnál a gyűrű üres marad, nem nullát mutat', () => {
  const { container } = render(
    <FuelMacroRings rings={[{ ...RINGS[0], pct: 0, value: '—', target: '—' }]} />,
  )
  expect(screen.getByText('—')).toBeInTheDocument()
  expect(container.querySelector('.fmx-ring')!.className).toContain('is-empty')
})

test('a gyűrű képernyőolvasónak egy mondatban mondja el az értéket', () => {
  render(<FuelMacroRings rings={RINGS} />)
  expect(screen.getByLabelText('fehérje: 148 g / 155 g')).toBeInTheDocument()
})

// A víz-gyűrű a hub EGYETLEN víz-logoló ajtaja (a retiráló KeretHero-tól örökölve) — ha a
// szülő átad `onWater`-t, a cella igazi gomb lesz; nélküle a sor teljesen passzív marad.
test('onWater nélkül egyetlen gyűrű sem gomb', () => {
  const { container } = render(<FuelMacroRings rings={RINGS} />)
  expect(container.querySelectorAll('button')).toHaveLength(0)
})

test('onWater-rel a víz gyűrűje gomb, és koppintásra hív', async () => {
  const onWater = vi.fn()
  render(<FuelMacroRings rings={RINGS} onWater={onWater} />)
  await userEvent.click(screen.getByRole('button', { name: /^Víz logolása/ }))
  expect(onWater).toHaveBeenCalledTimes(1)
})
