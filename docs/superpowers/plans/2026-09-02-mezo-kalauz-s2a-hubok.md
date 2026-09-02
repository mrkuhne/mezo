# Mezo-kalauz S2a — öt hub-kalauz + `fogalmak.ts` szótár · implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az öt tab-gyökér (`/nap`, `/train`, `/fuel`, `/mezo`, `/me`) mindegyike kapjon
saját, laikusnak írt T1 kalauzt, egy közös HU fogalom-szótárral, anélkül hogy a meglévő
shell-tesztek elhasadnának.

**Architecture:** Tisztán frontend, tisztán adat. A `features/tutorial/registry/`
mappa négy új `KalauzEntry[]` fájlt és egy `fogalmak.ts` szótárat kap; a szótárt egy
`fogalom(key)` helper oldja fel **registry-építéskor** `{term, def}` párrá, így a
`shared/ui/kalauz/KalauzSheet` domain-mentes marad. Négy hub-oldal `data-kalauz-anchor`
attribútumot kap a hőse minden variánsán. A teszt-oldali fallout-ot egy
`KALAUZ_REGISTRY`-ből *generáló* seed-helper kezeli.

**Tech Stack:** TypeScript, React 18, react-router-dom (`matchPath`/`matchRoutes`),
Vitest + Testing Library, Playwright (vizuális goldenek), pnpm.

**Spec:** [`docs/superpowers/specs/2026-09-02-mezo-kalauz-s2-hubok-design.md`](../specs/2026-09-02-mezo-kalauz-s2-hubok-design.md)
**bd:** `mezo-gb1s.3` · **branch:** `feat/kalauz-s2a-hubok`

## Global Constraints

- **Hang-lint (`registry.test.ts:7`):** tilos tő — `/\b(kell|muszáj|hib[aá]|elbuk|rossz)/i`.
  Tőre illeszkedik, nem szóra: `kellene`, `kellemes`, `hibázik`, `rosszul` mind bukik.
- **Kártyánként legfeljebb 2 mondat** a `voice` mezőben. A mondat-számláló:
  `voice.split(/[.!?…]\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ„])/).length`. Gondolatjel (`—`), pontosvessző és
  kettőspont **nem** vág mondatot.
- **`def` ≤ 25 szó** (`/\s+/` szerint darabolva — a különálló `—` is egy szónak számít).
- **Többes szám első személy**, Mezo hangján. Nincs számígéret, nincs nyomásgyakorlás.
- **`spot` / `icon` csak létező clay-név lehet** (`shared/ui/clay/index.tsx:14-33`).
  Nincs `s-nap`, `s-mezo`, `s-en` spot. **Ebben a szeletben nem születik új art.**
- **A `KalauzCard` típusa NEM változik** — a `fogalom` variáns továbbra is inline
  `term: string; def: string` mezőket hordoz; a szótár ezeket *termeli*.
- **Minden `kapcsolat`-chip `to`-ja létező route** a `frontend/src/app/router.tsx`-ben.
- **Frontend-only.** Nincs backend-változás, nincs contract, nincs migráció.
- **Kapuk:** `VITE_USE_MOCK=true pnpm test` **és** `VITE_USE_MOCK=false pnpm test` + `pnpm build`.
  Minden parancs a `frontend/` könyvtárból fut.

---

## File Structure

**Létrehozott fájlok**

| Fájl | Felelősség |
|---|---|
| `frontend/src/features/tutorial/registry/fogalmak.ts` | A kanonikus HU fogalom-szótár + a `fogalom(key)` feloldó. Tiszta adat, semmi React. |
| `frontend/src/features/tutorial/registry/nap.ts` | `NAP_KALAUZ` — a `/nap` hub egyetlen T1 bejegyzése. |
| `frontend/src/features/tutorial/registry/train.ts` | `TRAIN_KALAUZ` — a `/train` hub bejegyzése. |
| `frontend/src/features/tutorial/registry/mezo.ts` | `MEZO_KALAUZ` — a `/mezo` hub bejegyzése. |
| `frontend/src/features/tutorial/registry/me.ts` | `ME_KALAUZ` — a `/me` hub bejegyzése. |
| `frontend/src/features/tutorial/registry/anchors.test.tsx` | Per-hub DOM-teszt: minden hub tartalmazza a saját `data-kalauz-anchor`-ját, minden arc-variánsban. |
| `frontend/src/test/kalauz.ts` | `buildAllSeenProgress()` (tiszta adat, Node-ból is hívható) + `seedAllKalauzSeen()` (localStorage-ba ír). |

**Módosított fájlok**

| Fájl | Változás |
|---|---|
| `frontend/src/features/tutorial/registry/fuel.ts` | a `makró` fogalom-kártya átáll a `fogalom('makro')` helperre |
| `frontend/src/features/tutorial/registry/index.ts` | a négy új tömb a `KALAUZ_REGISTRY` spreadbe |
| `frontend/src/features/tutorial/registry/registry.test.ts` | szótár-lint + chip-route-lint |
| `frontend/src/features/today/pages/NapHubPage.tsx` | `data-kalauz-anchor="nap-hero"` négy helyen |
| `frontend/src/features/train/pages/EdzesHubPage.tsx` | `data-kalauz-anchor="train-hero"` hat helyen |
| `frontend/src/features/insights/pages/MezoHubPage.tsx` | `data-kalauz-anchor="mezo-chat"` |
| `frontend/src/features/me/pages/EnHubPage.tsx` | `data-kalauz-anchor="me-idhero"` |
| `frontend/src/app/hubHeaders.test.tsx` | a fejléc-elvárás a registry-ből származik |
| `frontend/src/app/AppHeader.test.tsx` | a „kalauz nélküli oldal" ellenpélda `/mezo` → `/nap/rutin` |
| `frontend/src/app/navigation.test.tsx` · `notificationRoutes.test.tsx` · `features/train/pages/train.nav.test.tsx` · `train.emptyStates.test.tsx` · `features/insights/pages/insights.nav.test.tsx` | `seedAllKalauzSeen()` a `beforeEach`-be |
| `frontend/tests/visual/visual.spec.ts` | az init-script a generált mapet kapja argumentumként |
| `docs/features/tutorial.md` | §7 / §9 / §10 |
| `docs/CODEMAP.md` | regenerálva |

---

## Task 1: A fogalom-szótár és a `fuel` átállítása

**Files:**
- Create: `frontend/src/features/tutorial/registry/fogalmak.ts`
- Modify: `frontend/src/features/tutorial/registry/fuel.ts:14-20`
- Test: `frontend/src/features/tutorial/registry/registry.test.ts`

**Interfaces:**
- Consumes: `KalauzEntry`, `KalauzCard` a `registry/types.ts`-ből (változatlanul).
- Produces:
  - `export type FogalomKey = 'napszak' | 'mezociklus' | 'makro' | 'minta' | 'szint'`
  - `export interface Fogalom { term: string; def: string }`
  - `export const FOGALMAK: Record<FogalomKey, Fogalom>`
  - `export const fogalom: (key: FogalomKey) => Fogalom`
  A 3–5. Task a `...fogalom('<kulcs>')` spreaddel építi a `fogalom`-kártyáit.

- [ ] **Step 1: Írd meg a bukó tesztet**

Add hozzá a `frontend/src/features/tutorial/registry/registry.test.ts` végéhez:

```ts
import { FOGALMAK, type FogalomKey } from '@/features/tutorial/registry/fogalmak'

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

test('szótár: a definíciók lintelve vannak', () => {
  for (const [key, f] of Object.entries(FOGALMAK)) {
    expect(f.def, key).not.toMatch(FORBIDDEN)
    expect(f.term, key).not.toMatch(FORBIDDEN)
    expect(f.def.split(/\s+/).length, key).toBeLessThanOrEqual(25)
  }
})
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/registry.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/tutorial/registry/fogalmak"`.

- [ ] **Step 3: Írd meg a szótárat**

Create `frontend/src/features/tutorial/registry/fogalmak.ts`:

```ts
// ============================================================
// Mezo · fogalmak — a kalauz KANONIKUS fogalom-szótára (mezo-gb1s.3).
// Egy fogalom PONTOSAN egyszer van megfogalmazva; minden kalauz-kártya innen
// kapja a `term`/`def` párt a `fogalom()` helperen át, hogy ugyanaz a fogalom
// sose kapjon két megfogalmazást (spec S2a-3). A definíció HANGTALAN és sima —
// Mezo hangja a kártya `voice` mezőjében szól, nem itt (Duolingo-szabály).
// Minden bejegyzés a forrását viseli: a definíció a kódból/dokumentációból jön,
// nem találgatásból — ugyanaz az idióma, mint `me/logic/sleepEducation.ts`.
// ============================================================

export type FogalomKey = 'napszak' | 'mezociklus' | 'makro' | 'minta' | 'szint'

export interface Fogalom {
  /** A fogalom neve — Fraunces-dőlt fejként renderel a fogalom-dobozban. */
  term: string
  /** Egy mondat, legfeljebb 25 szó. `**félkövér**` megengedett. */
  def: string
}

export const FOGALMAK: Record<FogalomKey, Fogalom> = {
  // Forrás: features/today/logic/dayFace.ts:12-20 — három ALVÁS-horgonyzott ablak
  // (MORNING_SPAN_MIN / EVENING_LEAD_MIN), nem fix óra. A fali óra említése szándékos:
  // a laikus alapfeltevése az, hogy „délután" órához kötött.
  napszak: {
    term: 'napszak',
    def: 'A napod három szakasza — reggel, nap, este. Az ébredésed és a lefekvésed igazítja őket, nem a fali óra.',
  },
  // Forrás: docs/features/train.md §Planner; features/train/pages/MesocyclePlannerPage.tsx
  mezociklus: {
    term: 'mezociklus',
    def: 'Több hetes edzésblokk: a terhelés hétről hétre nő, a végén egy könnyebb hét pihentet. A Mezo innen kapta a nevét.',
  },
  // Forrás: docs/features/fuel.md §1–§3. Szó szerint a fuel.ts S1-es szövege — a
  // megfogalmazás nem változott, csak a helye.
  makro: {
    term: 'makró',
    def: 'A három „építőanyag": **fehérje** (izom), **szénhidrát** (üzemanyag), **zsír** (hormonok). A kalória ezekből adódik össze.',
  },
  // Forrás: docs/features/insights.md §2.1 + companion.md; features/insights/logic/{lifecycle,verdicts}.ts
  // A példa szándékosan „kevés alvás", nem „rossz alvás": a `rossz` tiltott tő a hang-lintben.
  minta: {
    term: 'minta',
    def: 'Egy ismétlődő összefüggés a saját adataidban, amit Mezo vesz észre — például „kevés alvás után több szénhidrát".',
  },
  // Forrás: docs/features/growth.md + ADR 0010 (XP = visszajelzés, nem fizetség).
  // A „semmit nem nyit meg" tagmondat az ADR betartatása copy-szinten.
  szint: {
    term: 'szint',
    def: 'A szinted az összegyűjtött XP-ből jön. Visszajelzés arról, mennyit tettél magadért — nem verseny, és semmit nem nyit meg.',
  },
}

/**
 * A szótárat REGISTRY-IDŐBEN oldja fel `{term, def}` párrá, hogy a `KalauzCard` típusa
 * (és vele a `shared/ui/kalauz/KalauzSheet` szándékosan újradeklarált uniója) domain-mentes
 * maradjon. Használat: `{ kind: 'fogalom', spot: 's-reggel', title: '…', voice: '…', ...fogalom('napszak') }`
 */
export const fogalom = (key: FogalomKey): Fogalom => FOGALMAK[key]
```

- [ ] **Step 4: Állítsd át a `fuel.ts`-t a helperre**

`frontend/src/features/tutorial/registry/fuel.ts` — az import sor kiegészül, és a
fogalom-kártya `term`/`def` sorai helyére a spread kerül:

```ts
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'
```

A `:14-20` kártya:

```ts
      {
        kind: 'fogalom', spot: 's-energia', orb: 's-orb',
        title: 'A napi keret és a makrók.',
        voice: 'A tested minden nap kap egy **keretet** — ennyi energia fér bele. A gyűrű fent mutatja, hol tartunk.',
        ...fogalom('makro'),
      },
```

- [ ] **Step 5: Futtasd — zöld**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/registry.test.ts`
Expected: PASS, 5 teszt. A „nincs árva kulcs" asszert azért zöld, mert egyelőre **csak** a
`makro` van a szótárban… **nem** — a szótárban öt kulcs van, négy árva. **Ez a lépés
szándékosan bukik.**

Ha bukik `expect([...]).toEqual([])` a `["napszak","mezociklus","minta","szint"]` listával,
az a helyes köztes állapot: a 3–5. Task hozza a hivatkozókat. **Kommenteld ki ideiglenesen
az árva-kulcs asszertet** ezzel a sorral, és a 6. Taskban vedd vissza:

```ts
  // TASK-5-BEN VISSZAVENNI: a kulcsokat a nap/train/mezo/me kalauz hivatkozza majd.
  // expect([...Object.keys(FOGALMAK)].filter((k) => !used.has(k))).toEqual([])
```

- [ ] **Step 6: Futtasd újra — most zöld**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/registry.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/tutorial/registry/
git commit -m "feat(tutorial): fogalmak.ts kanonikus fogalom-szótár, a fuel átáll rá (mezo-gb1s.3)

Egy fogalom pontosan egyszer van megfogalmazva; a kártya a fogalom()
helper spreadjéből kapja a term/def párt, így a KalauzCard típusa és a
shared/ui/kalauz határa változatlan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Teszt-infrastruktúra — seed-helper és a fejléc-tesztek registry-vezéreltté tétele

Ez a Task **megelőzi** a kalauzok hozzáadását: utána a 3–5. Task már nem nyúl teszt-fájlhoz.

**Files:**
- Create: `frontend/src/test/kalauz.ts`
- Modify: `frontend/src/app/hubHeaders.test.tsx:7-12,36-44`
- Modify: `frontend/src/app/AppHeader.test.tsx:22-26,73-80`
- Modify: `frontend/src/app/navigation.test.tsx` · `frontend/src/app/notificationRoutes.test.tsx` ·
  `frontend/src/features/train/pages/train.nav.test.tsx` ·
  `frontend/src/features/train/pages/train.emptyStates.test.tsx` ·
  `frontend/src/features/insights/pages/insights.nav.test.tsx` — mind a `beforeEach`-ben

**Interfaces:**
- Consumes: `KALAUZ_REGISTRY`, `findKalauz` (`@/features/tutorial/registry`),
  `writeLocalProgress` (`@/shared/lib/tutorialSeen`), `TutorialProgress` (`@/data/types`).
- Produces:
  - `export function buildAllSeenProgress(): TutorialProgress` — tiszta adat, nem ír sehova.
    A `visual.spec.ts` Node-oldalról ezt hívja.
  - `export function seedAllKalauzSeen(): void` — a fentit `writeLocalProgress`-szel kiírja.

- [ ] **Step 1: Írd meg a helpert**

Create `frontend/src/test/kalauz.ts`:

```ts
// ============================================================
// Mezo · teszt-helper a kalauz seen-store-hoz (mezo-gb1s.3).
// Minden T1/T2 kalauz 600 ms után magától felugrik (TutorialProvider AUTO_DELAY_MS),
// tehát BÁRMELY teszt, ami kalauzos route-ot rendel AppLayouttal, sheetet kapna a
// képernyőre az asszertjei közben. A seed a KALAUZ_REGISTRY-ből GENERÁL — nem
// duplikálja a tartalmat, így egy új kalauz hozzáadása nem söpri végig a teszteket.
// A dedikált TutorialProvider.test.tsx SZÁNDÉKOSAN nem ezt használja: az a valódi
// auto-open utat gyakorolja.
// ============================================================
import type { TutorialProgress } from '@/data/types'
import { KALAUZ_REGISTRY } from '@/features/tutorial/registry'
import { writeLocalProgress } from '@/shared/lib/tutorialSeen'

/** Determinisztikus időbélyeg — a goldenek és a merge-szabály miatt sose `Date.now()`. */
const SEEN_AT = '2026-08-30T10:00:00.000Z'

/** Minden ismert kalauz „látva, végigolvasva" állapotban. Tiszta adat, nem ír sehova. */
export function buildAllSeenProgress(): TutorialProgress {
  const out: TutorialProgress = {}
  for (const e of KALAUZ_REGISTRY) {
    out[e.id] = { version: e.version, seenAt: SEEN_AT, completedAt: SEEN_AT, dismissedAtStep: null }
  }
  return out
}

/** Vitest-oldali kényelem: a fenti mapet a localStorage-tükörbe írja. */
export function seedAllKalauzSeen(): void {
  writeLocalProgress(buildAllSeenProgress())
}
```

- [ ] **Step 2: Írd át a `hubHeaders.test.tsx` fejléc-asszertjét registry-vezéreltre**

A mai teszt (`:36-44`) azt állítja, hogy `/nap`, `/train`, `/mezo`, `/me` fejlécén
`labels[0] === 'Napszak váltása'` — pontosan az a négy hub, ami a 3–5. Taskban kalauzt kap.
Cseréld le a `:7-12` `beforeEach`-et és a `:36-53` két tesztet erre:

```ts
import { seedAllKalauzSeen } from '@/test/kalauz'
import { findKalauz } from '@/features/tutorial/registry'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  // mezo-gb1s.3: minden kalauz látottnak seedelve — a fejléc-tesztek a fejlécet nézik.
  seedAllKalauzSeen()
})
```

```ts
const BASE_CONTROLS = [
  'Napszak váltása',
  expect.stringMatching(/^Mezo üzenetei/),
  expect.stringMatching(/^Értesítések/),
  'Profil',
]

// mezo-gb1s.1/.3: a „?" a gombsor ELEJÉN áll, de csak ott, ahol van registry-találat.
// Az elvárás magából a registry-ből származik, hogy egy új kalauz ne törje ezt a tesztet.
test.each(['/nap', '/train', '/fuel', '/mezo', '/me'])('a %s fejléce a kalauz-gombot + a négy alap-kontrollt viseli', (path) => {
  const { container } = renderAt(path)
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  const expected = findKalauz(path) !== null ? ['Kalauz ehhez az oldalhoz', ...BASE_CONTROLS] : BASE_CONTROLS
  expect(labels.slice(0, expected.length)).toEqual(expected)
})
```

- [ ] **Step 3: Írd át az `AppHeader.test.tsx` két pontját**

A `:22-26` `beforeEach`-ben a `writeLocalProgress({ fuel: … })` hívást cseréld
`seedAllKalauzSeen()`-re (az importot is), a `writeLocalProgress` import maradhat, ha máshol
használva van — ha nem, töröld.

A `:73-80` teszt `/mezo`-t használ „kalauz nélküli oldal" ellenpéldának; a `/mezo` a 5. Taskban
kalauzt kap. Cseréld `/nap/rutin`-ra, ami T2 — az S3 szelet előtt nincs bejegyzése:

```ts
// mezo-gb1s.3: a /mezo már kalauzos, az ellenpélda egy T2 aloldal, aminek még nincs bejegyzése.
test('kalauz nélküli oldalon nincs „?" gomb — a négy kontroll a régi sorrendben', async () => {
  const { container } = renderAt('/nap/rutin')
  await screen.findByRole('button', { name: 'Napszak váltása' })
  expect(screen.queryByRole('button', { name: 'Kalauz ehhez az oldalhoz' })).toBeNull()
  const labels = [...container.querySelectorAll('.nap-head button')].map((b) => b.getAttribute('aria-label'))
  expect(labels[0]).toBe('Napszak váltása')
  expect(labels[3]).toBe('Profil')
})
```

- [ ] **Step 4: Seedeld a maradék öt shell-tesztet**

Mindegyikbe vedd fel az importot és hívd a `beforeEach`-ben. A meglévő `beforeEach`-ek
szerkezete eltér, ezért fájlonként:

`frontend/src/app/navigation.test.tsx` — ma **nincs** `beforeEach`; vedd fel:

```ts
import { seedAllKalauzSeen } from '@/test/kalauz'

// mezo-gb1s.3: a hub-kalauzok 600 ms után felugranának a navigációs asszertek közben.
beforeEach(() => seedAllKalauzSeen())
```

`frontend/src/app/notificationRoutes.test.tsx` — a meglévő egysoros `beforeEach` bővül:

```ts
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  seedAllKalauzSeen()
})
```

`frontend/src/features/train/pages/train.nav.test.tsx` — ugyanez a forma:

```ts
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  seedAllKalauzSeen()
})
```

`frontend/src/features/train/pages/train.emptyStates.test.tsx` — a meglévő `beforeEach`
`server.use(...)` blokkja után add hozzá a `seedAllKalauzSeen()` hívást (az import mellé).

`frontend/src/features/insights/pages/insights.nav.test.tsx` — ma **nincs** `beforeEach`;
vedd fel ugyanúgy, mint a `navigation.test.tsx`-nél (env-stub nélkül — ez a fájl
szándékosan real-módban fut).

- [ ] **Step 5: Futtasd az érintett teszteket — zölden kell maradniuk**

A seed ebben az állapotban még nem csinál semmit (csak a `fuel` van a registryben), tehát
a hat fájlnak változatlanul zöldnek kell lennie. Ez a lépés bizonyítja, hogy a refaktor
maga nem tört el semmit.

Run:
```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run \
  src/app/hubHeaders.test.tsx src/app/AppHeader.test.tsx src/app/navigation.test.tsx \
  src/app/notificationRoutes.test.tsx src/features/train/pages/train.nav.test.tsx \
  src/features/train/pages/train.emptyStates.test.tsx \
  src/features/insights/pages/insights.nav.test.tsx
```
Expected: PASS mind a hét fájlban.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/test/kalauz.ts frontend/src/app frontend/src/features/train/pages frontend/src/features/insights/pages
git commit -m "test(tutorial): seedAllKalauzSeen() helper, a fejléc-teszt registry-vezérelt (mezo-gb1s.3)

A seed a KALAUZ_REGISTRY-ből generál, így az öt hub-kalauz (és később az
S3 ~32 T2 kalauza) nem söpri végig újra a shell-teszteket. Az AppHeader
'kalauz nélküli oldal' ellenpéldája /mezo helyett /nap/rutin.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: A `/nap` kalauza + a `nap-hero` anchorok

**Files:**
- Create: `frontend/src/features/tutorial/registry/nap.ts`
- Create: `frontend/src/features/tutorial/registry/anchors.test.tsx`
- Modify: `frontend/src/features/tutorial/registry/index.ts:2,8`
- Modify: `frontend/src/features/today/pages/NapHubPage.tsx:222,274,323,387`

**Interfaces:**
- Consumes: `fogalom` (Task 1), `KalauzEntry` (`registry/types.ts`).
- Produces: `export const NAP_KALAUZ: KalauzEntry[]` — egy bejegyzés, `id: 'nap'`.
  A 4–5. Task ugyanezt a fájl-alakot másolja.

- [ ] **Step 1: Írd meg a bukó anchor-tesztet**

Create `frontend/src/features/tutorial/registry/anchors.test.tsx`:

```tsx
// A „Mutasd meg a képernyőn" gomb CSAK akkor renderel, ha az anchor épp a DOM-ban van
// (KalauzSheet.tsx:64) — némán degradál. Ez a teszt fogja el, ha egy hős-variánsról
// lemarad az attribútum: arc-variánsonként külön renderel.
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { routes } from '@/app/router'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { seedAllKalauzSeen } from '@/test/kalauz'

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  seedAllKalauzSeen()
})
afterEach(() => vi.unstubAllEnvs())

const renderAt = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(
    <QueryWrapper><ThemeProvider><RouterProvider router={router} /></ThemeProvider></QueryWrapper>,
  )
}

const hasAnchor = (name: string) => document.querySelector(`[data-kalauz-anchor="${name}"]`)

// A `?dp=` CSAK a /nap-on jelent napszak-választást (useDayFace.ts:20-27), a `?day=rough`
// pedig az anchor-mód (NapHubPage.tsx:216). Mind a négy felület saját JSX-node.
test.each(['/nap?dp=reggel', '/nap?dp=nap', '/nap?dp=este', '/nap?day=rough'])(
  '%s — a nap-hero anchor jelen van', (path) => {
    renderAt(path)
    expect(hasAnchor('nap-hero')).not.toBeNull()
  },
)
```

- [ ] **Step 2: Futtasd — bukik**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/anchors.test.tsx`
Expected: FAIL mind a négy esetben — `expected null not to be null`.

- [ ] **Step 3: Tedd ki az attribútumot mind a négy hős-node-ra**

`frontend/src/features/today/pages/NapHubPage.tsx` — négy `div`, mindegyikre ugyanaz az
attribútum. A `className` és a `style` változatlan; csak az attribútum kerül be.

`:222` (anchor-mód):
```tsx
          <div className="mz-tile nap-hero nap-anch-hero rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
```
`:274` (reggel):
```tsx
            <div className="mz-tile mz-w-lav nap-hero rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
```
`:323` (nap):
```tsx
            <div className="mz-tile mz-w-sage nap-hero rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
```
`:387` (este):
```tsx
            <div className="mz-tile nap-hero nap-dusk rise" data-kalauz-anchor="nap-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/anchors.test.tsx`
Expected: PASS, 4 eset.

- [ ] **Step 5: Írd meg a kalauzt**

Create `frontend/src/features/tutorial/registry/nap.ts`:

```ts
// ============================================================
// Mezo · a Nap hub kalauza (mezo-gb1s.3).
// ARC-SEMLEGES: a NapHubPage napszaktól függően három különböző hőst és csempe-készletet
// rendel (:272 reggel, :321 nap, :385 este) + egy anchor-mód variánst (:220). Egyetlen
// kártya sem állít olyat, ami csak EGY arcban igaz — az Életjel-gyűrű például csak a
// „nap" arcban létezik, ezért az a kapcsolat-chipek közé került, nem a törzsszövegbe.
// A fogalom-kártya témája maga a napszakosság: egyszerre igaz és a Mezo egyik legsajátabb
// fogalma (spec S2a-5).
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const NAP_KALAUZ: KalauzEntry[] = [
  {
    id: 'nap',
    route: '/nap',
    tier: 'T1',
    version: 1,
    label: 'Nap',
    cards: [
      {
        kind: 'intro', spot: 'i-nap', orb: 's-orb',
        title: 'Ez a Nap.',
        voice: 'Itt fut össze a mai napod: mit csináltál, mi van hátra, hogy vagy. Ide térünk vissza reggel, délben és este.',
      },
      {
        kind: 'fogalom', spot: 's-reggel', orb: 's-orb',
        title: 'Az oldal veled együtt változik.',
        voice: 'Reggel az éjszakádat mutatja, napközben a keretet és a teendőket, este a lezárást. Ugyanaz a hely, más arc.',
        ...fogalom('napszak'),
      },
      {
        kind: 'hogyan', spot: 'i-checkin', orb: 's-orb-figyel', anchor: 'nap-hero',
        title: 'Fentről lefelé.',
        voice: 'A felső csempe mindig a soron következő dolgot mutatja — alatta a küldetések, a rutin és a check-in várnak egy koppintásra.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Reggel és este, egy percre.',
        voice: 'Reggel megnézed, mi vár rád; este lezárod, ami volt. Napközben úgyis ide dob vissza minden.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen indul minden.',
        voice: 'A Nap csak összefoglal — a részletek a saját oldalaikon élnek. Egy koppintás, és ott vagy.',
        links: [
          { to: '/nap/eletjel', label: 'Életjel', icon: 'i-eletjel', effect: 'hogy vagy ma' },
          { to: '/nap/kuldetesek', label: 'Küldetések', icon: 'i-kihivas', effect: 'a nap három ajánlata' },
          { to: '/nap/rutin', label: 'Rutin', icon: 'i-rend' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel', effect: 'a keret innen jön' },
        ],
      },
    ],
  },
]
```

- [ ] **Step 6: Kösd be a registrybe**

`frontend/src/features/tutorial/registry/index.ts`:

```ts
import { FUEL_KALAUZ } from '@/features/tutorial/registry/fuel'
import { NAP_KALAUZ } from '@/features/tutorial/registry/nap'
```
```ts
export const KALAUZ_REGISTRY: KalauzEntry[] = [...NAP_KALAUZ, ...FUEL_KALAUZ]
```

- [ ] **Step 7: Futtasd a registry- és a fejléc-teszteket**

Run:
```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run \
  src/features/tutorial/registry src/app/hubHeaders.test.tsx src/app/AppHeader.test.tsx
```
Expected: PASS. A `hubHeaders` most már a `/nap`-ra is a kalauz-gombot várja — a
registry-vezérelt asszert ezt magától követi.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/tutorial/registry frontend/src/features/today/pages/NapHubPage.tsx
git commit -m "feat(tutorial): a Nap hub kalauza + nap-hero anchor mind a négy arcon (mezo-gb1s.3)

Arc-semleges szöveg: a NapHubPage három arcot rendel, ezért egyetlen
kártya sem állít olyat, ami csak egyben igaz — a fogalom-kártya témája
maga a napszakosság. Az anchor-teszt arc-variánsonként külön ellenőriz.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: A `/train` kalauza + a `train-hero` anchorok

**Files:**
- Create: `frontend/src/features/tutorial/registry/train.ts`
- Modify: `frontend/src/features/tutorial/registry/index.ts`
- Modify: `frontend/src/features/tutorial/registry/anchors.test.tsx`
- Modify: `frontend/src/features/train/pages/EdzesHubPage.tsx:109,129,163,185,215,235`

**Interfaces:**
- Consumes: `fogalom` (Task 1), `KalauzEntry`.
- Produces: `export const TRAIN_KALAUZ: KalauzEntry[]` — `id: 'train'`.

- [ ] **Step 1: Bővítsd az anchor-tesztet**

Add az `anchors.test.tsx`-hez:

```tsx
// A /train hőse hat SZÁMÍTOTT variáns (EdzesHubPage.tsx:109,129,163,185,215,235), egyszer
// renderelve (:302). Mock-módban a mai nap edzés-variánst ad; a többi variánst a
// registry-lint nem látja, ezért az attribútum mind a hatra kikerül — a code review
// feladata, hogy egyik se maradjon le.
test('/train — a train-hero anchor jelen van', () => {
  renderAt('/train')
  expect(hasAnchor('train-hero')).not.toBeNull()
})
```

- [ ] **Step 2: Futtasd — bukik**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/anchors.test.tsx -t "train-hero"`
Expected: FAIL — `expected null not to be null`.

- [ ] **Step 3: Tedd ki az attribútumot mind a hat hős-variánsra**

`frontend/src/features/train/pages/EdzesHubPage.tsx` — hat sor, mindegyikbe ugyanaz az
attribútum a `className` után:

```tsx
:109  <div className="eh-hero eh-hero-ghost rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
:129  <div className="eh-hero rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
:163  <div className="eh-hero eh-hero-rose rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
:185  <div className="eh-hero eh-hero-sky rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
:215  <div className="eh-hero rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
:235  <div className="eh-hero rise" data-kalauz-anchor="train-hero" style={{ '--d': '0ms' } as React.CSSProperties}>
```

Ellenőrzés a szerkesztés után (hatot kell látni):
```bash
grep -c 'data-kalauz-anchor="train-hero"' frontend/src/features/train/pages/EdzesHubPage.tsx
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/anchors.test.tsx`
Expected: PASS, 5 eset (4 nap + 1 train).

- [ ] **Step 5: Írd meg a kalauzt**

Create `frontend/src/features/tutorial/registry/train.ts`:

```ts
// ============================================================
// Mezo · az Edzés hub kalauza (mezo-gb1s.3).
// A hős hat számított variánst vehet fel (terv nélküli szellem, gym, sport, futás, saját,
// pihenőnap — EdzesHubPage.tsx:109-235), ezért a „hogyan" kártya arról beszél, hogy a
// felső csempe MINDIG a mai napot mutatja, nem arról, hogy MI van benne.
// A fogalom-kártya a mezociklus, mert a terv nélküli új user első akadálya pont ez a szó:
// a hős szellem-variánsa azt mondja neki, hogy „tervezz egy mesociklust".
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const TRAIN_KALAUZ: KalauzEntry[] = [
  {
    id: 'train',
    route: '/train',
    tier: 'T1',
    version: 1,
    label: 'Edzés',
    cards: [
      {
        kind: 'intro', spot: 's-edzes', orb: 's-orb',
        title: 'Ez az Edzés.',
        voice: 'Itt él a mai edzésed, a heti terved és minden, amit eddig megemeltél. A tervezéstől a sorozat lelogolásáig egy hely.',
      },
      {
        kind: 'fogalom', spot: 'i-meso', orb: 's-orb',
        title: 'A terv több hétre szól.',
        voice: 'Az edzés nem napról napra születik: egy mezociklus előre kiosztja a heteket, és Mezo ebből rakja ki a mai napodat.',
        ...fogalom('mezociklus'),
      },
      {
        kind: 'hogyan', spot: 's-hajtas', orb: 's-orb-figyel', anchor: 'train-hero',
        title: 'A hős mindig a mai nap.',
        voice: 'A legfelső csempe azt mutatja, mi van ma — edzés, sport, futás vagy pihenő —, és egy koppintással indul. Terv nélkül itt ajánlunk egyet.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Edzés előtt és közben.',
        voice: 'Indulás előtt megnézed, mi jön; közben a sorozatokat itt vezetjük. Utána a Heti és a Medálok mutatják, mi gyűlt össze.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Az edzés máshol is látszik.',
        voice: 'Egy edzésnapon több energia jár, és a súlyod is másképp mozog. Mezo ezeket összeköti.',
        links: [
          { to: '/train/week', label: 'Heti', icon: 'i-heti', effect: 'a hét ritmusa' },
          { to: '/train/mesocycles', label: 'Mezociklus', icon: 'i-meso', effect: 'a többhetes terv' },
          { to: '/fuel', label: 'Fuel', icon: 'i-fuel', effect: 'edzésnap → +keret' },
          { to: '/train/medals', label: 'Medálok', icon: 'i-erme' },
        ],
      },
    ],
  },
]
```

- [ ] **Step 6: Kösd be a registrybe**

`index.ts` — import + spread:
```ts
import { TRAIN_KALAUZ } from '@/features/tutorial/registry/train'
```
```ts
export const KALAUZ_REGISTRY: KalauzEntry[] = [...NAP_KALAUZ, ...TRAIN_KALAUZ, ...FUEL_KALAUZ]
```

- [ ] **Step 7: Futtasd a registry- és a train-teszteket**

Run:
```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run \
  src/features/tutorial/registry src/app/hubHeaders.test.tsx \
  src/features/train/pages/train.nav.test.tsx
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/tutorial/registry frontend/src/features/train/pages/EdzesHubPage.tsx
git commit -m "feat(tutorial): az Edzés hub kalauza + train-hero anchor mind a hat variánson (mezo-gb1s.3)

A fogalom-kártya a mezociklus: a terv nélküli user hőse épp ezt a szót
kéri tőle. A hogyan-kártya a hős SZEREPÉRŐL beszél, nem a tartalmáról,
mert az hat számított variáns.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: A `/mezo` és a `/me` kalauza + anchorok, az árva-kulcs kapu visszavétele

**Files:**
- Create: `frontend/src/features/tutorial/registry/mezo.ts`, `frontend/src/features/tutorial/registry/me.ts`
- Modify: `frontend/src/features/tutorial/registry/index.ts`
- Modify: `frontend/src/features/tutorial/registry/registry.test.ts` (az árva-kulcs asszert vissza)
- Modify: `frontend/src/features/tutorial/registry/anchors.test.tsx`
- Modify: `frontend/src/features/insights/pages/MezoHubPage.tsx:160`
- Modify: `frontend/src/features/me/pages/EnHubPage.tsx:183`

**Interfaces:**
- Consumes: `fogalom` (Task 1), `KalauzEntry`.
- Produces: `export const MEZO_KALAUZ: KalauzEntry[]` (`id: 'mezo'`),
  `export const ME_KALAUZ: KalauzEntry[]` (`id: 'me'`). Ezzel mind az öt `FOGALMAK`-kulcs
  hivatkozott lesz, tehát a Task 1-ben kikommentelt árva-kulcs asszert visszavehető.

- [ ] **Step 1: Bővítsd az anchor-tesztet**

Add az `anchors.test.tsx`-hez:

```tsx
// A /mezo döntéskártyája (:174) és a /me cél-kártyája (:108) adat-feltételes, ezért NEM
// anchor: a „Mutasd meg" gomb némán eltűnne. A chat-nyitó és az identitás-hős
// feltétel nélkül renderel.
test('/mezo — a mezo-chat anchor jelen van', () => {
  renderAt('/mezo')
  expect(hasAnchor('mezo-chat')).not.toBeNull()
})

test('/me — a me-idhero anchor jelen van', () => {
  renderAt('/me')
  expect(hasAnchor('me-idhero')).not.toBeNull()
})
```

- [ ] **Step 2: Futtasd — bukik**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/anchors.test.tsx`
Expected: a két új eset FAIL, a többi PASS.

- [ ] **Step 3: Tedd ki a két attribútumot**

`frontend/src/features/insights/pages/MezoHubPage.tsx:160` — a composer-alakú chat-nyitó:

```tsx
        <button type="button" className="mzh-chatopen rise" data-kalauz-anchor="mezo-chat" style={{ '--d': '70ms' } as React.CSSProperties}
          aria-label="Beszélgetés a társsal" onClick={() => navigate('/mezo/chat')}>
```

`frontend/src/features/me/pages/EnHubPage.tsx:183` — az identitás-hős:

```tsx
        <div className="enh-idhero rise" data-kalauz-anchor="me-idhero" style={{ '--d': '0ms' } as React.CSSProperties}>
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd frontend && VITE_USE_MOCK=true pnpm vitest run src/features/tutorial/registry/anchors.test.tsx`
Expected: PASS, 7 eset.

- [ ] **Step 5: Írd meg a `/mezo` kalauzt**

Create `frontend/src/features/tutorial/registry/mezo.ts`:

```ts
// ============================================================
// Mezo · a Mezo hub kalauza (mezo-gb1s.3).
// A tab a társ „agya": chat, minták, memoár, tudástár, előrejelzések, kísérletek,
// diagnózis, memória (docs/features/insights.md). A laikusnak a legfontosabb üzenet,
// hogy Mezo nem a semmiből tanácsol — a saját adataiból olvas; ezért a fogalom-kártya
// a `minta`, és a hogyan-kártya a chat-nyitóra mutat, ami feltétel nélkül renderel.
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const MEZO_KALAUZ: KalauzEntry[] = [
  {
    id: 'mezo',
    route: '/mezo',
    tier: 'T1',
    version: 1,
    label: 'Mezo',
    cards: [
      {
        kind: 'intro', spot: 's-orb', orb: 's-orb',
        title: 'Ez Mezo.',
        voice: 'Itt lakik a társad: amit megtanult rólad, és amit ebből gondol. Beszélgethetsz vele, vagy csak elolvashatod, mit vett észre.',
      },
      {
        kind: 'fogalom', spot: 'i-minta', orb: 's-orb',
        title: 'Amit észrevesz.',
        voice: 'Mezo nem a semmiből tanácsol — a saját napjaidból olvas ki ismétlődő összefüggéseket, és megmutatja őket.',
        ...fogalom('minta'),
      },
      {
        kind: 'hogyan', spot: 'i-mezo', orb: 's-orb-figyel', anchor: 'mezo-chat',
        title: 'Kérdezz, ahogy egy embertől.',
        voice: 'A felső sáv egy sima beszélgetés-indító: írd be, ami eszedbe jut, vagy mondd fel hangosan. Mezo ismeri a mai napodat, nem a nulláról indul.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Amikor elakadsz, vagy csak kíváncsi vagy.',
        voice: 'Nincs napi adag belőle. Hetente egyszer viszont megéri ránézni a mintákra és a memoárra — abból látszik a nagyobb ív.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Egy agy, sok szoba.',
        voice: 'A mintáktól a memoárig ugyanaz a tudás jelenik meg más formában. Válaszd azt, ami épp érdekel.',
        links: [
          { to: '/mezo/chat', label: 'Chat', icon: 'i-mezo' },
          { to: '/mezo/patterns', label: 'Minták', icon: 'i-minta', effect: 'amit észrevett' },
          { to: '/mezo/memoir', label: 'Memoár', icon: 'i-memoar', effect: 'a heted, elmesélve' },
          { to: '/mezo/knowledge', label: 'Tudástár', icon: 'i-tudas', effect: 'amit rólad megjegyzett' },
        ],
      },
    ],
  },
]
```

- [ ] **Step 6: Írd meg a `/me` kalauzt**

Create `frontend/src/features/tutorial/registry/me.ts`:

```ts
// ============================================================
// Mezo · az Én hub kalauza (mezo-gb1s.3).
// A hub-tile-reorg elve (docs/features/insights.md §2.0): „Mezo = minden AI-származtatott,
// Én = a személyes adat". A kalauz ezt mondja ki laikusul. A fogalom-kártya a `szint`,
// mert az identitás-hős legfeltűnőbb eleme az XP-gyűrű — és mert az ADR 0010 szerint az
// XP visszajelzés, nem fizetség; ezt ki kell mondani, mielőtt a user pontvadászatnak nézi.
// ============================================================
import { fogalom } from '@/features/tutorial/registry/fogalmak'
import type { KalauzEntry } from '@/features/tutorial/registry/types'

export const ME_KALAUZ: KalauzEntry[] = [
  {
    id: 'me',
    route: '/me',
    tier: 'T1',
    version: 1,
    label: 'Én',
    cards: [
      {
        kind: 'intro', spot: 'i-emberek', orb: 's-orb',
        title: 'Ez az Én.',
        voice: 'Itt vagy te: a szinted, a céljaid, a súlyod, az alvásod és a beállítások. Minden, ami rólad szól, és nem a mai napról.',
      },
      {
        kind: 'fogalom', spot: 'i-growth', orb: 's-orb',
        title: 'A gyűrű a szintedet mutatja.',
        voice: 'Minden logolás ad egy kis XP-t, és a gyűrű ebből telik meg. Semmi nem áll meg attól, ha egy nap kimarad.',
        ...fogalom('szint'),
      },
      {
        kind: 'hogyan', spot: 'i-erme', orb: 's-orb-figyel', anchor: 'me-idhero',
        title: 'A tetején te vagy.',
        voice: 'A felső blokkban a szinted, a címed és a sorozatod látszik — alatta a céljaid, még lejjebb a súly, az alvás és a napló csempéi.',
      },
      {
        kind: 'mikor', spot: 'i-idozito', orb: 's-orb',
        title: 'Ritkán, de megéri.',
        voice: 'Hetente egyszer bőven elég. Ha valami változik — új cél, más ébresztő —, itt állítjuk be.',
      },
      {
        kind: 'kapcsolat', orb: 's-orb-unnepel',
        title: 'Innen tanul a többi oldal.',
        voice: 'A célod és az alvásod a Nap és a Fuel számításaiba is beleszól. Amit itt beállítasz, ott lesz látható.',
        links: [
          { to: '/me/weight', label: 'Súly', icon: 'i-suly' },
          { to: '/me/sleep', label: 'Alvás', icon: 'i-alvas', effect: 'a napszakok horgonya' },
          { to: '/me/growth', label: 'Growth', icon: 'i-growth' },
          { to: '/me/beallitasok', label: 'Beállítások', icon: 'i-beallitas' },
        ],
      },
    ],
  },
]
```

- [ ] **Step 7: Kösd be mindkettőt, és vedd vissza az árva-kulcs kaput**

`index.ts`:
```ts
import { ME_KALAUZ } from '@/features/tutorial/registry/me'
import { MEZO_KALAUZ } from '@/features/tutorial/registry/mezo'
```
```ts
export const KALAUZ_REGISTRY: KalauzEntry[] = [
  ...NAP_KALAUZ, ...TRAIN_KALAUZ, ...FUEL_KALAUZ, ...MEZO_KALAUZ, ...ME_KALAUZ,
]
```

`registry.test.ts` — a Task 1-ben kikommentelt sort állítsd vissza (a `// TASK-5-BEN
VISSZAVENNI` kommenttel együtt töröld a kommentelést):

```ts
  // S2a-4 (YAGNI): a szótár csak azt tartalmazza, amit valaki hivatkoz.
  expect([...Object.keys(FOGALMAK)].filter((k) => !used.has(k))).toEqual([])
```

- [ ] **Step 8: Add hozzá a chip-route lintet**

`registry.test.ts` — új teszt, hogy egy elgépelt chip-útvonal (pl. `/mezo/memoar` a valódi
`/mezo/memoir` helyett) ne csússzon át; a meglévő route-teszt csak az entry `route`-ját nézi:

```ts
test('minden kapcsolat-chip létező route-ra mutat', () => {
  for (const e of KALAUZ_REGISTRY) for (const c of e.cards) {
    if (c.kind !== 'kapcsolat') continue
    for (const l of c.links) {
      expect(matchRoutes(routes, l.to), `${e.id}: ${l.label} → ${l.to}`).not.toBeNull()
    }
  }
})
```

- [ ] **Step 9: Futtasd a teljes tutorial-felületet**

Run:
```bash
cd frontend && VITE_USE_MOCK=true pnpm vitest run \
  src/features/tutorial src/app/hubHeaders.test.tsx src/app/AppHeader.test.tsx \
  src/features/insights/pages/insights.nav.test.tsx src/app/navigation.test.tsx \
  src/app/notificationRoutes.test.tsx
```
Expected: PASS. Ha a chip-lint bukik, a hibaüzenet megnevezi a rossz `to`-t — javítsd az
útvonalat a `router.tsx` szerint, **ne** a tesztet.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/tutorial/registry frontend/src/features/insights/pages/MezoHubPage.tsx frontend/src/features/me/pages/EnHubPage.tsx
git commit -m "feat(tutorial): a Mezo és az Én hub kalauza, chip-route lint (mezo-gb1s.3)

Mind az öt hub kalauza megvan; ezzel minden FOGALMAK-kulcs hivatkozott,
így az árva-kulcs kapu visszakerül. Új lint: minden kapcsolat-chip
létező route-ra mutat — az entry route-ját néző kapu ezt nem fedte.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Vizuális goldenek, dokumentáció, teljes kapu

**Files:**
- Modify: `frontend/tests/visual/visual.spec.ts:97-102`
- Modify: `docs/features/tutorial.md`
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:**
- Consumes: `buildAllSeenProgress()` (Task 2) — Node-oldalról importálva.

- [ ] **Step 1: Állítsd át a vizuális init-scriptet**

Az init-script a **böngészőben** fut, tehát nem importálhatja a registryt. A mapet a
Node-oldali teszt-fájl számolja ki, és `addInitScript` **argumentumaként** adja át.
`frontend/tests/visual/visual.spec.ts` — az import mellé:

```ts
import { buildAllSeenProgress } from '../../src/test/kalauz'
```

és a `:97-102` blokk:

```ts
        // Mezo-kalauz (mezo-gb1s.1/.3): egy first-visit sheet minden goldenbe beleugrana —
        // MINDEN kalauzt látottnak seedelünk. A map a registryből generálódik (Node-oldal),
        // és argumentumként utazik be a böngészőbe: az init-script nem importálhat.
        const kalauzSeen = JSON.stringify(buildAllSeenProgress())
        await page.addInitScript(([t, seen]) => {
          localStorage.setItem('mezo-theme', t)
          localStorage.setItem('mezo.kalauz.v1', seen)
        }, [theme, kalauzSeen] as const)
```

- [ ] **Step 2: Ellenőrizd, hogy a Playwright-fájl fordul**

Run: `cd frontend && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: nincs hiba. (A vizuális futtatás Linux-goldeneket igényel, ezért **nem** itt
fut — a baseline-ok az `update-visual-baselines.yml` workflow-val frissülnek, ha a `?` gomb
miatt szükséges.)

- [ ] **Step 3: Frissítsd a feature-docot**

`docs/features/tutorial.md` három pontja:

1. §7 (recept): a „hogyan írj új kalauzt" lépéssor egészüljön ki azzal, hogy a
   `fogalom`-kártya `term`/`def`-je **nem** kézzel íródik, hanem `...fogalom('<kulcs>')`;
   új fogalom előbb a `registry/fogalmak.ts`-be kerül, forrás-kommenttel.
2. §9 (`:236-239`): a „Deferred to later slices" bekezdésből **töröld** a
   „any guide beyond `fuel`" és a „a shared `fogalmak.ts` concept dictionary (deliberately
   not built yet — YAGNI until a second `fogalom` term appears)" tagmondatokat; maradjon a
   T0 welcome (S2b) és a chrome-mentes mini-„?" (S3). Vedd fel helyette a két új csapdát:
   az anchor arc-variánsonként külön JSX-node a `/nap`-on és a `/train`-en, és a
   `seedAllKalauzSeen()` a shell-tesztek kötelező `beforeEach`-e.
3. §10 (fájltérkép): a hat új fájl (`fogalmak.ts`, `nap.ts`, `train.ts`, `mezo.ts`, `me.ts`,
   `src/test/kalauz.ts`) egy-egy sorral.

Az „Open question #1" bekezdés (`:229-232`) **marad** — a napszak-váltó kérdése az S2b-ben dől el.

- [ ] **Step 4: Regeneráld a CODEMAP-et**

Run:
```bash
cd frontend && node ../scripts/gen-codemap.mjs
```
(Ha a script a repo gyökeréből fut, akkor: `node scripts/gen-codemap.mjs` a gyökérből.)
Majd ellenőrizd:
```bash
node scripts/gen-codemap.mjs --check
```
Expected: exit 0. A `tutorial` blokk mostantól a hat fájlt listázza.

- [ ] **Step 5: Teljes frontend-kapu, mindkét módban**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test
```
Expected: PASS.

```bash
cd frontend && VITE_USE_MOCK=false pnpm test
```
Expected: PASS. (A `VITE_USE_MOCK` beállítatlanul mock-módot jelent, ezért a real-módú
kaput **explicit** kell futtatni — enélkül kétszer fut ugyanaz.)

```bash
cd frontend && pnpm build
```
Expected: sikeres build.

- [ ] **Step 6: Commit**

```bash
git add frontend/tests/visual/visual.spec.ts docs/features/tutorial.md docs/CODEMAP.md
git commit -m "docs(tutorial): S2a feature-doc + CODEMAP, vizuális seed a registryből (mezo-gb1s.3)

A golden-seed mostantól minden kalauzt látottnak jelöl, a mapet a Node-oldal
generálja és argumentumként adja át az init-scriptnek.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: PR, CI-kapu, merge

- [ ] **Step 1: Push és self-PR**

```bash
git push -u origin feat/kalauz-s2a-hubok
```

```bash
gh pr create --title "feat(tutorial): Kalauz S2a — öt hub-kalauz + fogalmak.ts szótár (mezo-gb1s.3)" --body-file -
```

A PR-leírás tartalmazza **táblázatban a kalauz-szövegeket** (kártya-típus · cím · voice ·
fogalom), hogy a termék-hang review olvasható legyen kód nélkül — a szülő-spec §8 ezt
kifejezetten kéri.

- [ ] **Step 2: Várd meg a CI-t**

```bash
gh pr checks --watch
```
Expected: minden check zöld. A CI a hiteles teljes-suite kapu (backend IT + FE mindkét mód
+ lint + contract-drift); lokálisan csak a fókuszált tesztek futottak.

Ha a **contract-drift** vagy a **CODEMAP** check bukik: a CODEMAP regenerálása kimaradt vagy
elavult — futtasd újra a 6. Task 4. lépését, commitolj, pushol.

- [ ] **Step 3: Merge lokálisan, `--no-ff`**

**A FŐ checkoutból**, nem ebből a worktree-ből:

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/kalauz-s2a-hubok && git push
```

- [ ] **Step 4: Zárd a bd issue-t és töröld a branchet**

```bash
bd close mezo-gb1s.3 && bd dolt push && git push origin --delete feat/kalauz-s2a-hubok
```

- [ ] **Step 5: Kommenteld az epicet a következő szelet kontextusával**

```bash
bd comment mezo-gb1s "S2a merged. Él: fogalmak.ts (5 kulcs: napszak/mezociklus/makro/minta/szint), öt T1 hub-kalauz, négy anchor (nap-hero ×4, train-hero ×6, mezo-chat, me-idhero), seedAllKalauzSeen() teszt-helper. Következő: S2b = T0 welcome. Nyitott: a NN/G-mérés a statikus 6 lépéses paklit kérdőjelezi meg, és a welcome→/nap auto-lánc ellen szól — az S2b brainstormjának ezzel kell kezdenie."
```

---

## Self-Review

**Spec-lefedettség.** A spec §3 (hozzáadott fájlok) → Task 1–5; §4 (szótár) → Task 1;
§5 (öt kalauz + anchorok) → Task 3–5; §6 (prior art) → a `fogalmak.ts` és a `me.ts`
fejléc-kommentjében materializálódik (hangtalan definíció, ADR 0010 kimondása);
§7 (terrain) → a fájlonkénti sor-hivatkozások; §8 (tesztelés) → Task 1 Step 1 (szótár-lint),
Task 5 Step 8 (chip-lint), Task 3/4/5 (anchor-teszt), Task 2 (seed + fejléc-tesztek),
Task 6 Step 1 (goldenek), Task 6 Step 5 (mindkét mód + build); §9 (dokumentáció) → Task 6
Step 3–4; §10 (nyitott kérdések) → Task 7 Step 5 az epic-kommentben átadja az S2b-nek.

**Placeholder-ellenőrzés.** Nincs „TBD"/„hasonlóan a Task N-hez"; minden kód-lépés valódi,
bemásolható kódot tartalmaz, a `mezo.ts` és a `me.ts` teljes tartalma ki van írva, nem
hivatkozik a `nap.ts`-re.

**Egy ismert, szándékos köztes állapot.** A Task 1 Step 5–6 kikommentelteti az árva-kulcs
asszertet, mert a szótár öt kulcsa közül négyet csak a Task 3–5 hivatkoz; a Task 5 Step 7
visszaveszi. Ez a plan egyetlen helye, ahol egy Task nem hagy teljesen zöld kaput maga
után — a lépés ezt kimondja, és a visszavétel konkrét Taskhoz/lépéshez van kötve.

**Típus-konzisztencia.** `FogalomKey` / `Fogalom` / `FOGALMAK` / `fogalom()` a Task 1-ben
definiálva, a Task 3–5 pontosan ezeket a neveket használja. `buildAllSeenProgress()` /
`seedAllKalauzSeen()` a Task 2-ben definiálva, a Task 3–6 ezeket hívja. Az entry-nevek
(`NAP_KALAUZ`, `TRAIN_KALAUZ`, `MEZO_KALAUZ`, `ME_KALAUZ`, `FUEL_KALAUZ`) végig azonosak.
Minden `spot`/`icon` név szerepel a `shared/ui/clay/index.tsx:14-33` unióiban.
