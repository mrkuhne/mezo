# Fuel Mai „Ablak-folyam” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/fuel` Mai nézet újrakomponálása a Today három-sziget nyelvére: étkezés-ablak szigetek + állandó Keret-öv, a meglévő fuel-adatréteg érintése nélkül.

**Architecture:** A Today sziget-héja (`Island`) domain-mentesül és `shared/ui`-ba emelkedik; egy új pure `windowIslands.ts` vetíti a `buildDayPlan`/`pickHeroWindow` kimenetét sziget-viewmodellekké; a `FuelMaiPage` égként komponálja a `WindowIsland` + `KeretBelt` komponenseket. Spec: [`docs/superpowers/specs/2026-08-08-fuel-window-river-design.md`](../specs/2026-08-08-fuel-window-river-design.md) — **minden task implementálója olvassa el a spec-et ÉS a `docs/references/frontend_conventions.md`-t munka előtt.**

**Tech Stack:** React 19 + Vite + TS, vitest + testing-library, prototype.css (DS tokenek), meglévő fuel data-hookok.

## Global Constraints

- Frontend conventions kötelezőek: `@/*` abszolút importok, no barrel (csak `data/hooks.ts`), hooks csak `@/data/hooks`-ról, `shared/ui` domain-mentes, tesztek kolokáltak.
- **Nincs backend/API-változás**; data-hook aláírás nem változhat.
- Minden CSS érték DS-token (`var(--…)`), hardcode hex tilos; motion-szabály `:where()`-be csomagolt modifier-szelektoron (reduced-motion garancia).
- Magyar UI-copy, a spec szövegei szó szerint.
- Gate minden task végén: az érintett tesztek zöldek; a záró tasknál `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- Commit-konvenció: `feat(fuel)|refactor(ui)|docs: … (mezo-jgh9)` + Claude trailer.

---

### Task 1: Island héj promóció `shared/ui`-ba (domain-mentesítés)

**Files:**
- Create: `frontend/src/shared/ui/Island.tsx` (+ `Island.test.tsx` mellette)
- Modify: `frontend/src/features/today/components/IslandSky.tsx` (import-retarget + emoji/label átadás)
- Delete: `frontend/src/features/today/components/Island.tsx`, `Island.test.tsx` (tartalmuk költözik)
- Modify: `frontend/src/styles/prototype.css:2250-2320` (a `.sky-islands`/`.isl*` blokk: `[data-face=…]` szelektorok → `[data-tone=…]`, + új tónusok)

**Interfaces:**
- Consumes: a mai `features/today/components/Island.tsx` héj-viselkedése (29↔34 px morf, cross-fade `.isl-cap`, `now-clock`, `isl-night`).
- Produces (később minden task erre épül):

```tsx
// shared/ui/Island.tsx — domain-free shell. A hívó adja a nyelvet (emoji/címke), a héj csak formát tud.
export type IslandTone = 'reggel' | 'nap' | 'este' | 'fuel' | 'keret'
export interface IslandCapsule { emoji: string; title: string; essence: string; count: string; nowTag?: string }
export interface IslandProps {
  tone: IslandTone
  big: boolean
  nowRing: boolean            // arany gyűrű + nowTag a kapszulán (kiválasztástól független)
  capsule: IslandCapsule
  night?: boolean             // este night-fázis: a héj elsötétül (.isl-night)
  belt?: boolean              // öv-variáns: fix 54px, r-xl, nem lebeg (.isl-belt)
  ariaLabel: string           // teljes HU label a kapszula-buttonre
  onSelect: () => void
  children: React.ReactNode   // a bigview tartalma (csak big-ben renderel)
}
export function Island(props: IslandProps): JSX.Element
```

- [ ] **Step 1:** Olvasd el a mai `features/today/components/Island.tsx`-t és tesztjét, valamint a `prototype.css` 2250–2320 sáv `.isl*` szabályait.
- [ ] **Step 2:** Írd meg `shared/ui/Island.test.tsx`-et a mai teszt eseteiből általánosítva (renderel kapszula-buttont aria-labellel; `big` → `.isl-big` + children renderel + kapszula `aria-hidden`; `nowRing` → `.now-clock` + nowTag szöveg; `belt` → `.isl-belt`; `night` → `.isl-night`; `data-tone` attribútum a tone-ból). Futtasd: `pnpm vitest run src/shared/ui/Island.test.tsx` → FAIL (nincs ilyen modul).
- [ ] **Step 3:** Írd meg `shared/ui/Island.tsx`-et a fenti props-szal — a mai héj JSX-e, de `FACE_EMOJI[face]`/`FACE_LABEL[face]` helyett `capsule.emoji`/`capsule.title`, `data-face` helyett `data-tone={tone}`, a `MOST` felirat `capsule.nowTag ?? 'MOST'`. Semmilyen `@/features/*` vagy `@/data/*` import nem maradhat benne.
- [ ] **Step 4:** `prototype.css`: a `.isl[data-face="reggel|nap|este"]` blob-szelektorok átírása `data-tone`-ra (értékek változatlanok), + két új tónus a spec §6 szerint: `.isl[data-tone="fuel"] .isl-blob` (sage-amber: `radial-gradient(ellipse at 50% 45%, rgba(154,184,143,.32), rgba(244,208,111,.14) 55%, transparent 75%)` — token-mixből képezve, ne nyers rgba-t dupláz: használd a meglévő `--halo-sage` mintát követő `color-mix(in srgb, var(--success-base) …)` formát, ahogy a szomszédos blokk csinálja), `.isl[data-tone="keret"] .isl-blob` (amber-sage fordított súllyal); + `.isl.isl-belt { flex: 0 0 54px; border-radius: var(--r-xl); }` és `:where(.isl.isl-belt)` kivétel a floaty animáció alól; a floaty delay-szelektorok (`[data-face=…]`) is tone-ra.
- [ ] **Step 5:** `IslandSky.tsx` (Today) átáll a shared Islandre: `import { Island } from '@/shared/ui/Island'`, tone=face, capsule.emoji=`FACE_EMOJI[face]`, capsule.title=`FACE_LABEL[face]`, ariaLabel a mai képlettel. Töröld a feature-beli `Island.tsx`+tesztet.
- [ ] **Step 6:** Futtasd a Today + shared teszteket: `pnpm vitest run src/shared/ui/Island.test.tsx src/features/today` → PASS (a Today viselkedés-tesztek változtatás nélkül zöldek — ez bizonyítja a viselkedés-azonosságot).
- [ ] **Step 7:** Commit: `refactor(ui): promote Island shell to shared/ui, data-tone blob hooks (mezo-jgh9)`.

---

### Task 2: `windowIslands.ts` — pure ég-viewmodel

**Files:**
- Create: `frontend/src/features/fuel/logic/windowIslands.ts` + `windowIslands.test.ts`

**Interfaces:**
- Consumes: `FuelSlot` (`@/data/types`), `FuelPlanToday`, `DayBudget` (`@/features/fuel/logic/buildDayPlan`), `HeroResult`/`pickHeroWindow` (`heroWindow.ts`), `MealMatchVerdict` (`matchMealsToStack.ts`), `toMin` (`@/data/fuel/fuelConfig`).
- Produces (Task 4–5 erre épül):

```ts
export type WindowIslandState = 'done' | 'now' | 'missed' | 'future'
export interface WindowFacts {
  proteinJump: { addG: number; fromG: number; toG: number; pctOfTarget: number } | null
  dayScore: { avg: number; aboveWeekly: boolean } | null   // score-próza nincs (P8) — csak szám
}
export interface WindowIslandVM {
  key: string                    // `${slot.time}-${slot.label}` — stabil kulcs + ?w= cél
  state: WindowIslandState
  emoji: string                  // slot-kategória emoji (breakfast 🍳, lunch 🥙, snack 🥜, dinner 🍲)
  title: string                  // a slot label-je (deriveMealName kimenete a slotban)
  time: string                   // HH:mm
  essence: string                // kapszula-sor — done: "07:40 · zabkása + skyr" · missed: "12:30 · kimaradt — pótold"
  count: string                  // done: "✓ 420 kcal · 92 p" · missed: "Pótold" · egyéb: "N ›"
  subtitle: string               // bigview herosub: ablak-határ + edzés-kapcsolat + (csúcshéten) Reta-jegy
  meal: { name: string; kcal: number | null; p: number | null; fit: number | null; fromPlan: boolean } | null
  facts: WindowFacts
  stackDoses: { name: string; note: string }[]   // ehhez az ablakhoz kötött adagok
  l1Count: number                // a "még N ›" fogantyú száma
}
export interface WindowRiverVM {
  islands: WindowIslandVM[]      // kronologikus sorrendben
  nowKey: string | null          // MOST-gyűrűs sziget (pickHeroWindow open-hero slotja)
  defaultKey: string             // induló nagy sziget: nowKey, ha nincs → 'keret'
  doneSummary: { count: number; kcal: number; avgScore: number | null } // "✓ 2 ablak kész…" sor
}
export function buildWindowRiver(input: {
  plan: FuelPlanToday
  budget: DayBudget
  hero: HeroResult
  stackVerdict: MealMatchVerdict | null
  workoutTime: string | null     // "13:00" | null — az edzés-kapcsolat subtitle-höz
  retaPeak: boolean              // csúcshét-jelzés a subtitle-be
  nowHHmm: string
}): WindowRiverVM
```

- [ ] **Step 1:** Olvasd el `buildDayPlan.ts` (FuelPlanToday/FuelSlot state-ek), `heroWindow.ts`, `matchMealsToStack.ts`, `deriveMealName.ts` exportjait.
- [ ] **Step 2:** Írd meg a táblás teszteket (`windowIslands.test.ts`) — minimum ezek az esetek, mock-seed slotokból építve:
  - négy slot (done/done/now/pending) → 4 sziget kronologikusan, `nowKey` a now-slot kulcsa, `defaultKey === nowKey`;
  - done sziget: `count === '✓ 420 kcal · 92 p'` (kcal+score a slotból), essence az étel nevével;
  - missed slot → `state: 'missed'`, `count: 'Pótold'`, essence tartalmazza a `kimaradt` szót; **a missed sziget nyitva marad** (nem kerül a doneSummary-ba);
  - minden slot done → `defaultKey === 'keret'`;
  - proteinJump: now-slot `p=42`, consumed `p=62`, target `160` → `{addG:42, fromG:62, toG:104, pctOfTarget:65}`;
  - `workoutTime: '13:00'` és a now-ablak 12:30 → subtitle tartalmazza az `edzés 13:00` szöveget; `retaPeak: true` → subtitle tartalmazza az `étvágy` szót;
  - stackVerdict egy ablakhoz kötött adaggal → az adag CSAK annak a szigetnek a `stackDoses`-ában és `l1Count`-jában jelenik meg.
  Futtasd → FAIL.
- [ ] **Step 3:** Implementáld a `buildWindowRiver`-t (pure, no React, no `@/data/*` hook-import — csak típusok). Emoji-map a `SlotKey`-ből; score a slot logolt meal-score mezőjéből, ha van.
- [ ] **Step 4:** `pnpm vitest run src/features/fuel/logic/windowIslands.test.ts` → PASS.
- [ ] **Step 5:** Commit: `feat(fuel): windowIslands pure view-model a Mai éghez (mezo-jgh9)`.

---

### Task 3: `KeretBelt` — az öv + kibontott keret-nézet

**Files:**
- Create: `frontend/src/features/fuel/components/KeretBelt.tsx` + `KeretBelt.test.tsx`
- Modify: `frontend/src/styles/prototype.css` (öv-belső: `.kbelt*` család + `--gradient-sage`/`--shadow-sage` tokenek a DS token-blokkba)

**Interfaces:**
- Consumes: `Island` (Task 1, `belt`/`tone="keret"` móddal), `DayBudget` (`energy: { base, activity, balance, target }`), `useWaterActions` kimenete propként.
- Produces (Task 5 hívja):

```tsx
export interface KeretBeltProps {
  big: boolean
  budget: DayBudget
  consumed: { kcal: number; p: number; c: number; f: number }
  water: { currentMl: number; targetMl: number; onAdd250: () => void } | null
  activityLabel: string          // "Pull A + lépések" | "lépések" — a mozgás-sor címkéje
  onSelect: () => void
  onAdHocLog: () => void         // üres LogMealSheet nyitása
}
export function KeretBelt(props: KeretBeltProps): JSX.Element
```

- [ ] **Step 1:** Tesztek (`KeretBelt.test.tsx`): övként (big=false) renderel maradék-kcal-t (`budget.kcal - consumed.kcal`, HU szóközös ezres formázás) + 3 makró mini-csík aria-val; big=true → felépülés-sorok: `Alapanyagcsere` = `energy.base`, `Mozgás` = `+energy.activity` az `activityLabel`-lel, `Cél-deficit` = `energy.balance` előjelesen, `Mai keret` = `energy.target`; makró-sorok `még N g a C-hoz` szöveggel; víz-sor `+250 ml` gombbal (klikk → `onAdd250`); `＋ Log bármikor` sor (klikk → `onAdHocLog`); `water: null` → nincs víz-sor. FAIL.
- [ ] **Step 2:** Implementáld: az `Island` héjba (`belt`, `tone="keret"`, `nowRing=false`) ágyazva; öv-belső a `.kbelt` család (érték 15/700 tabular + 7.5/700/0.14em label + `.kbelt-bars` mini-csíkok `--macro-protein/carbs/fat` tónussal); kibontott nézet: hero-szám (`heronum` szerep), evett/maradt sáv, felépülés-sorok (`.kbelt-bd*`), teljes makró-csíkok, víz- és adhoc-sor ItemRow-mintán. CTA-k sage-en: vedd fel a token-blokkba `--gradient-sage: linear-gradient(135deg, var(--success-base), var(--success-hover))` + `--shadow-sage: 0 8px 20px rgba(93,132,104,.35)` és egy `.cta-sage` modifiert a meglévő CTA-osztály mellé.
- [ ] **Step 3:** `pnpm vitest run src/features/fuel/components/KeretBelt.test.tsx` → PASS.
- [ ] **Step 4:** Commit: `feat(fuel): KeretBelt — állandó keret-öv + felépülés-nézet (mezo-jgh9)`.

---

### Task 4: `WindowIsland` — az ablak-sziget bigview + L1

**Files:**
- Create: `frontend/src/features/fuel/components/WindowIsland.tsx` + `WindowIsland.test.tsx`

**Interfaces:**
- Consumes: `Island` (T1), `WindowIslandVM` (T2), `ItemRow` (`@/shared/ui/ItemRow`).
- Produces (Task 5 hívja):

```tsx
export interface WindowIslandProps {
  vm: WindowIslandVM
  big: boolean
  nowRing: boolean
  open: boolean                          // L1 nyitva
  doneSummary: string | null             // "✓ 2 ablak kész ma · 840 kcal · átlag 90 pont" — csak a now-szigeten
  onSelect: () => void
  onToggleOpen: () => void
  onLog: () => void                      // LogMealSheet a slotra
  onAiLog: () => void                    // AiLogSheet
  onSwap: () => void                     // csere → /fuel/recipes szűrve (nav)
  onStackDose: (name: string) => void    // adag-pipa
}
export function WindowIsland(props: WindowIslandProps): JSX.Element
```

- [ ] **Step 1:** Tesztek: big+vm(now) → hero az idővel (`12:30`) + unit a címmel; meal-chip név+kcal+P+`illik: 94`; 2 tény-cella (proteinJump/dayScore) és `facts.dayScore=null` → csak 1 cella (nincs `—` hamisítás); CTA-sor `Logold`(→`onLog`) + `✨ AI` + `még N ›`(→`onToggleOpen`); `open` → L1 csoportok (ablak étkezése / Csere / AI / Ehhez az ablakhoz kötve) + `összecsuk ↑`; `meal: null` → `＋ tervezz ide` ghost; `state:'missed'` bigview → `Pótold` CTA-copy; kapszula-essence/count a vm-ből. FAIL.
- [ ] **Step 2:** Implementáld az `Island` héjra (tone=`fuel`), a Today `IslandMorning` mintáját követve (strip-cellák a DS delta-idiómával, `.l1` nyit/zár, stopPropagation a belső gombokon).
- [ ] **Step 3:** `pnpm vitest run src/features/fuel/components/WindowIsland.test.tsx` → PASS.
- [ ] **Step 4:** Commit: `feat(fuel): WindowIsland — ablak-sziget hero + L1 (mezo-jgh9)`.

---

### Task 5: `FuelMaiPage` újrakomponálás + `?w=` + skeleton

**Files:**
- Modify: `frontend/src/features/fuel/pages/FuelMaiPage.tsx` (teljes recompose), `FuelMaiPage.test.tsx`, `FuelMaiPage.logMeal.test.tsx`
- Create: `frontend/src/features/fuel/pages/FuelMaiSkeleton.tsx` (ha ma inline skeleton van, külön fájlba)

**Interfaces:**
- Consumes: T2 `buildWindowRiver`, T3 `KeretBelt`, T4 `WindowIsland`; meglévő hookok a `@/data/hooks` barrelről (`useFuelTimeline`, `useWaterActions`, `useMedication`, `useTrain` a workoutTime-hoz); meglévő sheetek (`LogMealSheet`, `AiLogSheet`).
- Produces: a kész Mai képernyő; `?w=<key|keret>` URL-viselkedés.

- [ ] **Step 1:** Olvasd el a mai `FuelMaiPage.tsx`-t végig — a sheet-host és a hook-kompozíció megtartandó, csak a render-fa cserélődik.
- [ ] **Step 2:** Tesztek frissítése/bővítése: `?w=` deriváció (nincs param → `river.defaultKey` a nagy; `?w=keret` → öv nagy; ismeretlen kulcs → default; pill-katt `replace:true`-val írja, default-kulcsnál törli — a Today `?dp=` tesztek mintája); kiválasztás-váltás kapszula-klikkel; `Logold` → LogMealSheet nyílik a slotra (a meglévő logMeal-teszt átcímzése); missed-sziget `Pótold` → ugyanaz a sheet; minden-kész seed → keret a nagy. FAIL.
- [ ] **Step 3:** Recompose: `screen-content`-be `sky-islands` konténer; sorrend: múlt/most/jövő ablakok a `river.islands` szerint, az öv a nagy sziget UTÁN (DOM-sorrendben a now-sziget után fixen — spec §2 ég-ábra); `.pghead-np` fejléc-sor, `retamicro`, `NowWindowCard`, `DayZoneCard`, `DayBudgetCard` importok törlése a Mai-ról; skeleton az új layoutra (AppHero-azonosság: a section-shell adja, itt csak a test cserél).
- [ ] **Step 4:** `pnpm vitest run src/features/fuel/pages` → PASS.
- [ ] **Step 5:** Commit: `feat(fuel): Mai = ablak-folyam ég + Keret-öv (mezo-jgh9)`.

---

### Task 6: Retirálás-takarítás + dokumentáció + ADR

**Files:**
- Delete/módosít: `NowWindowCard.tsx` (+teszt) ha nincs más fogyasztója; `DayZoneCard`/`DayBudgetCard`/`MissedStrip` fogyasztó-ellenőrzés — csak a Mai-ról kerülnek le, más fogyasztó nélküli komponens törölhető tesztjével együtt; `prototype.css` árva `.nowcard*`/`.retamicro*`/Mai-only családok törlése.
- Create: `docs/decisions/0023-fuel-window-river.md` (ADR: miért ablak-sziget + keret-öv; a Today-nyelv 2. fogyasztója → Island shared).
- Modify: `docs/features/fuel.md` (§2 Mai, §3 kompozíció, §9 CSS/retirálások), `docs/features/today.md` (Island → shared/ui jegyzet), `docs/features/_platform-design-system.md` (`.isl*` shared vocabulary + data-tone + `.isl-belt` + sage-gradient tokenek).

- [ ] **Step 1:** `grep -rn` minden retirálandó komponensre — fogyasztó-lista; csak árvát törölj, a többinél csak a Mai-import szűnik.
- [ ] **Step 2:** CSS-takarítás: a törölt komponensek családjai ki; `pnpm build` zöld.
- [ ] **Step 3:** ADR 0023 megírása (a 0022 szerkezetét követve, driving bd: mezo-jgh9).
- [ ] **Step 4:** A három feature-doc frissítése az új §-okkal; `node scripts/lint-docs.mjs` → a fuel/today/DS docok nem stale-ek, link-hiba nincs.
- [ ] **Step 5:** Commit: `docs(fuel): window-river feature docs + ADR 0023 + DS-platform sweep (mezo-jgh9)`.

---

### Task 7: Kapuk + vizuális goldenek (operátor-task, a fő session futtatja)

- [ ] **Step 1:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — mindhárom zöld; hibánál javítás ugyanabban a körben.
- [ ] **Step 2:** Darwin visual goldenek: a fuel-mai state-ekre (`now-nagy`, `keret-nagy`, `L1-nyitva`, `missed`) meglévő golden-szkript bővítése/újragenerálása (`pnpm test:visual -u` a repo bevett módján), diff-ek átnézése.
- [ ] **Step 3:** Push + self-PR (`gh pr create`), CI-monitor; `test-visual` linux-bukásnál a `update-visual-baselines` workflow dispatch + bot-commit approve (a Today-körben bevált lánc), újra zöldig.
- [ ] **Step 4:** `git pull --rebase` main → `--no-ff` merge → push → PR auto-close → branch-törlés → `bd close mezo-jgh9` + `bd dolt push` → deploy-workflow monitor zöldig.
