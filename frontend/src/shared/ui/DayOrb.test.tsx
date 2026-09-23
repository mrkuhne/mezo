import { render } from '@testing-library/react'
import { DayOrb } from '@/shared/ui/DayOrb'

/** Üveg (bible §7.1, mezo-me75u.1): a gömb teste y-ban 10…90 közt fut; a folyadék
 *  felszíne `90 − pct/100 × 80`, a `.dayorb-liquid` `data-level`-jén olvasható. 0%-on nincs
 *  folyadék — ott a szint maga az alj (90). */
function level(container: HTMLElement): number {
  const liquid = container.querySelector('.dayorb-liquid')
  return liquid ? Number(liquid.getAttribute('data-level')) : 90
}

test('0%-on nincs folyadék és nincs hullám — csak az üres üveggömb', () => {
  const { container } = render(<DayOrb pct={0} intensity={0.5} />)
  expect(container.querySelector('.dayorb-glass')).not.toBeNull()
  expect(container.querySelector('.dayorb-liquid')).toBeNull()
  expect(container.querySelector('.dayorb-wave')).toBeNull()
})

test('részleges töltésnél a felszín a pct-ből jön', () => {
  const { container } = render(<DayOrb pct={50} intensity={0.5} />)
  expect(level(container)).toBeCloseTo(50, 5) // 90 − 0.5 × 80
})

test('0%-on a felszín a gömb alja, 100%-on a teteje', () => {
  expect(level(render(<DayOrb pct={0} intensity={0.5} />).container)).toBeCloseTo(90, 5)
  expect(level(render(<DayOrb pct={100} intensity={0.5} />).container)).toBeCloseTo(10, 5)
})

test('100%-on nincs hullám — tele gömbnek nincs felszíne', () => {
  const { container } = render(<DayOrb pct={100} intensity={1} />)
  expect(container.querySelector('.dayorb-wave')).toBeNull()
  expect(container.querySelector('.dayorb-liquid circle')).not.toBeNull()
})

test('részleges töltésnél VAN hullámzó felszín', () => {
  const { container } = render(<DayOrb pct={40} intensity={0.5} />)
  expect(container.querySelector('.dayorb-wave path')).not.toBeNull()
})

test('intensity=0 a kifakult végpontot adja, intensity=1 a teltet', () => {
  const stops = (i: number) =>
    [...render(<DayOrb pct={100} intensity={i} />).container.querySelectorAll('stop')]
      .map((s) => s.getAttribute('stop-color'))
  expect(stops(0)).toEqual(['#f3e2d9', '#e3bdab', '#c69c89'])
  expect(stops(1)).toEqual(['#ffc3a8', '#ff7a55', '#d8481f'])
})

test('a pct a 0…100 tartományra szorul', () => {
  expect(level(render(<DayOrb pct={-20} intensity={0.5} />).container)).toBeCloseTo(90, 5)
  expect(level(render(<DayOrb pct={140} intensity={0.5} />).container)).toBeCloseTo(10, 5)
})

test('két példány clipPath id-je különbözik — a defs nem ütközik', () => {
  const { container } = render(
    <><DayOrb pct={30} intensity={0.5} /><DayOrb pct={70} intensity={0.5} /></>,
  )
  const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('a svg dekoratív — a gomb adja az akadálymentes nevet', () => {
  const { container } = render(<DayOrb pct={30} intensity={0.5} />)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

// mezo-tzid: a komponens korábban `useId().replace(/:/g, '')`-vel sanitizálta az id-t — ez a
// React-18-as `:r0:` formátum maradványa, React 19-en (`_r_0_`) állandó no-op, ezért kikerült.
// Ez az assert őrzi a feltevést: ha a React újra olyan id-t adna, ami `url(#…)`-ben vagy egy
// selectorban törik (kettőspont, guillemet, szóköz), a defs-hivatkozások CSENDBEN, futásidőben
// bukhatnának — itt hangosan bukik helyette.
test('a generált id url(#…)-ben biztonságos marad', () => {
  const { container } = render(<DayOrb pct={50} intensity={0.5} />)
  const ids = [...container.querySelectorAll('clipPath, linearGradient')].map((n) => n.id)
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
})
