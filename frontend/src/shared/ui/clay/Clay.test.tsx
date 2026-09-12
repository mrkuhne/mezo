import { render } from '@testing-library/react'
import { ClayIcon, ClaySpot, ClaySprites } from '@/shared/ui/clay'

// The clay sprites are the design_2.0 asset contract: docs/design_2.0/assets/clay-icons.svg
// (62 symbols) + clay-spots.svg (24 symbols) copied VERBATIM (1:1 fidelity — mezo-d20.1.2).
// Titanium redraw (mezo-titanium-icons): the whole set was re-authored in the Titanium
// material language — a brushed-titanium base gradient (ig-titanium/sg-titanium) plus a domain
// accent — replacing the earlier warm-clay ramps. The existing NAMES are unchanged so every
// call site and mapping table keeps compiling; the set only ever GROWS (62 i-* + 24 s-*).

test('ClaySprites mounts all 62 icon symbols and 24 spot symbols', () => {
  render(<ClaySprites />)
  expect(document.querySelectorAll('symbol[id^="i-"]')).toHaveLength(62)
  expect(document.querySelectorAll('symbol[id^="s-"]')).toHaveLength(24)
})

// Fuel Titanium S1a (mezo-33k6): az owner rögzített makró-identitása — hús/gabona/avokádó/növény
// a Mai hero gyűrűsorához. Ugyanaz a titánium recept: 64-es viewBox, titánium alap + EGY akcentus
// a zárt ig-* palettáról, tompított árnyék. Új gradiens nem született.
test('a négy makró-ikon a sprite-ban van, a titánium recept szerint', () => {
  render(<ClaySprites />)
  for (const id of ['i-hus', 'i-gabona', 'i-avokado', 'i-noveny']) {
    const sym = document.querySelector(`#${id}`)
    expect(sym, `${id} hiányzik`).not.toBeNull()
    expect(sym!.getAttribute('viewBox')).toBe('0 0 64 64')
    expect(sym!.innerHTML).toContain('url(#ig-titanium)')
    expect(sym!.innerHTML).toContain('url(#ig-shadow)')
  }
})

// Fuel Titanium (mezo-o6uv): a Fuel fülsor négy saját szimbóluma — tányér, kiegészítő-tégely,
// trend-tábla, fazék. A készlet szabálya szerint titánium alap + domén-akcentus.
test('a négy Fuel-fül ikon a sprite-ban van, a titánium recept szerint', () => {
  render(<ClaySprites />)
  for (const id of ['i-tanyer', 'i-kiegeszito', 'i-trend', 'i-fazek']) {
    const sym = document.querySelector(`#${id}`)
    expect(sym, `${id} hiányzik`).not.toBeNull()
    expect(sym!.getAttribute('viewBox')).toBe('0 0 64 64')
    expect(sym!.innerHTML).toContain('url(#ig-titanium)')
    expect(sym!.innerHTML).toContain('url(#ig-shadow)')
  }
})

// mezo-8az6: a fejléc szekció-spotjaihoz a Fuel és az Én darabja hiányzott a készletből.
test('a két új szekció-spot a sprite-ban van, a clay recept szerint', () => {
  render(<ClaySprites />)
  for (const id of ['s-fuel', 's-en']) {
    const sym = document.querySelector(`#${id}`)
    expect(sym, `${id} hiányzik`).not.toBeNull()
    expect(sym!.getAttribute('viewBox')).toBe('0 0 100 100')
    // minden spot alján tompított árnyék-ellipszis ül
    expect(sym!.querySelector('ellipse')).not.toBeNull()
  }
})

test('sprite gradients are copied verbatim — the titanium ramp keeps its exact stops', () => {
  render(<ClaySprites />)
  const ti = document.querySelector('#ig-titanium')
  expect(ti).not.toBeNull()
  const stops = Array.from(ti!.querySelectorAll('stop')).map(s => s.getAttribute('stop-color'))
  expect(stops).toEqual(['#e9e4f6', '#8e8a9e', '#282b39', '#62697d', '#c9c7d8', '#393647'])
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
