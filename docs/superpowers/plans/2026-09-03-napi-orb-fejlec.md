# DayOrb — a fejléc Mezo-orbja napi állapotjelzőként · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fejléc jobb szélső „Profil" gombja helyére egy szürke Mezo-orb kerül, ami alulról fölfelé telik meg a nap rögzített jelei szerint, a kitöltés színének telítettsége a nap minőségét hordozza, és koppintásra a mai nap-oldalra visz.

**Architecture:** Három réteg, szigorú határokkal. (1) `dayOrbFill.ts` — pure, React-mentes függvény: jel-flagek + naptípus + napi pont → `{ present, denominator, pct, intensity }`. (2) `useDayOrbFill.ts` — az EGYETLEN hely, ahol a hét jel olvasása történik; a shellben már futó lekérdezéseket komponálja, két új olvasással (súly, napló). (3) `DayOrb.tsx` — buta SVG-prezentáció, csak `pct`/`intensity`/`size`. A `AppHeader` a `nap-avatar` gomb tartalmát cseréli; backend nem változik.

**Tech Stack:** React 18 + TypeScript, TanStack Query (`useDualQuery`), Vitest + Testing Library, SVG + a meglévő clay sprite-készlet, CSS a `frontend/src/styles/prototype.css`-ben.

**Spec:** [`docs/superpowers/specs/2026-09-03-napi-orb-fejlec-design.md`](../specs/2026-09-03-napi-orb-fejlec-design.md) · **bd:** mezo-idz2

## Global Constraints

- **Sprite-ot NEM szerkesztünk.** `frontend/src/shared/ui/clay/clay-spots.svg` és `clay-icons.svg` 1:1 asset-kontraktus (`frontend/src/shared/ui/clay/index.tsx:3`). A `DayOrb` a meglévő `#s-orb` szimbólumot használja `<use>`-szal.
- **Backend nem változik.** Nincs új endpoint, nincs contract-fragment, nincs `api.gen.ts` regenerálás. Ha egy lépés backendet érintene, az hiba — állj meg és jelezd.
- **Minden olvasás `@/data/hooks`-ból jön**, soha nem per-domain mély importtal (`frontend/src/data/hooks.ts` az egyetlen FE↔data határ). Az `AppHeader.tsx:19` meglévő `@/data/notification/feedHooks` importja szabálysértés — **ne másold**.
- **Nincs mód-elágazás feature-kódban.** `isMockMode()` a `data/` rétegben él; a `features/` és `app/` kód mód-agnosztikus.
- **`VITE_USE_MOCK` üresen = mock mód.** Minden teszt-futtatást MINDKÉT módban külön kell futtatni; a csupasz `pnpm test` kétszer mockot futtat.
- **Magyar szövegek inline vagy `*_COPY` konstansban** — nincs i18n keretrendszer.
- **Dátum-összehasonlítás ISO stringgel**, `localDateString()` / `addDays()` / `mondayOf()` a `@/shared/lib/dates`-ből.
- **Tónus-végpontok (verbatim):** kifakult `#F3E2D9` / `#E3BDAB` / `#C69C89`, telt `#FFC3A8` / `#FF7A55` / `#D8481F`.
- **Orb-geometria (verbatim):** a `#s-orb` teste `circle cx=50 cy=48 r=34`, tehát a kitöltés y-ban `82` (alja) és `14` (teteje) közt fut; `fillY = 82 − pct/100 × 68`.
- **Intenzitás-küszöbök (verbatim):** 45 pont alatt 0, 92 pont fölött 1, közte lineáris.

---

## File Structure

**Létrehozandó**

| Fájl | Felelősség |
|---|---|
| `frontend/src/features/today/logic/dayOrbFill.ts` | Pure. A hét jel + naptípus + napi pont → töltöttség és intenzitás. Nincs React, nincs dátum-olvasás, nincs `Date`. |
| `frontend/src/features/today/logic/dayOrbFill.test.ts` | A pure modul tesztje. |
| `frontend/src/features/today/logic/useDayOrbFill.ts` | A hét jel EGYETLEN olvasási pontja; a pure modult hívja. |
| `frontend/src/features/today/logic/useDayOrbFill.test.tsx` | A hook tesztje mock módban. |
| `frontend/src/shared/ui/DayOrb.tsx` | Buta SVG-prezentáció. |
| `frontend/src/shared/ui/DayOrb.test.tsx` | A komponens tesztje. |

**Módosítandó**

| Fájl | Mit |
|---|---|
| `frontend/src/app/AppHeader.tsx:153-156` | A `nap-avatar` gomb tartalma és célja. |
| `frontend/src/app/hubHeaders.test.tsx:38-43` | `BASE_CONTROLS` — a `'Profil'` label cseréje. |
| `frontend/src/app/AppHeader.test.tsx` | A profil-navigáció assertje. |
| `frontend/src/styles/prototype.css:4559` | `.nap-avatar` + új `.dayorb-*` szabályok. |
| `frontend/src/data/me/sleep.ts` | Mai dátumú alvás-sor a seedhez. |
| `frontend/src/data/me/goals.ts:141` | Mai dátumú súly-sor a seedhez. |
| `frontend/src/data/journal/journalMock.ts` | Mai dátumú napló-sor a seedhez. |
| `frontend/src/data/train/train.ts:1048` | Mai dátumú sport-session a seedhez. |
| `frontend/src/data/train/trainHooks.ts:910` | `gymDoneDates` mock-ága. |
| `docs/features/today.md` | A fejléc 6. elemének leírása. |
| `docs/CODEMAP.md` | Regenerálva. |

---

### Task 1: `dayOrbFill` — a pure töltöttség-modul

**Files:**
- Create: `frontend/src/features/today/logic/dayOrbFill.ts`
- Test: `frontend/src/features/today/logic/dayOrbFill.test.ts`

**Interfaces:**
- Consumes: semmit (ez az első task).
- Produces:
  ```ts
  export interface DayOrbSignals {
    sleep: boolean; weight: boolean; fuel: boolean
    gym: boolean; sport: boolean; checkin: boolean; journal: boolean
  }
  export interface DayOrbPlan { gymPlanned: boolean; sportPlanned: boolean }
  export interface DayOrbFill { present: number; denominator: number; pct: number; intensity: number }
  export function dayOrbFill(
    signals: DayOrbSignals, plan: DayOrbPlan, score: number | null,
  ): DayOrbFill
  export const NEUTRAL_INTENSITY = 0.5
  ```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/today/logic/dayOrbFill.test.ts`:

```ts
import { dayOrbFill, NEUTRAL_INTENSITY, type DayOrbSignals, type DayOrbPlan } from '@/features/today/logic/dayOrbFill'

const none: DayOrbSignals = {
  sleep: false, weight: false, fuel: false,
  gym: false, sport: false, checkin: false, journal: false,
}
const restDay: DayOrbPlan = { gymPlanned: false, sportPlanned: false }
const gymDay: DayOrbPlan = { gymPlanned: true, sportPlanned: false }
const fullDay: DayOrbPlan = { gymPlanned: true, sportPlanned: true }

test('pihenőnapon öt jel a nevező — az edzés és a sport nem tartozik a naphoz', () => {
  expect(dayOrbFill(none, restDay, null).denominator).toBe(5)
})

test('edzésnapon hat, edzés+sport napon hét a nevező', () => {
  expect(dayOrbFill(none, gymDay, null).denominator).toBe(6)
  expect(dayOrbFill(none, fullDay, null).denominator).toBe(7)
})

test('egy nem tervezett, de LOGOLT sport belép a nevezőbe ÉS a számlálóba — sosem ronthat', () => {
  const withSport = dayOrbFill({ ...none, sport: true }, restDay, null)
  expect(withSport.denominator).toBe(6)
  expect(withSport.present).toBe(1)
  // 1/6 > 0/5 — a spontán mozgás nem húzhatja lejjebb a töltöttséget
  expect(withSport.pct).toBeGreaterThan(dayOrbFill(none, restDay, null).pct)
})

test('egy nem tervezett, de logolt edzés ugyanígy viselkedik', () => {
  const withGym = dayOrbFill({ ...none, gym: true }, restDay, null)
  expect(withGym.denominator).toBe(6)
  expect(withGym.present).toBe(1)
})

test('egy tervezett, de nem logolt edzés a nevezőben van, a számlálóban nincs', () => {
  const r = dayOrbFill({ ...none, sleep: true }, gymDay, null)
  expect(r.denominator).toBe(6)
  expect(r.present).toBe(1)
})

test('minden jel egyet ér — nincs súlyozás', () => {
  const onlyJournal = dayOrbFill({ ...none, journal: true }, restDay, null)
  const onlyWeight = dayOrbFill({ ...none, weight: true }, restDay, null)
  expect(onlyJournal.pct).toBe(onlyWeight.pct)
})

test('a teljes pihenőnap 100%', () => {
  const all: DayOrbSignals = {
    sleep: true, weight: true, fuel: true, checkin: true, journal: true,
    gym: false, sport: false,
  }
  expect(dayOrbFill(all, restDay, null)).toMatchObject({ present: 5, denominator: 5, pct: 100 })
})

test('a pct kerekített egész', () => {
  const r = dayOrbFill({ ...none, sleep: true }, fullDay, null)
  expect(r.pct).toBe(14) // 1/7 = 14.28…
  expect(Number.isInteger(r.pct)).toBe(true)
})

test('45 pont alatt az intenzitás 0, 92 fölött 1', () => {
  expect(dayOrbFill(none, restDay, 30).intensity).toBe(0)
  expect(dayOrbFill(none, restDay, 45).intensity).toBe(0)
  expect(dayOrbFill(none, restDay, 92).intensity).toBe(1)
  expect(dayOrbFill(none, restDay, 100).intensity).toBe(1)
})

test('a 45 és 92 közti pont lineárisan interpolál', () => {
  // 68.5 a felezőpont: (68.5 − 45) / 47 = 0.5
  expect(dayOrbFill(none, restDay, 68.5).intensity).toBeCloseTo(0.5, 5)
})

test('null pont (COMPANION_SWITCH ki, vagy „tanulom") → semleges intenzitás', () => {
  expect(dayOrbFill(none, restDay, null).intensity).toBe(NEUTRAL_INTENSITY)
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/logic/dayOrbFill.test.ts
```

Elvárt: FAIL — `Failed to resolve import "@/features/today/logic/dayOrbFill"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/today/logic/dayOrbFill.ts`:

```ts
// ============================================================
// Mezo · dayOrbFill — a fejléc DayOrb-jának két tengelye, tisztán (mezo-idz2).
// MAGASSÁG: hány napi jel van már rögzítve, a nap ALKALMAZANDÓ jeleihez képest.
// SZÍN: a napi pontból számolt telítettség — külön tengely, sosem keveredik a magassággal.
// Pure: nincs `Date`, nincs olvasás, nincs React. A hívó (useDayOrbFill) dönti el,
// mi számít „jelen lévőnek"; ez a modul csak a számtant tartja.
// Spec: docs/superpowers/specs/2026-09-03-napi-orb-fejlec-design.md
// ============================================================

/** A hét napi jel jelen/hiány állapota. Minden mező: „ma rögzítve van-e". */
export interface DayOrbSignals {
  sleep: boolean
  weight: boolean
  fuel: boolean
  gym: boolean
  sport: boolean
  checkin: boolean
  journal: boolean
}

/** A nap terve — csak a két feltételes jelre. */
export interface DayOrbPlan {
  gymPlanned: boolean
  sportPlanned: boolean
}

export interface DayOrbFill {
  /** Hány alkalmazandó jel van rögzítve. */
  present: number
  /** Hány jel tartozik ehhez a naphoz (5–7). */
  denominator: number
  /** `present / denominator`, kerekített egész százalék. */
  pct: number
  /** 0…1 — a kitöltés színének telítettsége. */
  intensity: number
}

/** Napi pont híján (COMPANION_SWITCH ki, vagy <2 subscore = „tanulom") az orb
 *  se nem dicsér, se nem büntet: középen szól. */
export const NEUTRAL_INTENSITY = 0.5

const INTENSITY_FLOOR = 45
const INTENSITY_CEIL = 92

/** Az öt feltétlen jel — minden napon a nevezőben van. */
const ALWAYS: readonly (keyof DayOrbSignals)[] = ['sleep', 'weight', 'fuel', 'checkin', 'journal']

/** Az edzés és a sport akkor tartozik a naphoz, ha a TERV szerint jár VAGY ha ma
 *  tényleg logoltál ilyet. A második ág azért kell, hogy egy spontán séta egy nem
 *  tervezett napon a nevezőbe ÉS a számlálóba is belépjen — így sosem ronthat. */
function conditionalApplies(planned: boolean, logged: boolean): boolean {
  return planned || logged
}

export function dayOrbFill(
  signals: DayOrbSignals,
  plan: DayOrbPlan,
  score: number | null,
): DayOrbFill {
  let denominator = ALWAYS.length
  let present = ALWAYS.reduce((n, key) => (signals[key] ? n + 1 : n), 0)

  if (conditionalApplies(plan.gymPlanned, signals.gym)) {
    denominator += 1
    if (signals.gym) present += 1
  }
  if (conditionalApplies(plan.sportPlanned, signals.sport)) {
    denominator += 1
    if (signals.sport) present += 1
  }

  return {
    present,
    denominator,
    pct: Math.round((present / denominator) * 100),
    intensity: intensityFor(score),
  }
}

function intensityFor(score: number | null): number {
  if (score === null) return NEUTRAL_INTENSITY
  if (score <= INTENSITY_FLOOR) return 0
  if (score >= INTENSITY_CEIL) return 1
  return (score - INTENSITY_FLOOR) / (INTENSITY_CEIL - INTENSITY_FLOOR)
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/features/today/logic/dayOrbFill.test.ts
```

Elvárt: PASS, 11 teszt.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/today/logic/dayOrbFill.ts frontend/src/features/today/logic/dayOrbFill.test.ts
git commit -m "feat(today): dayOrbFill — a napi orb töltöttség-számtana (mezo-idz2)"
```

---

### Task 2: `DayOrb` — a glif

**Files:**
- Create: `frontend/src/shared/ui/DayOrb.tsx`
- Test: `frontend/src/shared/ui/DayOrb.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (a `.nap-avatar` szabály után, kb. `:4560`)

**Interfaces:**
- Consumes: semmit a Task 1-ből (a komponens buta, `pct`/`intensity` számokat kap).
- Produces:
  ```ts
  export function DayOrb(props: { pct: number; intensity: number; size?: number }): JSX.Element
  ```
  A `size` alapértéke `40` (a `.nap-avatar` mérete).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/shared/ui/DayOrb.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { DayOrb } from '@/shared/ui/DayOrb'

/** A `#s-orb` teste y-ban 14…82 közt fut; a clip-rect teteje `82 − pct/100 × 68`. */
function clipTop(container: HTMLElement): number {
  const rect = container.querySelector('clipPath rect')
  return Number(rect?.getAttribute('y'))
}

test('0%-on nincs kitöltés és nincs menisz — csak a szürke alap', () => {
  const { container } = render(<DayOrb pct={0} intensity={0.5} />)
  expect(container.querySelectorAll('use')).toHaveLength(1)
  expect(container.querySelector('use')).toHaveClass('dayorb-base')
  expect(container.querySelector('.dayorb-meniscus')).toBeNull()
})

test('részleges töltésnél a clip teteje a pct-ből jön', () => {
  const { container } = render(<DayOrb pct={50} intensity={0.5} />)
  expect(clipTop(container)).toBeCloseTo(48, 5) // 82 − 0.5 × 68
})

test('0%-on a clip teteje az orb alja, 100%-on a teteje', () => {
  expect(clipTop(render(<DayOrb pct={0} intensity={0.5} />).container)).toBeCloseTo(82, 5)
  expect(clipTop(render(<DayOrb pct={100} intensity={0.5} />).container)).toBeCloseTo(14, 5)
})

test('100%-on nincs menisz — a felszín nem látszik, ha tele van', () => {
  const { container } = render(<DayOrb pct={100} intensity={1} />)
  expect(container.querySelector('.dayorb-meniscus')).toBeNull()
})

test('részleges töltésnél VAN menisz', () => {
  const { container } = render(<DayOrb pct={40} intensity={0.5} />)
  expect(container.querySelector('.dayorb-meniscus')).not.toBeNull()
})

test('intensity=0 a kifakult végpontot adja, intensity=1 a teltet', () => {
  const stops = (i: number) =>
    [...render(<DayOrb pct={100} intensity={i} />).container.querySelectorAll('stop')]
      .map((s) => s.getAttribute('stop-color'))
  expect(stops(0)).toEqual(['#f3e2d9', '#e3bdab', '#c69c89'])
  expect(stops(1)).toEqual(['#ffc3a8', '#ff7a55', '#d8481f'])
})

test('a pct a 0…100 tartományra szorul', () => {
  expect(clipTop(render(<DayOrb pct={-20} intensity={0.5} />).container)).toBeCloseTo(82, 5)
  expect(clipTop(render(<DayOrb pct={140} intensity={0.5} />).container)).toBeCloseTo(14, 5)
})

test('két példány clipPath id-je különbözik — a defs nem ütközik', () => {
  const { container } = render(
    <><DayOrb pct={30} intensity={0.5} /><DayOrb pct={70} intensity={0.5} /></>,
  )
  const ids = [...container.querySelectorAll('clipPath')].map((c) => c.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('a svg dekoratív — a gomb adja az akadálymentes nevet', () => {
  const { container } = render(<DayOrb pct={30} intensity={0.5} />)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/shared/ui/DayOrb.test.tsx
```

Elvárt: FAIL — `Failed to resolve import "@/shared/ui/DayOrb"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/shared/ui/DayOrb.tsx`:

```tsx
// ============================================================
// Mezo · DayOrb — a fejléc napi állapotjelzője (mezo-idz2).
// A meglévő `#s-orb` clay sprite szürkén, alulról fölfelé kitöltve. A sprite-hoz NEM
// nyúlunk (1:1 asset-kontraktus, shared/ui/clay/index.tsx): az alap egy `<use>` szürke-
// szűrővel, a kitöltés az orb testének újrarajzolása a nap tónusával, clipPath-be zárva.
// Buta prezentáció: a számokat a `useDayOrbFill` hook adja.
// ============================================================
import { useId } from 'react'

/** A `#s-orb` teste: `circle cx=50 cy=48 r=34` → y-ban 14…82. */
const ORB_TOP = 14
const ORB_BOTTOM = 82
const ORB_SPAN = ORB_BOTTOM - ORB_TOP

/** A tónus két végpontja. A telt hármas maga az `sg-orb` gradiens a sprite-ból. */
const PALE = ['#f3e2d9', '#e3bdab', '#c69c89'] as const
const FULL = ['#ffc3a8', '#ff7a55', '#d8481f'] as const

function lerpHex(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  let out = '#'
  for (let i = 0; i < 3; i++) {
    const v = Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t)
    out += v.toString(16).padStart(2, '0')
  }
  return out
}

interface DayOrbProps {
  /** 0…100 — mennyit tudunk a napról. */
  pct: number
  /** 0…1 — a nap minőségéből számolt telítettség. */
  intensity: number
  size?: number
}

export function DayOrb({ pct, intensity, size = 40 }: DayOrbProps) {
  const uid = useId().replace(/:/g, '')
  const clipped = Math.max(0, Math.min(100, pct))
  const fillY = ORB_BOTTOM - (clipped / 100) * ORB_SPAN
  const t = Math.max(0, Math.min(1, intensity))
  const stops = [lerpHex(PALE[0], FULL[0], t), lerpHex(PALE[1], FULL[1], t), lerpHex(PALE[2], FULL[2], t)]

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="dayorb">
      <defs>
        <clipPath id={`dayorb-fill-${uid}`}>
          <rect x="0" y={fillY} width="100" height={100 - fillY} />
        </clipPath>
        <clipPath id={`dayorb-body-${uid}`}>
          <circle cx="50" cy="48" r="34" />
        </clipPath>
        <radialGradient id={`dayorb-grad-${uid}`} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.45" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </radialGradient>
      </defs>

      <use href="#s-orb" className="dayorb-base" />

      {clipped > 0 && (
        <g clipPath={`url(#dayorb-fill-${uid})`} className="dayorb-fill">
          <ellipse cx="50" cy="90" rx="26" ry="6" fill={stops[2]} opacity="0.28" />
          <circle cx="50" cy="48" r="34" fill={`url(#dayorb-grad-${uid})`} />
          <ellipse cx="37" cy="32" rx="12" ry="8" fill="rgba(255,255,255,0.55)" transform="rotate(-24 37 32)" />
          <path d="M27 61a28 28 0 0 0 13 11" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}

      {clipped > 0 && clipped < 100 && (
        <g clipPath={`url(#dayorb-body-${uid})`}>
          <rect className="dayorb-meniscus" x="8" y={fillY - 1} width="84" height="2" rx="1" fill={stops[2]} opacity="0.7" />
        </g>
      )}
    </svg>
  )
}
```

- [ ] **Step 4: Add the CSS**

A `frontend/src/styles/prototype.css`-ben, közvetlenül a `.nap-avatar` szabály UTÁN (kb. `:4560`) szúrd be:

```css
/* DayOrb (mezo-idz2) — a fejléc napi állapotjelzője. Az alap a `#s-orb` szürkén;
   a kitöltés magassága a `clipPath` rect y-ja, ami új adatnál átcsúszik. */
.dayorb { display: block; }
.dayorb-base { filter: grayscale(1) brightness(1.28) contrast(0.55); opacity: 0.55; }
.dayorb rect { transition: y 0.45s cubic-bezier(0.25, 0.8, 0.35, 1), height 0.45s cubic-bezier(0.25, 0.8, 0.35, 1); }
@media (prefers-reduced-motion: reduce) { .dayorb rect { transition: none; } }
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd frontend && pnpm vitest run src/shared/ui/DayOrb.test.tsx
```

Elvárt: PASS, 9 teszt.

- [ ] **Step 6: Verify the CSS file is still structurally sound**

A `prototype.css` egy 8800+ soros fájl, aminek a szerkezetét egy teszt őrzi (négyszer tört már el csendben merge-konfliktuson).

```bash
cd frontend && pnpm vitest run src/shared/ui/mozaik/prototypeCssStructure.test.ts
```

Elvárt: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/ui/DayOrb.tsx frontend/src/shared/ui/DayOrb.test.tsx frontend/src/styles/prototype.css
git commit -m "feat(ui): DayOrb — alulról töltődő Mezo-orb glif (mezo-idz2)"
```

---

### Task 3: Mock-seed paritás — a hét jel mock módban is él

**Files:**
- Modify: `frontend/src/data/me/sleep.ts`
- Modify: `frontend/src/data/me/goals.ts` (a `weightLog` tömb vége)
- Modify: `frontend/src/data/journal/journalMock.ts`
- Modify: `frontend/src/data/train/train.ts` (a `sessions` tömb eleje, `:1048` környéke)
- Modify: `frontend/src/data/train/trainHooks.ts:910`

**Interfaces:**
- Consumes: semmit.
- Produces: mock módban a mai napra létező alvás-, súly-, napló-, sport- és gym-adat. A Task 4 hookja erre támaszkodik a teszteléskor.

**Miért kell:** a seedek fix 2026-05 / 07 / 08 dátumokra vannak pinelve, a `gymDoneDates` mock-ága pedig üres tömb. Dátum-egyezéssel a DayOrb mock módban ~2/7-en állna, és a fejlesztői felület hazudna. **A javítás a seedek kiegészítése — SOHA nem a dátum-ellenőrzés elhagyása a hookban.**

- [ ] **Step 1: Add a today-dated sleep row**

`frontend/src/data/me/sleep.ts` — a `sleepLog` tömb VÉGÉRE (a tömb dátum szerint növekvő):

```ts
// mezo-idz2: a DayOrb (és minden mai-napra néző fogyasztó) mock módban is lásson
// tegnap éjszakát. Dátum-relatív, hogy ne avuljon el — a fenti sorok szándékosan
// fix dátumúak, mert a hét/hónap nézetek görbéi rájuk épülnek.
  { date: localDateString(), bedtime: '23:20', wakeup: '06:30', duration: 7.1, quality: 7, awakenings: 1, mealToSleep: 120, notes: null },
```

A fájl tetejére kell az import:

```ts
import { localDateString } from '@/shared/lib/dates'
```

- [ ] **Step 2: Add a today-dated weight row**

`frontend/src/data/me/goals.ts` — a `weightLog` tömb VÉGÉRE:

```ts
  // mezo-idz2: mai súly, hogy a DayOrb súly-jele mock módban is jelen legyen.
  { date: localDateString(), value: 78.4 },
```

Ha a fájlban még nincs, add hozzá az importot:

```ts
import { localDateString } from '@/shared/lib/dates'
```

- [ ] **Step 3: Add a today-dated journal note**

`frontend/src/data/journal/journalMock.ts` — a `mockJournalNotes` tömb ELEJÉRE (a lista newest-first):

```ts
  {
    id: 'jn-today',
    // mezo-idz2: dátum-relatív mai bejegyzés — a DayOrb napló-jele mock módban is jelen van.
    occurredOn: localDateString(),
    text: 'Ma jólesett a délutáni séta — utána sokkal tisztább fejjel ültem vissza dolgozni.',
    source: 'quickinput',
    createdAt: `${localDateString()}T18:40:00Z`,
  },
```

Import a fájl tetejére:

```ts
import { localDateString } from '@/shared/lib/dates'
```

- [ ] **Step 4: Add a today-dated sport session**

`frontend/src/data/train/train.ts` — a `sessions` tömb ELEJÉRE (a lista newest-first, `:1048` környéke):

```ts
    // mezo-idz2: dátum-relatív mai session — a DayOrb sport-jele mock módban is jelen van.
    { id: 'vb-today', sport: 'volleyball', date: huMonthDayDow(localDateString()), isoDate: localDateString(), time: '18:00', duration: 90, setsPlayed: 4, rounds: null, intensity: 7, rpe: 6.6, shoulderStrain: 5, jumpCount: 33, notes: null },
```

Ellenőrizd, hogy a fájl tetején megvan-e mindkét import; ha nem, add hozzá:

```ts
import { huMonthDayDow, localDateString } from '@/shared/lib/dates'
```

- [ ] **Step 5: Make the mock gym-done list say today**

`frontend/src/data/train/trainHooks.ts:910`. A jelenlegi sor:

```ts
    gymDoneDates: mock ? [] : (todayData?.weekDoneDates ?? []),
```

Cseréld erre:

```ts
    // mezo-idz2: mock módban a mai nap „megcsinált gym-nap" — enélkül a DayOrb edzés-jele
    // mock módban strukturálisan sosem lenne jelen, és a fejlesztői felület hazudna.
    gymDoneDates: mock ? [localDateString()] : (todayData?.weekDoneDates ?? []),
```

A `localDateString` importja már ott van a fájlban (a `toSportSession` / `useToday` használja); ha mégsem, add hozzá a `@/shared/lib/dates` importhoz.

- [ ] **Step 6: Run the data-layer and needs tests in BOTH modes**

Ez a lépés azt méri, hogy a seed-bővítés nem tört-e el meglévő fogyasztót — a `gymDoneDates` a needs-ringek `mozgas` eseményeibe is befolyik.

```bash
cd frontend && pnpm vitest run src/data src/features/today/logic
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/data src/features/today/logic
```

Elvárt: mindkettő PASS. Ha egy `needs*` teszt elbukik, olvasd el, mit assertál: ha fixture-ből táplálkozik, a seed nem érintheti — akkor valódi regressziót találtál; ha a seedből, akkor az elvárást kell a seedhez igazítani (és a commit-üzenetben megindokolni).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data
git commit -m "test(data): dátum-relatív mai seedek a DayOrb hét jeléhez (mezo-idz2)"
```

---

### Task 4: `useDayOrbFill` — a hét jel egyetlen olvasási pontja

**Files:**
- Create: `frontend/src/features/today/logic/useDayOrbFill.ts`
- Test: `frontend/src/features/today/logic/useDayOrbFill.test.tsx`

**Interfaces:**
- Consumes: `dayOrbFill(signals, plan, score)`, `DayOrbSignals`, `DayOrbPlan`, `DayOrbFill`, `NEUTRAL_INTENSITY` a Task 1-ből.
- Produces:
  ```ts
  export interface DayOrbState { pct: number; intensity: number; present: number; denominator: number; label: string }
  export function useDayOrbFill(): DayOrbState
  ```
  A `label` a kész `aria-label` szöveg — az `AppHeader` (Task 5) ezt teszi a gombra.

**Fontos részletek, amiket a felderítés kiásott — ezek NÉLKÜL a hook csendben hazudna:**

- `useSleep().lastNight` **NEM tegnap éjszaka**, hanem a teljes napló utolsó eleme (`data/me/sleepHooks.ts:53`). A helyes predikátum a `needsInputs.ts:93` idióma: **ma VAGY tegnap** dátumú sor.
- `train.sport.sessions[].date` **HU display string** (`„Máj 20 · Kedd"`), az ISO nap az `isoDate` mezőben van. Az `isoDate`-tel hasonlíts.
- `useRunning().runSessions` elemei `RunSessionLogResponse`-ok, ISO `date` mezővel.
- A `deriveGymSchedule` gym-ága `time`-ot is megkövetel, ezért a `resolveDayType` egy time-slot nélküli meso-napot pihenőnapnak mutatna. A NEVEZŐHÖZ ezért `weeklyTimes.find(d => d.today && d.active)` kell, **idő nélkül**.
- A mock sport-slotokon **nincs** `today` flag (azt csak a real-mode `toSportSchedule` bélyegzi) — mock módban a sport sosem „tervezett". Ez rendben van: a Task 1 szabálya szerint a LOGOLT sport is beemeli a jelet, és a Task 3 seedje ad mai sport-sessiont.
- `useMeWeek` visszatérése `{ week, mode, isPending, isError, refetch }`, ahol `week: MeWeek | null`, a napok a `week.days` tömbben, `MeWeekDay.score` nullable.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/today/logic/useDayOrbFill.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

test('mock módban a mai nap jelei megvannak — a nevező legalább 5, a töltöttség pozitív', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.denominator).toBeGreaterThanOrEqual(5)
  expect(result.current.present).toBeGreaterThan(0)
  expect(result.current.pct).toBeGreaterThan(0)
})

test('a present sosem nagyobb a nevezőnél', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.present).toBeLessThanOrEqual(result.current.denominator)
})

test('az intenzitás a 0…1 tartományban van', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.intensity).toBeGreaterThanOrEqual(0)
  expect(result.current.intensity).toBeLessThanOrEqual(1)
})

test('a label a jelek számát mondja ki, nem csak színben közöl', () => {
  const { result } = renderHook(() => useDayOrbFill(), { wrapper })
  expect(result.current.label).toMatch(/^A mai napod/)
  expect(result.current.label).toContain(String(result.current.denominator))
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && pnpm vitest run src/features/today/logic/useDayOrbFill.test.tsx
```

Elvárt: FAIL — `Failed to resolve import "@/features/today/logic/useDayOrbFill"`.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/today/logic/useDayOrbFill.ts`:

```ts
// ============================================================
// Mezo · useDayOrbFill — a fejléc DayOrb-jának EGYETLEN olvasási pontja (mezo-idz2).
// A hét napi jelet a shellben MÁR FUTÓ lekérdezésekből olvassa (a MezoThreadProvider
// useNeeds-e minden chrome-os route-on mountol), plusz két új olvasás: súly + napló.
// A `useDayFace` / MezoThreadProvider precedens: a fejléc és a Nap hub nem drift-elhet
// szét két külön olvasáson — ha bárhol máshol is kell a töltöttség, EZT hívd.
// A tónus külön forrásból jön (useMeWeek napi pont), hogy a „milyen jó a nap"-nak
// egyetlen definíciója legyen: ugyanaz, amit a nap-oldal mutat.
// Spec: docs/superpowers/specs/2026-09-03-napi-orb-fejlec-design.md
// ============================================================
import { useMemo } from 'react'
import {
  useCheckins, useFuelDay, useJournalNotes, useMeWeek, useRunning, useSleep, useTrain, useWeight,
} from '@/data/hooks'
import { addDays, localDateString, mondayOf } from '@/shared/lib/dates'
import { useMinuteTick } from '@/features/today/logic/useMinuteTick'
import { dayOrbFill, type DayOrbPlan, type DayOrbSignals } from '@/features/today/logic/dayOrbFill'

export interface DayOrbState {
  pct: number
  intensity: number
  present: number
  denominator: number
  /** Kész `aria-label` — az állapotot szavakban is közli, nem csak színben. */
  label: string
}

export function useDayOrbFill(): DayOrbState {
  const now = useMinuteTick()
  const todayIso = localDateString(now)
  const yesterdayIso = addDays(todayIso, -1)

  const { fuel } = useFuelDay(todayIso)
  const { sleepLog } = useSleep()
  const { weightLog } = useWeight()
  const { checkins } = useCheckins()
  const { data: journalToday } = useJournalNotes(todayIso, todayIso)
  const train = useTrain()
  const { runSessions } = useRunning()
  const { week } = useMeWeek(mondayOf(todayIso))

  const gymDoneDates = train.gymDoneDates
  const completedTodayWorkout = train.completedTodayWorkout
  const sportSessions = train.sport.sessions
  const gymWeeklyTimes = train.gymSchedule?.weeklyTimes
  const sportScheduleSessions = train.sport.schedule?.volleyball.sessions

  return useMemo(() => {
    // A `lastNight` mező a teljes napló utolsó eleme, NEM tegnap éjszakáé — ezért a
    // needsInputs.ts:93 idiómát másoljuk: ma VAGY tegnap dátumú sor számít. (A
    // SleepEntry.date hol a lefekvés, hol az ébredés napját nevezi meg.)
    const sleep = sleepLog.some((e) => e.date === todayIso || e.date === yesterdayIso)

    const weight = weightLog.some((w) => w.date === todayIso)
    const fuelLogged = fuel.meals.length > 0
    const checkin = checkins.some((c) => c.state === 'done')
    const journal = journalToday.some((n) => n.occurredOn === todayIso)

    const gym = gymDoneDates.includes(todayIso) || completedTodayWorkout?.date === todayIso

    // A sport-sessionök `date` mezője HU display string; az ISO nap az `isoDate`-ben van.
    // A futás ugyanebbe a jelbe olvad (a felhasználó egy tételként gondol rá).
    const sport = sportSessions.some((s) => s.isoDate === todayIso)
      || runSessions.some((r) => r.date === todayIso)

    const signals: DayOrbSignals = { sleep, weight, fuel: fuelLogged, gym, sport, checkin, journal }

    // A nevezőhöz a `deriveBlocks` gym-ága NEM jó: az `d.time`-ot is megköveteli, tehát egy
    // time-slot nélküli meso-nap pihenőnapnak látszana. Itt csak az számít, hogy a nap
    // TERVE szerint jár-e edzés — az időpont nem.
    const plan: DayOrbPlan = {
      gymPlanned: Boolean(gymWeeklyTimes?.some((d) => d.today && d.active)),
      sportPlanned: Boolean(sportScheduleSessions?.some((s) => s.today)),
    }

    const score = week?.days.find((d) => d.date === todayIso)?.score ?? null
    const fill = dayOrbFill(signals, plan, score)

    return {
      ...fill,
      label: fill.present === 0
        ? 'A mai napod · még nincs adat'
        : `A mai napod · ${fill.present} a ${fill.denominator} jelből megvan`,
    }
  }, [
    todayIso, yesterdayIso, sleepLog, weightLog, fuel.meals, checkins, journalToday,
    gymDoneDates, completedTodayWorkout, sportSessions, runSessions,
    gymWeeklyTimes, sportScheduleSessions, week,
  ])
}
```

- [ ] **Step 4: Run the test in BOTH modes**

```bash
cd frontend && pnpm vitest run src/features/today/logic/useDayOrbFill.test.tsx
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm vitest run src/features/today/logic/useDayOrbFill.test.tsx
```

Elvárt: mock PASS mind a 4 teszttel. Real módban a hálózat nélküli `realEmpty` miatt a `present` 0 lehet — ha az első teszt real módban elbukik, **ne lazítsd az assertet**: tedd az első három tesztet mock-only-vá egy `describe.skipIf(import.meta.env.VITE_USE_MOCK === 'false')` blokkba, és hagyd a `label`-tesztet mindkét módban futni.

- [ ] **Step 5: Verify the dual-mode guard still passes**

```bash
cd frontend && pnpm vitest run src/data/dualMode.guard.test.ts
```

Elvárt: PASS. Ez a teszt az egész `src` fát nézi; ha az új hook bárhol statikus fallbackot adna real módban, itt bukna.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/today/logic/useDayOrbFill.ts frontend/src/features/today/logic/useDayOrbFill.test.tsx
git commit -m "feat(today): useDayOrbFill — a hét napi jel egyetlen olvasási pontja (mezo-idz2)"
```

---

### Task 5: A fejléc bekötése

**Files:**
- Modify: `frontend/src/app/AppHeader.tsx:153-156`
- Modify: `frontend/src/app/hubHeaders.test.tsx:38-43`
- Modify: `frontend/src/app/AppHeader.test.tsx`
- Modify: `docs/features/today.md`

**Interfaces:**
- Consumes: `useDayOrbFill()` → `{ pct, intensity, label }` a Task 4-ből; `DayOrb` a Task 2-ből.
- Produces: semmit további taskoknak.

- [ ] **Step 1: Update the header contract test FIRST (ez a piros teszt)**

`frontend/src/app/hubHeaders.test.tsx:38-43`. A jelenlegi `BASE_CONTROLS`:

```ts
const BASE_CONTROLS = [
  'Napszak váltása',
  expect.stringMatching(/^Mezo üzenetei/),
  expect.stringMatching(/^Értesítések/),
  'Profil',
]
```

Cseréld erre:

```ts
const BASE_CONTROLS = [
  'Napszak váltása',
  expect.stringMatching(/^Mezo üzenetei/),
  expect.stringMatching(/^Értesítések/),
  // mezo-idz2: a jobb szélső gomb már nem a profilra visz (azt az alsó „Én" fül adja),
  // hanem a mai nap-oldalra, és a napi töltöttséget is kimondja.
  expect.stringMatching(/^A mai napod/),
]
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd frontend && pnpm vitest run src/app/hubHeaders.test.tsx
```

Elvárt: FAIL — az 5 route-os `.each` eset mind bukik, mert a gomb még `'Profil'`.

- [ ] **Step 3: Wire the header**

`frontend/src/app/AppHeader.tsx`. Add hozzá az importokat a meglévő import-blokkhoz:

```ts
import { DayOrb } from '@/shared/ui/DayOrb'
import { useDayOrbFill } from '@/features/today/logic/useDayOrbFill'
```

A komponens törzsében, a többi hook mellé:

```ts
  const dayOrb = useDayOrbFill()
```

Végül a `:153-156` blokk:

```tsx
      <button type="button" className="nap-avatar" aria-label="Profil" onClick={() => navigate('/me')}>
        <ClaySpot name="s-orb" size={40} />
      </button>
```

cseréld erre:

```tsx
      {/* mezo-idz2: a jobb szélső orb korábban a profilra vitt — ugyanoda, ahova az alsó
          „Én" fül, tehát duplikátum volt. Most a nap állapotjelzője: alulról fölfelé telik
          a rögzített jelek szerint, és a mai nap-oldalra visz. A töltöttség maga a jelzés,
          ezért nincs rajta badge. */}
      <button type="button" className="nap-avatar" aria-label={dayOrb.label}
        onClick={() => navigate(`/me/week/napok/${localDateString()}`)}>
        <DayOrb pct={dayOrb.pct} intensity={dayOrb.intensity} size={40} />
      </button>
```

Ellenőrizd, hogy a `localDateString` importálva van-e a `@/shared/lib/dates`-ből; ha nem, add hozzá.

Ha a `ClaySpot` import ezzel használatlanná vált a fájlban, töröld — a lint különben bukik.

- [ ] **Step 4: Run the header tests**

```bash
cd frontend && pnpm vitest run src/app/hubHeaders.test.tsx src/app/AppHeader.test.tsx src/app/navigation.test.tsx
```

Elvárt: a `hubHeaders` PASS. Az `AppHeader.test.tsx` valószínűleg bukik egy „Profil" gombra navigáló eseten — nyisd meg, keresd meg az assertet (`getByLabelText('Profil')` vagy `/me` navigációs elvárás), és írd át a mai nap-oldalra:

```tsx
// mezo-idz2: a jobb szélső orb a mai nap-oldalra visz; a profil az alsó „Én" fülön van.
expect(screen.getByLabelText(/^A mai napod/)).toBeInTheDocument()
```

Navigációs assert esetén az elvárt útvonal `/me/week/napok/<localDateString()>`.

- [ ] **Step 5: Fix the stale doc line**

`docs/features/today.md` §2, a fejléc 6. eleme jelenleg azt állítja, hogy a `.nap-avatar` az `i-mezo` clay IKONT rendereli → `/me`. Ez már a változás előtt is pontatlan volt (`ClaySpot name="s-orb"` volt, nem `ClayIcon name="i-mezo"`), és most a cél is változik. Keresd meg:

```bash
grep -n "nap-avatar" docs/features/today.md
```

és írd át a sort úgy, hogy tükrözze: **DayOrb** (a `#s-orb` sprite alulról töltődő variánsa), `aria-label` a napi töltöttséget mondja, cél `/me/week/napok/<ma>`, a profil az alsó „Én" fülön él.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app docs/features/today.md
git commit -m "feat(app): a fejléc jobb szélső orbja napi állapotjelző lett (mezo-idz2)"
```

---

### Task 6: Kapuk — CODEMAP, lint, teljes FE suite, vizuális baseline-ok

**Files:**
- Modify: `docs/CODEMAP.md` (generált)
- Modify: `frontend/tests/visual/visual.spec.ts-snapshots/**` (generált)

**Interfaces:**
- Consumes: minden előző task.
- Produces: zöld CI.

**Miért külön task:** a vizuális baseline-ok regenerálása a legnagyobb, legkockázatosabb és legutolsó lépés — a fejléc MIND a 90 snapshoton rajta van, két platformon. Ezt csak akkor szabad futtatni, amikor a kód már végleges.

- [ ] **Step 1: Regenerate the codemap**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
```

Elvárt: a `--check` PASS. (Az első hívás írja, a második ellenőrzi.)

- [ ] **Step 2: Lint + typecheck**

```bash
cd frontend && pnpm lint && pnpm exec tsc --noEmit
```

Elvárt: mindkettő tiszta. Ha a `ClaySpot` (Task 5) használatlanul maradt az `AppHeader.tsx`-ben, itt bukik — töröld az importot.

- [ ] **Step 3: Full frontend suite, BOTH modes**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test
```

```bash
cd frontend && VITE_USE_MOCK=false pnpm test
```

Elvárt: mindkettő PASS. **Csupasz `pnpm test`-et ne futtass** — üres `VITE_USE_MOCK` mock módot jelent, tehát kétszer ugyanazt mérnéd, és a real-módú kapu üresen állna.

- [ ] **Step 4: Build**

```bash
cd frontend && pnpm build
```

Elvárt: siker.

- [ ] **Step 5: Regenerate the darwin visual baselines locally**

```bash
cd frontend && pnpm exec playwright test tests/visual/visual.spec.ts --update-snapshots
```

Elvárt: minden snapshot újraíródik. Nézd át a diffet **szemmel**: a fejléc jobb szélén az orb kitöltése kell hogy változzon, minden más pixel változatlan. Ha egy oldal TARTALMA is elmozdult, az regresszió — állj meg és keresd meg az okát (a leggyakoribb gyanúsított a Task 3 seed-bővítése, ami a needs-ringeket vagy a súly/alvás kijelzőket mozdítja el).

- [ ] **Step 6: Commit the baselines**

```bash
git add docs/CODEMAP.md frontend/tests/visual/visual.spec.ts-snapshots
git commit -m "chore(visual): darwin baseline-ok + CODEMAP a DayOrb után (mezo-idz2)"
```

- [ ] **Step 7: Push and open the self-PR**

```bash
git push -u origin HEAD
```

```bash
gh pr create --fill
```

- [ ] **Step 8: Regenerate the linux baselines in CI**

A linux baseline-ok NEM generálhatók lokálisan (más a betűrenderelés). Indítsd a dedikált workflow-t az ág ellen:

```bash
gh workflow run update-visual-baselines.yml --ref "$(git branch --show-current)"
```

Várd meg, amíg lefut és commitol az ágra, majd:

```bash
git pull --rebase
```

- [ ] **Step 9: Wait for CI green**

```bash
gh pr checks --watch
```

Elvárt: minden check zöld. **Ez az autoritatív kapu** — a 16 GB-os gép nem futtatja a nehéz suite-ot, a CI igen.

- [ ] **Step 10: Close the bd issue**

```bash
bd close mezo-idz2
```

---

## Self-review

**Spec-lefedettség.** A spec minden szakasza taskhoz köthető: a két tengely és a hét jel → Task 1; a glif, a tónus-interpoláció, a geometria, a mozgás → Task 2; a mock-parancsok → Task 3; az adatforrások, a naptípus és a `useMeWeek` tónus-ág → Task 4; a fejléc-csere, az `aria-label`, a doksi-elavulás → Task 5; a 11 csapdából a vizuális goldenek, a CODEMAP-kapu, a kétmódú futtatás és a `prototypeCssStructure` → Task 2 Step 6 és Task 6.

**Amit szándékosan NEM tartalmaz a terv:** nincs badge, nincs csempe, nincs napszak-függő tartalom, nincs új sprite-art — a spec YAGNI-szakasza szerint.

**Ismert, tudatosan vállalt költség:** a `useWeight` + `useJournalNotes` a fejlécből minden chrome-os route-on elindul, a session teljes hosszára. Ez ugyanaz az osztály, amit a `docs/features/today.md` §3 a `useNeeds` ~15 olvasásánál már dokumentál.

**Későbbi becsatlakozás:** amikor a párhuzamos, 6-dimenziós napi értékelés landol, csak a `useDayOrbFill` tónus-ága vált át a `useMeWeek`-ről — ezzel a `COMPANION_SWITCH`-függés is megszűnik. A `dayOrbFill` és a `DayOrb` nem változik.
