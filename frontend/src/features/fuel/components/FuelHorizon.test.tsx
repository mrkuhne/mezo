// A hosszabb táv (evés × súly) tesztjei (Fuel Titanium S3, mezo-83g0 — C3).
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { FuelHorizon, type HorizonWeek } from '@/features/fuel/components/FuelHorizon'

const WEEKS: HorizonWeek[] = [
  { startIso: '2026-07-27', label: 'Júl 27', kcal: 2380, weightKg: 82.4 },
  { startIso: '2026-08-03', label: 'Aug 3', kcal: 2310, weightKg: 82.1 },
  { startIso: '2026-08-10', label: 'Aug 10', kcal: 2405, weightKg: 82.2 },
  { startIso: '2026-08-17', label: 'Aug 17', kcal: 2290, weightKg: 81.9 },
  { startIso: '2026-08-24', label: 'Aug 24', kcal: 2240, weightKg: 81.7 },
  { startIso: '2026-08-31', label: 'Aug 31', kcal: 2360, weightKg: 81.6 },
  { startIso: '2026-09-07', label: 'Szept 7', kcal: 2185, weightKg: 81.3 },
]

/** Középen KIESIK egy súlymérés — ez valódi szakadás, nem nullára húzott pont. */
const weeksWithGap = (): HorizonWeek[] =>
  WEEKS.map((w, i) => (i === 3 ? { ...w, weightKg: null } : w))

// C3 (mezo-83g0): evés és súly EGY időtengelyen — meglévő sorozatokból, új backend nélkül.
test('az evés és a súly egy időtengelyen jelenik meg', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} />)
  expect(container.querySelector('.ftx-horizon-kcal')).not.toBeNull()
  expect(container.querySelector('.ftx-horizon-weight')).not.toBeNull()
})

// Őszinte-null: hiányzó súlymérés megszakítja a vonalat, nem húzza nullára.
test('a hiányzó súly megszakítja a vonalat, nem nullára húzza', () => {
  const { container } = render(<FuelHorizon weeks={weeksWithGap()} />)
  const d = container.querySelector('.ftx-horizon-weight')!.getAttribute('d')!
  expect(d).toMatch(/M.*M/) // több szakasz — a hiány valódi szakadás
  // És egyetlen pont sem ült le a tengely aljára nulla súly miatt.
  expect(container.querySelectorAll('.ftx-horizon-dot')).toHaveLength(6)
})

test('két hétnél kevesebb adatnál nem rajzolunk trendet', () => {
  render(<FuelHorizon weeks={[WEEKS[0]]} />)
  expect(screen.getByText(/Néhány hét kell/i)).toBeInTheDocument()
})

test('egyetlen héten belül sincs kitalált vonal', () => {
  const { container } = render(<FuelHorizon weeks={[WEEKS[0]]} />)
  expect(container.querySelector('.ftx-horizon-kcal')).toBeNull()
  expect(container.querySelector('.ftx-horizon-weight')).toBeNull()
})

// Őszinte-null: a kalória oldala is hiányozhat — azt sem nullázzuk le.
test('a hiányzó heti kalória-átlag is szakadás, nem nulla', () => {
  const weeks = WEEKS.map((w, i) => (i === 2 ? { ...w, kcal: null } : w))
  const { container } = render(<FuelHorizon weeks={weeks} />)
  expect(container.querySelector('.ftx-horizon-kcal')!.getAttribute('d')!).toMatch(/M.*M/)
})

test('egyetlen súlymérés nélküli sorozat súlyvonal nélkül, de kalóriavonallal áll', () => {
  const weeks = WEEKS.map(w => ({ ...w, weightKg: null }))
  const { container } = render(<FuelHorizon weeks={weeks} />)
  expect(container.querySelector('.ftx-horizon-kcal')).not.toBeNull()
  expect(container.querySelector('.ftx-horizon-weight')).toBeNull()
  expect(screen.getByText(/Súlymérés nélkül/i)).toBeInTheDocument()
})

// Szégyenmentesség: a hosszú táv LEÍR, nem értékel.
test('a hosszabb táv nem mond ítéletet', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} />)
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc|jól|gyengén/i)
  // És nem állít okozatiságot sem — csak együttjárást.
  expect(container.textContent).toMatch(/együttjárás|egymás mellett/i)
})

test('a tengely felirata a legelső és legutolsó hét', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} />)
  const labels = [...container.querySelectorAll('.ftx-horizon-axis')].map(n => n.textContent)
  expect(labels).toEqual(['Júl 27', 'Szept 7'])
})
