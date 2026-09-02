import { matchRoutes } from 'react-router-dom'
import { routes } from '@/app/router'
import { KALAUZ_REGISTRY, findKalauz, getKalauz } from '@/features/tutorial/registry'
import { FOGALMAK, type FogalomKey } from '@/features/tutorial/registry/fogalmak'

// Stems, not whole words — no trailing \b — so inflections (pl. "kellene", "hibázik", "elbuktad",
// "rosszul") are caught too, not just the dictionary form.
const FORBIDDEN = /\b(kell|muszáj|hib[aá]|elbuk|rossz)/i

// `matchRoutes(...).not.toBeNull()` alone would never fail: a router.tsx-ben van egy
// top-szintű `{ path: '*', element: <Navigate to="/nap" /> }` fogó-route (:326), ami
// MINDEN nemlétező útvonalra is illeszkedik, és a lánc utolsó tagja marad `*`. Ezért a
// tényleges kaput az adja, hogy a lánc utolsó illesztett route-jának path-je NEM `*`.
// Mindkét route-létezést ellenőrző teszt ezt a helpert hívja, ne duplikáljuk a logikát.
const routeExists = (to: string) => {
  const m = matchRoutes(routes, to)
  return m != null && m[m.length - 1]?.route.path !== '*'
}

test('a /fuel-nek van kalauza, a /fuel/log-nak (még) nincs', () => {
  expect(findKalauz('/fuel')?.id).toBe('fuel')
  expect(findKalauz('/fuel/log')).toBeNull()
  expect(getKalauz('fuel')?.label).toBe('Fuel')
  expect(getKalauz('nincs-ilyen')).toBeNull()
})

test('minden entry route-ja létezik a routerben, az id-k egyediek', () => {
  const ids = new Set<string>()
  for (const e of KALAUZ_REGISTRY) {
    expect(routeExists(e.route), `${e.id}: route → ${e.route}`).toBe(true)
    expect(ids.has(e.id)).toBe(false)
    ids.add(e.id)
    expect(e.version).toBeGreaterThanOrEqual(1)
  }
})

test('hang-lint: nincs tiltott szó, kártyánként legfeljebb 2 mondat, fogalom ≤ 25 szó', () => {
  for (const e of KALAUZ_REGISTRY) for (const c of e.cards) {
    expect(c.voice).not.toMatch(FORBIDDEN)
    expect(c.title).not.toMatch(FORBIDDEN)
    const sentences = c.voice.split(/[.!?…]\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ„])/).length
    expect(sentences).toBeLessThanOrEqual(2)
    if (c.kind === 'fogalom') expect(c.def.split(/\s+/).length).toBeLessThanOrEqual(25)
  }
})

test('szótár: minden fogalom-kártya egy FOGALMAK-bejegyzést hordoz, és nincs árva kulcs', () => {
  const used = new Set<string>()
  const byTerm = new Map(Object.entries(FOGALMAK).map(([k, f]) => [f.term, k as FogalomKey]))
  for (const e of KALAUZ_REGISTRY) for (const c of e.cards) {
    if (c.kind !== 'fogalom') continue
    const key = byTerm.get(c.term)
    // A kártya `term`/`def`-je NEM kézzel írt: a `fogalom(key)` spreadjéből jön.
    expect(key, `ismeretlen fogalom: „${c.term}"`).toBeDefined()
    expect(c.def).toBe(FOGALMAK[key!].def)
    used.add(key!)
  }
  // S2a-4 (YAGNI): a szótár csak azt tartalmazza, amit valaki hivatkoz.
  expect([...Object.keys(FOGALMAK)].filter((k) => !used.has(k))).toEqual([])
})

test('minden kapcsolat-chip létező route-ra mutat', () => {
  for (const e of KALAUZ_REGISTRY) for (const c of e.cards) {
    if (c.kind !== 'kapcsolat') continue
    for (const l of c.links) {
      expect(routeExists(l.to), `${e.id}: ${l.label} → ${l.to}`).toBe(true)
    }
  }
})

test('szótár: a definíciók lintelve vannak', () => {
  for (const [key, f] of Object.entries(FOGALMAK)) {
    expect(f.def, key).not.toMatch(FORBIDDEN)
    expect(f.term, key).not.toMatch(FORBIDDEN)
    expect(f.def.split(/\s+/).length, key).toBeLessThanOrEqual(25)
  }
})
