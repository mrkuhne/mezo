# Energy-breakdown explanation sheet + Profile Alap-TDEE restyle

- **Date:** 2026-07-27
- **Driving bd:** mezo-hobb — follow-up polish on the dynamic daily-energy feature (mezo-eujg / mezo-1oy5)
- **Status:** design approved (mockup-driven)
- **Mockup:** `scratchpad/energy-breakdown-mockup.html` (light theme, real numbers)

## 1. Problem

The dynamic daily-energy model (mezo-eujg) surfaces its breakdown in two places, both currently weak:

1. **Profile → Biometria card** renders the `Alaphő·NEAT / Betábl. mozgás / Fenntartó·Katch` breakdown inside a container styled `.tdee .tdee-split`. `.tdee` is `display:flex; justify-content:space-between` (horizontal) and **`.tdee-split` has no CSS rule at all**, so the three values cram into one horizontal flex row and wrap awkwardly — no hierarchy, hard to read.
2. **Fuel → "Mai cél" card** shows three chips (`Alaphő 2272 / Mozgás +1290 / Deficit 869`) that are static `<span>`s: no affordance, not tappable, and **no explanation of where each number comes from or why the deficit is that size**.

Users cannot see *why* today's target is what it is — the whole point of the non-static model.

## 2. Goals / non-goals

**Goals**
- Restyle the Profile Alap-TDEE breakdown into a clean, segmented, readable block (approved: **Variant B — stacked list + emphasized total**).
- Make the Fuel "Mai cél" chips tappable, each opening an explanation.
- A **single shared, presentational** explanation sheet reused by both screens (DRY), that explains, per component: the **formula** (mono line) and the **why** (prose). Movement lists **today's training as per-activity pills** (🏋️ Gym 60p · 430 …), not plain text.
- Zero new backend fields — everything derives from existing `useGoal()` data + the Fuel timeline blocks.

**Non-goals**
- No engine/model change (the numbers themselves are already correct post-mezo-eujg).
- No new API endpoints/DTOs.
- The permanent jsonb `ignoreUnknown` hardening (tracked separately as **mezo-hbev**) is out of scope here.

## 3. Data model — `EnergyBreakdown`

A plain typed object each screen builds and passes to the sheet (no data hooks inside the sheet):

```ts
interface EnergyBreakdown {
  base: {                    // "Alaphő · NEAT"
    kcal: number             // neatBaselineKcal (bmr × neat)
    bmr: number
    neat: number             // multiplier, e.g. 1.2
    neatLabel: string        // "Ülő" | "Vegyes" | … (from biometricFields.neatLabel + activity short label)
    formula: 'KATCH' | 'MSJ'
  }
  movement: {                // "Betáblázott mozgás"
    kcal: number             // Fuel: today's activityKcal; Profile: weeklyEatKcalPerDay
    isWeeklyAvg: boolean      // true on Profile (weekly ÷7), false on Fuel (today)
    blocks?: { label: string; kind: 'gym'|'sport'|'run'; min: number; kcal: number }[] // Fuel only → pills
  }
  deficit?: {                // "Deficit · <goal>" — omitted on Profile
    kcal: number             // signed balance (negative = deficit); rendered as −|kcal|/+|kcal|
    rateKgPerWk: number      // segment.projectedRateKgPerWk
    goalLabel: string        // segment.label / goal title, e.g. "Nyári cut"
    rationale?: string       // segment.rationale (fallback prose if present)
  }
  target: number             // base + movement ± deficit (the displayed daily goal)
}
type EnergySection = 'base' | 'movement' | 'deficit'
```

## 4. Components

### 4.1 `EnergyBreakdownSheet` (presentational, no `@/data` import)
**Location:** `features/fuel/sheets/EnergyBreakdownSheet.tsx` — Fuel owns the dynamic-energy concept. `me` imports it (intentional, documented cross-feature reuse of a presentational sheet; avoids duplication and keeps `shared/ui` domain-free). Wraps `@/shared/ui/Sheet` (`children`/`onClose`/`className`/`labelledBy`; conditionally mounted by the opener — the 30-of-31 idiom).

**Props:** `{ breakdown: EnergyBreakdown; initial: EnergySection; onClose: () => void }`.

**Render:**
- Header: eyebrow + `Honnan jön a {target} kcal?` + one-line intro.
- **Equation bar** (`.eqbar`): `Alap {base} + Mozgás {movement} [− Deficit {|deficit|}] = {target}`, color-coded (sage/amber/coral); the deficit term only when `deficit` present. At-a-glance summary above the sections.
- **Sections** (`.seg`), one per present component, in order base → movement → deficit. **Every section renders its derivation as the SAME structured tile row** (`.btiles` → `.btile`s + operator glyphs + a dashed `.btile.result`), NOT a mono formula line. Each tile is roomy with consistent typography — an icon+name header (`.thd`), an uppercase sub-label (`.sub`), and a display-font value+unit (`.val`+`.u`) — laid out on separate lines (no cramming). Tint by section (sage/amber/coral wash). Then the prose `.why` below.
  - `base`: tiles `[🔥 Alapanyagcsere · Katch/MSJ · {bmr} kcal] × [🚶 NEAT-szorzó · {neatLabel} · {neat}×] = [Alaphő · {kcal} kcal]`.
  - `movement`: if `blocks` present → one tile **per activity** (emoji by kind: gym 🏋️, sport 🏐, run 🏃; `[{label} · {min} perc · {kcal} kcal]`) joined by `+`, then `= [Mai mozgás · +{kcal} kcal]`; else (`isWeeklyAvg`) a single tile `[Heti átlag · betáblázott ÷ 7 · {kcal} kcal]`. Prose: MET-based, scales with bodyweight, varies by day → why the target isn't fixed.
  - `deficit`: a **derivation, not an exact equation** — `[🎯 Cél ütem · {goalLabel} · {rateKgPerWk} kg/hét] → [Napi deficit · −{|kcal|} kcal]`. The engine's `projectedRateKgPerWk` tracks the real weight trend (GoalProjectionService), so it need NOT reconcile with `dailyEnergyBalanceKcal` via kcalPerKg — hence a "→" arrow (not `×…÷7=`), and 7700 stays a rough guide in the prose only. Prose from `rationale` if present, else generated ("~rate üteméhez a motor napi ~X kcal deficitet szab, a valós trendhez igazítva").
- The `initial` section gets a highlight ring (`.seg.hl`) and the sheet scrolls it into view on open.

### 4.2 Adapters (pure, per-feature `logic/`)
- `features/fuel/logic/buildEnergyBreakdown.ts` — from `plan.energy` (base/activity/balance/target), today's `blocks` (+ `weightKg`, via `blockKcal`), the current `tdeeBootstrap` (bmr/neat/formula + `neatLabel`), and `currentSegment` (rate/label/rationale). Full three-section breakdown.
- `features/me/logic/buildTdeeBreakdown.ts` — from `tdeeBootstrap` (`neatBaselineKcal`, `bmr`, `neat`, `weeklyEatKcalPerDay`, `formula`) + `activityLevel` (→ `neatLabel`). **No deficit section**; movement = `weeklyEatKcalPerDay` with `isWeeklyAvg=true`, `target = tdee`.

## 5. Wiring

- **Profile** (`features/me/components/BiometricCard.tsx`): replace the `.tdee .tdee-split` block with Variant B markup (3 stacked rows: colored dot + label left, value right; dashed divider; emphasized "Fenntartó" total row with an ⓘ). Wrap the block in a `<button>` that opens `EnergyBreakdownSheet` with `initial='base'`, built via `buildTdeeBreakdown(profile, tdeeBootstrap)`. The `open` state + conditional mount live in `BiometricCard` (or lifted to `ProfilePage` if cleaner). Empty/`null` `tdeeBootstrap` → no breakdown block (unchanged).
- **Fuel** (`features/fuel/pages/FuelMaiPage.tsx`): the three chips become `<button class="chx … chip-tap">`; each opens the sheet with its `initial` (`base`/`movement`/`deficit`). `FuelMaiPage` owns the `open` + `initial` state and builds the breakdown via `buildEnergyBreakdown(...)`. The `staticEnergy` case (no dynamic inputs) keeps hiding the chips — nothing to explain.
- **Data plumbing:** `useFuelTimeline` currently computes `blocks` internally; expose them (and `weightKg`) in its return so `FuelMaiPage` can build the per-block pills. Small additive change; no signature break for existing consumers.

## 6. CSS (`frontend/src/styles/prototype.css`)
- Give `.tdee-split` a real rule (Variant B): reset the horizontal `.tdee` flex to a vertical stack, style `.row`/`.lab`/`.dot`/`.amt`/`.total`.
- Add sheet classes: `.eqbar` (+ terms/ops), `.seg`/`.seg.hl`, the shared **breakdown-tile** system `.btiles`/`.btile`(+`.sage`/`.amber`/`.coral`/`.result`)/`.thd`/`.emo`/`.nm`/`.sub`/`.val`/`.u`/`.op`, section dots/text colors — all via `var(--token)` (no raw hex).
- Add `.chip-tap` affordance (the small ⓘ) for the Fuel chips.

## 7. Testing
- `EnergyBreakdownSheet.test.tsx`: renders all three sections when `deficit` present; two when absent; `initial` highlights the right section; movement renders pills when `blocks` present, weekly-avg line otherwise.
- `buildEnergyBreakdown.test.ts` / `buildTdeeBreakdown.test.ts`: correct field mapping + `target` math; Profile omits deficit.
- Update `BiometricCard.test.tsx` + `FuelMaiPage.test.tsx`: the breakdown/chips are buttons that open the sheet with the expected `initial`.
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.

## 8. Verification & docs
- Runtime-verify in the running FE (mock mode renders the new-shape `tdeeBootstrap` seed) per the `verify` skill: Profile card restyle + tap → sheet; Fuel chips tap → sheet with correct section + pills.
- Update `docs/features/fuel.md` (and the Profile/me feature doc) §4/§5 for the new sheet + interaction; run `node scripts/lint-docs.mjs`.

## 9. Open items resolved
- **Sheet placement:** `features/fuel/sheets/`, cross-feature import from `me` (approved).
- **Per-block pills:** yes — movement section shows today's training as pills (approved).
