import { render } from '@testing-library/react'
import { CLAY_TO_3D, ClaySprites, ContentIcon, Icon3D, type Icon3DName } from '@/shared/ui/clay'
import titaniumRaw from './titanium-icons.svg?raw'

// Folyadék F1 (mezo-n4wf5.1): the CONTENT icon set is the Folyadék-jel sprite (outlined,
// half-liquid glyphs), namespaced t-* (symbols) / tc-* (clip defs) so it shares the DOM with the clay set.

const symbolIds = () => Array.from(titaniumRaw.matchAll(/<symbol id="(t-[a-z0-9-]+)"/g), m => m[1])

test('the sprite carries the original 62 symbol ids plus the approved custom ones', () => {
  const ids = symbolIds()
  expect(ids.length).toBeGreaterThanOrEqual(62)
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ['t-bowl', 't-score', 't-meat', 't-carb', 't-avocado', 't-water', 't-fiber', 't-thumb-up', 't-thumb-down', 't-send', 't-flask']) {
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

// U4 (mezo-me75u.4): the Edzés icons the owner approved on prototypes/uveg-edzes.html#ikonok.
test('the sprite carries the U4 Edzés icons', () => {
  const ids = symbolIds()
  for (const id of ['t-muscle', 't-bandage'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

// U5 (mezo-me75u.5): the Terv/Sablonok icons the owner approved on
// prototypes/uveg-edzes2.html#ikonok. Each one exists because the 62-symbol set has no
// honest stand-in: a reusable week plan, two closed runs side by side, and a delete.
test('the sprite carries the U5 Terv icons', () => {
  const ids = symbolIds()
  for (const id of ['t-template', 't-compare', 't-trash'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

// U6 (mezo-me75u.6): the Én I icons the owner approved on prototypes/uveg-en.html#ikonok —
// the Értelem life dimension, the goal signal sources, the weekly discoveries, and the two
// night-mode tools (guided breathing, the 20-minute get-up rule).
test('the sprite carries the U6 Én icons', () => {
  const ids = symbolIds()
  for (const id of ['t-compass', 't-signal', 't-lens', 't-breath', 't-candle'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

// U7 (mezo-me75u.7): the Én II icons the owner approved on prototypes/uveg-en2.html#ikonok —
// notifications, the habit anchor, tips, "cut it smaller", AI suggestion, account key, sign-out,
// appearance, and two achievement badges (first quest, LIFE Lv 5).
test('the sprite carries the U7 Én II icons', () => {
  const ids = symbolIds()
  for (const id of ['t-bell', 't-anchor', 't-bulb', 't-scissors', 't-spark', 't-key', 't-exit', 't-palette',
    't-flag', 't-brain'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

// U8 (mezo-me75u.8): the Mezo I icons the owner approved on prototypes/uveg-mezo.html#ikonok —
// coaching, the observer, the daily card, diagnosis, memories, the memory layers, rename.
test('the sprite carries the U8 Mezo I icons', () => {
  const ids = symbolIds()
  for (const id of ['t-whistle', 't-eye', 't-card', 't-diagnose', 't-album', 't-layers', 't-pencil'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

// U9 (mezo-me75u.9): konzílium, detektor, kapcsolatok, összes funkció — owner OK 2026-09-25.
test('the sprite carries the U9 Mezo II icons', () => {
  const ids = symbolIds()
  for (const id of ['t-council', 't-radar', 't-graph', 't-grid'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

// Check-in 2.0 (mezo-ck2): the Edzés readiness card's reason + care icons, approved on
// prototypes/elo/edzes.html (kipihentség, izomláz, fájdalom, kedv).
test('the sprite carries the Check-in 2.0 readiness icons', () => {
  const ids = symbolIds()
  for (const id of ['t-rested', 't-soreness', 't-pain', 't-motivation'] satisfies Icon3DName[]) {
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
  expect(refs.every(r => r.startsWith('t-') || r.startsWith('tc-'))).toBe(true)
  expect(titaniumRaw).not.toMatch(/tg-|feDropShadow|Gradient/)
})

// Visszaöltöztetés trap: a display:none sprite never resolves its gradients.
test('every glyph draws with the Folyadék colour variables (--ic line, --ic2 liquid, --icf body)', () => {
  expect(titaniumRaw).toContain('var(--ic,var(--dom))')
  expect(titaniumRaw).toContain('var(--ic2,var(--dom2))')
  expect(titaniumRaw).toContain('var(--icf,')
  expect(titaniumRaw).not.toMatch(/fill="#[0-9a-fA-F]{3,6}"/)
})

test('the sprite is hidden by zero size, never display:none', () => {
  expect(titaniumRaw.slice(0, 200)).toContain('position:absolute;width:0;height:0')
  expect(titaniumRaw).not.toMatch(/display:\s*none/)
})

// S6 (mezo-d6ivw.6): the Tudástár hub verbs the owner approved on prototypes/uveg-tudastar-hub.html#ikonok —
// Elhallgattatom, Elfelejtem, Honnan tudom?, and the Hatások tile (két hullám együtt mozog).
test('the sprite carries the S6 Tudástár hub icons', () => {
  const ids = symbolIds()
  for (const id of ['t-mute', 't-eraser', 't-source', 't-cowave'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
})

// Check-in 2.0 (mezo-ck2): the nine item icons the owner approved on prototypes/elo/nap.html#ikonok.
test('the sprite carries the Check-in 2.0 item icons', () => {
  const ids = symbolIds()
  for (const id of ['t-mood', 't-rested', 't-soreness', 't-pain', 't-motivation', 't-hunger',
    't-craving', 't-day', 't-digestion'] satisfies Icon3DName[]) {
    expect(ids, id).toContain(id)
  }
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
    const { container } = render(<ContentIcon name="i-retegek" />)
    expect(container.querySelector('use')!.getAttribute('href')).toBe('#i-retegek')
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 100 100')
  })
  test('every mapping target exists in the sprite', () => {
    const ids = new Set(symbolIds())
    for (const t of Object.values(CLAY_TO_3D)) expect(ids.has(t!), t).toBe(true)
  })
})
