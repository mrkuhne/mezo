import { render, screen } from '@testing-library/react'
import type { DayZone } from '@/features/fuel/logic/dayZones'
import { DayZoneCard } from '@/features/fuel/components/DayZoneCard'

const zone = (over: Partial<DayZone> = {}): DayZone => ({
  key: 'morning', label: 'Reggel', slots: [], kcal: 790, hasMeals: true,
  state: 'done', burnKcal: 0, stackPips: [], ...over,
})

test('a done zone prints its kcal with a ✓ and the sage header', () => {
  const { container } = render(<DayZoneCard zone={zone()} index={0}><div>row</div></DayZoneCard>)
  expect(screen.getByText('Reggel')).toBeInTheDocument()
  expect(screen.getByText(/790 kcal ✓/)).toBeInTheDocument()
  expect(container.querySelector('.zcard.donez')).toBeInTheDocument()
})

test('the zone holding the now window is marked open', () => {
  const { container } = render(<DayZoneCard zone={zone({ state: 'open', kcal: 900 })} index={1}><div /></DayZoneCard>)
  expect(screen.getByText(/900 kcal nyitva/)).toBeInTheDocument()
  expect(container.querySelector('.zcard.openz')).toBeInTheDocument()
})

test('an upcoming zone prints a plain kcal balance', () => {
  render(<DayZoneCard zone={zone({ state: 'ahead', kcal: 1020 })} index={2}><div /></DayZoneCard>)
  expect(screen.getByText('1020 kcal')).toBeInTheDocument()
})

test('a zone with no eating window prints no kcal at all', () => {
  render(<DayZoneCard zone={zone({ hasMeals: false, kcal: 0, state: 'ahead' })} index={0}><div /></DayZoneCard>)
  expect(screen.queryByText(/kcal/)).toBeNull()
})

test('the burn is appended only when the zone actually earned some', () => {
  render(<DayZoneCard zone={zone({ state: 'ahead', kcal: 300, burnKcal: 510 })} index={0}><div /></DayZoneCard>)
  expect(screen.getByText(/\+510/)).toBeInTheDocument()
})

test('a pure-activity zone with no eating window prints only the burn, no kcal text or stray separator', () => {
  render(<DayZoneCard zone={zone({ hasMeals: false, kcal: 0, burnKcal: 510 })} index={0}><div /></DayZoneCard>)
  expect(screen.getByText('+510')).toBeInTheDocument()
  expect(screen.queryByText(/kcal/)).toBeNull()
  expect(screen.getByText('+510').parentElement?.textContent).toBe('+510')
})

test('stack pips render one dot per supplement item, filled when taken', () => {
  const { container } = render(
    <DayZoneCard zone={zone({ stackPips: [true, false, false] })} index={0}><div /></DayZoneCard>,
  )
  expect(container.querySelectorAll('.caps i')).toHaveLength(3)
  expect(container.querySelectorAll('.caps i.on')).toHaveLength(1)
})

test('the stagger index rides on a CSS custom property, carried by the shared np-anim class', () => {
  const { container } = render(<DayZoneCard zone={zone()} index={3}><div /></DayZoneCard>)
  const card = container.querySelector('.zcard') as HTMLElement
  expect(card).not.toBeNull()
  // Rewritten per the brief's flagged known-issue: `toHaveAttribute`'s 2nd arg is exact-equality,
  // not an asymmetric-matcher slot, and React's inline-style serialisation of custom properties
  // varies. Read the property directly instead — this still proves the index reaches the DOM.
  expect(card.style.getPropertyValue('--i')).toBe('3')
  // Review finding: `--i` is inert without `.np-anim` (prototype.css:1194), which is the class that
  // actually reads it (`animation-delay: calc(var(--i, 0) * 70ms)`) and is reduced-motion-guarded
  // (prototype.css:1198-1199). Assert both classes so a future refactor can't silently drop either.
  expect(card.classList.contains('np-anim')).toBe(true)
})

test('renders the composed rows', () => {
  render(<DayZoneCard zone={zone()} index={0}><div data-testid="child-row" /></DayZoneCard>)
  expect(screen.getByTestId('child-row')).toBeInTheDocument()
})
