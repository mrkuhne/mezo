# Logolás mint jutalom — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/nap/rutin` pipálás jutalom-pillanata: a felhasználó saját `celebration`
mondatának visszajátszása a meglévő reward-toastban, és az erő-csík valódi
értékváltozásának átcsusszanása.

**Architecture:** FE-only szelet. A `celebration` a már mountolt `useHabitCatalog()`-ból jön
egy tiszta lookup-függvényen át (a `HabitResponse` NEM bővül). A toast egy új opcionális
mezőt kap; a csík egy `width` transitiont. A mock-arm megkapja a backend erő-képletének
tükrét, hogy a `VITE_USE_MOCK=true` futás ne legyen vákuum.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Vitest + Testing Library, MSW,
`frontend/src/styles/prototype.css`.

**Spec:** [`docs/superpowers/specs/2026-09-03-logging-as-reward-design.md`](../specs/2026-09-03-logging-as-reward-design.md)
**bd:** `mezo-3zue.5` — minden commit-subject hordozza: `(mezo-3zue.5)`

## Global Constraints

- **Backend, contract és migráció NEM mozdul.** Nincs `api/feature/habit/habit.yml` változás,
  nincs generálás, nincs Testcontainers/ArchUnit felület.
- **A pipálás kizárólag a `/nap/rutin` oldalon történik.** Ez a szelet nem visz pipáló
  kontrollt egyetlen rutin-felületre sem, és nem vezet be második tick-affordanciát.
- **Nincs generikus ünneplés-fallback.** Ha a szokásnak nincs `celebration` szövege, a toast
  pontosan a mai marad.
- **CSS:** csak a `frontend/src/styles/prototype.css`-ben már létező tokenek és a szomszédos
  szabályok idiómái. **Új hex nem mehet be, még kommentbe sem** (`mozaikCssTokens.test.ts` a
  kommenteket is nézi). A toast-blokk `rgba(255,255,255,…)` fehér-átlátszóságokkal dolgozik —
  az új szabály is azt követi, nem hexet.
- **Hookok kizárólag `@/data/hooks`-on át.** Soha ne importáld közvetlenül a
  `habitApi`/`habitMock`-ot feature-kódból (habit.md §6).
- **Egy toast-host.** Tilos második `.toast-stack`-et mountolni (DS §2 item 7).
- **Egy magyar mondat-renderer.** A `features/me/logic/routineSentence.ts` érintetlen; az
  ünneplés itt nyers mezőként jelenik meg, nem mondatba szőve.
- **Mozgás kétszer védett:** minden új animáció/transition kap sort a
  `@media (prefers-reduced-motion: reduce)` blokkban.
- **Kapuk minden task végén:** `pnpm exec tsc -b`, majd a task saját tesztje. A záró taskban
  a teljes kapu: `pnpm exec tsc -b && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`.
  Beállítatlan `VITE_USE_MOCK` mock módot jelent — a puszta `pnpm test` kétszer mockot futtat,
  ezért MINDKÉT mód EXPLICIT.
- Minden parancs a worktree gyökeréből vagy a `frontend/` alól, abszolút úttal. Ne `cd`-zz az
  elsődleges repóba.

## File Structure

| Fájl | Felelősség | Task |
|---|---|---|
| `frontend/src/features/today/logic/habitCelebration.ts` | **új** — tiszta lookup: szokáskulcs → ünneplés-szöveg a katalógusból | 1 |
| `frontend/src/features/today/logic/habitCelebration.test.ts` | **új** — a lookup unit-tesztje | 1 |
| `frontend/src/shared/lib/toastBus.ts` | `RewardToast` + `celebration?: string` | 2 |
| `frontend/src/features/progression/logic/rewardToast.ts` | a builder továbbadja a `celebration`-t | 2 |
| `frontend/src/features/progression/logic/rewardToast.test.ts` | builder-teszt az új mezőre | 2 |
| `frontend/src/shared/ui/ToastProvider.tsx` | `RewardBody` — az ünneplés-sor renderelése | 2 |
| `frontend/src/styles/prototype.css` | `.t-celebrate` szabály; `.nr-str div` width-transition; reduced-motion sorok | 2, 5 |
| `frontend/src/features/today/pages/NapRutinPage.tsx` | a `tickAction` `case 'check'` ága átadja az ünneplést | 3 |
| `frontend/src/features/today/pages/NapRutinPage.test.tsx` | oldal-szintű teszt: ünnepléses és ünneplés nélküli sor | 3 |
| `frontend/src/data/habit/habitMock.ts` | keret-térkép két pipálható seed-sorra | 4 |
| `frontend/src/data/habit/habitMock.test.ts` | **új** — seed-invariánsok (FOGG teljesség, demózhatóság) | 4 |
| `frontend/src/data/habit/habitHooks.ts` | `patchMock` az erő-értéket is mozgatja | 5 |
| `frontend/src/data/habit/habitHooks.test.tsx` | mock-arm: az erő emelkedik pipára, visszaáll visszavonásra | 5 |
| `docs/features/habit.md` | ground truth frissítés | 6 |
| `docs/CODEMAP.md` | generált — két új fájl miatt | 6 |

---

### Task 1: `celebrationFor` — a tiszta lookup

**Files:**
- Create: `frontend/src/features/today/logic/habitCelebration.ts`
- Test: `frontend/src/features/today/logic/habitCelebration.test.ts`

**Interfaces:**
- Consumes: `HabitCatalog` / `HabitChainInfo` / `HabitDefInfo` a `@/data/types`-ból
  (`HabitCatalog { chains: HabitChainInfo[] }`, `HabitChainInfo { …, defs: HabitDefInfo[] }`,
  `HabitDefInfo { habitKey: string, …, celebration: string | null }`).
- Produces: `celebrationFor(catalog: HabitCatalog, habitKey: string): string | null` —
  a 3. task ezt hívja a `NapRutinPage`-ből.

- [ ] **Step 1: Write the failing test**

`frontend/src/features/today/logic/habitCelebration.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { celebrationFor } from '@/features/today/logic/habitCelebration'
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

/** A def fixture: csak az számít, amit a lookup olvas — a többi mező kitöltése zaj lenne. */
function def(habitKey: string, celebration: string | null): HabitDefInfo {
  return { habitKey, celebration } as HabitDefInfo
}

const catalog: HabitCatalog = {
  chains: [
    { chainKey: 'MORNING', defs: [def('wake_on_time', null), def('morning_pushups', 'ökölbe szorított kéz')] },
    { chainKey: 'EVENING', defs: [def('kitchen_close', 'lekapcsolom a lámpát')] },
  ] as HabitCatalog['chains'],
}

describe('celebrationFor', () => {
  test('megtalálja a szokás saját ünneplését, láncon átívelve is', () => {
    expect(celebrationFor(catalog, 'morning_pushups')).toBe('ökölbe szorított kéz')
    expect(celebrationFor(catalog, 'kitchen_close')).toBe('lekapcsolom a lámpát')
  })

  test('null, ha a defnek nincs ünneplése', () => {
    expect(celebrationFor(catalog, 'wake_on_time')).toBeNull()
  })

  test('null, ha a kulcs nincs a katalógusban', () => {
    expect(celebrationFor(catalog, 'nincs_ilyen')).toBeNull()
  })

  test('null üres katalógusra — ez a hálózati hiba / stale ablak ága, nem hiba', () => {
    expect(celebrationFor({ chains: [] }, 'morning_pushups')).toBeNull()
  })

  test('a csak whitespace-t tartalmazó ünneplés is null, nem üres sor a toastban', () => {
    const c: HabitCatalog = { chains: [{ chainKey: 'MORNING', defs: [def('x', '   ')] }] as HabitCatalog['chains'] }
    expect(celebrationFor(c, 'x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm exec vitest run src/features/today/logic/habitCelebration.test.ts`
Expected: FAIL — `Failed to resolve import "@/features/today/logic/habitCelebration"`

- [ ] **Step 3: Write minimal implementation**

`frontend/src/features/today/logic/habitCelebration.ts`:

```ts
import type { HabitCatalog } from '@/data/types'

/**
 * A szokás saját ünneplés-mondata (FOGG `celebration`), a katalógusból kikeresve.
 *
 * A `celebration` szándékosan NINCS rajta a napi lekérésen (`HabitResponse` csak a sor
 * megjelenítéséhez kellő mezőket viszi; a keret-mezők a katalógus-olvasás dolgai), ezért a
 * `/nap/rutin` a már amúgy is mountolt `useHabitCatalog()`-ból olvassa ki (mezo-3zue.5).
 *
 * `null`, ha a szokásnak nincs ünneplése, ha a kulcs ismeretlen, VAGY ha a katalógus még/már
 * üres (hálózati hiba, `realEmpty` ág). Mindhárom ugyanaz a viselkedés: a toast marad a mai —
 * generikus fallback szándékosan nincs.
 */
export function celebrationFor(catalog: HabitCatalog, habitKey: string): string | null {
  for (const chain of catalog.chains) {
    const def = chain.defs.find((d) => d.habitKey === habitKey)
    if (def) return def.celebration?.trim() || null
  }
  return null
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && VITE_USE_MOCK=false pnpm exec vitest run src/features/today/logic/habitCelebration.test.ts && pnpm exec tsc -b`
Expected: 5 teszt PASS, a tsc néma.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/logic/habitCelebration.ts frontend/src/features/today/logic/habitCelebration.test.ts
git commit -m "feat(today): celebrationFor — a szokás ünneplés-mondata a katalógusból (mezo-3zue.5)"
```

---

### Task 2: A toast ünneplés-sora

**Files:**
- Modify: `frontend/src/shared/lib/toastBus.ts:17-31` (a `RewardToast` interface)
- Modify: `frontend/src/features/progression/logic/rewardToast.ts:41-58` (`buildHabitRewardToast`)
- Modify: `frontend/src/shared/ui/ToastProvider.tsx:118-141` (`RewardBody`)
- Modify: `frontend/src/styles/prototype.css` (a `.t-meta` szabály után, ~`:1393`)
- Test: `frontend/src/features/progression/logic/rewardToast.test.ts`

**Interfaces:**
- Produces:
  - `RewardToast.celebration?: string` — opcionális, a `title` alatt saját sorban renderelve.
  - `buildHabitRewardToast(input: { title: string; chainDone: number; chainTotal: number; xp: number; levelUp?: LevelUpResult | null; celebration?: string | null })`
    — a 3. task ezzel az új mezővel hívja.

- [ ] **Step 1: Write the failing test**

A `frontend/src/features/progression/logic/rewardToast.test.ts` VÉGÉRE (a meglévő tesztek
maradnak):

```ts
test('az ünneplés saját mezőként utazik a toastban', () => {
  const t = buildHabitRewardToast({
    title: '50 fekvőtámasz', chainDone: 2, chainTotal: 8, xp: 10,
    celebration: 'ökölbe szorított kéz + „ez az”',
  })
  expect(t.celebration).toBe('ökölbe szorított kéz + „ez az”')
  // a meta a mennyiségi addendum helye marad — az ünneplés nem foglalja el
  expect(t.meta).toBeUndefined()
})

test('ünneplés nélkül a mező ki sem kerül a payloadba', () => {
  const withNull = buildHabitRewardToast({
    title: 'Reggeli napfény', chainDone: 0, chainTotal: 8, xp: 5, celebration: null,
  })
  expect('celebration' in withNull).toBe(false)

  const omitted = buildHabitRewardToast({
    title: 'Reggeli napfény', chainDone: 0, chainTotal: 8, xp: 5,
  })
  expect('celebration' in omitted).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm exec vitest run src/features/progression/logic/rewardToast.test.ts`
Expected: FAIL — TS/futásidejű hiba: a `celebration` nem létező property az inputon.

- [ ] **Step 3: Implement**

**3a.** `frontend/src/shared/lib/toastBus.ts` — a `RewardToast` interface-be, a `meta` mező
UTÁN:

```ts
  /** a felhasználó saját ünneplés-mondata (FOGG `celebration`), a tett pillanatában
   *  visszajátszva — saját sor a cím alatt, NEM a `meta` addendum (mezo-3zue.5) */
  celebration?: string
```

**3b.** `frontend/src/features/progression/logic/rewardToast.ts` — a `buildHabitRewardToast`
input-típusa és teste:

```ts
export function buildHabitRewardToast(input: {
  title: string
  chainDone: number
  chainTotal: number
  xp: number
  levelUp?: LevelUpResult | null
  /** a szokás saját ünneplés-mondata a katalógusból; hiányában a toast a régi marad —
   *  generikus fallback szándékosan nincs (mezo-3zue.5) */
  celebration?: string | null
}): RewardToast {
  const { title, chainDone, chainTotal, xp, levelUp, celebration } = input
  const fromServer = fromLevelUp(levelUp)
  const meter = fromServer.meter ?? (xp > 0 ? { label: 'XP', delta: xp } : undefined)
  return {
    kind: 'reward',
    eyebrow: chainTotal > 0 ? `Szokás · ${chainDone + 1} / ${chainTotal}` : 'Szokás',
    title,
    ...(celebration ? { celebration } : {}),
    ...(meter ? { meter } : {}),
    ...(fromServer.levelUp ? { levelUp: fromServer.levelUp } : {}),
  }
}
```

**3c.** `frontend/src/shared/ui/ToastProvider.tsx` — a `RewardBody`-ban, a `t-title` div UTÁN
és a `toast.meter` blokk ELŐTT:

```tsx
      {toast.celebration && <div className="t-celebrate">{toast.celebration}</div>}
```

**3d.** `frontend/src/styles/prototype.css` — közvetlenül a `.t-meta` szabály után:

```css
/* a felhasználó saját ünneplés-mondata (mezo-3zue.5) — a cím alatt, saját sorban: ez az
   ő hangja, nem mennyiségi addendum, ezért nem a `.t-meta` helyét foglalja el */
.t-celebrate {
  margin-top: 5px;
  font-size: 12.5px; font-style: italic; font-weight: 400; line-height: 1.35;
  color: rgba(255,255,255,0.82);
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && VITE_USE_MOCK=false pnpm exec vitest run src/features/progression/logic/rewardToast.test.ts src/shared/ui src/shared/ui/mozaik/mozaikCssTokens.test.ts && pnpm exec tsc -b`
Expected: minden PASS. A `mozaikCssTokens` guard is zöld (az új szabály `rgba`-t használ, nem hexet).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/toastBus.ts frontend/src/features/progression/logic/rewardToast.ts frontend/src/features/progression/logic/rewardToast.test.ts frontend/src/shared/ui/ToastProvider.tsx frontend/src/styles/prototype.css
git commit -m "feat(toast): ünneplés-sor a reward kártyán (mezo-3zue.5)"
```

---

### Task 3: A `/nap/rutin` pipa átadja az ünneplést

**Files:**
- Modify: `frontend/src/features/today/pages/NapRutinPage.tsx:101-109` (a `tickAction`
  `case 'check'` ága) + az import-blokk
- Test: `frontend/src/features/today/pages/NapRutinPage.test.tsx`

**Interfaces:**
- Consumes: `celebrationFor` (Task 1), `buildHabitRewardToast(… celebration?)` (Task 2).

- [ ] **Step 1: Write the failing test**

**1a.** A `NapRutinPage.test.tsx` stubolt katalógusában a `defs: []` tömböket ki kell tölteni
— ma üresek, ezért bármely katalógus-join néma maradna. A `vi.mock('@/data/hooks', …)`
blokkban a `useHabitCatalog` stubja legyen:

```ts
    useHabitCatalog: () => ({
      catalog: {
        chains: [
          { id: 'c-m', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
            // a keret-mezők a katalógus-olvasásból jönnek, nem a napi sorból (mezo-3zue.5)
            defs: [
              { habitKey: 'morning_pushups', framework: 'FOGG', celebration: 'ökölbe szorított kéz + „ez az”' },
              { habitKey: 'morning_sunlight', framework: null, celebration: null },
            ],
          },
          { id: 'c-e', chainKey: 'EVENING', title: 'Esti rutin', daypart: 'EVENING', position: 2, isActive: true,
            defs: [{ habitKey: 'kitchen_close', framework: null, celebration: null }],
          },
        ],
      },
      isPending: false, isError: false, refetch: vi.fn(),
    }),
```

> A `defs` elemei szándékosan részlegesek — a stub egyetlen fogyasztója a lookup, ami csak a
> `habitKey`-t és a `celebration`-t olvassa. Ha a TypeScript panaszkodik, a `chains` tömb kap
> egy `as HabitCatalog['chains']` állítást (importáld a `HabitCatalog` típust a
> `@/data/types`-ból); NE töltsd ki a teljes `HabitDefInfo`-t, az zaj lenne.

**1b.** Új tesztek a fájl végére:

```tsx
test('ünnepléses szokás pipálása visszajátssza a saját mondatot', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: '50 fekvőtámasz' }))
  expect(await screen.findByText('ökölbe szorított kéz + „ez az”')).toBeInTheDocument()
})

test('ünneplés nélküli szokásnál a toast a régi marad', async () => {
  const user = userEvent.setup()
  renderPage('/nap/rutin?dp=este')
  await user.click(screen.getByRole('button', { name: 'Konyha zárva' }))
  // a toast megjelenik, de ünneplés-sor nélkül — generikus fallback szándékosan nincs.
  // Az esti lánc a fixtúrában 2 sor (kitchen_close + bed_on_time), egyik sem done →
  // chainProgress = { done: 0, total: 2 } → az eyebrow „Szokás · 1 / 2".
  expect(await screen.findByText('Szokás · 1 / 2')).toBeInTheDocument()
  expect(screen.queryByText('ökölbe szorított kéz + „ez az”')).not.toBeInTheDocument()
})
```

> A `renderPage` a fájlban MÁR LÉTEZIK (`NapRutinPage.test.tsx:85`) és TELJES utat vár
> (`'/nap/rutin?dp=este'`), nem csak query-stringet — ne vezess be másodikat.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=false pnpm exec vitest run src/features/today/pages/NapRutinPage.test.tsx`
Expected: az első új teszt FAIL — az ünneplés-mondat nincs a dokumentumban (a page még nem adja át).

- [ ] **Step 3: Implement**

`NapRutinPage.tsx` — import a többi `features/today/logic` import mellé:

```ts
import { celebrationFor } from '@/features/today/logic/habitCelebration'
```

és a `tickAction` `case 'check'` ága:

```ts
      case 'check':
        return () => {
          const { done, total } = chainProgress(h.chain)
          // az ünneplés a katalógusból jön (a napi sor nem viszi) — hiányában a toast a régi
          const celebration = celebrationFor(catalog, h.key)
          check(h.key)
            .then((lu) => emitToast(buildHabitRewardToast({
              title: h.title, chainDone: done, chainTotal: total, xp: h.xp, levelUp: lu?.[0],
              celebration,
            })))
            .catch(() => {})
        }
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && VITE_USE_MOCK=false pnpm exec vitest run src/features/today/pages/NapRutinPage.test.tsx && pnpm exec tsc -b`
Expected: a fájl minden tesztje PASS (a régiek is), a tsc néma.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/pages/NapRutinPage.tsx frontend/src/features/today/pages/NapRutinPage.test.tsx
git commit -m "feat(today): a rutin-pipa visszajátssza a szokás saját ünneplését (mezo-3zue.5)"
```

---

### Task 4: Mock-seed — legyen mit ünnepelni

**Files:**
- Modify: `frontend/src/data/habit/habitMock.ts:88-118` (`toDefInfo`)
- Test: `frontend/src/data/habit/habitMock.test.ts` (**új**)

**Interfaces:**
- Produces: a `mockHabitCatalog` két pipálható MANUAL sora (`morning_pushups`,
  `kitchen_close`) FOGG keretet és `celebration` szöveget hordoz. Az 5. task tesztje és a
  kézi demó erre épül.

**Miért kell:** ma a `toDefInfo` MINDEN sorra fixen `celebration: null`-t ad, az egyetlen
ünnepléses def (`bed_on_time`) pedig szándékosan kimarad a napi nézetből — enélkül a
`VITE_USE_MOCK=true` arm vakon zöld lenne és a funkció mock módban demózhatatlan.

- [ ] **Step 1: Write the failing test**

`frontend/src/data/habit/habitMock.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { mockHabitCatalog, mockHabitDay } from '@/data/habit/habitMock'

const defs = mockHabitCatalog.chains.flatMap((c) => c.defs)

describe('mock habit seed — keret-invariánsok', () => {
  test('minden FOGG def teljes: horgony ÉS ünneplés (a backend validátor szabálya)', () => {
    // HabitFrameworkValidator: FOGG = (anchorHabitKey VAGY anchorCopy) + celebration.
    // A mock nem írhat le olyan állapotot, amit a valós oldal 400-zal utasítana el.
    const fogg = defs.filter((d) => d.framework === 'FOGG')
    expect(fogg.length).toBeGreaterThan(0)
    for (const d of fogg) {
      expect(Boolean(d.anchorHabitKey || d.anchorCopy), `${d.habitKey} horgony`).toBe(true)
      expect(Boolean(d.celebration), `${d.habitKey} ünneplés`).toBe(true)
    }
  })

  test('keret nélküli def egyetlen keret-mezőt sem hordoz', () => {
    for (const d of defs.filter((d) => d.framework === null)) {
      expect([d.cue, d.craving, d.reward, d.celebration, d.identity, d.anchorHabitKey])
        .toEqual([null, null, null, null, null, null])
    }
  })

  test('mindkét lánc kínál pipálható, ünnepléses sort — a jutalom-pillanat demózható', () => {
    for (const chainKey of ['MORNING', 'EVENING']) {
      const tickable = mockHabitDay
        .filter((h) => h.chain === chainKey && h.mode === 'MANUAL' && h.status === 'pending')
        .map((h) => h.key)
      const celebrated = defs.filter((d) => tickable.includes(d.habitKey) && d.celebration)
      expect(celebrated.length, `${chainKey} ünnepléses pipálható sor`).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm exec vitest run src/data/habit/habitMock.test.ts`
Expected: a harmadik teszt FAIL mindkét láncra (`0 > 0` nem teljesül) — ma egyetlen
pipálható sor sem hordoz ünneplést.

- [ ] **Step 3: Implement**

`frontend/src/data/habit/habitMock.ts` — a `toDefInfo` FÖLÉ:

```ts
/**
 * A két seed-sor, ami mock módban teljes FOGG receptet hordoz (mezo-3zue.5). Mindkettő
 * MANUAL + pending a mock napban, tehát ténylegesen pipálható, és mindkettőnek van
 * `anchorCopy`-ja — így a keret teljes a backend validátor szabálya szerint (horgony +
 * ünneplés), a mock nem ír le elutasítandó állapotot. Nélkülük a jutalom-pillanat mock
 * módban demózhatatlan és a VITE_USE_MOCK teszt-arm vak lenne.
 */
const MOCK_CELEBRATION: Record<string, string> = {
  morning_pushups: 'ökölbe szorított kéz + „ez az”',
  kitchen_close: 'lekapcsolom a lámpát és bólintok',
}
```

és a `toDefInfo` visszatérési objektumában a keret-mezők:

```ts
    framework: MOCK_CELEBRATION[h.key] ? 'FOGG' : null,
    anchorHabitKey: null,
    cue: null,
    craving: null,
    reward: null,
    celebration: MOCK_CELEBRATION[h.key] ?? null,
    identity: null,
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && VITE_USE_MOCK=true pnpm exec vitest run src/data/habit && pnpm exec tsc -b`
Expected: az új fájl 3 tesztje PASS, a `habitAdminHooks.test.tsx` és `habitHooks.test.tsx` is zöld marad.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/habit/habitMock.ts frontend/src/data/habit/habitMock.test.ts
git commit -m "feat(habit): mock-seed — két pipálható sor teljes FOGG recepttel (mezo-3zue.5)"
```

---

### Task 5: Az erő-csík mozgása

**Files:**
- Modify: `frontend/src/data/habit/habitHooks.ts:62-71` (`patchMock`)
- Modify: `frontend/src/styles/prototype.css:4886-4890` (`.nr-str div`) és `:4970` (a
  `prefers-reduced-motion` blokk `.nr-str div` sora)
- Test: `frontend/src/data/habit/habitHooks.test.tsx`

**Interfaces:**
- Produces: mock módban a `check()` a sor `strengthPct`-jét is emeli, az `uncheck()`
  visszaállítja a seed-értékre. Valós módban semmi nem változik (a szerver adja az értéket).

**Miért kell:** a `patchMock` ma csak `status`/`doneAt`-ot állít, tehát mock módban a csík
sosem mozdul — a szélesség-transition önmagában vak lenne a `VITE_USE_MOCK=true` armban.

- [ ] **Step 1: Write the failing test**

A `habitHooks.test.tsx` `describe('useHabitDay (mock mode)')` blokkjába:

```tsx
  test('a pipa a sor erő-értékét is emeli — a csík valódi változást animál', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useHabitDay(DATE), { wrapper })
    const actions = renderHook(() => useHabitActions(DATE), { wrapper })
    const pct = (k: string) => day.result.current.habits.find((h) => h.key === k)?.strengthPct

    // morning_pushups: seed 48%, a summary 18 done + 6 missed = 24 lezárt nap
    // round((48 * 24 / 100 + 1) * 100 / 25) = 50
    expect(pct('morning_pushups')).toBe(48)
    await act(() => actions.result.current.check('morning_pushups'))
    await waitFor(() => expect(pct('morning_pushups')).toBe(50))

    // a visszavonás a seed-értékre állít vissza — a pipa/visszavonás kör nem inflálja az erőt
    await act(() => actions.result.current.uncheck('morning_pushups'))
    await waitFor(() => expect(pct('morning_pushups')).toBe(48))
  })

  test('erő nélküli sor erő nélkül marad (minSample alatt a szerver is null-t ad)', async () => {
    const wrapper = makeHookWrapper()
    const day = renderHook(() => useHabitDay(DATE), { wrapper })
    const actions = renderHook(() => useHabitActions(DATE), { wrapper })
    await act(() => actions.result.current.check('evening_ritual'))
    await waitFor(() =>
      expect(day.result.current.habits.find((h) => h.key === 'evening_ritual')?.status).toBe('done'))
    expect(day.result.current.habits.find((h) => h.key === 'evening_ritual')?.strengthPct).toBeNull()
  })
```

> Ha a `morning_pushups` seed-értéke vagy a `mockHabitSummary` `done28`/`missed28` párosa
> időközben változott, számold ÚJRA a várt értéket a képlettel — ne a számot igazítsd
> vaktában, hanem a fixtúrából vezesd le.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && VITE_USE_MOCK=true pnpm exec vitest run src/data/habit/habitHooks.test.tsx`
Expected: FAIL — a `strengthPct` 48 marad (`expected 48 to be 50`).

- [ ] **Step 3: Implement**

**3a.** `frontend/src/data/habit/habitHooks.ts` — a `useHabitActions` fölé, modul-szintre (mindkét
seed már importálva van a fájl tetején):

```ts
/**
 * A backend erő-képletének mock tükre (HabitService.strengthByKey: done / (done + missed) a
 * 28 napos ablakon). A ma-kész nap hozzáadása a sor SAJÁT arányához: a megjelenített
 * százalékot arányként véve `round((p * C / 100 + 1) * 100 / (C + 1))`, ahol C a lezárt napok
 * száma. Kicsi, monoton, 100 felé konvergál — nem talál ki új számformát (mezo-3zue.5).
 *
 * `null` marad `null`: a szerver is null-t ad `minSample` alatt.
 */
function bumpStrength(habitKey: string, pct: number | null | undefined): number | null {
  if (pct == null) return null
  const s = mockHabitSummary.habits.find((h) => h.key === habitKey)
  const closed = s ? s.done28 + s.missed28 : 0
  if (closed <= 0) return pct
  return Math.round(((pct * closed) / 100 + 1) * (100 / (closed + 1)))
}

/** A visszavonás a seed-értékre állít vissza, nem az inverz képlettel — így a
 *  pipa → visszavonás → pipa kör determinisztikus és nem sodródik kerekítési hibával. */
function seedStrength(habitKey: string): number | null {
  return mockHabitDay.find((h) => h.key === habitKey)?.strengthPct ?? null
}
```

és a `patchMock`:

```ts
  const patchMock = (habitKey: string, status: HabitItem['status']) => {
    qc.setQueryData<HabitDay>(key(date), (d) =>
      d && {
        ...d,
        habits: d.habits.map((h) =>
          h.key === habitKey
            ? {
                ...h,
                status,
                doneAt: status === 'done' ? new Date().toISOString() : null,
                // a csík valódi értéket animál, mock módban is (mezo-3zue.5)
                strengthPct: status === 'done'
                  ? bumpStrength(habitKey, h.strengthPct)
                  : seedStrength(habitKey),
              }
            : h),
      })
  }
```

> A fájl tetején MINDKÉT seed már importálva van
> (`habitHooks.ts:5` — `import { mockHabitDay, mockHabitSummary } from '@/data/habit/habitMock'`),
> tehát nincs új import-út.

**3b.** `frontend/src/styles/prototype.css` — a `.nr-str div` szabály kiegészítése:

```css
.nr-str div { height: 100%; border-radius: 4px; background: var(--mz-strength);
  transform: scaleX(1); transform-origin: left;
  /* a pipa után a friss strengthPct-re CSUSSZAN, nem ugrik — a jutalom-pillanat
     vizuális magja (mezo-3zue.5). A belépő scaleX animációval nem ütközik: mountoláskor
     a szélesség már a helyén van, tehát nincs mit átmenetezni. */
  transition: width 380ms cubic-bezier(0.25, 0.8, 0.35, 1); }
```

és a `@media (prefers-reduced-motion: reduce)` blokkban a meglévő sor:

```css
  .nr-str div, .mz-play .nr-str div { animation: none; transform: scaleX(1); transition: none; }
```

- [ ] **Step 4: Run tests + typecheck**

Run: `cd frontend && VITE_USE_MOCK=true pnpm exec vitest run src/data/habit && VITE_USE_MOCK=false pnpm exec vitest run src/data/habit src/features/today && pnpm exec tsc -b`
Expected: minden PASS mindkét módban.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/habit/habitHooks.ts frontend/src/data/habit/habitHooks.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(habit): az erő-csík valódi értékváltozást csusszan, mock módban is (mezo-3zue.5)"
```

---

### Task 6: Dokumentáció, codemap és a teljes kapu

**Files:**
- Modify: `docs/features/habit.md`
- Modify: `docs/CODEMAP.md` (generált)

- [ ] **Step 1: `habit.md` frissítés**

Írd át a következőket (a fájl saját 10-szekciós szerkezetét követve):

1. **§2 (tick-felület):** a pipa jutalom-visszajelzése mostantól két rétegű — a reward-toast
   az ünneplés-sorral, ha a szokásnak van `celebration` szövege, és a sor erő-csíkjának
   átcsusszanása a friss `strengthPct`-re. Generikus fallback nincs. Rögzítsd, hogy a
   `celebration` a KATALÓGUS-olvasásból jön (`celebrationFor`,
   `features/today/logic/habitCelebration.ts`), mert a `HabitResponse` szándékosan nem viszi.
2. **§9 (mock-eltérések):** két új tétel — (a) a `morning_pushups` és `kitchen_close` mock
   defek FOGG keretet és ünneplést kapnak, hogy a jutalom-pillanat demózható legyen;
   (b) a `patchMock` a backend erő-képletét tükrözi, de a `useHabitSummary` 28 napos
   aggregátuma mock módban NEM mozdul vele — a napi sor csúszik, az összegző panel nem.
3. **Javítsd menet közben a talált pontatlanságokat:** §5 még `/me/growth`-ként hivatkozza a
   Rutin felületet (helyesen `/me/rutin`, `RutinHubPage`); a §2/§7/§9 „a sor tick / cím /
   horgony / erő és semmi más" állítása elavult, mert a `linkUrl` cím-link visszakerült
   (`mezo-d20.11`) — a §9 erre vonatkozó deferred tétele törölhető.
4. **§10 (változásnapló):** egy sor `mezo-3zue.5`-tel.

- [ ] **Step 2: Codemap regenerálás**

Run: `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check && node scripts/lint-docs.mjs`
Expected: a `--check` és a doc-lint is zöld. Két új fájl kerül be:
`features/today/logic/habitCelebration.ts` és `data/habit/habitMock.test.ts`.

- [ ] **Step 3: A teljes kapu**

Run: `cd frontend && pnpm exec tsc -b && VITE_USE_MOCK=false pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`
Expected: mind a négy zöld. **Beállítatlan `VITE_USE_MOCK` mock módot jelent** — ezért
mindkét mód explicit; a puszta `pnpm test` kétszer mockot futtatna.

> Ha az `ActiveWorkoutPage.test.tsx` „hard reload on /train/session" esete időtúllépéssel
> bukik: az a teszt a TELJES útvonalfát bemountolja, és kapott egy explicit 20 s-os korlátot.
> Ha mégis bukik, az terhelés-flake (`mezo-h3rj`), nem ennek a szeletnek a regressziója —
> futtasd újra magában, és ha zöld, jegyezd fel a PR-be.

- [ ] **Step 4: Commit**

```bash
git add docs/features/habit.md docs/CODEMAP.md
git commit -m "docs(habit): logolás mint jutalom — tick-felület, mock-eltérések, codemap (mezo-3zue.5)"
```

---

## Kézi ellenőrzés (a PR előtt)

A `verify` skill receptjével, mock módban:

1. `/nap/rutin` → reggeli arc → **50 fekvőtámasz** pipálása → a toastban megjelenik az
   `ökölbe szorított kéz + „ez az”` sor, és a sor erő-csíkja 48%-ról 50%-ra csusszan.
2. `/nap/rutin?dp=este` → **Konyha zárva** pipálása → ünneplés-sor jelenik meg.
3. **Reggeli napfény** (vagy más ünneplés nélküli MANUAL sor) pipálása → a toast a régi
   marad, ünneplés-sor NÉLKÜL.
4. OS-szinten `prefers-reduced-motion: reduce` → a csík ugrik, a mondat továbbra is látszik.

## Zárás

- `bd close mezo-3zue.5`, `bd dolt push`
- Ág → self-PR → CI zöld → helyi `--no-ff` merge → `git push` main → ág törlése (CLAUDE.md).
