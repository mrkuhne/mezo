import { matchRoutes } from 'react-router-dom'
import { routes } from '@/app/router'
import { KALAUZ_REGISTRY, type KalauzEntry, findKalauz, getKalauz, resolveKalauz } from '@/features/tutorial/registry'
import { FOGALMAK, type FogalomKey } from '@/features/tutorial/registry/fogalmak'
import { FORBIDDEN, countSentences } from '@/features/tutorial/registry/lint'

// `matchRoutes(...).not.toBeNull()` alone would never fail: a router.tsx-ben van egy
// top-szintű `{ path: '*', element: <Navigate to="/nap" /> }` fogó-route (:326), ami
// MINDEN nemlétező útvonalra is illeszkedik, és a lánc utolsó tagja marad `*`. Ezért a
// tényleges kaput az adja, hogy a lánc utolsó illesztett route-jának path-je NEM `*`.
// Mindkét route-létezést ellenőrző teszt ezt a helpert hívja, ne duplikáljuk a logikát.
const routeExists = (to: string) => {
  const m = matchRoutes(routes, to)
  return m != null && m[m.length - 1]?.route.path !== '*'
}

// A hub és az aloldala KÜLÖN kalauz (a route `end: true`-val matchel), és van olyan
// Fuel-útvonal, ami szándékosan kalauz nélkül él — a /fuel/slots csak a beállítás-lapról
// érhető el, a spec §10 T2-listája nem sorolja (S4-ig marad üresen).
test('a /fuel-nek és a /fuel/log-nak külön kalauza van, a /fuel/slots-nak nincs', () => {
  expect(findKalauz('/fuel')?.id).toBe('fuel')
  expect(findKalauz('/fuel/log')?.id).toBe('fuel-log')
  expect(findKalauz('/fuel/slots')).toBeNull()
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
    const sentences = countSentences(c.voice)
    expect(sentences).toBeLessThanOrEqual(2)
    if (c.kind === 'fogalom') expect(c.def.split(/\s+/).length).toBeLessThanOrEqual(25)
  }
})

// A KalauzSheet a `card.orb`-ot ÉS a `card.spot`-ot is feltétel nélkül kirakja egymás mellé
// (KalauzSheet.tsx kalauz-art): ha a kettő ugyanaz, a kártyán két azonos folt ül.
test('art-lint: a kártya spotja nem lehet azonos az orbjával', () => {
  for (const e of KALAUZ_REGISTRY) for (const c of e.cards) {
    if (c.kind === 'kapcsolat') continue // ennek nincs spotja
    expect(c.spot, `${e.id}: ${c.title}`).not.toBe(c.orb ?? 's-orb')
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

// ── route-feloldás (mezo-gvbl) ────────────────────────────────────────────────
// A T3 detail-route-ok (`:id`) mellett a routerben ott ülnek a literál testvéreik
// (`/me/people/heti`, `/me/goals/new`, `/fuel/recipes/muhely`, `/train/mesocycles/compare`),
// tehát az átfedés nem tiltható — a feloldásnak kell determinisztikusnak lennie.
const entry = (id: string, route: string): KalauzEntry => ({
  id, route, tier: 'T3', version: 1, label: id,
  cards: [{ kind: 'intro', title: id, voice: id, spot: 'i-nap' }],
})

test('a specifikusabb route nyer, a registry-sorrendtől függetlenül', () => {
  const literal = entry('people-heti', '/me/people/heti')
  const param = entry('person', '/me/people/:id')
  expect(resolveKalauz([param, literal], '/me/people/heti')?.id).toBe('people-heti')
  expect(resolveKalauz([literal, param], '/me/people/heti')?.id).toBe('people-heti')
  expect(resolveKalauz([literal, param], '/me/people/42')?.id).toBe('person')
})

test('route-lint: nincs két bejegyzés azonos route-mintával', () => {
  const seen = new Map<string, string>()
  for (const e of KALAUZ_REGISTRY) {
    expect(seen.get(e.route), `${e.route}: ${seen.get(e.route)} vs ${e.id}`).toBeUndefined()
    seen.set(e.route, e.id)
  }
})

// A `matchRoutes` rangsora nem totális: két KÜLÖNBÖZŐ minta azonos pontszámot kaphat
// (statikus szegmens 10, paraméteres 3), és holtversenyben a tömbsorrend dönt — némán.
// A lint ezért PÁRONKÉNT keres tanú-útvonalat: azt a konkrét pathnamet, amit mindkét minta
// matchel (a literál szegmensek fixek, a két paraméteres pozíció helyőrzőt kap).
const witness = (a: string, b: string): string | null => {
  const A = a.split('/'), B = b.split('/')
  if (A.length !== B.length) return null
  const out: string[] = []
  for (let i = 0; i < A.length; i++) {
    const [x, y] = [A[i]!, B[i]!]
    const [px, py] = [x.startsWith(':'), y.startsWith(':')]
    if (!px && !py && x !== y) return null
    out.push(px ? (py ? 'x1' : y) : x)
  }
  return out.join('/')
}

/** Azok az átfedő párok, amelyeken a registry MEGFORDÍTÁSA más kalauzt old fel. */
const orderDependent = (entries: KalauzEntry[]) => {
  const rev = [...entries].reverse()
  const bad: string[] = []
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    const [a, b] = [entries[i]!, entries[j]!]
    const w = witness(a.route, b.route)
    if (w != null && resolveKalauz(entries, w)?.id !== resolveKalauz(rev, w)?.id) {
      bad.push(`${a.id} (${a.route}) ⇄ ${b.id} (${b.route}) — ${w}`)
    }
  }
  return bad
}

test('a sorrend-lint elkapja a holtversenyes párt', () => {
  // `/me/:a/heti` és `/me/people/:b` pontszáma egyaránt 10+3+10, a tanú `/me/people/heti`-t
  // mindkettő matcheli — ott csak a tömbsorrend dönt.
  const pair = [entry('a', '/me/:a/heti'), entry('b', '/me/people/:b')]
  expect(orderDependent(pair)).toHaveLength(1)
})

test('a KALAUZ_REGISTRY feloldása sorrend-független', () => {
  expect(orderDependent(KALAUZ_REGISTRY)).toEqual([])
})

// ── S3a lefedettség (mezo-gb1s.5) ─────────────────────────────────────────────
// Az epic-spec §10 T2-listájának Nap + Edzés szelete: minden fő aloldal kalauzt
// kap, T2 szinten (auto-open). A lista a spec-ből másolva — ha egy route kiesik a
// routerből, a route-létezés lint amúgy is szól; ez a teszt a MEGLÉTET őrzi.
const S3A_T2_ROUTES = [
  '/nap/uzenetek', '/nap/rutin', '/nap/kuldetesek', '/nap/checkin', '/nap/eletjel',
  '/train/mai', '/train/week', '/train/sport', '/train/futas', '/train/exercises',
  '/train/medals', '/train/mesocycles', '/train/session', '/train/review/:workoutId',
]

test('S3a: minden Nap + Edzés fő aloldalnak van T2 kalauza', () => {
  for (const route of S3A_T2_ROUTES) {
    const e = KALAUZ_REGISTRY.find((k) => k.route === route)
    expect(e, route).toBeDefined()
    expect(e!.tier, route).toBe('T2')
  }
})

// ── S3b lefedettség (mezo-gb1s.6) ─────────────────────────────────────────────
// A spec §10 T2-listájának Fuel szelete. A `/fuel/log/uj` szándékosan ÖNÁLLÓ kalauz,
// nem a `/fuel/log` folytatása: a composer saját teljes oldal (mezo-bq2t), és a
// route-effekt ott külön auto-opent futtat. A listából KIMARAD a „Gyors logolás sheet"
// (`quickinput`): nem route, a motor route-effektje nem tudja triggerelni — az S4
// komponens-esemény seamjére csúszott (epic-komment).
const S3B_T2_ROUTES = [
  '/fuel/log', '/fuel/log/uj', '/fuel/plan', '/fuel/stack',
  '/fuel/recipes', '/fuel/kamra', '/fuel/gyogyszer', '/fuel/naplo',
]

test('S3b: minden Fuel fő aloldalnak van T2 kalauza', () => {
  for (const route of S3B_T2_ROUTES) {
    const e = KALAUZ_REGISTRY.find((k) => k.route === route)
    expect(e, route).toBeDefined()
    expect(e!.tier, route).toBe('T2')
  }
})
