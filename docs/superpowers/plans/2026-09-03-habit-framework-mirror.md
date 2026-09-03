# Rutin — a keret-szabályok mock-tükrözése + a hiányzó horgony-IT (mezo-3zue.8 + mezo-3zue.7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mock-arm ugyanazt a keret-igazságot mondja, mint a `HabitFrameworkValidator` — a `clearForeignFields` átkeretezéskor tisztít, a négy keret-400 pedig eldobja az írást —, és a backend user-scope horgony-ága kap egy nevesített integrációs tesztet.

**Architecture:** A validátor szabályai egy új, tiszta FE-modulba kerülnek (`habitFrameworkRules.ts`), amit a `habitAdminHooks.ts` két mock-mutátora (`mockCreateDef`, `mockUpdateDef`) hív pontosan abban a sorrendben, ahogy a `HabitAdminService` teszi: `clearForeignFields` → `validate` → cache-írás. A mock seed egy nem-előállítható állapotát (`dailyIntention` = CLEAR + `anchorCopy`) javítjuk, és az invariáns-tesztet kiterjesztjük rá. Backend oldalon egyetlen új IT-metódus a `HabitAdminApiIT`-ben.

**Tech Stack:** TypeScript + React Query (`@tanstack/react-query`), vitest + `@testing-library/react` (`renderHook`/`act`/`waitFor`); backend: JUnit 5 + Spring Boot IT (`ApiIntegrationTest`), Testcontainers.

## Global Constraints

- **A mock-arm LEKÉPEZ, nem újraértelmez.** Az egyetlen igazságforrás `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitFrameworkValidator.java`. Ahol a Java furcsa, a TS is legyen ugyanolyan furcsa, kommenttel.
- **`anchorCopy` NINCS a `FIELDS_ORPHAN` `hasAny(...)` listáján** (`HabitFrameworkValidator.java:31-34`): keret nélküli def hordozhat `anchorCopy`-t. Ez a teljes valós seed állapota (`backend/src/main/resources/content/habit-catalog.json` — egyetlen def sem hordoz keret-mezőt), és két meglévő teszt épül rá. Verbatim tükrözni kell.
- **Hibadobás alakja:** `throw new Error('<CODE>')` — a `habitAdminHooks.ts` meglévő precedense (`HABIT_CHAIN_SEED`, `HABIT_CHAIN_NOT_EMPTY`, `HABIT_REORDER_MISMATCH`, `HABIT_DEF_UNKNOWN_CHAIN`). Kód-string betűre pontosan: `HABIT_FRAMEWORK_FOGG_INCOMPLETE`, `HABIT_FRAMEWORK_CLEAR_INCOMPLETE`, `HABIT_FRAMEWORK_FIELDS_ORPHAN`, `HABIT_ANCHOR_INVALID`.
- **„Set" jelentése:** a Java `isSet` = `value != null && !value.isBlank()`. TS-ben: `v != null && v.trim() !== ''`. A csak-whitespace érték NINCS kitöltve.
- **Contract nem mozdul.** `api/feature/habit/habit.yml` marad 0.6.0, generátor NEM fut, generált fájlt senki nem ír.
- **CSS nem mozdul.** Ebben a körben nincs stílus-változás; új hex sehol, kommentben sem.
- **Frontend tesztek MINDKÉT módban, explicit:** `VITE_USE_MOCK=false pnpm test` és `VITE_USE_MOCK=true pnpm test`. A beállítatlan változó mock módot jelent, tehát a csupasz `pnpm test` kétszer mockot futtat. A típusellenőrzés külön: `pnpm exec tsc -b` (a vitest nem típusellenőriz).
- **Backend: SOHA nem fut a teljes suite helyben.** Fókuszált futás mindig Testcontainers-szel: `./mvnw test -Dtest='HabitAdminApiIT' -Dmezo.test.use-testcontainers=true`.
- **Hosszú parancsokat ELŐTÉRBEN kell futtatni, nagy timeouttal** — soha háttérben, soha Monitorral.
- **`node scripts/gen-codemap.mjs`** minden olyan commitban, ami új fájlt vagy doc `key_files`-t érint (Task 1 és Task 5).
- **Commit-subject** hordozza a bd id-t: `... (mezo-3zue.8)` vagy `(mezo-3zue.7)`. Minden commit végén:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- Munkakönyvtár mindig az abszolút worktree-út: `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14`. A `cd` megmarad a Bash-hívások közt — minden parancs elején állítsd be.

## Hatókörön kívül (NE csináld)

- `mockCreateDef` ma némán `undefined`-ot ad ismeretlen `chainKey`-re, míg a backend `HABIT_DEF_UNKNOWN_CHAIN` 400-at dob (a `mockUpdateDef` már dobja). Ez egy ötödik eltérés, NEM része ennek a szeletnek — külön bd issue-ként megy fel a kör végén.
- Nem nyúlunk a wizard/HabitPage UI-hoz: a `RoutineWizardPage` `canProceed` kapui már kliens-oldalon kizárják a hiányos beküldést, tehát az új dobások csak valóban érvénytelen állapotra sülnek el.

---

### Task 1: `habitFrameworkRules.ts` — a validátor tiszta FE-tükre

**Files:**
- Create: `frontend/src/data/habit/habitFrameworkRules.ts`
- Create: `frontend/src/data/habit/habitFrameworkRules.test.ts`
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:**
- Consumes: `HabitCatalog`, `HabitDefInfo` a `@/data/types`-ból.
- Produces (a Task 2 ezekre hivatkozik, betűre pontosan):
  - `export type FrameworkDraft = Pick<HabitDefInfo, 'habitKey' | 'framework' | 'anchorHabitKey' | 'anchorCopy' | 'cue' | 'craving' | 'reward' | 'celebration' | 'identity'>`
  - `export function clearForeignFields<T extends FrameworkDraft>(draft: T): T` — ÚJ objektumot ad vissza, nem mutál.
  - `export function validateFramework(draft: FrameworkDraft, catalog: HabitCatalog): void` — `Error(<CODE>)`-ot dob, egyébként `undefined`.

- [ ] **Step 1: Írd meg a bukó tesztet**

Hozd létre `frontend/src/data/habit/habitFrameworkRules.test.ts`-t ezzel a TELJES tartalommal:

```ts
import { describe, expect, test } from 'vitest'
import { clearForeignFields, validateFramework, type FrameworkDraft } from '@/data/habit/habitFrameworkRules'
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

/** Egy minimális draft — minden keret-mező üres, a teszt csak azt tölti ki, ami számít. */
function draft(patch: Partial<FrameworkDraft> = {}): FrameworkDraft {
  return {
    habitKey: 'custom_self', framework: null, anchorHabitKey: null, anchorCopy: null,
    cue: null, craving: null, reward: null, celebration: null, identity: null, ...patch,
  }
}

/** Kétsoros katalógus: egy élő és egy inaktív horgony-jelölt. */
const catalog: HabitCatalog = {
  chains: [{
    id: 'c1', chainKey: 'MORNING', title: 'Reggeli rutin', daypart: 'MORNING', position: 1, isActive: true,
    defs: [
      { habitKey: 'morning_sunlight', isActive: true } as HabitDefInfo,
      { habitKey: 'retired_row', isActive: false } as HabitDefInfo,
    ],
  }],
}

describe('clearForeignFields — a HabitFrameworkValidator.clearForeignFields tükre', () => {
  test('FOGG-ra váltva a CLEAR-mezők nullázódnak, a FOGG-mezők maradnak', () => {
    const out = clearForeignFields(draft({
      framework: 'FOGG', anchorCopy: 'letettem a fogkefét', celebration: 'ökölrázás',
      cue: 'régi jelzés', craving: 'régi vágy', reward: 'régi jutalom', identity: 'régi identitás',
    }))
    expect([out.cue, out.craving, out.reward, out.identity]).toEqual([null, null, null, null])
    expect(out.anchorCopy).toBe('letettem a fogkefét')
    expect(out.celebration).toBe('ökölrázás')
  })

  test('CLEAR-re váltva a FOGG-mezők nullázódnak — az anchorCopy IS', () => {
    // A backend kommentje szerint az anchorCopy azért megy, mert a Nap felületen ki VAN rajzolva
    // (.nr-anchor), tehát egy megtartott „miután …" hamis jelzést hagyna egy Clear recept alatt.
    const out = clearForeignFields(draft({
      framework: 'CLEAR', anchorHabitKey: 'morning_sunlight', anchorCopy: 'fogmosás után',
      celebration: 'ökölrázás', cue: 'jelzés', craving: 'vágy', reward: 'jutalom', identity: 'identitás',
    }))
    expect([out.anchorHabitKey, out.anchorCopy, out.celebration]).toEqual([null, null, null])
    expect([out.cue, out.craving, out.reward, out.identity])
      .toEqual(['jelzés', 'vágy', 'jutalom', 'identitás'])
  })

  test('keret nélkül semmit nem tisztít — a validáció dolga eldönteni, hogy ez árva-e', () => {
    const input = draft({ anchorCopy: 'ébredés után', celebration: 'ökölrázás' })
    expect(clearForeignFields(input)).toEqual(input)
  })
})

describe('validateFramework — keret nélkül', () => {
  test('árva keret-mező 400: HABIT_FRAMEWORK_FIELDS_ORPHAN', () => {
    expect(() => validateFramework(draft({ celebration: 'ökölrázás' }), catalog))
      .toThrow('HABIT_FRAMEWORK_FIELDS_ORPHAN')
  })

  test('a puszta anchorCopy NEM árva — a backend hasAny listája szándékosan kihagyja', () => {
    // HabitFrameworkValidator.java:31-34: anchorHabitKey/cue/craving/reward/celebration/identity,
    // anchorCopy nélkül. A teljes valós seed pontosan ilyen (keret nélkül, anchorCopy-val).
    expect(() => validateFramework(draft({ anchorCopy: 'ébredés után' }), catalog)).not.toThrow()
  })

  test('a csak-whitespace mező nincs kitöltve (isBlank-tükör)', () => {
    expect(() => validateFramework(draft({ celebration: '   ' }), catalog)).not.toThrow()
  })
})

describe('validateFramework — FOGG', () => {
  test('horgony nélkül 400: HABIT_FRAMEWORK_FOGG_INCOMPLETE', () => {
    expect(() => validateFramework(draft({ framework: 'FOGG', celebration: 'ökölrázás' }), catalog))
      .toThrow('HABIT_FRAMEWORK_FOGG_INCOMPLETE')
  })

  test('ünneplés nélkül 400: HABIT_FRAMEWORK_FOGG_INCOMPLETE', () => {
    expect(() => validateFramework(draft({ framework: 'FOGG', anchorCopy: 'fogmosás után' }), catalog))
      .toThrow('HABIT_FRAMEWORK_FOGG_INCOMPLETE')
  })

  test('szabad szöveges horgony + ünneplés átmegy', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorCopy: 'fogmosás után', celebration: 'ökölrázás' }), catalog,
    )).not.toThrow()
  })

  test('élő testvér-defre mutató horgony átmegy', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorHabitKey: 'morning_sunlight', celebration: 'ökölrázás' }), catalog,
    )).not.toThrow()
  })

  test('ismeretlen horgony-kulcs 400: HABIT_ANCHOR_INVALID', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorHabitKey: 'custom_nemletezik', celebration: 'ökölrázás' }), catalog,
    )).toThrow('HABIT_ANCHOR_INVALID')
  })

  test('önmagára mutató horgony 400: HABIT_ANCHOR_INVALID', () => {
    expect(() => validateFramework(
      draft({ habitKey: 'custom_self', framework: 'FOGG', anchorHabitKey: 'custom_self', celebration: 'ökölrázás' }),
      catalog,
    )).toThrow('HABIT_ANCHOR_INVALID')
  })

  test('inaktív defre mutató horgony 400: HABIT_ANCHOR_INVALID', () => {
    expect(() => validateFramework(
      draft({ framework: 'FOGG', anchorHabitKey: 'retired_row', celebration: 'ökölrázás' }), catalog,
    )).toThrow('HABIT_ANCHOR_INVALID')
  })
})

describe('validateFramework — CLEAR', () => {
  test('hiányzó craving 400: HABIT_FRAMEWORK_CLEAR_INCOMPLETE', () => {
    expect(() => validateFramework(
      draft({ framework: 'CLEAR', cue: '7:10-kor a konyhában', reward: 'a pipa maga' }), catalog,
    )).toThrow('HABIT_FRAMEWORK_CLEAR_INCOMPLETE')
  })

  test('cue + craving + reward átmegy, identity nélkül is', () => {
    expect(() => validateFramework(
      draft({ framework: 'CLEAR', cue: 'jelzés', craving: 'vágy', reward: 'jutalom' }), catalog,
    )).not.toThrow()
  })

  test('CLEAR-nél a horgony-hivatkozást nem is nézzük — a clearForeignFields már levette', () => {
    expect(() => validateFramework(
      draft({ framework: 'CLEAR', anchorHabitKey: 'custom_nemletezik', cue: 'j', craving: 'v', reward: 'r' }),
      catalog,
    )).not.toThrow()
  })
})
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14/frontend && VITE_USE_MOCK=true pnpm test -- habitFrameworkRules
```

Elvárt: FAIL — „Failed to resolve import '@/data/habit/habitFrameworkRules'".

- [ ] **Step 3: Írd meg a modult**

Hozd létre `frontend/src/data/habit/habitFrameworkRules.ts`-t ezzel a TELJES tartalommal:

```ts
// ============================================================
// Mezo · habitFrameworkRules — a backend HabitFrameworkValidator FE-tükre (mezo-3zue.8).
// Egyetlen igazságforrás: backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/
// HabitFrameworkValidator.java. Ez a modul LEKÉPEZI azt, nem újraértelmezi: ahol a Java
// szabálya meglepő, itt is meglepő, kommenttel. A mock-arm (habitAdminHooks.ts) ezt hívja,
// hogy egy FOGG→CLEAR átkeretezés offline ugyanazt tegye, mint valós módban.
// Tiszta: nincs hook, nincs cache, nincs I/O.
// ============================================================
import type { HabitCatalog, HabitDefInfo } from '@/data/types'

/** A def keret-releváns szelete — a mutátorok teljes `HabitDefInfo`-t adnak, de csak ez számít. */
export type FrameworkDraft = Pick<HabitDefInfo,
  'habitKey' | 'framework' | 'anchorHabitKey' | 'anchorCopy'
  | 'cue' | 'craving' | 'reward' | 'celebration' | 'identity'>

/** A Java `isSet` tükre: a null és a csak-whitespace érték egyaránt „nincs kitöltve". */
function isSet(value: string | null | undefined): boolean {
  return value != null && value.trim() !== ''
}

/**
 * A `clearForeignFields` tükre: leveszi a mezőket, amiket a választott keret nem birtokol.
 * A backend a managed entitást mutálja; itt ÚJ objektumot adunk vissza, mert a React Query
 * cache-be írt def sosem mutálható helyben.
 */
export function clearForeignFields<T extends FrameworkDraft>(draft: T): T {
  if (draft.framework === 'FOGG') {
    return { ...draft, cue: null, craving: null, reward: null, identity: null }
  }
  if (draft.framework === 'CLEAR') {
    // Az anchorCopy IS megy: a Nap felületen ki van rajzolva (`.nr-anchor` + a todayItems
    // alcím), tehát egy megtartott „miután …" hamis jelzést hagyna egy Clear recept alatt.
    return { ...draft, anchorHabitKey: null, anchorCopy: null, celebration: null }
  }
  return draft
}

/**
 * A `validate` tükre — a def ÖSSZEFÉSÜLT, írás UTÁNI állapotát nézi, tehát mindig
 * `clearForeignFields` UTÁN kell hívni (ez a HabitAdminService.createDef/updateDef sorrendje).
 * Dob `Error(<CODE>)`-ot, ahol a backend 400-at adna — a mock-mutátorok meglévő
 * `throw new Error('HABIT_CHAIN_SEED')` precedensének alakjában.
 */
export function validateFramework(draft: FrameworkDraft, catalog: HabitCatalog): void {
  if (draft.framework == null) {
    // FIGYELEM: az `anchorCopy` SZÁNDÉKOSAN nincs ezen a listán — a backend `hasAny(...)`
    // hívása sem sorolja fel (HabitFrameworkValidator.java:31-34). Keret nélküli def tehát
    // hordozhat szabad szöveges horgonyt; a teljes valós seed pontosan ilyen.
    const orphan = [draft.anchorHabitKey, draft.cue, draft.craving,
      draft.reward, draft.celebration, draft.identity].some(isSet)
    if (orphan) throw new Error('HABIT_FRAMEWORK_FIELDS_ORPHAN')
    return
  }
  if (draft.framework === 'FOGG') {
    const hasAnchor = isSet(draft.anchorHabitKey) || isSet(draft.anchorCopy)
    if (!hasAnchor || !isSet(draft.celebration)) {
      throw new Error('HABIT_FRAMEWORK_FOGG_INCOMPLETE')
    }
    validateAnchorReference(draft, catalog)
    return
  }
  if (!isSet(draft.cue) || !isSet(draft.craving) || !isSet(draft.reward)) {
    throw new Error('HABIT_FRAMEWORK_CLEAR_INCOMPLETE')
  }
}

/**
 * A `validateAnchorReference` tükre. A backend a horgonyt a def SAJÁT tulajdonosának körén
 * belül keresi (`findByCreatedByAndHabitKeyAndDeletedFalse`); mock módban egyetlen felhasználó
 * van, ezért a katalógus maga a tulajdonosi kör — a más-felhasználós ág valós módban él, és a
 * HabitAdminApiIT fedi (mezo-3zue.7).
 */
function validateAnchorReference(draft: FrameworkDraft, catalog: HabitCatalog): void {
  const anchorKey = draft.anchorHabitKey
  if (!isSet(anchorKey)) return // csak szabad szöveges horgony
  if (anchorKey === draft.habitKey) throw new Error('HABIT_ANCHOR_INVALID')
  const anchor = catalog.chains.flatMap((c) => c.defs).find((d) => d.habitKey === anchorKey)
  if (!anchor || anchor.isActive !== true) throw new Error('HABIT_ANCHOR_INVALID')
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14/frontend && VITE_USE_MOCK=true pnpm test -- habitFrameworkRules && pnpm exec tsc -b
```

Elvárt: mind a 16 teszt PASS, `tsc -b` néma.

- [ ] **Step 5: Codemap + commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && node scripts/gen-codemap.mjs && git add frontend/src/data/habit/habitFrameworkRules.ts frontend/src/data/habit/habitFrameworkRules.test.ts docs/CODEMAP.md && git commit -m "$(cat <<'MSG'
feat(habit): a HabitFrameworkValidator tiszta FE-tükre (mezo-3zue.8)

clearForeignFields + validateFramework a keret-szabályokra, a backend
osztály leképezéseként — beleértve az anchorCopy hiányát a FIELDS_ORPHAN
listáról, ami a valós seed állapota.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: A mock-arm bekötése — `mockCreateDef` / `mockUpdateDef`

**Files:**
- Modify: `frontend/src/data/habit/habitAdminHooks.ts` (import + `mockCreateDef` + `mockUpdateDef`)
- Test: `frontend/src/data/habit/habitAdminHooks.test.tsx` (a `describe('useHabitCatalog / useHabitCatalogActions (mock mode)')` blokk végén, a `useHabitAiSuggest` esete ELŐTT)

**Interfaces:**
- Consumes: `clearForeignFields`, `validateFramework` a Task 1-ből, pontosan a fenti szignatúrákkal.
- Produces: nincs új export — a viselkedés a `useHabitCatalogActions().createDef` / `.updateDef` felületén jelenik meg.

**Amit tudni kell a meglévő fájlról:** a mock-mutátorok modul-privát függvények a fájl alján; a `mockUpdateDef` már ma is (a) kiszűri a `null` patch-értékeket (`patchNoNulls`), (b) normalizálja az üres `anchorHabitKey` unlink-sentinelt `null`-ra, (c) dob `HABIT_DEF_UNKNOWN_CHAIN`-t ismeretlen cél-láncra. Ezek MARADNAK, és a keret-lépés UTÁNUK jön — pontosan úgy, ahogy a `HabitAdminService.updateDef` is a mezők összefésülése után hívja a validátort.

- [ ] **Step 1: Írd meg a bukó teszteket**

Illeszd be `frontend/src/data/habit/habitAdminHooks.test.tsx`-be, a mock-módú `describe` blokkon BELÜL, közvetlenül a `it('useHabitAiSuggest.suggest resolves the canned 2-suggestion fixture (mezo-n5e9.3)'` sor ELÉ:

```tsx
  it('updateDef FOGG→CLEAR átkeretezésnél leveszi a FOGG-mezőket — mirrors clearForeignFields (mezo-3zue.8)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    let created: { id: string } | undefined
    await act(async () => {
      created = await result.current.actions.createDef({
        chainKey: 'MORNING', title: 'Egy oldal olvasás', mode: 'MANUAL', skillKey: 'mindset', xp: 5,
        framework: 'FOGG', anchorHabitKey: 'morning_sunlight', anchorCopy: 'letettem a fogkefét',
        celebration: 'ökölrázás',
      })
    })
    const findIt = () => result.current.catalog.catalog.chains
      .flatMap((c) => c.defs).find((d) => d.id === created!.id)!
    await waitFor(() => expect(findIt().celebration).toBe('ökölrázás'))

    await act(async () => {
      await result.current.actions.updateDef(created!.id, {
        framework: 'CLEAR', cue: '7:10-kor a konyhaasztalnál', craving: 'tisztább fej', reward: 'a pipa maga',
      })
    })
    await waitFor(() => expect(findIt().framework).toBe('CLEAR'))
    // Ez a hibajelenség, amiért a szelet létezik: mock módban bennragadt a régi FOGG recept.
    expect(findIt().celebration).toBeNull()
    expect(findIt().anchorHabitKey).toBeNull()
    expect(findIt().anchorCopy).toBeNull()
    expect(findIt().cue).toBe('7:10-kor a konyhaasztalnál')
  })

  it('updateDef CLEAR→FOGG átkeretezésnél leveszi a CLEAR-mezőket (mezo-3zue.8)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    let created: { id: string } | undefined
    await act(async () => {
      created = await result.current.actions.createDef({
        chainKey: 'MORNING', title: 'Egy oldal olvasás', mode: 'MANUAL', skillKey: 'mindset', xp: 5,
        framework: 'CLEAR', cue: 'jelzés', craving: 'vágy', reward: 'jutalom', identity: 'olvasó ember',
      })
    })
    const findIt = () => result.current.catalog.catalog.chains
      .flatMap((c) => c.defs).find((d) => d.id === created!.id)!
    await waitFor(() => expect(findIt().cue).toBe('jelzés'))

    await act(async () => {
      await result.current.actions.updateDef(created!.id, {
        framework: 'FOGG', anchorCopy: 'letettem a fogkefét', celebration: 'ökölrázás',
      })
    })
    await waitFor(() => expect(findIt().framework).toBe('FOGG'))
    expect([findIt().cue, findIt().craving, findIt().reward, findIt().identity])
      .toEqual([null, null, null, null])
    expect(findIt().celebration).toBe('ökölrázás')
  })

  it('createDef keret nélküli defre írt keret-mezőt eldob: HABIT_FRAMEWORK_FIELDS_ORPHAN (mezo-3zue.8)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitCatalogActions(), { wrapper: Wrapper })
    await expect(result.current.createDef({
      chainKey: 'MORNING', title: 'Napi mondat', mode: 'MANUAL', skillKey: 'mindset', xp: 10,
      celebration: 'ökölrázás',
    })).rejects.toThrow('HABIT_FRAMEWORK_FIELDS_ORPHAN')
  })

  it('createDef ismeretlen horgony-kulcsra HABIT_ANCHOR_INVALID-ot dob (mezo-3zue.8)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(() => useHabitCatalogActions(), { wrapper: Wrapper })
    await expect(result.current.createDef({
      chainKey: 'MORNING', title: 'Napi mondat', mode: 'MANUAL', skillKey: 'mindset', xp: 10,
      framework: 'FOGG', anchorHabitKey: 'custom_nemletezik', celebration: 'ökölrázás',
    })).rejects.toThrow('HABIT_ANCHOR_INVALID')
  })

  it('updateDef ünneplés nélküli FOGG-ra váltást eldob: HABIT_FRAMEWORK_FOGG_INCOMPLETE (mezo-3zue.8)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const target = result.current.catalog.catalog.chains
      .find((c) => c.chainKey === 'MORNING')!.defs.find((d) => d.habitKey === 'morning_sunlight')!

    await expect(result.current.actions.updateDef(target.id, { framework: 'FOGG' }))
      .rejects.toThrow('HABIT_FRAMEWORK_FOGG_INCOMPLETE')
    // Az elutasított írás nem hagyhat nyomot a cache-ben.
    const after = result.current.catalog.catalog.chains
      .flatMap((c) => c.defs).find((d) => d.id === target.id)!
    expect(after.framework).toBeNull()
  })

  it('egy elutasított írás után a katalógus érintetlen marad (mezo-3zue.8)', async () => {
    const { Wrapper } = sharedWrapper()
    const { result } = renderHook(
      () => ({ catalog: useHabitCatalog(), actions: useHabitCatalogActions() }),
      { wrapper: Wrapper },
    )
    const before = result.current.catalog.catalog.chains.flatMap((c) => c.defs).length
    await expect(result.current.actions.createDef({
      chainKey: 'MORNING', title: 'Napi mondat', mode: 'MANUAL', skillKey: 'mindset', xp: 10,
      framework: 'CLEAR', cue: 'jelzés', reward: 'jutalom',
    })).rejects.toThrow('HABIT_FRAMEWORK_CLEAR_INCOMPLETE')
    expect(result.current.catalog.catalog.chains.flatMap((c) => c.defs)).toHaveLength(before)
  })
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14/frontend && VITE_USE_MOCK=true pnpm test -- habitAdminHooks
```

Elvárt: a 6 új eset FAIL (a bennragadt `celebration`, illetve „promise resolved instead of rejecting"); a meglévő ~20 eset PASS.

- [ ] **Step 3: Kösd be a mutátorokba**

`frontend/src/data/habit/habitAdminHooks.ts`, az import-blokk végére (a `habitMock` import UTÁN):

```ts
import { clearForeignFields, validateFramework } from '@/data/habit/habitFrameworkRules'
```

A `mockCreateDef`-ben cseréld le a `def` felépítése utáni `qc.setQueryData(...)` + `return def` részt erre:

```ts
  // A HabitAdminService.createDef sorrendje: mezők → clearForeignFields → validate → mentés.
  // A validáció a beszúrás ELŐTT fut, hogy egy elutasított írás ne hagyjon nyomot a cache-ben;
  // a friss `habitKey` miatt az önhorgony itt szerkezetileg lehetetlen, a backendnél is.
  const settled = clearForeignFields(def)
  validateFramework(settled, base)
  qc.setQueryData<HabitCatalog>(HABIT_CATALOG_KEY, {
    chains: base.chains.map((c) => (c.chainKey === input.chainKey ? { ...c, defs: [...c.defs, settled] } : c)),
  })
  return settled
```

A `mockUpdateDef`-ben, közvetlenül az `anchorHabitKey` blank-normalizálás UTÁN és a `const targetChainKey = ...` sor ELÉ szúrd be:

```ts
  // A HabitAdminService.updateDef sorrendje: összefésülés → clearForeignFields → validate.
  // Enélkül egy FOGG→CLEAR átkeretezés mock módban bennhagyta a cue/celebration/anchorCopy-t,
  // valós módban nem — a két mód nem mondhat mást ugyanarról az írásról (mezo-3zue.8).
  const settled = clearForeignFields(updated)
  validateFramework(settled, base)
```

Ezután a függvény MARADÉK részében cseréld le mindhárom `updated` hivatkozást `settled`-re:
- az azonos láncú ág `defs.map((d) => (d.id === id ? updated : d))` → `... ? settled : d)`
- a lánc-váltó ág `{ ...updated, chainKey: targetChainKey, position: ... }` → `{ ...settled, ... }`

- [ ] **Step 4: Futtasd, hogy átmenjen**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14/frontend && VITE_USE_MOCK=true pnpm test -- habitAdminHooks habitFrameworkRules && pnpm exec tsc -b
```

Elvárt: minden PASS. **Ha a meglévő „blank unlink sentinel" vagy „null patch value" eset bukik, ÁLLJ MEG és jelezd** — az azt jelentené, hogy a tükör szigorúbb a backendnél (a leggyakoribb ok: az `anchorCopy` bekerült a FIELDS_ORPHAN listájába, ahol nincs helye).

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && git add frontend/src/data/habit/habitAdminHooks.ts frontend/src/data/habit/habitAdminHooks.test.tsx && git commit -m "$(cat <<'MSG'
fix(habit): a mock-arm tükrözze a clearForeignFields-et és a keret-400-akat (mezo-3zue.8)

mockCreateDef/mockUpdateDef a HabitAdminService sorrendjében hív
clearForeignFields → validateFramework-et, a cache-írás előtt. Eddig egy
FOGG→CLEAR átkeretezés mock módban bennhagyta a cue/celebration/anchorCopy-t.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: A seed egyetlen nem-előállítható állapotának javítása

**Files:**
- Modify: `frontend/src/data/habit/habitMock.ts` (`dailyIntention`)
- Test: `frontend/src/data/habit/habitMock.test.ts` (új invariáns)

**Interfaces:** nincs új felület — a seed adat és a rá vonatkozó invariáns változik.

**A hiba:** a `dailyIntention` def `framework: 'CLEAR'` ÉS `anchorCopy: 'reggeli rutin után'`. A `clearForeignFields` CLEAR-ága nullázza az `anchorCopy`-t, tehát a backend ilyen sort soha nem tud előállítani. A meglévő két invariáns ezt nem fogta meg (az egyik csak FOGG defeket, a másik csak keret nélkülieket nézi). A `routineSentence.ts` CLEAR-ága sosem használja az `anchorLabel`-t, és a `dailyIntention` nincs benne a `mockHabitDay`-ben, tehát a nullázás semmit nem ront el vizuálisan.

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/data/habit/habitMock.test.ts`-be, a `describe` blokk végére:

```ts
  test('minden CLEAR def teljes, és egyetlen FOGG-mezőt sem hordoz', () => {
    // clearForeignFields CLEAR-ága: anchorHabitKey + anchorCopy + celebration mind null.
    // Az anchorCopy azért megy vele, mert a Nap felületen ki VAN rajzolva — egy megtartott
    // „miután …" hamis jelzést hagyna egy Clear recept alatt.
    const clear = defs.filter((d) => d.framework === 'CLEAR')
    expect(clear.length).toBeGreaterThan(0)
    for (const d of clear) {
      expect(Boolean(d.cue && d.craving && d.reward), `${d.habitKey} teljes CLEAR recept`).toBe(true)
      expect([d.anchorHabitKey, d.anchorCopy, d.celebration], `${d.habitKey} idegen FOGG-mező`)
        .toEqual([null, null, null])
    }
  })

  test('egyetlen FOGG def sem hordoz CLEAR-mezőt', () => {
    for (const d of defs.filter((d) => d.framework === 'FOGG')) {
      expect([d.cue, d.craving, d.reward, d.identity], `${d.habitKey} idegen CLEAR-mező`)
        .toEqual([null, null, null, null])
    }
  })
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14/frontend && VITE_USE_MOCK=true pnpm test -- habitMock.test
```

Elvárt: FAIL — „daily_intention idegen FOGG-mező", `['reggeli rutin után']` a várt `null` helyett.

- [ ] **Step 3: Javítsd a seedet**

`frontend/src/data/habit/habitMock.ts`, a `dailyIntention` objektumban cseréld
`anchorCopy: 'reggeli rutin után',` helyére:

```ts
  // A valós seed defnek VAN „reggeli rutin után" horgonya, de keret NÉLKÜL (a
  // habit-catalog.json egyetlen defje sem hordoz keret-mezőt). Ez a mock def CLEAR-re van
  // állítva, hogy a négy törvény sora demózható legyen — a clearForeignFields viszont a
  // CLEAR-ágon nullázza az anchorCopy-t, tehát CLEAR + anchorCopy olyan állapot, amit a
  // backend soha nem tud előállítani (mezo-3zue.8).
  anchorCopy: null,
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14/frontend && VITE_USE_MOCK=true pnpm test -- habitMock.test && pnpm exec tsc -b
```

Elvárt: mind az 5 eset PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && git add frontend/src/data/habit/habitMock.ts frontend/src/data/habit/habitMock.test.ts && git commit -m "$(cat <<'MSG'
fix(habit): a mock seed CLEAR defje ne hordozzon anchorCopy-t (mezo-3zue.8)

A daily_intention CLEAR + anchorCopy kombinációt a clearForeignFields
CLEAR-ága kizárja — a backend ilyen sort nem tud előállítani. Az invariáns
mindkét irányban rögzítve.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: IT — más felhasználó defjére mutató horgony (mezo-3zue.7)

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAdminApiIT.java`

**Interfaces:**
- Consumes: `ApiIntegrationTest` örökölt segédei (`ownerAuthHeaders()`, `postForBody`, `assertHasRequestError`), `UserPopulator` (`@Autowired`, a `HabitServiceIT`/`HabitChainDefEntityIT` precedense), `HabitAdminService.createDef(UUID, HabitDefCreateRequest)`.
- Produces: nincs — teszt-only.

**Eltérés az issue szövegétől, szándékosan:** az issue a `HabitCatalogService.ensureCatalog(otherId)`-t javasolja. Ez önmagában NEM elég bizonyító erejű: a seed kulcsok (`morning_sunlight` stb.) a tulajdonosnak IS megvannak, tehát egy seed kulcsra mutató horgony a saját defre oldódna fel és átmenne. A tesztnek olyan kulcsot kell használnia, ami KIZÁRÓLAG a másik felhasználónál létezik — ezért a másik user kap egy saját `custom_…` defet a `HabitAdminService`-en át (ami maga hívja az `ensureCatalog`-ot). Így a teszt tényleg a user-scope ágat méri.

- [ ] **Step 1: Írd meg a bukó tesztet**

Add hozzá az import-blokkhoz (az ábécérendbe illesztve):

```java
import io.mrkuhne.mezo.feature.habit.service.HabitAdminService;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.springframework.beans.factory.annotation.Autowired;
```

Az osztály tetejére, a `catalog()` segédmetódus ELÉ:

```java
    @Autowired private UserPopulator userPopulator;
    @Autowired private HabitAdminService habitAdminService;
```

A `testCreateDef_shouldRejectUnknownAnchorKey` teszt UTÁN:

```java
    @Test
    void testCreateDef_shouldRejectAnchor_whenDefBelongsToAnotherUser() {
        // A horgony-feloldás a def SAJÁT tulajdonosának körén belül keres
        // (findByCreatedByAndHabitKeyAndDeletedFalse) — eddig csak az ismeretlen-kulcs eset
        // volt fedve, ami akkor is átmenne, ha a lekérés user-scope nélkül futna. Ezért a
        // horgony egy KIZÁRÓLAG a másik felhasználónál létező custom_ kulcs: a seed kulcsok
        // (morning_sunlight stb.) a tulajdonosnak is megvannak, azokra a saját defjére
        // oldódna fel (mezo-3zue.7). Idióma: JournalApiIT#testUpdateJournalEntry_shouldReturn404_whenNotOwnEntry.
        UUID otherUser = userPopulator.createUser().getId();
        String foreignKey = habitAdminService.createDef(otherUser,
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Az ő szokása")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10).build())
            .getHabitKey();
        assertThat(foreignKey).startsWith("custom_");

        catalog();
        String err = postForBody("/api/habit/def",
            HabitDefCreateRequest.builder().chainKey("MORNING").title("Napi mondat")
                .mode(HabitDefCreateRequest.ModeEnum.MANUAL).skillKey("mindset").xp(10)
                .framework(HabitDefCreateRequest.FrameworkEnum.FOGG)
                .anchorHabitKey(foreignKey).celebration("ökölrázás").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(err, "HABIT_ANCHOR_INVALID");
    }
```

- [ ] **Step 2: Futtasd, hogy lásd a bukást**

ELŐTÉRBEN, nagy timeouttal (a Testcontainers indulás percekig tart):

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && ./mvnw test -Dtest='HabitAdminApiIT#testCreateDef_shouldRejectAnchor_whenDefBelongsToAnotherUser' -Dmezo.test.use-testcontainers=true
```

Elvárt: **fordítási hiba VAGY zöld.** Ez a teszt egy MEGLÉVŐ, helyes viselkedést rögzít (a validátor user-scope ága már ma jó) — a szelet a hiányzó LEFEDETTSÉGET pótolja, nem hibát javít. Ha zöld, az a helyes kimenet; ha PIROS, akkor valódi backend-hibát találtál: ÁLLJ MEG és jelezd.

**Ha `UserPopulator.createUser()` nem `AppUserEntity`-t ad vissza** (a `.getId()` nem fordul), nézd meg a tényleges szignatúrát a `backend/src/test/java/io/mrkuhne/mezo/support/populator/UserPopulator.java`-ban és igazítsd — a `HabitServiceIT` és a `HabitChainDefEntityIT` már használja, onnan másolható a pontos alak.

- [ ] **Step 3: Futtasd a teljes osztályt regresszióra**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && ./mvnw test -Dtest='HabitAdminApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: minden teszt PASS. **Ne futtasd a teljes backend suite-ot helyben** — az a CI dolga.

- [ ] **Step 4: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && git add backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitAdminApiIT.java && git commit -m "$(cat <<'MSG'
test(habit): IT a más felhasználó defjére mutató horgonyra (mezo-3zue.7)

A validateAnchorReference user-scope ága eddig csak az ismeretlen-kulcs
eseten át volt tesztelve. A horgony most kizárólag a másik usernél létező
custom_ kulcs, tehát a teszt tényleg a tulajdonosi kört méri.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Dokumentáció + codemap + záró kapuk

**Files:**
- Modify: `docs/features/habit.md` (§9 gotchák + §10 key files/tests, `updated:` dátum)
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:** nincs kód-felület.

- [ ] **Step 1: A feature-doc §9 gotcha-bekezdése**

`docs/features/habit.md`-ben, a `mezo-3zue.5` celebration-deviáció gotchája UTÁN szúrd be:

```markdown
- **Mock-arm keret-tükrözés (`mezo-3zue.8`):** a mock `createDef`/`updateDef` (`data/habit/habitAdminHooks.ts`) a `HabitAdminService` sorrendjében fut — mezők összefésülése → `clearForeignFields` → `validateFramework` → cache-írás —, a két szabály tiszta FE-tükre pedig `data/habit/habitFrameworkRules.ts`. Enélkül egy FOGG→CLEAR átkeretezés mock módban bennhagyta a `cue`/`celebration`/`anchorCopy`-t, valós módban nem. A négy keret-400 (`HABIT_FRAMEWORK_FOGG_INCOMPLETE`, `HABIT_FRAMEWORK_CLEAR_INCOMPLETE`, `HABIT_FRAMEWORK_FIELDS_ORPHAN`, `HABIT_ANCHOR_INVALID`) `throw new Error('<CODE>')`-ként jelenik meg, a `HABIT_CHAIN_SEED`/`HABIT_REORDER_MISMATCH` precedens alakjában. **Két szándékos furcsaság, amit a tükör átvesz, nem javít:** (a) az `anchorCopy` NINCS a `FIELDS_ORPHAN` `hasAny(...)` listáján (`HabitFrameworkValidator.java:31-34`), tehát keret nélküli def hordozhat szabad szöveges horgonyt — a teljes valós seed (`content/habit-catalog.json`) pontosan ilyen; (b) a mock katalógus `daily_intention` defje ezért kapott `anchorCopy: null`-t: `CLEAR` + `anchorCopy` olyan állapot, amit a `clearForeignFields` CLEAR-ága kizár. A mock horgony-feloldás a katalógust tekinti a tulajdonosi körnek (mock módban egy felhasználó van); a valós user-scope ágat a `HabitAdminApiIT` fedi (`mezo-3zue.7`).
```

- [ ] **Step 2: A §10 hivatkozások**

A `**Logging-as-reward (mezo-3zue.5):**` felsorolás-pont UTÁN vegyél fel egy újat:

```markdown
- **Keret-tükrözés a mock-armban (`mezo-3zue.8`):** `frontend/src/data/habit/habitFrameworkRules.ts` (+ **`habitFrameworkRules.test.ts`**, 16 eset) — a `HabitFrameworkValidator` `clearForeignFields`/`validate` párjának tiszta FE-tükre, amit a `habitAdminHooks.ts` két mock-mutátora hív; a bekötés esetei a `habitAdminHooks.test.tsx` mock-módú blokkjában, a seed-invariánsok a `habitMock.test.ts`-ben (CLEAR-teljesség + kölcsönös idegen-mező tilalom). Backend oldalon a user-scope horgony-ág IT-je `HabitAdminApiIT#testCreateDef_shouldRejectAnchor_whenDefBelongsToAnotherUser` (`mezo-3zue.7`).
```

A frontmatter `key_files` listájába vedd fel:

```yaml
  - frontend/src/data/habit/habitFrameworkRules.ts
```

és állítsd a frontmatter `updated:` mezőjét `2026-09-03`-ra.

- [ ] **Step 3: Codemap + doc-lint**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs --errors-only
```

Elvárt: a doc-lint ZÖLD. **A csupasz `lint-docs.mjs`-t NE futtasd** — az repo-szintű, régóta meglévő stale találatokon bukik, nem a te dolgod.

- [ ] **Step 4: Teljes frontend kapu MINDKÉT módban + build**

Előtérben, nagy timeouttal:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14/frontend && pnpm exec tsc -b && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Elvárt: mindkét mód zöld, a build átmegy. Ha a `mezo-h3rj` flake-osztály (`ActiveWorkoutPage`, `ReflectionStep`, `FuelSettingsSheet`) bukik időtúllépéssel a TELJES futás terhelése alatt, az ismert, nem ehhez a szelethez tartozik — futtasd újra célzottan és jelezd az eredményt, ne kezdj hozzá javítani.

- [ ] **Step 5: Commit**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/routine-builder-page-framework-827f14 && git add docs/features/habit.md docs/CODEMAP.md && git commit -m "$(cat <<'MSG'
docs(habit): a mock-arm keret-tükrözése §9 + §10 (mezo-3zue.8)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```
