# Fuel · Múltbeli napra logolás Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/fuel/log` oldal nap-léptetőt kap (max 7 nap vissza), múltbeli napon Pótlás-hangulattal, a mentés a választott nap `loggedAt`-jával íródik; a hubon csali-chip jelzi a tegnapi pótolható ablakokat.

**Architecture:** Nincs backend-változás és nincs új hook — a meglévő dátum-paraméteres `useFuelDay(date)`/`useFuelTimeline(date)` kap egy `date`-et a page-től; a lane múlt-normalizálása egy új pure helper (`asPastDayLane`), a mentés dátumozása a `MealComposer` három új opcionális propja (`logDate`/`logTime`/`saveLabel`). Spec: `docs/superpowers/specs/2026-08-31-fuel-multinap-logolas-design.md`; vizuális forrás: `docs/design_2.0/prototypes/fuel-log-multinap.html` (a WIP-ből véglegesítve — 1:1 fidelity).

**Tech Stack:** React + TS (Vite), TanStack Query dual-mode, vitest + testing-library (MINDKÉT mód: `VITE_USE_MOCK=true` és `=false`), prototype.css mz-tokenek.

## Global Constraints

- Driving bd issue: **mezo-1j3z** — minden commit subject hordozza.
- `logDate` nélkül a MealComposer viselkedése **byte-azonos** (a LogFlowPage overlay-doorok érintetlenek).
- mezo-bnsf változatlan: ablak-indítású mentés slotja = az ablak `slotKey`-e (`fixedSlot`).
- Őszinte állapotok: soha nem büntető hang; nincs kitalált 0; „még pótolható".
- Tokenguard: a prototype.css-ben NEM lehet hardcodeolt világos hex `:root`-on kívül (`mozaikCssTokens` teszt) — mz-token / color-mix / rgba használandó.
- Reduced-motion: új animáció nem kerül be; a meglévő guard-blokkok érintik az új elemeket, ha transitiont kapnak.
- Fordítás/якость gate lokálban: `pnpm --dir frontend exec tsc -b` fut a build részeként; fókuszált tesztek MINDKÉT módban.
- A dátum-formázás KIZÁRÓLAG a `@/shared/lib/dates` helpereivel (`addDays`, `localDateString`, `offsetIso`, `huMonthDay`, `huWeekdayFullIso`) — kézi Date-matek tilos.
- Pirula-címkék (user-döntés): fő címke MINDIG a dátum kisbetűvel + ponttal — `huMonthDay(date).toLowerCase() + '.'` → „aug 30." ; kis sor = `huWeekdayFullIso(date).toLowerCase()` („szerda"), a MAI napon `… · ma` toldalékkal. NINCS „Ma/Tegnap" fő-felirat.

---

### Task 1: `asPastDayLane` pure helper

**Files:**
- Modify: `frontend/src/features/fuel/logic/fuelSwimlane.ts` (a `buildWindowLane` után)
- Test: `frontend/src/features/fuel/logic/fuelSwimlane.test.ts` (ha nem létezik, hozd létre; ha létezik, bővítsd)

**Interfaces:**
- Consumes: `WindowLaneVM`/`WindowTileVM` (ugyanebben a fájlban definiálva).
- Produces: `export function asPastDayLane(vm: WindowLaneVM): WindowLaneVM` — Task 3 és Task 4 importálja `@/features/fuel/logic/fuelSwimlane`-ből.

- [ ] **Step 1: Írd meg a bukó teszteket** (a VM-mezők kézzel konstruálhatók; egy minimál tile-gyár segít):

```ts
import { describe, expect, test } from 'vitest'
import { asPastDayLane, type WindowLaneVM, type WindowTileVM } from './fuelSwimlane'

const tile = (over: Partial<WindowTileVM>): WindowTileVM => ({
  key: '07:30-Reggeli', slotKey: 'breakfast', state: 'future', icon: 'i-reggeli',
  label: 'Reggeli', time: '07:30', name: 'Reggeli', ghost: true, fromPlan: false,
  kcal: null, rings: [], mealId: null, scorePct: null, scorable: false, ...over,
})

describe('asPastDayLane', () => {
  test('now és future tile missed-re normalizálódik, done marad, nowKey null', () => {
    const vm: WindowLaneVM = {
      tiles: [
        tile({ key: 'a', state: 'done', mealId: 'm1' }),
        tile({ key: 'b', state: 'now' }),
        tile({ key: 'c', state: 'missed' }),
        tile({ key: 'd', state: 'future' }),
      ],
      nowKey: 'b',
    }
    const past = asPastDayLane(vm)
    expect(past.tiles.map(t => t.state)).toEqual(['done', 'missed', 'missed', 'missed'])
    expect(past.nowKey).toBeNull()
    // minden más mező változatlan (a done tile mealId-je is)
    expect(past.tiles[0].mealId).toBe('m1')
  })

  test('üres lane identitás-szerű: üres tiles + null nowKey', () => {
    expect(asPastDayLane({ tiles: [], nowKey: null })).toEqual({ tiles: [], nowKey: null })
  })
})
```

- [ ] **Step 2: Futtasd — bukjon** (`asPastDayLane` nem létezik):
`cd frontend && VITE_USE_MOCK=true pnpm exec vitest run src/features/fuel/logic/fuelSwimlane.test.ts`

- [ ] **Step 3: Implementáld** a `fuelSwimlane.ts` végén:

```ts
/**
 * Past-day normalisation (mezo-1j3z): a múltban nincs MOST és nincs jövő —
 * minden be nem logolt ablak „kimaradt · még pótolható". Pure, a state-forrás
 * (buildDayPlan) érintetlen; a /fuel/log page futtatja át rajta a lane-t, ha
 * a választott nap nem a mai.
 */
export function asPastDayLane(vm: WindowLaneVM): WindowLaneVM {
  return {
    tiles: vm.tiles.map(t =>
      t.state === 'now' || t.state === 'future' ? { ...t, state: 'missed' } : t,
    ),
    nowKey: null,
  }
}
```

- [ ] **Step 4: Futtasd — zöld**, majd mindkét módban: ugyanaz a parancs `VITE_USE_MOCK=false`-szal is.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/fuelSwimlane.ts frontend/src/features/fuel/logic/fuelSwimlane.test.ts
git commit -m "feat(fuel): asPastDayLane múlt-normalizáló a window lane-hez (mezo-1j3z)"
```

---

### Task 2: MealComposer `logDate`/`logTime`/`saveLabel`

**Files:**
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx`
- Test: `frontend/src/features/fuel/components/MealComposer.logDate.test.tsx` (ÚJ)

**Interfaces:**
- Consumes: `offsetIso`, `nowOffsetIso` (`@/shared/lib/dates`); `useMealActions(date?)`, `useFuelDay(date?)` (`@/data/hooks`).
- Produces: a `MealComposerProps` bővül —

```ts
/** Melyik napra könyvelődik a mentés (ISO local date). Absent = ma (nowOffsetIso, byte-azonos). */
logDate?: string
/** A loggedAt idő-komponense HH:mm (ablak-indítás: az ablak ideje). Absent = slot-alap idő. */
logTime?: string
/** A mentés-CTA felirata (múltbeli nap). Absent = a meglévő felirat. */
saveLabel?: string
```

Task 3 ezekkel hívja a composert.

- [ ] **Step 1: Írd meg a bukó tesztet.** Mintázat: a meglévő `FuelLogPage.test.tsx` mentés-tesztje (mock módban a mentés a `['fuelDay', <date>]` query-cache-be ír; a cache a `useFuelDay(date)` probe-hookkal olvasható vissza ugyanabban a `QueryWrapper`-ben). Teszt-vaz:

```tsx
// MealComposer.logDate.test.tsx — a logDate/logTime dátumozott mentése (mezo-1j3z).
// Mock mód, minden hook valódi; a composer közvetlenül renderelve.
import { render, screen, renderHook, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { QueryWrapper, freshQueryWrapper } from '@/test/queryWrapper' // igazítsd a tényleges exporthoz!
import { useFuelDay } from '@/data/hooks'
import { MealComposer } from './MealComposer'

beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('logDate + logTime: a mentett meal loggedAt-ja a választott nap + idő, a cache a napra kulcsolt', async () => {
  const user = userEvent.setup()
  // EGY közös wrapper-példány kell (közös QueryClient) a composer + probe alá — nézd meg,
  // hogyan csinálja a FuelLogPage.test.tsx mentés-tesztje, és kövesd azt a technikát.
  const wrapper = ({ children }: { children: ReactNode }) => <QueryWrapper>{children}</QueryWrapper>
  render(
    <MealComposer fixedSlot="lunch" logDate="2026-05-19" logTime="13:00"
      prefill={null} onSaved={() => {}} onCancel={() => {}} />,
    { wrapper },
  )
  // adj hozzá egy kamra-tételt a meglévő picker-úton (Kamra forrás-csempe → első tétel → Kész)
  await user.click(screen.getByRole('button', { name: /kamra/i }))
  await user.click((await screen.findAllByRole('button', { name: /hozzáadás/i }))[0])
  await user.click(screen.getByRole('button', { name: /kész/i }))
  await user.click(screen.getByRole('button', { name: /logol|pótl/i }))

  const probe = renderHook(() => useFuelDay('2026-05-19'), { wrapper })
  await waitFor(() => {
    const meals = probe.result.current.fuel.meals
    expect(meals.some(m => m.loggedAt?.startsWith('2026-05-19T13:00'))).toBe(true)
  })
})

test('saveLabel felülírja a mentés-CTA feliratát', () => {
  render(<MealComposer fixedSlot="lunch" saveLabel="✓ Pótlás · aug 30." prefill={null}
    onSaved={() => {}} onCancel={() => {}} />, { wrapper: QueryWrapper })
  expect(screen.getByRole('button', { name: '✓ Pótlás · aug 30.' })).toBeInTheDocument()
})
```

FONTOS: a fenti szelektorok VÁZLATOK — a tényleges gomb-nevekhez (Kamra-csempe aria-label, tétel-hozzáadás, Kész, mentés-CTA) NYISD MEG a `MealComposer.tsx`-t és a meglévő `FuelLogPage.test.tsx`/`KamraPickSheet.test.tsx`-t, és onnan vedd a pontos query-ket. A cache-visszaolvasós technika a `FuelLogPage.test.tsx` „save" tesztjében készen van.

- [ ] **Step 2: Futtasd — bukjon** (`logDate` prop nem létezik → TS hiba / felirat nem található):
`cd frontend && VITE_USE_MOCK=true pnpm exec vitest run src/features/fuel/components/MealComposer.logDate.test.tsx`

- [ ] **Step 3: Implementáld a composerben.**
  1. Props-interfész + destruktúra bővítése (`logDate`, `logTime`, `saveLabel`).
  2. Modul-konstans a fájl tetejére (a szabad blokk MIKOR-alapú idejéhez):

```ts
/** Múltbeli napi mentés idő-komponense, ha az indító nem hoz sajátot (szabad blokk). */
const SLOT_DEFAULT_TIME: Record<MealSlot, string> = {
  breakfast: '08:00', lunch: '13:00', dinner: '19:00', snack: '16:00',
}
```

  3. Hook-hívások dátumozása (a meglévő default-viselkedés megtartásával):

```ts
const { fuel } = useFuelDay(logDate)          // undefined → a hook maga defaultol mára
const { logMeal, draftMealFromAi } = useMealActions(logDate)
```

  4. A mentésben (`loggedAt: nowOffsetIso(),` sor cseréje):

```ts
loggedAt: logDate != null
  ? offsetIso(logDate, logTime ?? SLOT_DEFAULT_TIME[fixedSlot ?? slot])
  : nowOffsetIso(),
```

  (`offsetIso` importálandó a `@/shared/lib/dates`-ből a meglévő `nowOffsetIso` mellé.)
  5. A mentés-CTA feliratánál: `{saveLabel ?? <a meglévő felirat változatlanul>}`.

- [ ] **Step 4: Futtasd — zöld**, majd `VITE_USE_MOCK=false`-szal is; PLUSZ regression: a meglévő LogFlowPage tesztek zöldek maradnak:
`VITE_USE_MOCK=true pnpm exec vitest run src/features/fuel/pages/LogFlowPage.test.tsx src/features/fuel/pages/LogFlowPage.prefill.test.tsx src/features/fuel/pages/LogFlowPage.ai.test.tsx src/features/fuel/pages/FuelLogPage.test.tsx` (és `false`-szal).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/MealComposer.tsx frontend/src/features/fuel/components/MealComposer.logDate.test.tsx
git commit -m "feat(fuel): MealComposer logDate/logTime/saveLabel — dátumozott mentés (mezo-1j3z)"
```

---

### Task 3: FuelLogPage — nap-léptető, Pótlás-hangulat, deep link

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelLogPage.tsx`
- Modify: `frontend/src/styles/prototype.css` (a `.flog-*` szekcióban, ~6350 körül)
- Test: `frontend/src/features/fuel/pages/FuelLogPage.test.tsx` (bővítés)

**Interfaces:**
- Consumes: `asPastDayLane` (Task 1), MealComposer `logDate/logTime/saveLabel` (Task 2), `addDays/localDateString/huMonthDay/huWeekdayFullIso` (`@/shared/lib/dates`), `useSearchParams` (`react-router-dom`).
- Produces: `/fuel/log?d=YYYY-MM-DD` deep link (Task 4 navigál rá).

- [ ] **Step 1: Írd meg a bukó teszteket** a meglévő `FuelLogPage.test.tsx` crafted-plan harnessében (a hoisted `useFuelTimeline`-mock a date-argot ignorálja — múltbeli napra ugyanazt a crafted plant adja, pont jó). Új tesztek (a meglévő `baseCtx`/`mkPlan` segédekkel — olvasd el őket):

```tsx
test('nap-léptető: ‹ visszalép, az oldal Pótlás-hangulatra vált, minden nem-done blokk Pótold', async () => {
  hoisted.plan = mkPlan([
    slotDone('07:30', 'Reggeli'),          // a meglévő segédek szerinti done slot
    slotNow('13:00', 'Ebéd'),
    slotPending('19:00', 'Vacsora'),
  ])
  const user = userEvent.setup()
  renderView()
  await user.click(screen.getByRole('button', { name: 'Előző nap' }))
  expect(screen.getByText('Pótlás')).toBeInTheDocument()
  expect(screen.getByText(/erre a napra könyvelődik/)).toBeInTheDocument()
  // a now + pending ablak is Pótold-ot kap (2 db), MOST stamp nincs
  expect(screen.getAllByRole('button', { name: /^Pótold/ })).toHaveLength(2)
  expect(screen.queryByText('MOST')).not.toBeInTheDocument()
})

test('a ‹ 7 napnál, a › a mai napnál disabled', async () => { /* léptetés 7× ‹, assert disabled; egy ›-vel vissza, ma: › disabled */ })

test('?d= deep link: érvényes tegnapi dátum azon a napon nyit, érvénytelen mára clampel', async () => {
  // renderView-t paraméterezd: initialEntries=[`/fuel/log?d=${addDays(localDateString(), -1)}`] → Pótlás
  // majd initialEntries=['/fuel/log?d=2020-01-01'] → nincs Pótlás (ma)
})

test('múltbeli mentés a választott nap loggedAt-jával, az ablak idejével íródik', async () => {
  // a meglévő „save" teszt mintája: ‹ egyet vissza, Pótold az Ebéd-ablakon, tétel a prefillből,
  // mentés — majd a useFuelDay(addDays(localDateString(),-1)) probe-cache-ben
  // loggedAt.startsWith(`${addDays(localDateString(), -1)}T13:00`)
})

test('nap-váltás bezárja a nyitott composert', async () => { /* Logold nyit ma → ‹ → nincs nyitott composer (MIKOR/„Honnan adod hozzá?" nem látszik) */ })

test('lezárt múltbeli nap: minden done → zsálya kártya, a szabad blokk marad', async () => {
  // csupa done slot; ‹ után: getByText('Minden ablak kész ✓') + „Ablakon kívül" blokk él
})
```

(A `slotDone`/`slotNow`/`slotPending` nevek illusztratívak — a fájl meglévő slot-építőit használd; ha nincsenek, a meglévő tesztek inline slot-objektumait másold.)

- [ ] **Step 2: Futtasd — bukjon.**
`VITE_USE_MOCK=true pnpm exec vitest run src/features/fuel/pages/FuelLogPage.test.tsx`

- [ ] **Step 3: Implementáld a page-et.** Vázlat (a meglévő struktúrába illesztve):

```tsx
const MAX_BACK = 7
const [searchParams] = useSearchParams()
const today = localDateString()
const initialOffset = (() => {
  const d = searchParams.get('d')
  if (!d) return 0
  const diff = Math.round((+new Date(today) - +new Date(d)) / 86_400_000)
  return Number.isFinite(diff) && diff >= 1 && diff <= MAX_BACK ? diff : 0
})()
const [offset, setOffset] = useState(initialOffset)
const date = addDays(today, -offset)
const past = offset > 0

const { fuel } = useFuelDay(date)
const { plan, budget } = useFuelTimeline(date)
const laneRaw = buildWindowLane({ slots: plan.slots, budget, meals: fuel.meals })
const lane = past ? asPastDayLane(laneRaw) : laneRaw

const stepDay = (d: number) => {
  setOpenKey(null); setAiOnMount(false)
  setOffset(o => Math.min(MAX_BACK, Math.max(0, o + d)))
}
```

Hero (a meglévő `mz-page-hero` blokk elejére a léptető, az eyebrow/megjegyzés feltételesen):

```tsx
<MozaikPage tone={past ? 'gold' : 'coral'} className="flog-page">
...
<div className="flog-daysw">
  <button type="button" onClick={() => stepDay(1)} disabled={offset >= MAX_BACK} aria-label="Előző nap">‹</button>
  <span className="flog-dlbl">
    <b>{huMonthDay(date).toLowerCase()}.</b>
    <small>{huWeekdayFullIso(date).toLowerCase()}{past ? '' : ' · ma'}</small>
  </span>
  <button type="button" onClick={() => stepDay(-1)} disabled={offset === 0} aria-label="Következő nap">›</button>
</div>
<div className="mz-eyebrow" style={{ color: past ? 'var(--mz-cell-amber-ink)' : 'var(--coral)' }}>
  {past ? 'Pótlás' : 'Logolás'}
</div>
...
{past && (
  <div className="flog-pastnote"><i aria-hidden="true" />
    Amit itt logolsz, erre a napra könyvelődik — pontszámot is kap.</div>
)}
```

Blokk-lista kiegészítések:
- Lezárt múltbeli nap kártya a lista elejére: `past && lane.tiles.length > 0 && lane.tiles.every(t => t.state === 'done')` → `.flog-dayclosed` div („Minden ablak kész ✓" + „Ez a nap le van zárva — alul még pótolhatsz, ha valami kimaradt.").
- Üres nap MÚLTBAN: a meglévő üres-nap ajtóban a „＋ tervezz" CTA-t `!past` mögé; past-on a meta: „ezen a napon nem volt étkezési ablak".
- Ablak-composer hívás: `logDate={past ? date : undefined} logTime={past ? tile.time : undefined} saveLabel={past ? `✓ Pótlás · ${huMonthDay(date).toLowerCase()}.` : undefined}`.
- Szabad blokk composer: `logDate={past ? date : undefined}` + ugyanaz a saveLabel; meta-sora past-on: „ami még kimaradt erről a napról".

CSS (prototype.css `.flog-*` szekció, a mockup `.daysw/.pastnote/.dayclosed` blokkjai token-fordítva — kb.):

```css
/* nap-léptető (mezo-1j3z) — mockup: fuel-log-multinap .daysw */
.flog-daysw { display: flex; align-items: center; gap: 7px; justify-content: center; margin: 2px 0 6px; }
.flog-daysw button { width: 28px; height: 28px; border-radius: 50%; border: 0.5px solid var(--border-subtle);
  background: var(--surface-0); font-family: inherit; font-size: 14px; color: var(--text-secondary);
  cursor: pointer; display: grid; place-items: center; padding: 0 0 1px; box-shadow: var(--mz-shadow-soft); }
.flog-daysw button:disabled { opacity: 0.3; box-shadow: none; cursor: default; }
.flog-dlbl { min-width: 128px; text-align: center; border-radius: 999px; padding: 4px 14px 5px;
  background: var(--surface-0); border: 0.5px solid var(--border-subtle); }
.flog-dlbl b { display: block; font-size: 12px; font-weight: 800; line-height: 1.25; }
.flog-dlbl small { display: block; font-size: 7.5px; font-weight: 700; color: var(--text-tertiary);
  letter-spacing: 0.12em; text-transform: uppercase; }
.flog-pastnote { display: flex; gap: 6px; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 600; color: var(--mz-cell-amber-ink); margin-top: 5px; }
.flog-pastnote i { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); flex: none; }
.flog-dayclosed { text-align: center; padding: 4px 12px 10px; }
.flog-dayclosed b { display: block; font-size: 13.5px; font-weight: 800; color: var(--mz-cell-sage-ink); }
.flog-dayclosed span { font-size: 10px; color: var(--text-secondary); }
```

A pontos token-neveket (`--mz-shadow-soft`, `--surface-0`, `--mz-cell-amber-ink`, `--gold`…) ELLENŐRIZD a prototype.css-ben — csak LÉTEZŐ tokent használj; ha nincs pontos megfelelő, a szomszédos `.flog-*` szabályok mintáit kövesd. SEMMI hardcodeolt világos hex.

- [ ] **Step 4: Futtasd — zöld mindkét módban** (`FuelLogPage.test.tsx` mindkét env-vel), plusz `pnpm exec vitest run src/styles` tokenguard, ha külön fut — egyébként a teljes fókusz-kör Task 7-ben.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/FuelLogPage.tsx frontend/src/styles/prototype.css frontend/src/features/fuel/pages/FuelLogPage.test.tsx
git commit -m "feat(fuel): nap-léptető + Pótlás-hangulat + ?d= deep link a /fuel/log oldalon (mezo-1j3z)"
```

---

### Task 4: Hub-csali chip (FuelLogHeroTile + FuelMaiPage)

**Files:**
- Modify: `frontend/src/features/fuel/components/FuelLogHeroTile.tsx`
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx`
- Modify: `frontend/src/styles/prototype.css` (a `.fh-lt-*` szekcióban, ~5950 körül)
- Test: `frontend/src/features/fuel/pages/FuelMaiPage.test.tsx` (bővítés)

**Interfaces:**
- Consumes: `asPastDayLane` (Task 1), `/fuel/log?d=` (Task 3), `addDays/localDateString/huMonthDay` (`@/shared/lib/dates`).
- Produces: `FuelLogHeroTileProps.pastHint?: { dateLabel: string; count: number; onOpen: () => void } | null`.

- [ ] **Step 1: Bukó tesztek** a `FuelMaiPage.test.tsx` meglévő hero-tile szekciójában (a hoisted timeline-mock minden dátumra ugyanazt a crafted plant adja — a tegnapi lane = ugyanaz a plan múlt-normalizálva; ezt használd ki):

```tsx
test('hub-csali: tegnapi pótolható ablakok chipje dátummal + darabszámmal, ?d=-re navigál', async () => {
  // crafted plan: 1 done + 1 now + 1 pending → a tegnapi (past-normalizált) lane 2 missed
  // assert: button name pl. /pótolható/ és a szövege tartalmazza `${huMonthDay(addDays(localDateString(), -1)).toLowerCase()}.` + '2 ablak pótolható'
  // click → a router a /fuel/log?d=<tegnap> útvonalra visz (route-probe, mint a meglévő navigációs tesztek)
})

test('hub-csali: ha tegnap minden ablak done, nincs chip', async () => {
  // csupa done crafted plan → queryByRole(/pótolható/) null
})
```

- [ ] **Step 2: Futtasd — bukjon.** `VITE_USE_MOCK=true pnpm exec vitest run src/features/fuel/pages/FuelMaiPage.test.tsx`

- [ ] **Step 3: Implementáld.**
FuelLogHeroTile — props + render a `.fh-lt-dline` UTÁN:

```tsx
export interface FuelLogHeroTileProps {
  vm: WindowLaneVM
  onOpen: () => void
  /** Tegnapi pótolható ablakok csali-chipje; null/undefined = nincs chip. */
  pastHint?: { dateLabel: string; count: number; onOpen: () => void } | null
}
...
{pastHint && (
  <span className="fh-lt-pastwrap">
    <button type="button" className="fh-lt-past"
      aria-label={`Pótlás · ${pastHint.dateLabel} · ${pastHint.count} ablak pótolható`}
      onClick={e => { e.stopPropagation(); pastHint.onOpen() }}>
      ↺ {pastHint.dateLabel} · {pastHint.count} ablak pótolható
    </button>
  </span>
)}
```

FONTOS: a `FuelLogHeroTile` gyökere jelenleg `<button>` — HTML-ben button nem ágyazható buttonbe! A gyökér-elemet alakítsd `div role="button" tabIndex={0}`-ra Enter/Space kezelővel (a retired WindowLane/`logtile` prototípus-minta), VAGY a chipet rendereld a gyökér-button UTÁN egy wrapper-divben a komponensen belül. Az egyszerűbb, ami a meglévő teszteket nem töri: a komponens gyökere legyen `<div className="fh-logtile-wrap">`, benne a meglévő button (className marad `fh-logtile`) + alatta a chip. Ellenőrizd a meglévő FuelMaiPage-tesztek query-jeit (`getByRole('button', { name: 'Logolás' })` — ez így megmarad).

FuelMaiPage — a tegnapi kompozíció + bekötés:

```tsx
const yesterday = addDays(localDateString(), -1)
const { fuel: fuelY } = useFuelDay(yesterday)
const { plan: planY, budget: budgetY } = useFuelTimeline(yesterday)
const laneY = asPastDayLane(buildWindowLane({ slots: planY.slots, budget: budgetY, meals: fuelY.meals }))
const yMissed = laneY.tiles.filter(t => t.state === 'missed').length
...
<FuelLogHeroTile vm={lane} onOpen={() => navigate('/fuel/log')}
  pastHint={yMissed > 0 ? {
    dateLabel: `${huMonthDay(yesterday).toLowerCase()}.`,
    count: yMissed,
    onOpen: () => navigate(`/fuel/log?d=${yesterday}`),
  } : null} />
```

CSS (a `.fh-lt-*` blokk végére; borostyán wash, tokenekkel):

```css
.fh-lt-pastwrap { display: block; margin-top: 9px; }
.fh-lt-past { border: none; font-family: inherit; cursor: pointer; display: inline-flex; gap: 5px;
  align-items: center; font-size: 9.5px; font-weight: 700; color: var(--mz-cell-amber-ink);
  background: color-mix(in srgb, var(--gold) 14%, transparent); border-radius: 999px; padding: 5px 12px; }
```

(Tokeneket itt is ellenőrizd; kövesd a szomszédos `.fh-lt-*` szabályok nyelvét.)

- [ ] **Step 4: Futtasd — zöld mindkét módban** (`FuelMaiPage.test.tsx` mindkét env-vel; a hero-tile meglévő 6 tesztje is zöld marad).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/FuelLogHeroTile.tsx frontend/src/features/fuel/pages/FuelMaiPage.tsx frontend/src/styles/prototype.css frontend/src/features/fuel/pages/FuelMaiPage.test.tsx
git commit -m "feat(fuel): hub-csali chip a tegnapi pótolható ablakokról (mezo-1j3z)"
```

---

### Task 5: Prototípus-műtermék véglegesítése

**Files:**
- Create: `docs/design_2.0/prototypes/src/fuel-log-multinap-head.html`, `docs/design_2.0/prototypes/src/fuel-log-multinap-body.html`
- Create (generált): `docs/design_2.0/prototypes/fuel-log-multinap.html`
- Modify: `docs/design_2.0/prototypes/build.sh` (új cat-sor + a záró echo „17 prototype files"), `docs/design_2.0/prototypes/README.md` (új sor a táblázatba, a fuel-logolas sor mintájára)
- Delete: `docs/design_2.0/prototypes/fuel-log-multinap.WIP.html`

**Interfaces:** nincs kód-fogyasztó; a spec §7 műtermék-követelménye.

- [ ] **Step 1:** A repo-gyökérben álló `docs/design_2.0/prototypes/fuel-log-multinap.WIP.html` a kész, jóváhagyott assembled fájl. Bontsd szét src-párrá: a head rész = az első `</style>`-ig bezárólag MINUSZ a két inline `<svg>` sprite-blokk (`clay-icons`/`clay-spots` — ezek a `../assets/*.svg`-ből jönnek build-kor); a body = a sprite-blokkok utáni második `<style>`-tól a fájl végéig. A LEGBIZTOSABB út: a meglévő `src/fuel-log-head.html`-t másold `src/fuel-log-multinap-head.html`-re és CSAK a `<title>`-t írd át („Fuel · Múltbeli napra logolás"), a body-t pedig a WIP-ből vágd ki: a WIP-ben a body pontosan a `sed -n '/^<style>$/,$p'` MÁSODIK style-blokktól tart — ellenőrizd diff-fel, hogy a kivágott body + head + sprite-ok cat-ja byte-azonos a WIP-pel.
- [ ] **Step 2:** `build.sh`: új sor a fuel-log sor után:

```bash
cat src/fuel-log-multinap-head.html "$A/clay-icons.svg" "$A/clay-spots.svg" src/fuel-log-multinap-body.html > fuel-log-multinap.html
```

és a záró `echo "OK — 16 prototype files assembled."` → `17`.
- [ ] **Step 3:** Futtasd a `./build.sh`-t; diff-eld az eredmény `fuel-log-multinap.html`-t a WIP-pel (`diff fuel-log-multinap.html fuel-log-multinap.WIP.html` — csak a `<title>` térhet el, ha a head-másolás útját választottad; ha eltér, addig igazíts, míg a tartalom egyezik). Töröld a WIP-et.
- [ ] **Step 4:** README-sor (a meglévő táblázat fuel-logolas sora alapján): fájlnév, egy mondat („A /fuel/log nap-léptetője + Pótlás-hangulat + hub-csali — mezo-1j3z"), artifact-oszlop üresen/`—`.
- [ ] **Step 5: Commit**

```bash
git add docs/design_2.0/prototypes
git rm docs/design_2.0/prototypes/fuel-log-multinap.WIP.html 2>/dev/null; true
git commit -m "docs(design2): fuel-log-multinap prototípus a családba (mezo-1j3z)"
```

---

### Task 6: Docs — fuel.md + CODEMAP

**Files:**
- Modify: `docs/features/fuel.md`
- Regenerate: `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`)

**Interfaces:** a knowledge-base skill konvenciói (frontmatter `updated`, key_files).

- [ ] **Step 1: fuel.md szerkesztések.**
  - §9 deferred bullet — a „**DEFERRED — no meal-window log path exists for a past day.**" bullet (jelenleg ~364. sor) átírása RESOLVED-ra: „**RESOLVED (mezo-1j3z, 2026-08-31)** — a /fuel/log nap-léptetőt kapott (max 7 nap vissza, `?d=` deep link); múltbeli napon a lane `asPastDayLane`-nel missed-re normalizálódik, a mentés `offsetIso(date, time)`-mal a választott napra íródik (`MealComposer.logDate/logTime`), a hub csali-chipet mutat a tegnapi pótolhatókról. Backend-változás nem kellett — a `MealRequest.loggedAt` mindig is elfogadta a múltat."
  - A /fuel/log route-leírásnál (§2 route-tábla + a mezo-byo1 §60-környéki bekezdés) egészítsd ki egy-egy mondattal a nap-léptetőt és a `?d=` paramétert.
  - A `MealComposer`-t leíró bekezdésbe (mezo-byo1 jegyzet §90 körül) egy mondat a `logDate/logTime/saveLabel` propokról.
  - Frontmatter: `updated: 2026-08-31` (már ez van — hagyd), key_files közé a spec-fájl útja, ha a lista specekre hivatkozik (kövesd a meglévő mintát).
- [ ] **Step 2:** `node scripts/gen-codemap.mjs` a repo-gyökérből; add a diffet.
- [ ] **Step 3:** `node scripts/lint-docs.mjs --errors-only` → PASS (a stale-findingok advisory-k — NE frissíts nem-érintett docsokat).
- [ ] **Step 4: Commit**

```bash
git add docs/features/fuel.md docs/CODEMAP.md
git commit -m "docs(fuel): múltbeli napra logolás — §9 resolved + route/composer jegyzetek (mezo-1j3z)"
```

---

### Task 7: Kapuk + vizuális goldenek (darwin)

**Files:**
- Esetleg módosul: `frontend/tests/visual/*-snapshots/*` (fuel goldenek, darwin)

- [ ] **Step 1: Teljes frontend teszt-kör MINDKÉT módban** (a worktree-ben, 128 GB-os gépen ez fut):

```bash
cd frontend && VITE_USE_MOCK=true pnpm exec vitest run && VITE_USE_MOCK=false pnpm exec vitest run
```

Expected: minden zöld. Ha bukik: javítsd, commitold a javítást.
- [ ] **Step 2: Build + típusok:** `pnpm --dir frontend build` → zöld.
- [ ] **Step 3: Vizuális goldenek (darwin, CSAK fuel):**

```bash
cd frontend && pnpm exec playwright test --config tests/visual/playwright.config.ts -g "fuel" --update-snapshots
```

FIGYELEM (memória: visual-goldens-stale-server-silent-pass): előtte `pkill -f 'vite.*4318'`, és a kimenetben a „writing actual" sorokat nézd, ne a „passed"-et; `ls -lT` mtime-mal ellenőrizd, hogy a fuel goldenek TÉNYLEG frissültek. Utána `git status` — CSAK fuel-goldenek változhattak (más golden változása = untargeted futás, revertáld: `git checkout -- <nem-fuel goldenek>`).
- [ ] **Step 4: Layout-invariánsok:** `pnpm exec playwright test --config tests/visual/playwright.config.ts layout.spec.ts` → zöld.
- [ ] **Step 5: Commit**

```bash
git add frontend/tests/visual
git commit -m "test(visual): fuel goldenek a nap-léptetős /fuel/log-hoz (darwin) (mezo-1j3z)"
```

---

## Merge-pálya (a fő session végzi, nem subagent)

1. `git push -u origin feat/fuel-multinap-log` → `gh pr create` (self-PR, CI-gate).
2. Linux goldenek: `gh workflow run update-visual-baselines.yml -r feat/fuel-multinap-log` → a bot-commit után ÜRES commit a CI triggeréhez (bot push nem triggerel); ha a run `action_required`: `gh api -X POST repos/mrkuhne/mezo/actions/runs/<id>/approve`.
3. CI zöld (5 check) → main worktree-ben: `git pull --rebase` ELŐBB, majd `git merge --no-ff feat/fuel-multinap-log` → `git push` (detached temp-worktree recept, ha a fő checkout foglalt).
4. `bd close mezo-1j3z` + `bd dolt push`; remote branch törlés.
