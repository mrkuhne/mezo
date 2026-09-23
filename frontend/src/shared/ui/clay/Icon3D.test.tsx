import { render } from '@testing-library/react'
import { CLAY_TO_3D, ClaySprites, ContentIcon, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import titaniumRaw from './titanium-icons.svg?raw'

// Üveg style bible §4 (mezo-me75u.1): the CONTENT icon set is the Titanium companion sprite,
// namespaced t-* (symbols) / tg-* (defs) so it shares the DOM with the clay set.

const symbolIds = () => Array.from(titaniumRaw.matchAll(/<symbol id="(t-[a-z0-9-]+)"/g), m => m[1])

test('the sprite carries the 62 companion-titanium symbols plus the approved custom ones', () => {
  const ids = symbolIds()
  expect(ids.length).toBeGreaterThanOrEqual(62)
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ['t-bowl', 't-score', 't-meat', 't-carb', 't-avocado', 't-water', 't-fiber']) {
    expect(ids, id).toContain(id)
  }
})

// U3 (mezo-me75u.3): the Nap icons the owner approved on prototypes/uveg-nap.html#ikonok.
test('the sprite carries the U3 Nap icons', () => {
  const ids = symbolIds()
  for (const id of ['t-checkin', 't-quick', 't-steps', 't-people', 't-chain', 't-quest',
    't-harvest', 't-coin', 't-orb', 't-flask', 't-scroll'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

test('every symbol is 64×64 art (Icon3D renders viewBox 0 0 64 64)', () => {
  const { container } = render(<ClaySprites />)
  const syms = container.querySelectorAll('symbol[id^="t-"]')
  expect(syms.length).toBe(symbolIds().length)
  for (const sym of syms) expect(sym.getAttribute('viewBox'), sym.id).toBe('0 0 64 64')
})

test('the namespace is closed: every url()/href reference resolves inside the sprite', () => {
  const defined = new Set(Array.from(titaniumRaw.matchAll(/id="([^"]+)"/g), m => m[1]))
  const refs = Array.from(titaniumRaw.matchAll(/(?:url\(#|href="#)([^)"]+)/g), m => m[1])
  expect(refs.filter(r => !defined.has(r))).toEqual([])
  expect(refs.every(r => r.startsWith('t-') || r.startsWith('tg-'))).toBe(true)
})

// Visszaöltöztetés trap: a display:none sprite never resolves its gradients.
test('the sprite is hidden by zero size, never display:none', () => {
  expect(titaniumRaw.slice(0, 200)).toContain('position:absolute;width:0;height:0')
  expect(titaniumRaw).not.toMatch(/display:\s*none/)
})

test('Icon3D renders an aria-hidden 64-viewBox svg with a use ref, carrying the kit class', () => {
  const name: Icon3DName = 't-bowl'
  const { container } = render(<Icon3D name={name} size={40} className="x" />)
  const svg = container.querySelector('svg')!
  expect(svg.getAttribute('viewBox')).toBe('0 0 64 64')
  expect(svg.getAttribute('aria-hidden')).toBe('true')
  expect(svg.getAttribute('class')).toBe('t-ico x')
  expect(svg.querySelector('use')!.getAttribute('href')).toBe('#t-bowl')
})

describe('ContentIcon — clay names onto the 3D set during the mixed look', () => {
  test('a Titanium name renders as the 3D icon', () => {
    const { container } = render(<ContentIcon name="t-score" size={20} />)
    expect(container.querySelector('use')!.getAttribute('href')).toBe('#t-score')
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 64 64')
  })
  test('a mapped clay name renders its 3D counterpart', () => {
    const { container } = render(<ContentIcon name="i-hus" />)
    expect(container.querySelector('use')!.getAttribute('href')).toBe('#t-meat')
  })
  test('an unmapped clay name falls back to the clay icon', () => {
    const { container } = render(<ContentIcon name="i-meso" />)
    expect(container.querySelector('use')!.getAttribute('href')).toBe('#i-meso')
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 100 100')
  })
  test('every mapping target exists in the sprite', () => {
    const ids = new Set(symbolIds())
    for (const t of Object.values(CLAY_TO_3D)) expect(ids.has(t!), t).toBe(true)
  })
})
