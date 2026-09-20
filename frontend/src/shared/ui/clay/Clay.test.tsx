import { render } from '@testing-library/react'
import { ClayIcon, ClaySpot, ClaySprites } from '@/shared/ui/clay'

// The clay sprites are the design_2.0 asset contract: docs/design_2.0/assets/clay-icons.svg
// (67 symbols) + clay-spots.svg (24 symbols) copied VERBATIM (1:1 fidelity — mezo-d20.1.2).
//
// Visszaöltöztetés (mezo-ju4j6.3): the Titanium redraw (mezo-titanium-icons, d302e941f) is
// ROLLED BACK. The 54 symbols that existed before it are restored verbatim from
// docs/design_2.0/assets/restored-world/clay-icons-pre-titanium.svg; the 13 that were born
// during the Titanium period (Fuel fülsor, makró-identitás, értékelés-dimenziók,
// vércukor-válasz, ⓘ) are REDRAWN in the clay material per the style bible §6.1 recipe —
// their names, subjects and call sites are unchanged, only the material. The set still only
// ever grows (67 i-* + 24 s-*): nothing was dropped, so no call site can break.
//
// The clay recipe, and what this file guards:
//   viewBox 0 0 100 100 · per-object named gradient (ig-*/sg-*) · one white specular ellipse
//   · NO brushed-titanium base ramp, NO ig-shadow drop filter.

/** Every symbol name a consumer can ask for, per the exported union in index.tsx. */
const RESTORED_TITANIUM_ERA = [
  'i-tanyer', 'i-kiegeszito', 'i-trend', 'i-fazek',
  'i-hus', 'i-gabona', 'i-avokado', 'i-noveny',
  'i-makro', 'i-mikro', 'i-feldolgozas', 'i-vercukor', 'i-info',
] as const

test('ClaySprites mounts all 70 icon symbols and 24 spot symbols', () => {
  render(<ClaySprites />)
  expect(document.querySelectorAll('symbol[id^="i-"]')).toHaveLength(70)
  expect(document.querySelectorAll('symbol[id^="s-"]')).toHaveLength(24)
})

// The kill-list itself (spec §Kill-list): the Titanium material must be GONE from the sprite,
// not merely unused by the 13 redraws — a partial merge that left the old defs behind would
// keep every restored symbol rendering in brushed metal.
test('the Titanium material is gone from the sprite — no metal ramp, no drop-shadow filter', () => {
  render(<ClaySprites />)
  expect(document.querySelector('#ig-titanium')).toBeNull()
  expect(document.querySelector('#ig-shadow')).toBeNull()
  expect(document.querySelector('#sg-titanium')).toBeNull()
  expect(document.querySelector('#sg-shadow')).toBeNull()
})

test('every symbol is authored at the clay viewBox — ClayIcon/ClaySpot render 0 0 100 100', () => {
  render(<ClaySprites />)
  for (const sym of document.querySelectorAll('symbol[id^="i-"], symbol[id^="s-"]')) {
    expect(sym.getAttribute('viewBox'), `${sym.id} viewBox`).toBe('0 0 100 100')
  }
})

// The 13 Titanium-era symbols had no pre-Titanium ancestor, so they are the ONLY ones this
// task hand-drew — and therefore the only ones that could silently keep a Titanium tell.
test.each(RESTORED_TITANIUM_ERA)('%s is redrawn in the clay material', id => {
  render(<ClaySprites />)
  const sym = document.querySelector(`#${id}`)
  expect(sym, `${id} hiányzik`).not.toBeNull()
  expect(sym!.innerHTML).not.toContain('ig-titanium')
  expect(sym!.innerHTML).not.toContain('ig-shadow')
  // the upper-left specular is what makes a clay object read as lit volume (§6.1)
  expect(sym!.querySelector('ellipse[fill^="rgba(255,255,255"]'), `${id} specular`).not.toBeNull()
})

// The palette is closed: a redraw may only reach for gradients the sprite actually defines.
test('no symbol references a gradient the sprite does not define', () => {
  const { container } = render(<ClaySprites />)
  const defined = new Set(Array.from(container.querySelectorAll('[id^="ig-"], [id^="sg-"]'), n => n.id))
  const referenced = new Set(
    Array.from(container.innerHTML.matchAll(/url\(#((?:ig|sg)-[a-z0-9-]+)\)/g), m => m[1]),
  )
  expect([...referenced].filter(g => !defined.has(g))).toEqual([])
})

// mezo-8az6: a fejléc szekció-spotjaihoz a Fuel és az Én darabja kell.
test('a két szekció-spot a sprite-ban van, a clay recept szerint', () => {
  render(<ClaySprites />)
  for (const id of ['s-fuel', 's-en']) {
    const sym = document.querySelector(`#${id}`)
    expect(sym, `${id} hiányzik`).not.toBeNull()
    // minden spot alján tompított árnyék-ellipszis ül
    expect(sym!.querySelector('ellipse')).not.toBeNull()
  }
})

test('sprite gradients are copied verbatim — the sun ramp keeps its exact stops', () => {
  render(<ClaySprites />)
  const sun = document.querySelector('#ig-sun')
  expect(sun).not.toBeNull()
  const stops = Array.from(sun!.querySelectorAll('stop')).map(s => s.getAttribute('stop-color'))
  expect(stops).toEqual(['#FFEDB8', '#F0B429', '#B57E14'])
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
