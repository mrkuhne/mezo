import { render } from '@testing-library/react'
import { DayOrb } from '@/shared/ui/DayOrb'

/** A `#s-orb` teste y-ban 14…82 közt fut; a clip-rect teteje `82 − pct/100 × 68`. */
function clipTop(container: HTMLElement): number {
  const rect = container.querySelector('clipPath rect')
  return Number(rect?.getAttribute('y'))
}

test('0%-on nincs kitöltés és nincs menisz — csak a szürke alap', () => {
  const { container } = render(<DayOrb pct={0} intensity={0.5} />)
  expect(container.querySelectorAll('use')).toHaveLength(1)
  expect(container.querySelector('use')).toHaveClass('dayorb-base')
  expect(container.querySelector('.dayorb-meniscus')).toBeNull()
})

test('részleges töltésnél a clip teteje a pct-ből jön', () => {
  const { container } = render(<DayOrb pct={50} intensity={0.5} />)
  expect(clipTop(container)).toBeCloseTo(48, 5) // 82 − 0.5 × 68
})

test('0%-on a clip teteje az orb alja, 100%-on a teteje', () => {
  expect(clipTop(render(<DayOrb pct={0} intensity={0.5} />).container)).toBeCloseTo(82, 5)
  expect(clipTop(render(<DayOrb pct={100} intensity={0.5} />).container)).toBeCloseTo(14, 5)
})

test('100%-on nincs menisz — a felszín nem látszik, ha tele van', () => {
  const { container } = render(<DayOrb pct={100} intensity={1} />)
  expect(container.querySelector('.dayorb-meniscus')).toBeNull()
})

test('részleges töltésnél VAN menisz', () => {
  const { container } = render(<DayOrb pct={40} intensity={0.5} />)
  expect(container.querySelector('.dayorb-meniscus')).not.toBeNull()
})

test('intensity=0 a kifakult végpontot adja, intensity=1 a teltet', () => {
  const stops = (i: number) =>
    [...render(<DayOrb pct={100} intensity={i} />).container.querySelectorAll('stop')]
      .map((s) => s.getAttribute('stop-color'))
  expect(stops(0)).toEqual(['#f3e2d9', '#e3bdab', '#c69c89'])
  expect(stops(1)).toEqual(['#ffc3a8', '#ff7a55', '#d8481f'])
})

test('a pct a 0…100 tartományra szorul', () => {
  expect(clipTop(render(<DayOrb pct={-20} intensity={0.5} />).container)).toBeCloseTo(82, 5)
  expect(clipTop(render(<DayOrb pct={140} intensity={0.5} />).container)).toBeCloseTo(14, 5)
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
  const ids = [...container.querySelectorAll('clipPath, radialGradient')].map((n) => n.id)
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
})
