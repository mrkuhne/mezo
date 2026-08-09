# Fuel „Keret-hero” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A window-river Mai tetejére a Keret-hero kerül (felpörgő kcal, chipek, 5 gyűrű, víz-logoló), a Keret-öv retirál, az AI meal-score visszaköt a logolt étel-sorokra.

**Architecture:** Spec: [`2026-08-09-fuel-keret-hero-design.md`](../specs/2026-08-09-fuel-keret-hero-design.md) — **minden task implementálója a spec-et ÉS `docs/references/frontend_conventions.md`-t olvassa el először.** Pure logika `logic/keretHero.ts`-ben; a hero `KeretHero.tsx`; a `FuelMaiPage` komponál; a meglévő `MealScoreSheet`/`EnergyBreakdownSheet`/`useWaterActions`/`QuickInputSheet` érintetlen.

**Tech Stack:** React 19 + TS + vitest; prototype.css DS tokenek.

## Global Constraints

- Frontend conventions kötelezőek (@/* import, no barrel, hooks a @/data/hooks-ról, kolokált tesztek, shared/ui domain-free).
- Nincs backend/API-változás; hook-aláírás nem változik.
- DS tokenek, `:where()` motion-garancia, magyar copy a spec/mockup szerint szó szerint.
- Commit: `feat(fuel)|refactor|docs: … (mezo-c9t5)` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Gate a záráskor: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.

---

### Task 1: `logic/keretHero.ts` — pure hero-viewmodel

**Files:** Create `frontend/src/features/fuel/logic/keretHero.ts` + `keretHero.test.ts`. Modify `frontend/src/data/fuel/fuelConfig.ts` (+`FIBER_TARGET_G = 30` konstans).

**Interfaces:**
- Consumes: `DayBudget` (`buildDayPlan.ts`), `FuelMeal` (`@/data/types` — `fiberG?`, `score?`, `role?`/MealRole mező — olvasd ki a valós neveket), `FuelSlot[]`.
- Produces (T2/T3 importálja sight-unseen):

```ts
export interface RingVM { key: 'p'|'c'|'f'|'fiber'|'water'; label: string; pct: number; value: string; target: string; color: string }
export interface DaySegVM { widthPct: number; toneAlt: boolean }
export interface KeretHeroVM {
  remainingKcal: number; consumedKcal: number; targetKcal: number
  doneCount: number; totalCount: number
  segments: DaySegVM[]; nowFrac: number | null
  chips: { base: number; activity: number; balance: number } | null   // null = staticEnergy → chipsor nem renderel
  rings: RingVM[]                                                     // mindig 5, fix sorrend P/C/F/Rost/Víz
}
export function buildKeretHero(input: { budget: DayBudget; staticEnergy: boolean; consumed: {kcal:number;p:number;c:number;f:number}; meals: FuelMeal[]; water: {currentMl:number;targetMl:number}; slots: FuelSlot[]; nowHHmm: string }): KeretHeroVM
export interface DoneMealRow { mealId: string; name: string; time: string; kcal: number|null; proteinG: number|null; role: string|null; scorePct: number|null }
export function doneMealRows(meals: FuelMeal[], slots: FuelSlot[]): DoneMealRow[]   // a kész ablakok logolt mealjei, kronologikusan
export function aiAverage(rows: DoneMealRow[]): number | null                        // score-os sorok átlaga, üresen null
```

- [ ] Táblás tesztek először (FAIL): rost-összegzés hiányzó `fiberG`-kkel (2 meal, egyiknek nincs → csak a meglévő számít); víz-ring pct; chips `null` staticEnergy-n; előjel-adatok (balance negatív/pozitív átmegy nyersen — a formázás a komponensé); segments a logolt kcal-okból egy közös nevezővel + ghost; `aiAverage` score-nélküliekkel és üresen (null); `doneMealRows` kronologikus, role/score átemelve.
- [ ] Implementáció (pure, no React); gate: `pnpm vitest run src/features/fuel/logic/keretHero.test.ts`; commit `feat(fuel): keretHero pure view-model + rost-összegzés (mezo-c9t5)`.

### Task 2: `KeretHero.tsx` + `WaterLogSheet.tsx`

**Files:** Create `frontend/src/features/fuel/components/KeretHero.tsx` + teszt, `frontend/src/features/fuel/sheets/WaterLogSheet.tsx` + teszt. Modify `prototype.css` (`.khero*` család + gyűrű-CSS).

**Interfaces:**
- Consumes: `KeretHeroVM` (T1), shared `Sheet`, `useWaterActions`-kimenet propként.
- Produces: `KeretHero({ vm, onChip(section:'base'|'movement'|'deficit'), onWaterRing }): JSX` · `WaterLogSheet({ currentMl, targetMl, onLog(ml), onClose })`.

- [ ] Tesztek először: count-up **reduced-motion ágon azonnali végérték** (mockolt matchMedia; az animációs ág smoke — a rAF-számláló t=0-nál 0-t, végállapotban a teljes értéket mutatja); a mozgó ág `aria-live` nélkül, a szám hozzáférhető neve a végérték; chipsor: 3 chip előjeles Cél-lel (`−400`/`+400` mindkét eset), klikk → `onChip('deficit')` stb.; `vm.chips=null` → nincs chipsor; 5 gyűrű `role="progressbar"` aria-val, fix sorrend; víz-gyűrű `button` HU labellel → `onWaterRing`; WaterLogSheet: 3 chip (250/400/500) egy-választós, kézi input felülírja, Mentés → `onLog(ml)` a kiválasztott/beírt értékkel, invalid input → Mentés inert.
- [ ] Implementáció: count-up rAF 2 s ease-out (`1-(1-p)^3`), gyűrű stroke-dashoffset transition együtt; halo-sage sáv; dayseg a régi `.dayseg` mintára (a v4 mockup CSS-e az irány, DS tokenekkel); commit `feat(fuel): KeretHero + WaterLogSheet (mezo-c9t5)`.

### Task 3: `FuelMaiPage` + `FuelSection` integráció, done-kapszula + score-visszakötés

**Files:** Modify `FuelMaiPage.tsx` (+tesztek), `FuelSection.tsx` (+teszt), `windowIslands.ts` (+teszt — done-ablakok `doneGroup`-ba), `pages/tabs.ts` nem változik.

- [ ] Tesztek először: hero a lap tetején (AppHero alatt, sky felett) a VM valós adataival; `KeretBelt` nem renderel többé; `?w=keret` érvénytelen → default (a régi teszt átfordítása); done-ablakok NEM külön kapszulák: egy összevont `✓ {n} kész ablak · {kcal} · AI-átlag {avg} p` kapszula, kibontva `DoneMealRow`-soronként MealRole-címkével és ✨ score-chippel (score-nélküli sornál nincs chip); étel-sorra koppintva `MealScoreSheet` nyílik a meal-lel; víz-gyűrű → `WaterLogSheet` → `useWaterActions.add(ml)`; chipek → `EnergyBreakdownSheet` szekció-nyitás (a retirált DayBudgetCard huzalozása vissza); `FuelSection`: a `SubNavDropdown` `extraAction`-je ⚙️ „Fuel-beállítások” → `FuelSettingsSheet` (Me-minta; a sheet hostja a section).
- [ ] Implementáció + minden fuel-teszt zöld; commit `feat(fuel): Mai keret-hero integráció + AI-score visszakötés (mezo-c9t5)`.

### Task 4: Retirálás + docs + ADR 0024

**Files:** Delete `KeretBelt.tsx`+teszt (fogyasztó-greppel bizonyítva) + `.kbelt*` CSS + az `Island` `belt`/`beltContent` prop (ha zero fogyasztó — Today nem használja; shared teszt frissül); Create `docs/decisions/0024-fuel-keret-hero.md` (0023-iteráció: belt→hero, score-visszakötés = mezo-cs8b megoldva, rost, víz-logoló; a v4 mockup-lánc hivatkozva); Modify `docs/features/fuel.md` (§2/§3/§9 az új Mai-ra, KeretBelt→KeretHero), `docs/features/_platform-design-system.md` (`.isl-belt`/beltContent retirált, `.khero*` új Fuel-család).

- [ ] Takarítás grep-bizonyítékkal; `node scripts/lint-docs.mjs` — fuel/DS doc nem stale; commit `docs(fuel): keret-hero docs + ADR 0024 + belt retirement (mezo-c9t5)`.

### Task 5: Kapuk + goldenek + szállítás (operátor-task, fő session)

- [ ] Teljes gate mindkét módban + build; `visual.spec.ts`: `fuel-keret` sor törlése, `fuel` darwin golden regen + verify; push + PR + CI; linux baselines workflow + bot-run approve; zöld után `--no-ff` merge → push → deploy-monitor; `bd close mezo-c9t5` + `bd close mezo-cs8b` + `bd dolt push`.
