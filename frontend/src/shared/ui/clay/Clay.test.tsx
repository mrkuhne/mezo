import { render } from '@testing-library/react'
import { ClayIcon, ClaySpot, ClaySprites } from '@/shared/ui/clay'

// The clay sprites are the design_2.0 asset contract: docs/design_2.0/assets/clay-icons.svg
// (53 symbols) + clay-spots.svg (22 symbols) copied VERBATIM (1:1 fidelity — mezo-d20.1.2).
// i-hold + i-termes joined the set for the Napzárás night language (mezo-d20.8.1.1).
// 8 s-orb-* persona variants joined the spot set for Karakter (mezo-1gim.13).
// 8 i-life-* life-area symbols joined for the F7.4 iconography round (mezo-d20.8.4.1).

test('ClaySprites mounts all 53 icon symbols and 22 spot symbols', () => {
  render(<ClaySprites />)
  expect(document.querySelectorAll('symbol[id^="i-"]')).toHaveLength(53)
  expect(document.querySelectorAll('symbol[id^="s-"]')).toHaveLength(22)
})

test('sprite gradients are copied verbatim — the orb ramp keeps its exact stops', () => {
  render(<ClaySprites />)
  const orb = document.querySelector('#ig-orb')
  expect(orb).not.toBeNull()
  const stops = Array.from(orb!.querySelectorAll('stop')).map(s => s.getAttribute('stop-color'))
  expect(stops).toEqual(['#FFC3A8', '#FF7A55', '#D8481F'])
})

test('ClayIcon renders an aria-hidden svg with a use ref to the requested symbol', () => {
  const { container } = render(<ClayIcon name="i-edzes" size={23} />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('width')).toBe('23')
  expect(svg.getAttribute('height')).toBe('23')
  expect(svg.getAttribute('viewBox')).toBe('0 0 100 100')
  expect(svg.getAttribute('aria-hidden')).toBe('true')
  expect(svg.querySelector('use')!.getAttribute('href')).toBe('#i-edzes')
})

test('ClaySpot renders a use ref to the requested spot symbol', () => {
  const { container } = render(<ClaySpot name="s-orb" size={40} />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('viewBox')).toBe('0 0 100 100')
  expect(svg.querySelector('use')!.getAttribute('href')).toBe('#s-orb')
})
