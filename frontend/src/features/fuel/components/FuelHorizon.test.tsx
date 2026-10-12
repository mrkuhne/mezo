// A hosszabb táv (súly + evés, ugyanazokon a heteken) tesztjei (Fuel Titanium S3, mezo-83g0 — C3).
// Folyadék (mezo-n4wf5.5): a két sorozat két folyadék-felszín egymás alatt (`.fr-ser.is-weight` / `.is-kcal`); a hiány
// valódi szakadás (több `.fr-ser-line` szakasz); a napi mérések halvány pontok; a súlycél vízvonal.
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { FuelHorizon, horizonNeedsMoreWeeks, type HorizonWeek } from '@/features/fuel/components/FuelHorizon'

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

const lines = (c: HTMLElement, kind: 'weight' | 'kcal') => c.querySelectorAll(`.fr-ser.is-${kind} .fr-ser-line`)
const points = (c: HTMLElement, kind: 'weight' | 'kcal') => c.querySelectorAll(`.fr-ser.is-${kind} .fr-ser-pt`)

// C3 (mezo-83g0): evés és súly ugyanazokon a heteken — meglévő sorozatokból, új backend nélkül.
test('a súly és az evés egymás alatt jelenik meg, a súly felül', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} />)
  const weight = container.querySelector('.fr-ser.is-weight')!
  const kcal = container.querySelector('.fr-ser.is-kcal')!
  expect(weight.compareDocumentPosition(kcal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(lines(container, 'weight')).toHaveLength(1)
  expect(points(container, 'weight')).toHaveLength(7)
  expect(points(container, 'kcal')).toHaveLength(7)
  expect(screen.getByRole('img', { name: 'Heti súlyátlag 7 héten át, Júl 27 és Szept 7 között' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Heti átlag kalória 7 héten át' })).toBeInTheDocument()
})

// Őszinte-null: hiányzó súlymérés megszakítja a vonalat, nem húzza nullára.
test('a hiányzó súly megszakítja a vonalat, nem nullára húzza', () => {
  const { container } = render(<FuelHorizon weeks={weeksWithGap()} />)
  expect(lines(container, 'weight')).toHaveLength(2) // két szakasz — a hiány valódi szakadás
  // És egyetlen pont sem ült le a tengely aljára nulla súly miatt.
  expect(points(container, 'weight')).toHaveLength(6)
  expect(screen.getByText(/a súlyvonal megszakad/)).toBeInTheDocument()
})

test('két nem üres hétnél kevesebb adatnál nem rajzolunk trendet', () => {
  render(<FuelHorizon weeks={[WEEKS[0]]} />)
  expect(screen.getByText(/Néhány hét kell még/i)).toBeInTheDocument()
})

// Az élő hiba javítása (owner-lista 2026-10-12): a horizont MINDIG hét elemű lista — a „kevés a hét" arc a NEM ÜRES
// hetek számán múlik, nem a lista hosszán.
test('hét elemű listában egyetlen adatos héttel is a „néhány hét kell még" arc áll', () => {
  const sparse = WEEKS.map((w, i) => (i === 6 ? w : { ...w, kcal: null, weightKg: null }))
  expect(horizonNeedsMoreWeeks(sparse)).toBe(true)
  const { container } = render(<FuelHorizon weeks={sparse} />)
  expect(screen.getByText(/Néhány hét kell még/i)).toBeInTheDocument()
  expect(container.querySelector('.fr-ser')).toBeNull()
})

test('két adatos hét már elég a képhez', () => {
  const two = WEEKS.map((w, i) => (i >= 5 ? w : { ...w, kcal: null, weightKg: null }))
  expect(horizonNeedsMoreWeeks(two)).toBe(false)
  const { container } = render(<FuelHorizon weeks={two} />)
  expect(container.querySelector('.fr-ser.is-weight')).not.toBeNull()
})

// Töltés közben nem állítjuk, hogy kevés a hét.
test('betöltés közben nincs „kevés a hét" arc', () => {
  render(<FuelHorizon weeks={WEEKS.map((w) => ({ ...w, kcal: null, weightKg: null }))} pending />)
  expect(screen.queryByText(/Néhány hét kell még/i)).toBeNull()
})

test('egyetlen héten belül sincs kitalált vonal', () => {
  const { container } = render(<FuelHorizon weeks={[WEEKS[0]]} />)
  expect(container.querySelector('.fr-ser')).toBeNull()
})

// Őszinte-null: a kalória oldala is hiányozhat — azt sem nullázzuk le.
test('a hiányzó heti kalória-átlag is szakadás, nem nulla', () => {
  const weeks = WEEKS.map((w, i) => (i === 2 ? { ...w, kcal: null } : w))
  const { container } = render(<FuelHorizon weeks={weeks} />)
  expect(lines(container, 'kcal')).toHaveLength(2)
  expect(points(container, 'kcal')).toHaveLength(6)
})

test('egyetlen súlymérés nélküli sorozat súlyvonal nélkül, de kalóriavonallal áll', () => {
  const weeks = WEEKS.map(w => ({ ...w, weightKg: null }))
  const { container } = render(<FuelHorizon weeks={weeks} />)
  expect(container.querySelector('.fr-ser.is-kcal')).not.toBeNull()
  expect(container.querySelector('.fr-ser.is-weight')).toBeNull()
  expect(screen.getByText(/Súlymérés nélkül/i)).toBeInTheDocument()
})

// Szégyenmentesség: a hosszú táv LEÍR, nem értékel.
test('a hosszabb táv nem mond ítéletet', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} />)
  expect(container.textContent).not.toMatch(/elrontott|túlléptél|hiba|rossz|bukta|kudarc|jól|gyengén/i)
  // És nem állít okozatiságot sem — csak együttjárást.
  expect(container.textContent).toMatch(/együttjárás/i)
})

test('a tengely felirata a legelső és legutolsó hét', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} />)
  const labels = [...container.querySelectorAll('.fr-ser-axis')].map(n => n.textContent)
  expect(labels).toEqual(['Júl 27', 'Szept 7'])
})

// --- Új, jóváhagyott (mezo-n4wf5.5): a súlycél vízvonala és a napi mérések. ---------------------

test('a súlycél szaggatott vízvonalként áll a súlygrafikonon, a feliratával és a jelmagyarázatban', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} goalKg={79} />)
  expect(container.querySelectorAll('.fr-ser.is-weight .fr-ser-goal')).toHaveLength(1)
  expect(container.querySelector('.fr-ser.is-kcal .fr-ser-goal')).toBeNull()
  expect(screen.getAllByText('cél · 79,0 kg')).toHaveLength(2)
})

test('súlycél nélkül nincs vízvonal és nincs róla szó', () => {
  const { container } = render(<FuelHorizon weeks={WEEKS} goalKg={null} />)
  expect(container.querySelector('.fr-ser-goal')).toBeNull()
  expect(container.textContent).not.toMatch(/cél/)
})

test('a napi mérések halvány pontok a hetük körül; mérés nélküli hétre nem kerül pont', () => {
  const log = [
    { date: '2026-07-27', value: 82.9 }, // az első hét hétfője: a rajz bal szélén kívül esne, nem rajzoljuk
    { date: '2026-07-30', value: 82.6 }, // az első hét csütörtökje
    { date: '2026-07-31', value: 82.2 },
    { date: '2026-08-19', value: 82.0 }, // a 4. hét szerdája — annak a hétnek nincs heti átlaga
    { date: '2026-09-07', value: 81.3 }, // az utolsó hét hétfője
    { date: '2026-01-01', value: 90 },   // a horizonton kívül
  ]
  const { container } = render(<FuelHorizon weeks={weeksWithGap()} weightLog={log} />)
  expect(container.querySelectorAll('.fr-ser-day')).toHaveLength(3)
  expect(screen.getByText('napi mérések')).toBeInTheDocument()
})
