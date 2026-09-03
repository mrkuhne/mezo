import { render } from '@testing-library/react'
import { HeaderAurora } from '@/app/HeaderAurora'

test('a napszakot data-attribútumban adja tovább a CSS-nek', () => {
  const { container, rerender } = render(<HeaderAurora face="reggel" />)
  const bg = container.querySelector('.app-head-bg')!
  expect(bg.getAttribute('data-face')).toBe('reggel')
  rerender(<HeaderAurora face="este" />)
  expect(container.querySelector('.app-head-bg')!.getAttribute('data-face')).toBe('este')
})

test('tisztán dekoratív: a kisegítő fából kimarad', () => {
  const { container } = render(<HeaderAurora face="nap" />)
  expect(container.querySelector('.app-head-bg')!.getAttribute('aria-hidden')).toBe('true')
})

test('minden napszak a saját grafikáját kapja', () => {
  const { container: reggel } = render(<HeaderAurora face="reggel" />)
  const { container: nap } = render(<HeaderAurora face="nap" />)
  const { container: este } = render(<HeaderAurora face="este" />)
  const svg = (c: HTMLElement) => c.querySelector('.app-head-deco svg')!.innerHTML
  expect(svg(reggel)).not.toBe(svg(nap))
  expect(svg(nap)).not.toBe(svg(este))
  // este: csillagok + hold — a legtöbb elemből álló rajz
  expect(este.querySelectorAll('.app-head-deco circle').length).toBeGreaterThan(3)
})

test('a wash és a két fényfolt réteg mindig ott van', () => {
  const { container } = render(<HeaderAurora face="nap" />)
  expect(container.querySelector('.app-head-wash')).not.toBeNull()
  expect(container.querySelectorAll('.app-head-blob')).toHaveLength(2)
})
