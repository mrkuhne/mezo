# Fuel Stack Design 2.0 újratervezés — Implementation Plan (mezo-ubxd)

> **For agentic workers:** REQUIRED SUB-SKILL: Use the repo-local `executing-plans`,
> `tdd`, `mezo-frontend`, and `verification-before-completion` skills. Execute tasks
> in order; every implementation change starts from a failing focused test.

**Goal:** A zsúfolt `/fuel/stack` oldal helyett egy következő-bevétel-központú,
színes Design 2.0 hub készüljön külön napi ritmus-, teljes protokoll-, étkezési és
kezelési oldalakkal, valamint siker-toasttal és azonnali, race-biztos visszavonással.

**Architecture:** Frontend-only route- és view-átszervezés a meglévő
occurrence-alapú living protocol felett. Egy tiszta `buildStackDayView` helper képezi
a minden oldal által használt napi nézetmodellt; a routed leaf oldalak ugyanazt a
TanStack Query cache-t és a meglévő `useStackDay`/`useProtocolActions` boundaryt
használják. A toast action opcionálisan bővíti a globális simple toastot, a log
mutation pedig visszaadja a létrehozott intake sort, hogy a közvetlen undo ne függjön
a refetch időzítésétől.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Mozaik 2.0 + saját
clay sprite-ok, CSS (`prototype.css`), Vitest + Testing Library + MSW, Playwright
visual/layout gate.

**Design spec:**
[`docs/superpowers/specs/2026-09-04-fuel-stack-redesign-design.md`](../specs/2026-09-04-fuel-stack-redesign-design.md)

**Driving issue:** `mezo-ubxd`

**Dependencies:** nincs (`dependency_count: 0`, `dependent_count: 0`).

## Global Constraints

- Frontend-only: nincs backend-, REST-, OpenAPI-, DTO- vagy adatmodell-változtatás.
- A globális `AppLayout`, `AppHeader`, `HeaderAurora`, tabbar és QuickLog FAB
  változatlan; egyik Stack oldal sem imitál saját app-shellt.
- A `/fuel/stack` a közös header után közvetlenül a `Most következik` heróval indul;
  nincs saját `PageHead`, `Stack` PageHero vagy `Fuel · nap` sor.
- A részletoldalak routed `*Page` leafek. Feature-kód adatot csak `@/data/hooks`
  felől importál; deep absolute importok, új barrel nélkül.
- A forrás kizárólag a meglévő living protocol és query cache. Nincs lokális shadow
  protocol, statikus prototípus-szám vagy real-mode mock fallback.
- Az időzítési és étkezési kezelőoldalak meglévő occurrence-ek vetületei; nem készül
  persistence nélküli kapcsoló vagy hamis `Mentés` gomb.
- Saját clay szimbólumok: `i-stack`, `i-idozito`, `i-recept`, `i-beallitas`,
  `i-kamra`. Emoji és külső ikoncsomag tilos.
- A napi progress csak a `!skippedToday` occurrence-eket számolja. Az all-done csak
  `totalCount > 0 && takenCount === totalCount`; az üres protokoll nem sikerállapot.
- Siker-toast csak feloldott log mutation után jelenhet meg. A `Visszavonás` az exact
  frissen létrehozott intake id-t törli; rejected mutation nem mutathat sikert.
- A meglévő globális mutation-error toast marad az egyetlen write-error felület.
- Minden click target legalább 44×44 px, név szerinti accessible labellel; progress
  és státusz nem támaszkodik kizárólag színre.
- `prefers-reduced-motion` alatt az új rise/progress/pulse mozgás állóképre vált.
- 320, 390 és 430 px szélességen nincs vízszintes overflow vagy app chrome alá
  szoruló tartalom; light, dark/Cirkadián/Pulse tokenekkel nincs komponensbranch.
- Minden task külön conventional commit, a commit subject tartalmazza a
  `mezo-ubxd` id-t.

## Végrehajtási előfeltétel

A jelenlegi HEAD detached. Az implementáció előtt a specifikáció commitjáról hozz
létre feature branchet, majd ellenőrizd, hogy csak a tervdokumentum módosítása
maradt:

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
git switch -c feat/fuel-stack-redesign
bd update mezo-ubxd --claim
git status --short --branch
```

Várt: `feat/fuel-stack-redesign`, az issue `IN_PROGRESS`, és legfeljebb ez a még
commitálatlan plan fájl látszik.

## Fájlstruktúra

| Fájl | Felelősség | Művelet |
|---|---|---|
| `frontend/src/shared/lib/toastBus.ts` | opcionális simple-toast action típusa | módosítás |
| `frontend/src/shared/ui/ToastProvider.tsx` | action render/dismiss | módosítás |
| `frontend/src/shared/ui/ToastProvider.test.tsx` | action és stack regressziók | módosítás |
| `frontend/src/data/fuel/stackHooks.ts` | Promise-os log/undo és exact intake id | módosítás |
| `frontend/src/data/fuel/stackHooks.test.tsx` | real/mock exact-undo contract | módosítás |
| `frontend/src/features/fuel/logic/stackPresentation.ts` | közös napi view-model | új |
| `frontend/src/features/fuel/logic/stackPresentation.test.ts` | progress/next/preview edge case-ek | új |
| `frontend/src/features/fuel/logic/useStackIntakeToggle.ts` | közös pipa + toast orchestration | új |
| `frontend/src/features/fuel/components/StackNextHero.tsx` | fókuszált következő/all-done/empty hero | új |
| `frontend/src/features/fuel/components/StackRhythmPreview.tsx` | legfeljebb három napi sor | új |
| `frontend/src/features/fuel/components/StackNextCard.tsx` + teszt | régi next-zone kártya | törlés, lefedettsége az új heróba költözik |
| `frontend/src/features/fuel/components/StackZoneCard.tsx` + teszt | régi zone mosaic kártya | törlés, lefedettsége a timeline-ba költözik |
| `frontend/src/features/fuel/components/StackPageScaffold.tsx` | aloldali PageHead/PageHero/PageBody keret | új |
| `frontend/src/features/fuel/components/StackTimeline.tsx` | teljes napi slot timeline | új |
| `frontend/src/features/fuel/components/StackManageCard.tsx` | kezelési navigációs csempe | új |
| `frontend/src/features/fuel/components/StackManageOccurrenceList.tsx` | protocol/timing/meal lens közös listája | új |
| `frontend/src/features/fuel/pages/FuelStackPage.tsx` | új Stack hub | átírás |
| `frontend/src/features/fuel/pages/FuelStackPage.test.tsx` | hub, toast, honest state regressziók | átírás |
| `frontend/src/features/fuel/pages/FuelStackProtocolPage.tsx` | teljes protokoll read oldal | új |
| `frontend/src/features/fuel/pages/FuelStackTodayPage.tsx` | teljes napi ritmus oldal | új |
| `frontend/src/features/fuel/pages/FuelStackMealsPage.tsx` | étkezési match oldal | új |
| `frontend/src/features/fuel/pages/FuelStackReadPages.test.tsx` | három read route tesztjei | új |
| `frontend/src/features/fuel/pages/FuelStackManagePage.tsx` | kezelési hub | új |
| `frontend/src/features/fuel/pages/FuelStackManageProtocolPage.tsx` | protocol lens wrapper | új |
| `frontend/src/features/fuel/pages/FuelStackManageTimingPage.tsx` | timing lens wrapper | új |
| `frontend/src/features/fuel/pages/FuelStackManageMealsPage.tsx` | meal-zone lens wrapper | új |
| `frontend/src/features/fuel/pages/FuelStackAddPage.tsx` | teljes oldalas Kamra-választó | új |
| `frontend/src/features/fuel/pages/FuelStackManagePages.test.tsx` | manage/add route és mutation tesztek | új |
| `frontend/src/features/fuel/sheets/StackPickerSheet.tsx` | régi picker sheet | törlés |
| `frontend/src/features/fuel/sheets/StackPickerSheet.test.tsx` | régi picker teszt | törlés, lefedettsége add page-re költözik |
| `frontend/src/features/fuel/sheets/StackItemSheet.tsx` | új vizuális osztályok, azonos mutationök | módosítás |
| `frontend/src/features/fuel/components/stackCssContract.test.ts` | scoped CSS és reduced-motion guard | új |
| `frontend/src/app/router.tsx` | kilenc explicit Stack route | módosítás |
| `frontend/src/styles/prototype.css` | izolált `.stk-hub-*`, `.stk-page-*`, `.stk-manage-*` stílus | módosítás |
| `frontend/tests/visual/visual.spec.ts` | öt két-témás Stack golden | módosítás |
| `frontend/tests/visual/layout.spec.ts` | 320/390/430 containment és reachability | módosítás |
| `frontend/tests/visual/visual.spec.ts-snapshots/fuel-stack-*-darwin.png` | vizuális baseline-ok | új |
| `docs/features/fuel.md` | living Stack IA/adatfolyam/file map | módosítás |
| `docs/features/_platform-notifications.md` | simple toast action szerződés | módosítás |
| `docs/features/_platform-design-system.md` | Stack Mozaik oldalcsalád | módosítás |
| `docs/CODEMAP.md` | generált route/file térkép | regenerálás |

---

### Task 1: Akciós toast és race-biztos exact intake undo

**Files:**
- Modify: `frontend/src/shared/lib/toastBus.ts`
- Modify: `frontend/src/shared/ui/ToastProvider.tsx`
- Modify: `frontend/src/shared/ui/ToastProvider.test.tsx`
- Modify: `frontend/src/data/fuel/stackHooks.ts`
- Modify: `frontend/src/data/fuel/stackHooks.test.tsx`

**Interfaces:**

```ts
export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface SimpleToast {
  kind: ToastKind
  text: string
  action?: ToastAction
}

// useStackActions()
logIntake(
  pantryItemId: string,
  slotKey?: StackZoneKey,
  dose?: string | null,
): Promise<Intake>

undoIntake(
  pantryItemId: string,
  slotKey?: StackZoneKey,
  intakeId?: string,
): Promise<void>
```

- [x] **Step 1: Írd meg a bukó ToastProvider teszteket**

A `ToastProvider.test.tsx` új tesztjei bizonyítsák, hogy:

```ts
const action = vi.fn()
act(() => emitToast({
  kind: 'success',
  text: 'Kreatin bevéve',
  action: { label: 'Visszavonás', onClick: action },
}))
fireEvent.click(screen.getByRole('button', { name: 'Visszavonás' }))
expect(action).toHaveBeenCalledOnce()
```

- a gomb aktiválása után csak ez a toast kap `is-leaving` állapotot, a mögötte levő
  queue-elem megmarad;
- Promise-ot visszaadó action is lefut és végül bezárja a toastot;
- action nélküli simple toast és reward toast DOM-ja változatlan;
- a gomb fókuszolható valódi `button`, nem click handleres `span`.

- [x] **Step 2: Futtasd a toast tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/shared/ui/ToastProvider.test.tsx
```

Várt: FAIL, mert `SimpleToast.action` és a toast-action button még nem létezik.

- [x] **Step 3: Implementáld az opcionális simple-toast actiont**

A `toastBus.ts`-ben add hozzá a fenti `ToastAction` típust kizárólag a
`SimpleToast` ághoz. A `ToastProvider` simple body-jában a szöveg mellé renderelj
`.t-action` gombot. A handler pontos alakja:

```ts
async function runAction(entry: Entry) {
  if (isRewardToast(entry.toast) || !entry.toast.action) return
  try {
    await entry.toast.action.onClick()
  } catch {
    // Mutation action errors are already surfaced by the global MutationCache.
  } finally {
    dismiss(entry.id)
  }
}
```

A JSX handler `onClick={() => { void runAction(e) }}` legyen, hogy rejected Promise
ne maradjon kezeletlen event-returnként. A meglévő close gomb, queue cap és 4/6
másodperces timer ne változzon.

- [x] **Step 4: Írd meg a bukó stack-hook teszteket**

A `stackHooks.test.tsx`-ben legyen real-mode teszt, amely:

1. a POST `/api/fuel/intake` válaszában `id: 'intake-fresh'` sort ad;
2. `await result.current.logIntake('kreatin', 'wake', '5g')` eredményén ezt az id-t
   várja;
3. az intake list refetchének megérkezése nélkül hívja:

```ts
await result.current.undoIntake('kreatin', 'wake', 'intake-fresh')
```

4. ellenőrzi, hogy a DELETE pontosan
   `/api/fuel/intake/entry/intake-fresh`-re ment.

Mock-mode tesztben a `logIntake` adjon vissza stabil id-jű `Intake` sort, majd az
exact id-s undo távolítsa el ugyanazt a cache-elemet.

- [x] **Step 5: Futtasd a focused hook tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/data/fuel/stackHooks.test.tsx
```

Várt: FAIL, mert a mai `logIntake`/`undoIntake` fire-and-forget és nem fogad exact
intake id-t.

- [x] **Step 6: Tedd Promise-ossá és exact-id képessé a stack actionöket**

- A real `logM.mutationFn` térjen vissza a `fuelApi.logIntake(...)` eredményével.
- A `mockAddIntake(...)` térjen vissza a már létező vagy az újonnan létrehozott
  `Intake` sorral; a cache-be írt és a visszaadott objektum ugyanaz legyen.
- A publikus callbackek `mutateAsync`-ot használjanak.
- Az undo mutation inputja kapjon `intakeId?: string` mezőt. Real módban
  `input.intakeId ?? findIntakeRow(...)?.id`, mock módban pedig ugyanígy az exact id
  élvezzen elsőbbséget.
- Exact id hiányában őrizd meg a jelenlegi pantryItemId+slotKey legacy feloldást.
- A meglévő query invalidációk és globális mutation-error viselkedés maradjon meg.

- [x] **Step 7: Futtasd újra a két focused tesztet**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/shared/ui/ToastProvider.test.tsx src/data/fuel/stackHooks.test.tsx
```

Várt: PASS.

- [x] **Step 8: Commit**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
git add frontend/src/shared/lib/toastBus.ts frontend/src/shared/ui/ToastProvider.tsx frontend/src/shared/ui/ToastProvider.test.tsx frontend/src/data/fuel/stackHooks.ts frontend/src/data/fuel/stackHooks.test.tsx
git commit -m "feat(fuel): add undoable intake toast contract (mezo-ubxd)"
```

### Task 2: Közös, tiszta Stack napi nézetmodell

**Files:**
- Create: `frontend/src/features/fuel/logic/stackPresentation.ts`
- Test: `frontend/src/features/fuel/logic/stackPresentation.test.ts`

**Interfaces:**

```ts
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'

export interface StackDayRow {
  entry: StackDayEntry
  zone: StackDaySlot['zone']
  time: string
  slotLabel: string
  anchorNote: string | null
}

export interface StackDayView {
  rows: StackDayRow[]
  applicableRows: StackDayRow[]
  previewRows: StackDayRow[]
  nextRow: StackDayRow | null
  takenCount: number
  totalCount: number
  allDone: boolean
}

export function buildStackDayView(slots: StackDaySlot[]): StackDayView
```

**Deterministic rules:**

1. `rows` a slot- és entry-sorrendet változtatás nélkül kilapítja, és minden entry
   mellé odaírja a slot idejét/címkéjét/anchorját.
2. `applicableRows = rows.filter(row => !row.entry.skippedToday)`.
3. `nextRow` az első nem taken applicable sor, különben `null`.
4. `previewRows` legfeljebb három applicable sor: a közvetlenül előző, a következő
   és az azt követő. Ha nincs előző, az első három; ha minden kész, az utolsó három.
5. `allDone = totalCount > 0 && takenCount === totalCount`.
6. A helper nem mutálhatja a `slots` vagy `entries` inputot, nem olvas órát és nem
   importál Reactot.

- [x] **Step 1: Írd meg a bukó unit teszteket**

A fixture legalább négy időrendi sort tartalmazzon: egy kész, egy következő, egy
későbbi és egy `skippedToday`. Ellenőrizd:

```ts
const view = buildStackDayView(slots)
expect(view.takenCount).toBe(1)
expect(view.totalCount).toBe(3)
expect(view.nextRow?.entry.name).toBe('Kreatin')
expect(view.previewRows.map(row => row.entry.name)).toEqual([
  'D3 + K2', 'Kreatin', 'Magnézium',
])
expect(view.allDone).toBe(false)
```

Külön tesztelje:

- üres input → `totalCount: 0`, `nextRow: null`, `allDone: false`;
- az első sor a következő → az első három kerül preview-ba;
- minden applicable sor kész → utolsó három, `allDone: true`;
- a skipped sor a `rows` listában megmarad, de progressbe/preview-ba nem számít;
- az input deep snapshotja hívás után változatlan.

- [x] **Step 2: Futtasd a focused tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/logic/stackPresentation.test.ts
```

Várt: FAIL, mert a modul még nem létezik.

- [x] **Step 3: Implementáld a tiszta view-model buildert**

A lapítás `flatMap`-pel készüljön, de minden `StackDayRow` új wrapper objektum legyen;
az eredeti `entry` referenciát csak olvassa. A preview indexelése:

```ts
const nextIndex = applicableRows.findIndex(row => !row.entry.taken)
const previewRows = nextIndex < 0
  ? applicableRows.slice(-3)
  : applicableRows.slice(Math.max(0, nextIndex - 1), Math.max(0, nextIndex - 1) + 3)
```

A return objektum minden derivált mezőt egyszer, ugyanabból az `applicableRows`
listából számoljon; routed oldal ne implementálja újra ezt a logikát.

- [x] **Step 4: Futtasd újra a focused tesztet**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/logic/stackPresentation.test.ts
```

Várt: PASS.

- [x] **Step 5: Commit**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
git add frontend/src/features/fuel/logic/stackPresentation.ts frontend/src/features/fuel/logic/stackPresentation.test.ts
git commit -m "feat(fuel): derive shared Stack day view (mezo-ubxd)"
```

### Task 3: Következő-bevétel-központú Stack hub és success-toast

**Files:**
- Create: `frontend/src/features/fuel/logic/useStackIntakeToggle.ts`
- Create: `frontend/src/features/fuel/components/StackNextHero.tsx`
- Create: `frontend/src/features/fuel/components/StackRhythmPreview.tsx`
- Rewrite: `frontend/src/features/fuel/pages/FuelStackPage.tsx`
- Rewrite: `frontend/src/features/fuel/pages/FuelStackPage.test.tsx`
- Delete: `frontend/src/features/fuel/components/StackNextCard.tsx`
- Delete: `frontend/src/features/fuel/components/StackNextCard.test.tsx`

**Interfaces:**

```ts
export function useStackIntakeToggle(): {
  toggleIntake: (entry: StackDayEntry) => Promise<void>
}

export function StackNextHero(props: {
  view: StackDayView
  onToggle: (entry: StackDayEntry) => void
  onOpen: (entry: StackDayEntry) => void
  onAdd: () => void
}): React.JSX.Element

export function StackRhythmPreview(props: {
  rows: StackDayRow[]
  totalCount: number
  onOpenAll: () => void
}): React.JSX.Element
```

- [ ] **Step 1: Cseréld le a régi hub-teszteket bukó, jóváhagyott IA-tesztekre**

A `FuelStackPage.test.tsx` render helperébe kerüljön `ToastProvider`. A tesztek
ellenőrizzék:

- `.mz-page.mz-p-sage` megmarad, de `.mz-page-head` és `.mz-page-hero` nincs;
- az első feature-content `.stk-hub-next` és benne `MOST KÖVETKEZIK`, az idő, az
  első nem teljesített occurrence neve/dózisa/reasonje, `i-stack` use;
- `N / M bevéve` szöveg és progressbar `aria-valuenow/min/max`;
- `.stk-rhythm-preview` legfeljebb három sort mutat, a `Mind a 8` navigációs célja
  `/fuel/stack/today`;
- `Teljes protokoll`, `Mai ritmus`, `Étkezéshez`, `Kezelés` teljes kártyagombok a
  specifikált route-okra visznek;
- all-done hero és üres protokoll külön állapot; az üres CTA
  `/fuel/stack/manage/add`-ra navigál és nincs `0/0` siker;
- real mode továbbra sem hív `/api/goals`-t és nem mutat mock seedet.

A lokális tesztrouter minden célroute-hoz `LocationProbe` elemet adjon, hogy a
navigáció valódi URL-en legyen ellenőrizve, ne mockolt `useNavigate`-tal.

- [ ] **Step 2: Futtasd a hub tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/pages/FuelStackPage.test.tsx
```

Várt: FAIL a régi PageHead/PageHero/stat-strip/zone-mosaic DOM miatt.

- [ ] **Step 3: Írd meg a közös pipa-orchestration hookot**

Az `useStackIntakeToggle` a `useStackActions()` és `useToast()` hookokat komponálja.
Pontos működés:

```ts
if (entry.taken) {
  await undoIntake(entry.pantryItemId, entry.persistedZone)
  return
}
const intake = await logIntake(entry.pantryItemId, entry.persistedZone, entry.dose)
show({
  kind: 'success',
  text: `${entry.name} bevéve`,
  action: {
    label: 'Visszavonás',
    onClick: () => undoIntake(entry.pantryItemId, entry.persistedZone, intake.id),
  },
})
```

A teljes handler legyen `try/catch`; a catch nem mutat második hibát, mert a globális
MutationCache már kiírta azt, csak a rejected event Promise-t nyeli el. Manual undo
nem mutat success-toastot.

- [ ] **Step 4: Építsd meg a herót és a háromsoros preview-t**

- `StackNextHero` a `view.nextRow`, `view.allDone` és `view.totalCount === 0` három
  kizárólagos állapotát renderelje.
- A normal hero checkbox labelje `${name} bevétel jelölése`; all-done esetén nincs
  aktív checkbox; empty esetén `Tétel hozzáadása` button.
- A heróban `ClayIcon name="i-stack"`, a reason fallbackje `anchorNote`, majd
  `Automatikusan időzítve.` legyen.
- `StackRhythmPreview` a kapott `previewRows` sorrendjét őrzi, és minden sorban idő,
  név/dózis, valamint szöveges `bevéve`/`következik`/`később` állapotot mutat.

- [ ] **Step 5: Írd át a FuelStackPage kompozícióját**

Használd: `useStackDay`, `useProtocol`, `useStack`, `useFuelDay`, `useRecipes`,
`buildStackDayView`, `matchMealsToStack`, `useStackIntakeToggle`, `Mosaic`, `Tile`,
`PageBody`, `EntranceGroup` és `StackItemSheet`.

A markup sorrendje:

1. `MozaikPage tone="sage" className="stk-hub-page"`;
2. `EntranceGroup` → `PageBody`;
3. `StackNextHero`;
4. `StackRhythmPreview`;
5. kétoszlopos `Mosaic` a négy kötelező `Tile`-lal és a specifikált clay ikonokkal.

Ne renderelj `PageHead`, `PageHero`, `StatStrip`, `StackDayArc`, `StackMealMatch`,
`StackNextCard`, `StackZoneCard`, `Miért így` blokkot vagy autosave recapet a hubon.
Ezek információja részletoldalra kerül, nem vész el.

- [ ] **Step 6: Add hozzá a success-toast + exact undo regressziót**

Mock módban kattints az induláskor nem teljesített `Origin PWO bevétel jelölése`
gombra. Várd meg:

```ts
expect(await screen.findByRole('status')).toHaveTextContent('Origin PWO bevéve')
await userEvent.click(screen.getByRole('button', { name: 'Visszavonás' }))
await waitFor(() => expect(
  screen.getByRole('button', { name: 'Origin PWO bevétel jelölése' }),
).toHaveAttribute('aria-pressed', 'false'))
```

Realer MSW rejectionnél a success szöveg nem jelenhet meg.

- [ ] **Step 7: Futtasd a focused teszteket**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/pages/FuelStackPage.test.tsx src/features/fuel/logic/stackPresentation.test.ts src/shared/ui/ToastProvider.test.tsx
```

Várt: PASS.

- [ ] **Step 8: Töröld a már fogyasztó nélküli régi next komponenst és commitolj**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
rg -n "StackNextCard" frontend/src --glob '!**/StackNextCard.tsx' --glob '!**/StackNextCard.test.tsx'
git rm frontend/src/features/fuel/components/StackNextCard.tsx frontend/src/features/fuel/components/StackNextCard.test.tsx
git add frontend/src/features/fuel/logic/useStackIntakeToggle.ts frontend/src/features/fuel/components/StackNextHero.tsx frontend/src/features/fuel/components/StackRhythmPreview.tsx frontend/src/features/fuel/pages/FuelStackPage.tsx frontend/src/features/fuel/pages/FuelStackPage.test.tsx
git commit -m "feat(fuel): rebuild Stack as next-action hub (mezo-ubxd)"
```

Az `rg` várt eredménye 0, mert a két törlendő fájlt a glob kizárja; más találat
esetén előbb migráld vagy frissítsd azt.

### Task 4: Teljes protokoll, napi ritmus és étkezési részletoldalak

**Files:**
- Create: `frontend/src/features/fuel/components/StackPageScaffold.tsx`
- Create: `frontend/src/features/fuel/components/StackTimeline.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackProtocolPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackTodayPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackMealsPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackReadPages.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/fuel/sheets/StackItemSheet.tsx` (csak elavult komponensnév-komment)
- Delete: `frontend/src/features/fuel/components/StackZoneCard.tsx`
- Delete: `frontend/src/features/fuel/components/StackZoneCard.test.tsx`

**Interfaces:**

```ts
export function StackPageScaffold(props: {
  tone: PageTone
  backTo: '/fuel/stack' | '/fuel/stack/manage'
  backLabel: '‹ Stack' | '‹ Kezelés'
  icon: ClayIconName
  name: string
  big?: ReactNode
  sub?: string
  children: ReactNode
}): React.JSX.Element

export function StackTimeline(props: {
  slots: StackDaySlot[]
  onToggle: (entry: StackDayEntry) => void
  onOpen: (entry: StackDayEntry) => void
}): React.JSX.Element
```

- [ ] **Step 1: Írd meg a három route bukó oldaltesztjeit**

A `FuelStackReadPages.test.tsx` lokális `Routes`-ban renderelje a három oldalt és
`/fuel/stack` location probe-ot. Fedje le:

- `/fuel/stack/protocol`: `‹ Stack`, `Teljes protokoll`, version/confidence/item
  összegzés, zónasorrend, dózis, placement reason, pinned jelzés; `Szerkesztés` →
  `/fuel/stack/manage/protocol`; nincs bevétel-checkbox;
- `/fuel/stack/today`: `Mai ritmus`, `StackDayArc`, minden slot időrendben, taken,
  displaced, skipped és pinned állapot; skipped gomb disabled; pipa success-toast;
- `/fuel/stack/meals`: a `matchMealsToStack()` seed suggestion/verdict linkjei,
  összesített match darabszám és a nulla-result honest empty state;
- mindhárom `‹ Stack` gomb `/fuel/stack`-re navigál;
- mindhárom page saját `MozaikPage` tone-t és a specifikált clay ikont használja.

- [ ] **Step 2: Futtasd a tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/pages/FuelStackReadPages.test.tsx
```

Várt: FAIL, mert a routed oldalak még nem léteznek.

- [ ] **Step 3: Készítsd el a közös részletoldal-keretet**

A `StackPageScaffold` `MozaikPage` → `PageHead` → `EntranceGroup` → `PageHero` →
`PageBody` kompozíció legyen. A back gomb `useNavigate()(backTo)` hívást végezzen;
a hero csak a kapott saját clay ikont használja. Ne rendereljen app-headert, tabbart
vagy saját fixed háttérréteget.

- [ ] **Step 4: Készítsd el a teljes protokoll read oldalt**

A `FuelStackProtocolPage` `useProtocol()` és `useStackDay()` eredményeit használja.
A hero:

```tsx
<StackPageScaffold
  tone="sage"
  backTo="/fuel/stack"
  backLabel="‹ Stack"
  icon="i-stack"
  name="Teljes protokoll"
  big={`${protocol.itemCount} tétel`}
  sub={`v${protocol.version} · ${Math.round(protocol.confidence * 100)}% bizalom`}
>
```

A slotokat az eredeti `useStackDay().slots` sorrendben renderelje. Minden occurrence
row neve/dózisa/reasonje és `pinned ? 'kézi' : 'auto'` szövege látható. A page-level
`Szerkesztés` button `/fuel/stack/manage/protocol`-ra visz. Pending/empty/error
állapotban ne mutasson seedből származó metaértéket.

- [ ] **Step 5: Készítsd el a teljes napi timeline-t**

A `StackTimeline` egy `.stk-timeline` listát renderel slot-headekkel és occurrence
sorokkal. Migráld bele a régi `StackZoneCard` bizonyított állapotait:

- pinned → `kézi`;
- nem pinned → `auto`;
- `displacedToday` → `ma nincs edzés`;
- `skippedToday` → `ma kimarad`, disabled checkbox;
- checkbox accessible neve `${name} bevétel jelölése` vagy
  `${name} bevétel visszavonása`;
- külön `${name} beállítások` button nyitja a `StackItemSheet`-et.

A `FuelStackTodayPage` `useStackDay`, `buildStackDayView` és
`useStackIntakeToggle` hookokat használja; gold `StackPageScaffold`,
`StackDayArc`, `StackTimeline`, lokális `openEntry` state és `StackItemSheet`.

- [ ] **Step 6: Készítsd el az étkezési match oldalt**

A `FuelStackMealsPage` ugyanazzal a mai/tegnapi dátumképzéssel hívja a
`useFuelDay`, `useRecipes` és `matchMealsToStack` párost, mint a régi hub. A hero
`result.suggestions.length + result.verdicts.length` darabszámot mutat, coral
tónussal és `i-recept` ikonnal. Nem üres eredménynél `StackMealMatch`, egyébként
`.stk-meals-empty` magyarázó kártya jelenik meg; write control nincs.

- [ ] **Step 7: Regisztráld a három explicit route-ot**

A `router.tsx` Fuel blokkja pontosan ezt a sorrendet kapja:

```tsx
{ path: 'fuel/stack', element: <FuelStackPage /> },
{ path: 'fuel/stack/protocol', element: <FuelStackProtocolPage /> },
{ path: 'fuel/stack/today', element: <FuelStackTodayPage /> },
{ path: 'fuel/stack/meals', element: <FuelStackMealsPage /> },
```

Az importok közvetlenül a `pages/` fájlokra mutassanak.

- [ ] **Step 8: Futtasd a focused route/page teszteket**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/pages/FuelStackReadPages.test.tsx src/features/fuel/pages/FuelStackPage.test.tsx src/app/navigation.test.tsx
```

Várt: PASS.

- [ ] **Step 9: Távolítsd el a régi zone cardot és commitolj**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
rg -n "StackZoneCard" frontend/src --glob '!**/StackZoneCard.tsx' --glob '!**/StackZoneCard.test.tsx'
git rm frontend/src/features/fuel/components/StackZoneCard.tsx frontend/src/features/fuel/components/StackZoneCard.test.tsx
git add frontend/src/features/fuel/components/StackPageScaffold.tsx frontend/src/features/fuel/components/StackTimeline.tsx frontend/src/features/fuel/pages/FuelStackProtocolPage.tsx frontend/src/features/fuel/pages/FuelStackTodayPage.tsx frontend/src/features/fuel/pages/FuelStackMealsPage.tsx frontend/src/features/fuel/pages/FuelStackReadPages.test.tsx frontend/src/features/fuel/sheets/StackItemSheet.tsx frontend/src/app/router.tsx
git commit -m "feat(fuel): add Stack read detail pages (mezo-ubxd)"
```

Az `rg` várt eredménye 0, mert a két törlendő fájlt a glob kizárja. A
`StackItemSheet` nyitó kommentjében a régi `StackZoneCard` nevet előtte cseréld a
`StackTimeline` occurrence sorára; TypeScript/TSX fogyasztó nem maradhat.

### Task 5: Protokollkezelési oldalcsalád és teljes oldalas Kamra-add

**Files:**
- Create: `frontend/src/features/fuel/components/StackManageCard.tsx`
- Create: `frontend/src/features/fuel/components/StackManageOccurrenceList.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackManagePage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackManageProtocolPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackManageTimingPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackManageMealsPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackAddPage.tsx`
- Create: `frontend/src/features/fuel/pages/FuelStackManagePages.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/data/fuel/stackHooks.ts` (csak elavult picker-komment)
- Delete: `frontend/src/features/fuel/sheets/StackPickerSheet.tsx`
- Delete: `frontend/src/features/fuel/sheets/StackPickerSheet.test.tsx`

**Interfaces:**

```ts
export function StackManageCard(props: {
  icon: 'i-stack' | 'i-idozito' | 'i-recept' | 'i-kamra'
  wash: MozaikWash
  title: string
  detail: string
  onClick: () => void
}): React.JSX.Element

export type StackManageLens = 'protocol' | 'timing' | 'meals'

export function StackManageOccurrenceList(props: {
  slots: StackDaySlot[]
  lens: StackManageLens
  onOpen: (entry: StackDayEntry) => void
}): React.JSX.Element
```

- [ ] **Step 1: Írd meg a kezelési route-ok bukó tesztjeit**

A `FuelStackManagePages.test.tsx` lokális route tree-vel fedje le:

- manage hub: `Protokoll kezelése` lavender hero és négy route-kártya valós
  occurrence/zóna/meal-zone darabszámmal;
- `Protokoll tételei`: minden occurrence látható; tételre koppintva megnyílik a
  `StackItemSheet`, ahol dózis, zónaváltás, unpin, további occurrence és remove
  továbbra is elérhető;
- `Időzítési rend`: minden zóna időrendben, idő és anchor note látható;
- `Étkezési horgonyok`: csak breakfast/lunch/dinner slotok láthatók;
- egyik oldalon sincs `Mentés` gomb;
- mindhárom wrapper `‹ Kezelés` gombja `/fuel/stack/manage`-re visz;
- add page: keresés szűr, `a stackben` jelölés helyes, több eltérő tétel egymás után
  hozzáadható, a page nyitva marad;
- sikeres add után `${name} hozzáadva` toast, rejected add után nincs success-toast.

- [ ] **Step 2: Futtasd a focused tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/pages/FuelStackManagePages.test.tsx
```

Várt: FAIL, mert a management route-ok még nem léteznek.

- [ ] **Step 3: Készítsd el a Kezelés hubot**

A `FuelStackManagePage` `useProtocol`, `useStackDay` és `useNavigate` hookokat
használjon. Lavender `StackPageScaffold`, `i-beallitas`, majd négy
`StackManageCard`:

```text
Protokoll tételei   → /fuel/stack/manage/protocol
Időzítési rend      → /fuel/stack/manage/timing
Étkezési horgonyok  → /fuel/stack/manage/meals
Új tétel a Kamrából → /fuel/stack/manage/add
```

Az alcímeket valós adatokból képezd: occurrence count, használt zone count,
breakfast/lunch/dinner occurrence count és stash count. Pendingnél skeleton/`—`,
nem seed érték.

- [ ] **Step 4: Készítsd el a három management lens oldalt**

A `StackManageOccurrenceList` közös row-anatómiája: saját clay ikon helyett színes
status-dot, név, dózis, zónacímke, idő, `kézi`/`auto`, chevron. A teljes sor
`${name} beállítások` nevű button.

- `protocol`: minden slot/entry, a név+dózis a fő hangsúly;
- `timing`: minden slot/entry, a slot idő/anchor a fő hangsúly;
- `meals`: kizárólag `breakfast | lunch | dinner`, a meal-zone label a fő hangsúly.

Mindhárom routed wrapper `useStackDay`-t olvas, lokális `openEntry` state-et tart és
ugyanazt a `StackItemSheet`-et nyitja. Sem draft, sem page-level save nincs.

- [ ] **Step 5: Költöztesd a Kamra-pickert teljes oldalra**

A `FuelStackAddPage` `useStack`, `useProtocol`, `useProtocolActions`, `useToast` és
lokális `query` state-et használ. Gold/sage `StackPageScaffold`, `i-kamra`,
hozzáférhető `Keresés a Kamrában` input, majd teljes szélességű sorok.

Az add handler:

```ts
async function handleAdd(item: SupplementStashItem) {
  try {
    await addItem(item.id)
    show({ kind: 'success', text: `${item.name} hozzáadva` })
  } catch {
    // a globális MutationCache mutatja a hibát
  }
}
```

Ne navigáljon el és ne zárjon sheetet. Az occupied jelzés az
`new Set(occurrences.map(item => item.pantryItemId))` halmazból származzon; az elem
ettől még maradjon button, hogy a backend valós duplicate-szabálya adhasson hibát.

- [ ] **Step 6: Regisztráld az öt explicit management route-ot**

```tsx
{ path: 'fuel/stack/manage', element: <FuelStackManagePage /> },
{ path: 'fuel/stack/manage/protocol', element: <FuelStackManageProtocolPage /> },
{ path: 'fuel/stack/manage/timing', element: <FuelStackManageTimingPage /> },
{ path: 'fuel/stack/manage/meals', element: <FuelStackManageMealsPage /> },
{ path: 'fuel/stack/manage/add', element: <FuelStackAddPage /> },
```

A statikus route-ok közvetlen page importokat kapjanak; wildcard vagy route-param
nem szükséges.

- [ ] **Step 7: Futtasd a focused management és sheet regressziókat**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/pages/FuelStackManagePages.test.tsx src/features/fuel/sheets/StackItemSheet.test.tsx src/features/fuel/pages/FuelStackPage.test.tsx
```

Várt: PASS.

- [ ] **Step 8: Töröld a fogyasztó nélküli picker sheetet és commitolj**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
rg -n "StackPickerSheet" frontend/src --glob '!**/StackPickerSheet.tsx' --glob '!**/StackPickerSheet.test.tsx'
git rm frontend/src/features/fuel/sheets/StackPickerSheet.tsx frontend/src/features/fuel/sheets/StackPickerSheet.test.tsx
git add frontend/src/features/fuel/components/StackManageCard.tsx frontend/src/features/fuel/components/StackManageOccurrenceList.tsx frontend/src/features/fuel/pages/FuelStackManagePage.tsx frontend/src/features/fuel/pages/FuelStackManageProtocolPage.tsx frontend/src/features/fuel/pages/FuelStackManageTimingPage.tsx frontend/src/features/fuel/pages/FuelStackManageMealsPage.tsx frontend/src/features/fuel/pages/FuelStackAddPage.tsx frontend/src/features/fuel/pages/FuelStackManagePages.test.tsx frontend/src/data/fuel/stackHooks.ts frontend/src/app/router.tsx
git commit -m "feat(fuel): add living protocol management pages (mezo-ubxd)"
```

Az `rg` várt eredménye a törlés előtt csak a két törlendő fájl és elavult komment;
az utóbbit ugyanebben a taskban frissítsd.

### Task 6: Design 2.0 vizuális rendszer, reszponzív és screenshot gate-ek

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelStackPage.tsx`
- Modify: all new Stack page/component files from Tasks 3–5 as required for scoped classes
- Modify: `frontend/src/features/fuel/sheets/StackItemSheet.tsx`
- Create: `frontend/src/features/fuel/components/stackCssContract.test.ts`
- Modify: `frontend/src/styles/prototype.css`
- Modify: `frontend/tests/visual/visual.spec.ts`
- Modify: `frontend/tests/visual/layout.spec.ts`
- Create: ten Darwin snapshots under `frontend/tests/visual/visual.spec.ts-snapshots/`

**Required visual anatomy:**

1. Hub: immediate large sage/gold `Most következik` card, clay `i-stack`, 44 px
   checkbox, thin progress; compact three-row rhythm; 2×2 colored tile grid.
2. Protocol: sage hero and floating grouped protocol cards.
3. Today: gold/sky day arc and calm vertical timeline, not a second mosaic.
4. Meals: coral hero and distinct suggestion/verdict cards.
5. Manage: lavender hero and four large colorful management cards; nested manager
   pages keep the same family, not a white admin list.

- [ ] **Step 1: Írd meg a bukó CSS-contract tesztet**

A `stackCssContract.test.ts` ESM-safe `readFileSync`-fel olvassa a
`frontend/src/styles/prototype.css` fájlt, és ellenőrizze:

- létezik `.stk-hub-page`, `.stk-hub-next`, `.stk-hub-progress`,
  `.stk-rhythm-preview`, `.stk-page-hero`, `.stk-timeline`, `.stk-manage-grid`,
  `.stk-manage-row`, `.stk-add-row`, `.stk-item-sheet`;
- minden feature-selector `.stk-` prefixű; nincs új globális `.card`, `.row`,
  `.mz-page`, `.toast` felülírás;
- a `@media (prefers-reduced-motion: reduce)` blokk tartalmazza az új
  `.stk-hub-progress-fill` és `.stk-hub-next` motion neutralizálását;
- a 44 px hit-area szabály szerepel a pipa, manage row és add button selectorán.

- [ ] **Step 2: Futtasd a CSS-contract tesztet és rögzítsd a bukást**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/components/stackCssContract.test.ts
```

Várt: FAIL, mert a teljes scoped Stack CSS még hiányzik.

- [ ] **Step 3: Add hozzá a scoped markup hookokat és a StackItemSheet wrappert**

Minden új oldalnak egyedi `.stk-*` root/class neve legyen. A `StackItemSheet`
render-prop tartalmát egy `<div className="stk-item-sheet">...</div>` wrapperbe
tedd; belső actionök, inputok és `close()` hívások byte-for-byte azonosak maradnak.
Ne tegyél `position: fixed` fejlécet vagy hátteret feature komponensbe.

- [ ] **Step 4: Implementáld a Design 2.0 CSS-t**

A `prototype.css` végén egyetlen kommentelt `Fuel Stack 3.0 (mezo-ubxd)` szekcióban:

- tokenes sage/coral/gold/lav/sky wash és színhez igazított soft shadow;
- `border-radius`, térköz és tipográfia a meglévő Mozaik ×1.18 ritmusához;
- a hero min-heightja tartalomvezérelt legyen, ne fix phone-height;
- 44 px pipa/CTA, visible `:focus-visible`, disabled/skipped kontraszt;
- a tile grid `minmax(0, 1fr)` oszlopokat használjon;
- hosszú név/dózis törhessen; se `white-space: nowrap`, se fix szélesség ne okozzon
  overflow-t;
- detail page body alján legyen elég safe-area/tabbar/FAB tér;
- dark/Cirkadián/Pulse alatt csak tokenek dolgozzanak, komponenság nélkül;
- `@media (max-width: 350px)` finomítsa a hero/tile spacinget;
- reduced-motion blokk állítsa le a progress grow/pulse/rise animációkat.

Az elérhetetlenné vált régi `.stk-next`, `.stk-mosaic` és `StackZoneCard`-specifikus
szabályokat töröld, de a továbbra használt `StackDayArc` és `StackMealMatch`
selectorait tartsd meg.

- [ ] **Step 5: Futtasd a DOM- és CSS-focused teszteket**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm vitest run src/features/fuel/components/stackCssContract.test.ts src/features/fuel/pages/FuelStackPage.test.tsx src/features/fuel/pages/FuelStackReadPages.test.tsx src/features/fuel/pages/FuelStackManagePages.test.tsx src/features/fuel/sheets/StackItemSheet.test.tsx
```

Várt: PASS.

- [ ] **Step 6: Add hozzá az öt két-témás visual goldent**

A `visual.spec.ts` `SCREENS` listájába:

```ts
['fuel-stack', '/fuel/stack'],
['fuel-stack-protocol', '/fuel/stack/protocol'],
['fuel-stack-today', '/fuel/stack/today'],
['fuel-stack-meals', '/fuel/stack/meals'],
['fuel-stack-manage', '/fuel/stack/manage'],
```

Ez light + dark témában tíz Darwin snapshotot hoz létre. A seedelt kalauz maradjon
lezárva, a clock maradjon a közös délutáni fix időn, hogy a valódi AppHeader és
HeaderAurora determinisztikusan jelenjen meg.

- [ ] **Step 7: Add hozzá a 320/390/430 px layout gate-et**

A `layout.spec.ts` új helperrel ellenőrizze a hubot mindhárom szélességen, a négy
fő részletoldalt 390 px-en:

```ts
for (const width of [320, 390, 430]) {
  // /fuel/stack: root scrollWidth <= clientWidth + 1,
  // mind a négy tile és az utolsó content sor scrollIntoView után látható.
}
```

Minden ellenőrzés a `.screen-content` valódi scrolleren mérjen. A 390 px-es
részletoldal-tesztek bizonyítsák, hogy az utolsó kártya elérhető és a tabbar/FAB nem
takarja tartósan. A checkbox bounding box mindkét oldala legalább 44 px.

- [ ] **Step 8: Generáld és vizsgáld meg a goldent, majd iterálj vizuálisan**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm test:visual:update -- --grep "fuel-stack"
pnpm test:visual -- --grep "fuel-stack|Stack pages"
```

Nyisd meg mind a tíz Darwin PNG-t és hasonlítsd a jóváhagyott prototípushoz. A
browserben külön nézd meg 320/390/430 px-en a valódi headert, hátteret, tabbart és
FAB-ot; ellenőrizd a hub, today, protocol, meals, manage és legalább egy nested
manage route görgetését. Konzolhiba, vízszintes overflow vagy puritán/fehér aloldal
esetén CSS/markup iteráció után futtasd újra a focused visual gate-et.

- [ ] **Step 9: Commit**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
git add frontend/src/features/fuel frontend/src/styles/prototype.css frontend/tests/visual/visual.spec.ts frontend/tests/visual/layout.spec.ts frontend/tests/visual/visual.spec.ts-snapshots/fuel-stack-*-darwin.png
git commit -m "feat(fuel): apply colorful Stack Design 2.0 (mezo-ubxd)"
```

### Task 7: Élő dokumentáció, teljes kapuk, PR és lezárás

**Files:**
- Modify: `docs/features/fuel.md`
- Modify: `docs/features/_platform-notifications.md`
- Modify: `docs/features/_platform-design-system.md`
- Regenerate: `docs/CODEMAP.md`

- [ ] **Step 1: Frissítsd a Fuel living docot helyben**

A `docs/features/fuel.md` releváns szakaszait írd át, ne adj changelogot:

- §2: `/fuel/stack` új next-action hubja és a nyolc új child route;
- §3: `buildStackDayView`, a közös query cache és `useStackIntakeToggle` adatfolyam;
- §8: hub/read/manage route, exact undo és honest-empty tesztmátrix;
- §9: nincs saját app-header, nincs hamis Mentés, meal/timing oldalak read/write
  határa, toast exact-id race döntése;
- §10: az új page/component/logic fájlok, a törölt `StackNextCard`, `StackZoneCard`
  és `StackPickerSheet`, továbbra is élő `StackDayArc`, `StackMealMatch`,
  `StackItemSheet`.

Linkeld a design specet és a `mezo-ubxd` issue-t.

- [ ] **Step 2: Frissítsd a két platform living docot**

`docs/features/_platform-notifications.md`:

- a `SimpleToast.action?: { label, onClick }` opcionális szerződés;
- action csak simple toaston, reward toast változatlan;
- action Promise errorét a globális MutationCache jelzi, a toast végül bezár;
- accessibility és queue/timer változatlanság.

`docs/features/_platform-design-system.md`:

- Stack hub: common AppHeader után közvetlen next hero;
- saját clay ikonok és négytónusú tile → own page család;
- detail page scaffold és scoped `.stk-*` styling;
- reduced-motion és 320/390/430 px szerződés.

Mindkét doc frontmatter `last_reviewed` mezője és releváns key-file hivatkozása a
valós új állapotot tükrözze.

- [ ] **Step 3: Regeneráld a CODEMAP-et és futtasd a docs lintet**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs
```

Várt: 0 lint error és a három érintett living doc nem stale. A tervezéskori teljes
baseline 13 más, scope-on kívüli stale doc + 5 warning + 0 error volt; ha ezek miatt
a parancs non-zero marad, rögzítsd pontosan a bd kommentben, de ne javíts más domaint.
Új stale/error nem fogadható el.

- [ ] **Step 4: Futtasd a teljes lokális frontend kapukat friss állapotból**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo/frontend
pnpm build
pnpm test
VITE_USE_MOCK=true pnpm test
pnpm test:visual
```

Várt: TypeScript/Vite build, real-mode Vitest, mock-mode Vitest és teljes
Playwright visual/layout suite zöld. Ha a teljes visual suite csak nem e taskhoz
tartozó baseline-on bukik, külön rögzítsd; az összes `fuel-stack*` golden és Stack
layout gate kötelezően zöld.

- [ ] **Step 5: Ellenőrizd a scope-ot és az elavult Stack maradványokat**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
rg -n "StackNextCard|StackZoneCard|StackPickerSheet|Fuel · csütörtök" frontend/src docs/features/fuel.md
rg -n "fuel/stack/(protocol|today|meals|manage)" frontend/src/app/router.tsx docs/features/fuel.md
git diff --check
git status --short
```

Várt: az első `rg` 0 találat; a második minden előírt route-ot megtalál; nincs
whitespace-hiba vagy scope-on kívüli módosítás.

- [ ] **Step 6: Commitold a dokumentációt**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
git add docs/features/fuel.md docs/features/_platform-notifications.md docs/features/_platform-design-system.md docs/CODEMAP.md
git commit -m "docs(fuel): document Stack page family (mezo-ubxd)"
```

- [ ] **Step 7: Adj bizonyítékot a Beads issue-hoz**

A `bd comment mezo-ubxd` tartalmazza:

- a hét commit hashét és rövid tárgyát;
- focused tesztek, build, real/mock teljes tesztek és visual suite eredményét;
- 320/390/430 layout ellenőrzést;
- a tíz Darwin golden kézi vizsgálatát;
- a docs lint pontos baseline/eredményét;
- minden eltérést a tervtől.

Az issue még maradjon `IN_PROGRESS`, amíg a push és a CI nem zöld.

- [ ] **Step 8: Push, Linux visual baseline és self-PR**

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
bd dolt push
git push -u origin feat/fuel-stack-redesign
gh workflow run update-visual-baselines.yml -r feat/fuel-stack-redesign
```

Várd meg a baseline workflow-t. Ha a workflow Linux snapshot commitot pushol a
branchre, húzd be non-interaktívan, futtasd újra a `fuel-stack` visual tesztet, majd:

```bash
gh pr create --base main --head feat/fuel-stack-redesign --title "feat(fuel): redesign Stack pages" --body-file <prepared-pr-body>
gh pr checks --watch
```

A PR body sorolja fel a commitokat, gate-eket, screenshotokat, docs-lint baseline-t
és tervtől való eltéréseket. `ci.yml` green kötelező; pirosnál ugyanazon branchen
javíts, futtasd újra a kapcsolódó lokális gate-et, pusholj, majd várd meg az új CI-t.

- [ ] **Step 9: Main merge, issue-zárás és tiszta átadás**

CI green után a repo workflow szerint:

```bash
cd /Users/mrkuhne/.codex/worktrees/04f3/mezo
git switch main
git pull --rebase
git merge --no-ff feat/fuel-stack-redesign
git push origin main
bd close mezo-ubxd
bd dolt push
git branch -d feat/fuel-stack-redesign
git status --short --branch
```

Várt: main originhez képest up-to-date, tiszta worktree, a PR automatikusan closed,
`mezo-ubxd` closed. Destruktív vagy force művelet nem megengedett.

---

## Kész definíció

- [ ] A `/fuel/stack` a valós app shell alatt közvetlen next-action heróval indul,
  duplikált header/page hero nélkül.
- [ ] A négy hubcsempe és mind a nyolc child route valódi, színes Design 2.0 oldalra
  vezet.
- [ ] Protocol/timing/meals kezelés kizárólag a meglévő living protocol write-okat
  használja; nincs hamis mentési állapot.
- [ ] A pipálás név szerinti success-toastot ad, amely exact intake id-val azonnal
  visszavonható real és mock módban.
- [ ] Csak a saját clay sprite-ok jelennek meg; 320/390/430 px-en nincs overflow,
  clipped content vagy chrome-átfedés.
- [ ] Focused tesztek, build, teljes Vitest mindkét módban és minden Stack
  visual/layout gate zöld.
- [ ] Fuel, notifications és design-system living doc, valamint a generált CODEMAP
  a megvalósítással egyezik; docs lintben nincs új stale/error.
- [ ] Branch pusholt, self-PR CI green, main merge/push kész, Beads issue lezárva és
  a végső worktree tiszta.
