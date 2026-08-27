# Fuel feature audit — the redesign's ground truth (2026-08-27)

Exhaustive audit of the REAL Fuel (nutrition) feature, produced for the fuel-tab prototype
round of the UI/IA redesign (mezo-88jw). Everything below was read off the code on 2026-08-27;
paths are repo-relative. **Purpose: no feature may be lost in the redesign.** The fuel-tab
prototype's hub was built against this; the per-subpage deep rounds must consult it too.

---

## 1. IA / route map

Declared in `frontend/src/app/router.tsx:105-127`. Tab entry: `frontend/src/app/TabBar.tsx:13`
→ `{ id: 'fuel', label: 'Fuel', icon: 'fuel' }`.

**Tab group (shares the `FuelSection` shell = `AppHero` + `SubNavDropdown` + `Outlet`):**

| Route | Sub-nav label | Component | Landing |
|---|---|---|---|
| `/fuel` (index) | **Mai** | `FuelMaiPage` | ✅ tab landing page |
| `/fuel/plan` | **Terv** | `FuelPlanPage` | |
| `/fuel/stack` | **Stack** | `FuelStackPage` | |
| `/fuel/recipes` | **Receptek** | `FuelRecipesPage` | |
| `/fuel/kamra` | **Kamra** | `FuelKamraPage` | |
| `/fuel/kamra/:id` | (in-group, full page body) | `KamraItemDetailPage` | |
| `/fuel/gyogyszer` | **Gyógyszer** | `FuelMedicationPage` | |

Sub-nav array: `frontend/src/features/fuel/pages/tabs.ts:8-15` (`FUEL_TABS`, ids
`mai/plan/stack/recipes/kamra/gyogyszer`; `mai` has `end: true`). Rendered as a **dropdown**,
not a tab row — `FuelSection.tsx:16-29`, `accent="var(--sage-deep)"`, plus an `extraAction` row
**"Fuel-beállítások"** (settings icon) that opens `FuelSettingsSheet`.

**Full-page siblings (OUTSIDE the group ⇒ no sub-nav chrome), `router.tsx:121-126`:**
- `/fuel/recipes/new` → `RecipeEditorPage`
- `/fuel/recipes/:id` → `RecipeDetailPage`
- `/fuel/recipes/:id/edit` → `RecipeEditorPage`
- `/fuel/slots` → `FuelSlotsPage` — **reachable ONLY from `FuelSettingsSheet`'s
  "Étkezési ablakok / szerkesztése ›" row** (`FuelSettingsSheet.tsx:66-69`); not in `FUEL_TABS`.

**Navigation edges**
- Mai → `/fuel/plan` (`＋ tervezz` on the empty-day island), `/fuel/recipes` (island `Csere` /
  `Nézd ›`), `/fuel/stack` (island stack-dose `Pipa ✓` → deep-link, `FuelMaiPage.tsx:228`).
- Kamra card tap → `/fuel/kamra/:id`; Kamra detail back → `/fuel/kamra`.
- Recipes card tap → `/fuel/recipes/:id`; `+ Új` → `/fuel/recipes/new`; detail `Szerkesztés` →
  `/fuel/recipes/:id/edit`; editor save (edit) → detail, save (create) → list; `Törlés` → list.
- Stack meal-match suggestion row → `/fuel/recipes/{recipeId}` (`StackMealMatch.tsx`).
- FAB QuickInputSheet tiles (`features/quickinput/sheets/QuickInputSheet.tsx:25-29`):
  **Étkezés** → `/fuel`, **Víz** → `/fuel`, **Stack** → `/fuel/stack`. Navigation-only.
- Mai URL state: `?w=<islandKey>` picks which window island is "big"
  (`FuelMaiPage.tsx:155-168`; key = `` `${slot.time}-${slot.label}` ``, `replace: true`,
  deleted when equal to default; unknown/stale value silently falls back).
- Slots page day-type tab persists via `useStickyTab('fuel.slots.dayType','rest')`.

---

## 2. Per-screen feature inventory

### 2.1 `/fuel` — "Mai" (`FuelMaiPage.tsx`, 271 lines)

Structure: `KeretHero` (above the sky) → `.sky-islands sky-flow` containing `EmptyDayIsland?` +
`DoneWindowsCapsule?` + N × `WindowIsland` + a standing `.mai-logrow`.

**A. `KeretHero`** (`components/KeretHero.tsx`, VM built by `logic/keretHero.ts`)
- Big count-up number: `{remainingKcal}` + `" kcal hátra"`. 2s cubic-ease-out rAF count-up
  (`durationMs = 2000`), animates from the last displayed value, not from 0; instant under
  `prefers-reduced-motion` or jsdom. **Honest negative** on overshoot with Unicode minus `−`
  (U+2212), never clamped. HU thousands grouping (`huInt`).
- Of-line: `eddig {consumedKcal} / **{targetKcal}** · {doneCount}/{totalCount} ablak` — no percent.
- Segmented day-bar: one `<i class="khero-seg">` per **done** meal window, width =
  `pct(slot.kcal, budget.kcal)`, alternating tone (`toneAlt` on odd index). Gold now-marker
  `.khero-mark` at `nowFrac` — **only rendered when some window is `now`**, and only when the
  window span is non-zero (`keretHero.ts:72-78`). Marker is placed on the span of the day's own
  meal windows, not wake→bed.
- 3 energy chips, each a button → `EnergyBreakdownSheet` section: `Alap {base}` → `'base'`,
  `Mozgás +{activity}` → `'movement'`, `Cél {±balance}` → `'deficit'` (class
  `khero-chip-goal`). **Honesty gate:** the whole chip row is hidden when `staticEnergy`
  (`plan.energy.activity === 0 && plan.energy.balance === 0`, i.e. no biometric profile) —
  `FuelMaiPage.tsx:130`, `keretHero.ts:106`.
- 5 rings, 58px / stroke 5, CSS `stroke-dashoffset` transition one frame after mount:
  **Fehérje** (`--macro-protein`), **Szénhidrát** (`--macro-carbs`), **Zsír** (`--macro-fat`),
  **Rost** (`--macro-fiber`, target = static `FIBER_TARGET_G = 30`), **Víz** (`--sky`). Center
  shows integer `%`; below: label + `value / target`. Macro rings are `role="progressbar"`;
  **the víz ring is a real `<button>`** → `WaterLogSheet`, aria-label
  `Víz logolása · {l} a {l} literből`, displayed in **liters with one HU decimal** (`hu1`)
  while the VM carries ml.

**B. `DoneWindowsCapsule`** (`components/DoneWindowsCapsule.tsx`) — **honesty gate: rendered
only when `river.doneGroup != null`, i.e. ≥1 done meal window** (`windowIslands.ts:179`). Sits
first in the sky, own local open/close, never "big", excluded from `?w=`.
- Collapsed summary line: `✓ {count} kész ablak · {kcal} kcal[ · AI-átlag {avgScore} p]` — the
  AI-average part is **omitted when no done meal carries a score** (`aiAverage` returns null,
  never a fake 0). Arrow `›` / `˅`, `aria-expanded`.
- Expanded rows (chronological): name + role tag + meta `{time} · {kcal} kcal · {proteinG} g P`
  (each part only if non-null) + score chip `✨ {scorePct}` (class `kdone-chip` at ≥90,
  `kdone-chip-mid` below).
- Role tag copy: `EDZÉS ELŐTTI` / `EDZÉS UTÁNI` / `STANDARD` (`keretHero.ts:112-116`). Derived
  FE-side: `post` when meal 0…+120 min after workout start, `pre` when −90…0 before, else
  `standard`; no workout → always `standard` (`deriveMealRole`).
- **A row is a `<button>` only when `meal.breakdown != null`** (`clickable`) → opens
  `MealScoreSheet`; otherwise an inert `div.kdone-row-inert` (no dead tap).

**C. `WindowIsland`** per still-open window (`components/WindowIsland.tsx`, VM
`logic/windowIslands.ts`). **Done windows get no island** — they merge into the capsule
(`windowIslands.ts:141`).
- Capsule form: emoji + title + essence + count. Emoji by slotKey: `breakfast 🍳 · lunch 🥙 ·
  snack 🥜 · dinner 🍲`. Essence: `"{time} · kimaradt — pótold"` for `missed`, else
  `"{time} · {mealName ?? label}"`. Count: `"Pótold"` for missed, else `"{l1Count} ›"` where
  `l1Count = 3 + stackDoses.length`.
- Big (L0) form: hero `{time}` + `{title}`; subtitle `"{time}–{nextTime} ablak"` +
  `"edzés {workoutTime}"` (only if today has a gym block) + `"Csúcsfázisban megnőtt étvágy"`
  (only when `medicationCycle.phaseKey === 'peak'`).
- Meal chip: **ghost** `＋ tervezz ide` when there is no real meal idea (`vm.meal == null`, or a
  budget-only fallback where `!fromPlan && name === title`); otherwise emoji + name + meta
  `"a tervből · {kcal} kcal · {p} g P"` (each part only when sourced — no `—` fabrication) +
  `illik: {fit}` **only when `meal.fit != null` — and `fit` is hardcoded null today**
  (`windowIslands.ts:90-91`).
- Fact cells (0–2, grid columns = count): **Fehérje-ugrás** `+{addG} g`, delta
  `"{fromG} → {toG} · a céled {pctOfTarget}%-a"` tone good — built **only for `now`/`future`**
  windows; **Nap-score eddig** `{avg} p` with `"a heti átlagod felett"` / `"…alatt"` —
  **never rendered, `facts.dayScore` is hardcoded null** (`windowIslands.ts:165`).
- Action row: primary CTA `Logold` (or `Pótold` when `state === 'missed'`) → `LogMealSheet`
  with that window's `slotKey` + a recipe prefill if `suggestedRecipeId`; `✨ AI` → `AiLogSheet`
  for that slot; `még {l1Count} ›` → L1.
- L1 (mutually exclusive swap with L0, opens for the *selected* island only; a selection change
  always closes it — `FuelMaiPage.tsx:163`): header `{emoji} {title}`, then groups:
  - **Ablak étkezése** — row title `meal?.name ?? title`, subtitle = meta parts, action =
    `Logold`/`Pótold`.
  - **Csere a tervben** — `🔄 Csere a tervben` / `illő receptek a Kamrából` / `Nézd ›` →
    `/fuel/recipes`.
  - **AI naplózás** — `📷 AI naplózás` / `fotó vagy szabad szöveg` / `✨ AI`.
  - **Ehhez az ablakhoz kötve** — only when `stackDoses.length > 0`: one `💊 {name}` row per
    matching stack verdict (subtitle = `advice ?? metric`), action `Pipa ✓` → navigates to
    `/fuel/stack` (no in-place tick — the verdict shape carries no occurrence id).
  - `összecsuk ↑`.
- Ring: `nowRing` on the island whose key === `river.nowKey`.

**D. `EmptyDayIsland`** — **honesty gate: `mealSlots.length === 0`.** Always big,
`capsule = { 🍽️, 'Üres nap', 'Nincs mai terv', '' }`, hero word `Üres nap`, sub
`Nincs mai terv — tervezz egyet.`, CTA `＋ tervezz` → `/fuel/plan`. `KeretHero` still renders
(targets exist on an empty day).

**E. Standing log row `.mai-logrow`** (always, in every day state): `＋ Logolás` (empty
`LogMealSheet`) and `✨ AI naplózás` (slot-less `AiLogSheet`). Exists because CTAs vanish once
every window is done.

Sheets mounted from Mai: `LogMealSheet`, `WaterLogSheet`, `MealScoreSheet`,
`EnergyBreakdownSheet` (only when `energyBreakdown != null`), `AiLogSheet` (with
`onManualFallback` → opens `LogMealSheet`).

### 2.2 `/fuel/plan` — "Terv" (`FuelPlanPage.tsx`, 149 lines)

- Header: over `Fuel · Heti terv`, h1 = `{title}` (mock: seed label; real:
  `deriveWeekTitle(mondayIso())` → e.g. `Máj 18 – 24`, cross-month `Jún 29 – Júl 5`).
- Weekly stats card, 4 `StatCell`s: **Kcal avg**
  `{round(kcalTarget × kcalAvgFactor).toLocaleString()}` sub `/ {kcalTarget}`, `—` when 0;
  **Protein hit** `{proteinHitDays}/7` sub `napon`; **Stack** `{supplementsAdherence}%` or `—`
  sub `adherence`; **Gym + Sport** `{activeGymDays} + {vbCount}` sub `alkalom`.
- `weeklyNote` prose row (sparkle icon + `SafeMarkdown`) — **hidden when null; real mode is
  always null.**
- Medication cycle card — **hidden when `medCycleWeek.length === 0`.** Eyebrow
  `Gyógyszer-ciklus · 7 nap`, right `D{medCycleDay} · ma`, `MedicationWeekStrip`, and a
  **hardcoded** paragraph: `"D1-D2 peak (étvágy-szuppresszió erős, kcal floor 2500), D3-D5
  stabil ablak (PR-day candidate), D6-D7 trough (mikrobiom + folyadék reset)."`
- `WeekRhythmGrid` (`components/WeekRhythmGrid.tsx`): eyebrow `Heti ritmus · 24h tengelyen`,
  right `06 — 22`; hour axis ticks 06/10/14/18/22 (`HOURS_START = 6`, `TOTAL = 16`); one row
  per gym day with day label + `MA` marker on today; gym bar + volleyball bar positioned/sized
  by time & duration; vertical kitchen-close and coffee-cutoff markers; legend `gym`,
  `volleyball`, `kitchen close`, `coffee cutoff 14:00`. **Gym times are read-only here**
  (owned by Train).
- Recurring patterns section (`Visszatérő minták · Mezo` + `PatternRow`s) — **hidden when
  `patterns.length === 0`; real mode always `[]`.**
- Weekly supplement map (`Heti supplement-térkép` + `{n} item` + `WeeklySupplementGrid`, day
  headers `DAYS_HU`) — **hidden when empty; real mode always `[]`.**

### 2.3 `/fuel/stack` — "Stack" (`FuelStackPage.tsx`, 142 lines)

- Header: `Fuel · Stack` / **Napi protokoll**.
- Day-summary card: `**{huWeekdayFull()} · {edzésnap {time} | pihenőnap}** · ébredés {wake} ·
  lefekvés {bed} · {n} item[, {n} 📌]`, then the mono note
  `minden változás automatikusan mentve`.
- **Empty state (honesty gate `occurrences.length === 0`):** dashed card
  `Üres stack · adj hozzá a Kamrából`.
- Otherwise one `StackZoneCard` per projected slot (key `${zone}-${time}` — pre_workout can
  legitimately emit **two** slots on a multi-block day, `projectStackDay.ts:166-190`):
  - Zone head: label (`Ébredés · Reggeli · Edzés előtt · Edzés után · Ebéd · Vacsora · Este ·
    Lefekvés`, `data/fuel/stackZones.ts`) + time + `anchorNote` (`étkezéshez kötve`,
    `edzés −45p`-style, `edzés +30p`, `lefekvés −2h`, `lefekvés −30p`; multi-block
    pre_workout: `{blockLabel} · edzés −{lead}p`).
  - Row: circular tick button (`aria-pressed={taken}`, `aria-label="{name} bevétel"`,
    **disabled when `skippedToday`**; sage fill + check when taken) → log/undo intake; the
    label button (`aria-label="{name} beállítások"`) → `StackItemSheet`; name is struck
    through when taken; dose subline only when present; badge with strict precedence
    (`StackZoneCard.tsx:18-22`): `ma nincs edzés` (+` → kimarad` when fully skipped)
    **wins over** `📌` (user pin), which wins over `auto`. Skipped rows render at
    `opacity: 0.6`.
- `＋ Hozzáadás a Kamrából` chip → `StackPickerSheet`.
- `StackMealMatch` (`components/StackMealMatch.tsx`) — **hidden entirely when both suggestions
  and verdicts are empty.** Eyebrow `Étkezés-egyeztetés` + right `macro + micro match`;
  suggestion rows (`zoneLabel`, time, recipe name as a `Link`, `{metric} · {reason}`); verdict
  rows (`✓` sage / `⚠` amber, `{mealTitle} · {ma|tegnap}`, metric, amber advice line when not
  ok).
- `Miért így` reasoning card — **hidden when empty**; deduped, **max 3** reasons, drawn only
  from zones `pre_workout | post_workout | evening` (`PRIMARY_REASON_ZONES`,
  `FuelStackPage.tsx:33,51-56`).

### 2.4 `/fuel/recipes` — "Receptek" (`FuelRecipesPage.tsx`, 106 lines)

- Skeleton `RecipesSkeleton` while `pending` (real mode only).
- Header: `Fuel · Receptek` / **Receptek** / mono sub `{n} recept · {n} csillagos`; action
  `＋ Új` → `/fuel/recipes/new`.
- Segmented typebar with live counts: `Mind` / `Reggeli` / `Ebéd` / `Vacsi` / `★`.
  **Note: there is no `snack` segment** even though `FilterId` includes it
  (`FuelRecipesPage.tsx:19-27`) — snack recipes are only visible under `Mind`.
- Grid of `RecipeCard`s. Card anatomy (`components/RecipeCard.tsx`): image band (gradient +
  diagonal stripes placeholder), top-left slot chip + **role tag** (only when
  `role !== 'standard'`: `Edzés előtt`/`Edzés után`) + bookmark icon when starred; top-right
  `RecipeFitBadge`; body = Antonio uppercase name, `MacroCells` on the **per-serving** basis
  (`perLabel="/adag"`), meta `{n} hozzávaló · {totalMins} perc · NOVA {novaDominant}` (NOVA
  colored 1 green / 2-3 amber / 4 red).
- `RecipeFitBadge`: when `mezoFit.score == null` → twinkling sparkle + `Mezo` (pending); when
  scored → `{round(score*100)}` + `fit`. Same slot, no layout shift.
- Empty filter result: card `Nincs egyező recept.`

### 2.5 `/fuel/recipes/:id` — recipe detail (`RecipeDetailPage.tsx`, 341 lines)

- Not-found fallback: back `‹` + card `Nincs ilyen recept.` (real mode shows it briefly on a
  cold deep-link — the guard reads `useRecipes().recipes`, no query status).
- Top bar: `‹` (aria `Vissza`) + eyebrow `Recept`.
- Hero: image band with slot chip + bookmark (if starred) + `RecipeFitBadge size="hero"`;
  below on the card surface: name (26px Antonio uppercase) and meta `{servings} adag ·
  {totalMins} perc · NOVA {n}[ · {roleLabel}] · létrehozva {createdDate}` — the role part
  **only when non-standard**.
- `ServingToggle` (`1 adag` / `Egész · {n} adag`, default **`serving`**) then the 4-cell macro
  hero `kcal / Fehérje / Szénh. / Zsír` (protein cell accented), then `NutrientCells`
  (`Telített / Cukor / Rost / Só`) on the same basis.
- Two local (non-routed) tabs, `role="tablist"` aria `Recept nézetek`: **Részletek** (default)
  and **Hozzávalók {count}**.
- **Részletek** tab:
  - AI busy card — `Mezo értékeli a receptet…` on first generate, `Mezo újraértékeli a
    receptet…` on a write-driven regeneration (`breakdownRefreshing`). Suppresses the stale
    envelope while busy.
  - `Mezo · sablon-olvasat` card — **only when `breakdown.summary` exists**; `fitsFor` chips
    (`● {tag}`) only when non-empty.
  - `PONTSZÁM` header + `{n} szempont · megbízh. {round(confidence*100)}%`; for a non-standard
    role a second line `{roleRubricLabel} mérce szerint` (`általános` / `edzés előtti` /
    `edzés utáni`).
  - `ScoreBreakdownBody` (shared with `MealScoreSheet`): dimension cards + `Lehetne jobb` +
    `Hogyan számoltam`.
  - No-breakdown state: `Sablon-pontszámhoz még nincs elég adat (kcal nélküli hozzávalók).`
  - `LOGOK` + count (count only when >0) + `RecipeLogsList`.
- **Hozzávalók** tab: per-line card, left border = the line's pantry category color, line
  snapshot `name`, `SourceBadge` (resolved from the live pantry) + `· {note}`, right
  `{amount}{unit}`, then `MacroCells` of `line.contribution` and `NutrientCells` of
  `line.nutrients` with `empty="dashes"`.
- Actions (below the content, on **both** tabs, normal flow, not sticky): primary
  `＋ Mai étkezéshez` → `LogMealSheet` prefilled `{source:'recipe', recipeId}`; ghosts
  `Csillag` / `Csillag le` (toggles `starred` via a full `recipeToInput` round-trip),
  `Szerkesztés` → `/edit`, `Törlés` (red, aria `Törlés`) → remove + navigate to list.
  **No confirmation dialog on delete.**
- `RecipeLogsList` empty copy: `Még nem logoltad ezt a receptet ezen a héten.` + `Amint logolod
  a mai étkezésekbe, a Mezo kontextusra futtatja és látod itt a tényleges score-okat.` Log rows
  show slot, loggedAt, `{score*100}` + `{±delta} vs baseline`, or a `✨ pending` chip when
  score is falsy; footer dashed note `Csak a mai naptári logok látszanak itt. Heti / havi nézet
  az Insights tabon.`

### 2.6 `/fuel/recipes/new` + `/:id/edit` — recipe editor (`RecipeEditorPage.tsx`, 380 lines)

Create = edit, one component. Back `‹` row, then header `Fuel · Receptek` / h1 = the typed
name, or `Új recept` (create) / `—` (edit with empty name).

Fields, top→bottom:
- `NÉV` — placeholder `pl. Tonhalsaláta · postworkout`, aria `Recept neve`.
- `SLOT` card: chips `Reggeli / Ebéd / Vacsora / Snack` (default `breakfast` on create) + a
  `Csillag` / `Csillagos` toggle chip on the right.
- `SZEREP` card: chips `Általános / Edzés előtt / Edzés után` (default `standard`) +
  explainer: `A szerep dönti el, milyen mérce szerint pontozzuk: edzés körül a gyors
  szénhidrát üzemanyag, nem hiba.`
- `ADAG` stepper (unit `adag`, min **1**, default 1) and `ELŐ + FŐZÉS` stepper (unit `perc`,
  min 0, default 0). Steppers step by **1** (aria `Csökkentés`/`Növelés`).
- Live total card: `MAKRÓ-ÖSSZEG` + `ServingToggle` (default `serving`) + `MacroCells
  size="md"` + footer echoing the other basis: `{egy adag|egész recept} = {kcal} kcal · P {p}
  · C {c} · F {f}`.
- `HOZZÁVALÓK {count}` list. Empty state: dashed `Még nincs hozzávaló. Nyomd a Kamrából
  hozzáad gombot.` Each row: name + a kind badge for non-food pickables (`kindLabel`), brand
  subline, a **±10 g stepper** with a typeable `AmountField` (accepts comma/decimal,
  mid-typing states hold, resyncs only on external change), unit label, remove `×` (aria
  `Eltávolítás`), and `MacroCells` of that line's live contribution with
  `perLabel="{amount} {unit}"`.
- `＋ Kamrából hozzáad` (dashed) → `IngredientPickerSheet` (stays open for multi-add; duplicate
  refId ignored; picked amount defaults to `ing.per || 100` / `ing.unit || 'g'`).
- `CÍMKÉK` — existing tags as removable chips, plus an inline input `＋ címke` (aria
  `Új címke`, Enter commits, duplicates and blanks ignored).
- Save bar, **portaled into `.phone-screen`** (`.recipe-save-bar`): `Mégse` (navigate −1) and
  `✓ Mentés`, **disabled unless `name.trim()` non-empty AND ≥1 ingredient line** (`canSave`,
  line 167).

Contribution formula in the editor: `round(ing.macros.X × amount / (ing.per || 1))` — same as
backend mapper (`contributionOf`, line 42-51).

### 2.7 `/fuel/kamra` — "Kamra" (`FuelKamraPage.tsx`, 331 lines)

- `KamraSkeleton` while `pending` (real mode only).
- Header: `Fuel · Kamra` / **Polc**; two actions: `🔍 Import` → `ImportItemSheet`,
  `＋ Új tétel` → `AddPantryItemSheet`.
- **Empty state (`allItems.length === 0`):** card `A kamra üres` + `Vedd fel az első tételt —
  ételt vagy supplementet —, és itt jelenik meg a leltárban.` + `＋ Első tétel felvétele`.
- Type switcher (primary axis, coral active pill, count under each): `Mind / Étel / Supp /
  Stim`. **`med` has no segment** — medication items only appear under `Mind`.
- Stats strip: `Tételek {n}` sub `a kamrában`; `Hozzávaló {n}` sub `étel`. **Behind
  `SHOW_PANTRY_STOCK` (currently `false`, `data/_client/flags.ts:14`):** `Lejár {n}` sub
  `< 3 nap`, `Fogy {n}` sub `< 15 adag` — plus the amber attention banner `{n} tétel hamarosan
  lejár — nézd át a leltárt.`
- Filter bar: search input placeholder `Keress tétel, márka…` (matches `name + ' ' + brand`,
  case-insensitive) with a clear `×` (aria `Keresés törlése`); `⚙ Szűrők` button with a coral
  count badge → `CategoryFilterSheet`.
- Active category pills (removable, dot in the category color) when any selected; otherwise an
  8px spacer.
- Type-grouped list in fixed order `food → supplement → stim → med`, each with a colored nub +
  section eyebrow (`Étel / Supplement / Stimuláns / Gyógyszer`) + count + a fading rule;
  `KamraCard` rows.
- `KamraCard`: (stock slot hidden by flag), Antonio name, `SourceBadge` + brand + `koffein`
  chip; food → `P {p}  C {c}  F {f}` + `NovaDot`, right side big `{kcal}` + `kcal`; supplement
  → italic `protocol` line, right side `{dose}` in the kind tint. Kind tints: food sage,
  supplement info, stim `--cat-tendency`, med error; non-food gets an inset left tint bar.
- No-match state: card `Nincs egyező tétel.`
- `Mezo javaslatok` section (sparkle + eyebrow) — **hidden when `suggestions.length === 0`.**
- `Legutóbbi importok` section — **hidden when `imports.length === 0`.** Row = `SourceBadge` +
  `ofWhat` + `ellenőrzés` amber tag when `status === 'manual-review'` + `when`.
- Filter AND-logic (`matches`, line 72-77): type AND selected categories AND search. Category
  options offered by the sheet are only those **present among items passing the other axes**,
  each with a count, **sorted by count desc** (line 84-90).

### 2.8 `/fuel/kamra/:id` — pantry item detail (`KamraItemDetailPage.tsx`, 242 lines)

- Not-found: `‹` + `Nincs ilyen tétel.`
- Back `‹` row, `Fuel · Kamra` over-line, `SourceBadge size="lg"` pill, 26px Antonio uppercase
  name, then `{categoryLabel} · NovaDot` (NOVA only when non-null).
- `Makrók[ · /{per}{unit}]` — **only when `item.macros`** — 4 cells `kcal / P / C / F` (colors:
  `--cat-tendency`, `--info`, `--warning`, `--cat-preference`).
- `Tápanyag` — **only when `item.macros`** — 4 cells `Rost / Cukor / Tel.zsír / Só`, values
  `{v}g` or `—`.
- Section head is **flag-dependent**: `Készlet · ár` when `SHOW_PANTRY_STOCK`, else
  `Dózis · ár` (if a dose exists) else `Ár`. Cells: `Készlet {qty} {unit}[ · {expires}]` (flag
  on) or `Dózis {dose}` (flag off, only if present), and `Ár {price} Ft` / `—`.
- Actions: primary `＋ Logolás · mai étkezésbe` → `LogMealSheet` prefilled `{source:'pantry',
  pantryItemId: backendId}`; ghosts `Szerkesztés` → `AddPantryItemSheet` in edit mode with a
  **fully prefilled** `inputFromItem(item)`, and `Törlés` (amber) → delete + navigate to
  `/fuel/kamra`. **No delete confirmation.**
- ID quirk: stash-derived cards carry an `'stash-'` id prefix (`buildKamraItems`); mutations
  strip it (`backendId`, line 116).

### 2.9 `/fuel/gyogyszer` — "Gyógyszer" (`FuelMedicationPage.tsx`, 168 lines)

- **Honest empty state when `!med.id`** (the current real state — the owner tracks no
  medication): `Fuel · Gyógyszer` / **Gyógyszer** header + `data-testid="medication-empty"`
  card `Nincs aktív gyógyszer` + `Nem követsz gyógyszert. Jelenleg nincs felvételi út a
  felületen — ha kellene, az külön fejlesztés.` **No "add medication" path exists in the UI at
  all.**
- Populated state: header + `＋ Beadás` action; medication card (red left border) with name,
  `{defaultDose} {doseUnit}`, `{routeLabel} · {cadenceLabel}` (`subQ injekció`/`IM injekció`/
  `orális`; `heti · hétfő`…`napi`; raw code as fallback), `MedicationCycleBar` (one cell per
  cycle day, phase glyph `P`/`S`/`T`, phase tints peak `--error` / stable `--sage` / trough
  `--warning`, current cell outlined + `aria-current`, `role="list"` aria `Kinetikus ciklus`),
  phase note `{cycleDay}. nap · **{phaseName} fázis**[ · {ago}]` where
  `ago ∈ {utolsó beadás ma, …tegnap, …{n} napja}`.
- `Beadások` list, newest first: date `huMonthDayDow` + `{dose} {doseUnit}`. Empty:
  `Még nincs rögzített beadás.`
- `LogDoseSheet` on `＋ Beadás`.

### 2.10 `/fuel/slots` — meal-slot template editor (`FuelSlotsPage.tsx`, 581 lines)

- Back `‹`, header `Fuel · Beállítások` / **Étkezési ablakok**.
- Day-type tablist (`role="tablist"` aria `Naptípusok`, sage `SegButton`s): `Pihenőnap` /
  `Reggeli edzés` / `Esti edzés`. Sticky via `useStickyTab('fuel.slots.dayType','rest')`,
  default `rest`.
- **Read-only recommended mode** (no saved template & not forked): a `.zcard` per recommended
  window showing `{HH:mm} · {label} · {kcal} kcal`, then primary `✏ Testreszabás` — **disabled
  while `useSlotTemplates().isPending`** (real-mode cold-load guard). Reference blocks: today's
  real blocks when today's `resolveDayType` matches the selected type, else a synthetic single
  60-min gym block at `07:00` (`training_am`) / `18:00` (`training_pm`), `[]` for `rest`.
- **Editor mode** (a template exists or a fork is in progress) — per row:
  - `Slot neve` free text, `maxLength={40}`, delete button (aria `{label} törlése`).
  - Slot-kind chips `Reggeli / Ebéd / Vacsora / Snack`.
  - Role chips `Általános / Edzés előtt / Edzés után`.
  - Anchor `<select>` aria `Horgony`: `Fix időpont / Ébredés után / Edzés előtt‑után (kezdet) /
    Edzés vége után / Lefekvés előtt`. `fixed` → a `<input type="time">` (aria `Fix időpont`);
    relative → a ±15-min stepper around a typeable `Eltolás perc` field clamped to
    `[-720, 720]`.
  - `Budget %` typeable field, commit-normalized to an **integer clamped `[1,100]`** with
    `Math.trunc` semantics ("12.5" → 12), `onBlur` snaps the text to the committed value.
  - Switching anchor type resets: `fixed → { time: '12:00' }`, relative → `{ offsetMin: 0 }`.
- `＋ Új slot` (dashed) appends `NEW_ROW = { label:'Snack', slotKind:'snack', role:'standard',
  anchor:{fixed,'16:00'}, budgetPct:10 }`.
- `Σ BUDGET` pill: `{sumPct}%`, coral/warm tinted when `|sum−100| > 1`, else sage.
- Live compiled preview: `.zcard` per compiled window `{HH:mm} · {label} · {kcal} kcal · P{p}`.
- Tier-1 guardrails inline (`logic/validateSlotPlan.ts`), errors `role="alert"` coral,
  warnings amber:
  - Errors (block Mentés): `sum_pct` — `„A budgetek összege {n}% — 100% kell legyen"`;
    `too_few` — `Legalább 2 étkezési ablak kell a tervhez.`; `too_many` — `Legfeljebb 8
    étkezési ablak lehet egy tervben.`; `label_length` — `Van egy névtelen (üres nevű)
    étkezési ablak — adj neki nevet.` / `„{label}" neve túl hosszú — legfeljebb 40 karakter
    lehet.` (one per offending row); `out_of_span` — `Van olyan ablak, ami az
    ébredés–lefekvés időszakon kívülre esik.`; `rest_training_anchor` — `Pihenőnapon nem lehet
    edzéshez kötött időzítést használni.`
  - Warnings (advisory): `gap` — `„{a}" és „{b}" között 90 percnél kisebb a rés.`;
    `pre_workout_big` — `„{label}" edzés előtti ablaka túl nagy.` (fires when `budgetPct > 15`
    or the slot's kcal `> 300`); `evening_heavy` — `A nap utolsó harmadára esik a napi budget
    nagy része.` (last third share > 40%); `past_kitchen_close` — `„{label}" a konyhazárás
    után van.`
- Tier-2 AI: `✨ Mezo értékelése` ghost button — **disabled while any error blocks save or a
  call is in flight**; pending copy `✨ Mezo értékeli a felosztást…`; result card
  `Mezo · olvasat` + chip `rendben` (sage) / `érdemes igazítani` (amber warning) + summary +
  per-suggestion rows (`**{slotLabel}:** {text}`); degrade copy `Az AI-értékelés most nem
  elérhető — a determinisztikus ellenőrzés él.` The result **self-clears** on any `rows`
  change or day-type switch. **Never gates Mentés.**
- `Ajánlott visszaállítása` ghost (normal flow, not the save bar) — **only when a saved
  template exists**; deletes the template, drops the stashed draft, reverts to the
  recommendation.
- Portaled save bar (only in editor mode): `Mégse` + `✓ Mentés` (disabled while errors exist
  or a mutation is pending); on success clears the day-type draft and `navigate(-1)`.
- Per-day-type **draft retention**: switching tabs stashes `{rows, forked}` **only while
  forked**, restores on switch-back (`FuelSlotsPage.tsx:197-222`).

### 2.11 Sheets

**`LogMealSheet`** (`sheets/LogMealSheet.tsx`, 394) — eyebrow `Logolás · mai nap`, title
**Mit ettél?**, close `×`.
- `MIKOR` segmented `Reggeli / Ebéd / Vacsora / Snack` (aria-pressed). Initial slot =
  `initialSlot` if given, else wall-clock default: `<11 breakfast`, `<15 lunch`, `<21 dinner`,
  else `snack` (line 61-67). User can still change it.
- Read-only time row `ma · HH:mm` (`toLocaleTimeString('hu-HU')`).
- `NÉV` input, aria `Étkezés neve`, placeholder `Étkezés neve` — **derived-until-touched**:
  default from `deriveMealName(lineNames)` (recipe line → recipe name; pantry lines joined
  with `", "`, accumulated up to `MAX_DERIVED_NAME_LEN = 64` then `…`), sticks once typed.
- `TÉTELEK {n}`; empty: dashed `Még nincs tétel. Adj hozzá Receptből vagy a Kamrából.`
- Line card: left border coral (recipe) / amber (pantry); name + tag chip `recept` / `kamra`;
  stepper — **recipe step 1 `adag`, pantry step 10 `g`**, both `min: 1` (`Math.max(1, …)`,
  line 149); remove `×`; `MacroCells` + `NutrientCells` of that line's contribution with
  `perLabel="{amount} {unit}"`.
- Recipe lines only: an expandable `HOZZÁVALÓK · {n}[ · {n} MÓDOSÍTVA]` block, toggle copy
  `finomhangolás ▾` / `összecsuk ▴`, aria `Hozzávalók finomhangolása`. When `servings > 1` a
  note `a teljes recepthez ({n} adag)`. `RecipeOverrideRow` per ingredient; per-row `onReset`;
  `Alaphelyzet` button when any override exists. **Overrides only record a genuine delta** —
  stepping back to the original amount deletes the key (line 154-162).
- `＋ Receptből / Kamrából hozzáad` → `MealPickerSheet`.
- Live total card: `EZ AZ ÉTKEZÉS` + `{n} tétel` + `MacroCells size="md"` + `NutrientCells
  size="md"`; daily context line `Mai nap eddig **{consumed}** +{total} = **{after}**` /
  `cél **{targetKcal}** kcal` + a two-segment bar (`nowPct` grey + `addPct` coral,
  `addPct = min(100 − nowPct, pct(total, target))`).
- Footer: `Mégse` + `✓ Logolás a mai naphoz`, disabled unless ≥1 line.

**`AiLogSheet`** (338) — eyebrow `AI naplózás · mai nap`, title **AI ételnapló**. Three phases:
- `input`: textarea (`Írd le szabadon`, aria `Mit ettél?`, placeholder `pl. csirkés wrap és
  egy latte…`, 3 rows), `📷 Fotó` file input (`accept="image/*" capture="environment"`, aria
  `Étel fotó`) + thumbnail preview + name + `Fotó eltávolítása`, error paragraph, explainer
  `Írd le, mit ettél, vagy tölts fel egy fotót — az AI felismeri a tételeket és megbecsüli a
  makrókat. Mentés előtt mindent átnézhetsz.`, actions `Mégse` + `✨ AI naplózás` (disabled
  unless text or photo). Photo is downscaled via `resizeImage` before upload.
- `drafting`: card `Elemzem az étkezést…` + sparkle + twinkle dot.
- `review` with 0 lines: `GhostState` `Nem ismertem fel ételt a megadottakból.` + CTA
  `Kézi naplózás` (→ `onManualFallback` → LogMealSheet) + `Vissza`.
- `review` with lines: `MIKOR` slot segmented (a **slot-targeted launch keeps its slot**,
  otherwise the AI's proposed slot wins — line 84), `Étkezés neve` input (placeholder
  `pl. Csirkés wrap + latte`), optional AI `note` paragraph, then per line: source badge
  `Kamra` (brand) / `Recept` / `Becslés` (warning), name, `{kcalPreview} kcal`, delete (aria
  `Sor törlése`), a numeric amount input (aria `Mennyiség`) + unit, and — when `needsReview` —
  `Az AI nem teljesen biztos ebben a sorban — ellenőrizd a számokat.` Actions `Vissza` +
  `✓ Naplózás`.
- Error copy: `Nem sikerült az AI-feldolgozás. Próbáld újra, vagy naplózz kézzel.`
- Amount guard: a non-finite or ≤0 value keeps the previous amount (line 94-99).

**`WaterLogSheet`** (92) — eyebrow `💧 Víz logolása`, title **Mennyit ittál?**, sub
`ma eddig {l} / {l} l`. Chips **250 / 400 / 500 ml** (single-select) + a manual `ml kézzel`
numeric input (placeholder `pl. 330`, aria `Víz mennyisége kézzel (ml)`); **a valid manual
value overrides the chip and deselects it**, and picking a chip clears the manual text.
`✓ Mentés` disabled unless a positive value is selected.

**`MealScoreSheet`** (94) — **returns `null` when `meal.breakdown` is absent.** Eyebrow
`AI score · részletek`, title `mealDisplayName(meal) ?? 'Étkezés'`, sub = raw `meal.slot`.
`ScoreHero` (96px ring, `{scorePct}` + `/100`, macro line `kcal/P/C/F`, `meal.items` free-text
chips, `Confidence` bar + `%`). Coach prose: skeleton `Mezo olvasata készül…`
(`data-testid="coach-skeleton"`) while pending with no summary; card `Mezo · olvasat` when a
summary exists; **nothing at all** when the coach is off. Section `Súlyozott bontás` +
`{n} dimenzió`, then `ScoreBreakdownBody`.

**`ScoreBreakdownBody`** — dimension cards; `Lehetne jobb` + count (hidden when `improve`
empty), numbered rows with an `impact` tag; `Hogyan számoltam` + `ToolChipRow` (hidden when
`tools` empty).
**`DimensionCard`** — label in the dim color, `{score*100}` big, `× súly {weight*100}% =
{contribution} pt`, an 80px progress bar, `detail` prose (`SafeMarkdown`), and a per-dimension
panel: `MacroPanel` (macro), `MicroPanel` (micro), `NovaPanel` (nova), `ContextPanel`
(context/who/fat_quality/plant_diversity/energy_density/portion).

**`EnergyBreakdownSheet`** (178, shared with the Me/profile TDEE card) — eyebrow `Napi cél`,
title `Honnan jön a {n} kcal?`, sub `A napi cél nem statikus — az alapanyagcserédből, a mai
betáblázott mozgásból[ és a célod deficitjéből] áll össze.` Equation bar `Alap + Mozgás
[− Deficit] = Mai cél`. Sections (the one matching the tapped chip gets a `hl` highlight):
**Alaphő · NEAT** (`Alapanyagcsere` {Katch-McArdle|Mifflin-St Jeor} × `NEAT-szorzó` {band
label} = `Alaphő`); **Betáblázott mozgás** (per-block tiles with emoji 🏋️/🏐/🏃 + `{min} perc`
+ kcal, or a `Heti átlag` / `betáblázott ÷ 7` tile when no blocks); **Deficit · {goalLabel}** —
**rendered only when a deficit exists** — `Cél ütem {kg/hét} → Napi deficit`, prose from
`segment.rationale` or the 7700 kcal/kg fallback sentence.

**`FuelSettingsSheet`** (79) — h2 `Fuel beállítások`. Rows: `Étkezés/nap` ± stepper **clamped
3…6** (buttons disabled + 0.4 opacity at the bounds, aria `Étkezés csökkentése`/`növelése`);
`Koffein-cutoff` `<input type="time">`; note `A cutoff a Mai chipet, a nap-tervet és a
koffein-habitot is állítja.`; a navigation row `Étkezési ablakok` → `szerkesztése ›` →
`/fuel/slots`; `✓ Mentés` disabled while `pending || isPending` (blind-save guard over the
ghost prefill). Cold-open prefill re-syncs from the server value **unless the user already
touched a field** (line 17-25).

**`AddPantryItemSheet`** (256) — eyebrow `Új tétel · kézi` / `Tétel · szerkesztés`, title
`Új kamra-tétel` / `Tétel szerkesztése`. `Alap` section: `Típus` select (`Étel / Supplement /
Stimuláns / Gyógyszer`), `Kategória` select (from `pantryCategoryMeta`, default **`protein`**),
`Név`, `Forrás` select (from `pantrySources`, default `manual`). Legacy per-basis note
`Bázis: /{per} {unit} · örökölt`. For food: `Makrók · /100 g` (kcal placeholder, `Fehérje 6`,
`Szénhidrát 4`, `Zsír 9`) + `Tápanyag · /100 g` (`Rost / Cukor / Tel. zsír / Só`, placeholders
`0`). For non-food: `Dózis` section. Then `Készlet · ár` / `Ár` (flag-dependent). Footer:
`Mégse` + `✓ Polcra` / `✓ Mentés`, **disabled unless `name.trim()`**. Create pins
`per: 100, unit: 'g'`; edit echoes the stored basis (`AddPantryItemSheet.tsx:112`).

**`ImportItemSheet`** (580) — eyebrow `Import · OpenFoodFacts`, title `Új tétel a Kamrába`,
explainer `Keresés az OpenFoodFacts adatbázisban — makrók, tápértékek és NOVA-osztály
automatikusan. Terméknevet vagy vonalkódot is beírhatsz.` Three modes (`Keresés (OFF)` /
`Link` / `Fotó`), each with input → `searching` → `preview`:
- Keresés: field `Terméknév vagy vonalkód` (placeholder `pl. skyr · 5900512300108`); **min 2
  chars to fire**; a `HAMAROSAN · gyors-import` inert row; result list (name, brand · barcode,
  `{kcal} kcal`, `NovaDot`) with a selected card; the confirm card `Polcra kerül ·
  /{per}{unit}` with editable `Név` + `Kategória` (18-value contract enum) + P/C/F stat cells
  + `NutrientCells`; no-hit copy `Nincs találat erre: „{query}" — próbáld pontosabb névvel
  vagy vonalkóddal.`
- Link: field `Termékoldal linkje` (placeholder `https://…`); requires the value to start with
  `http`.
- Fotó: label photo (aria `Címke fotó`) + optional front-of-pack photo (aria `Előlap fotó`),
  **`MAX_PHOTO_BYTES = 5_000_000`** with copy `A kép túl nagy (JPEG/PNG/WebP, max 5 MB).`;
  explainer `Fotózd le a termék tápérték-táblázatát — az AI kiolvassa a makrókat /100 g
  bázison. A fotó nem kerül tárolásra.`; CTA `✨ Beolvasás`.
- Error copy: `A keresés most nem érhető el — próbáld újra kicsit később.` / `Az oldal
  beolvasása nem sikerült — ellenőrizd a linket, vagy próbáld később.` / `A fotó beolvasása
  nem sikerült — próbáld élesebb képpel, vagy vidd fel kézzel.` / `A mentés nem sikerült —
  próbáld újra.`
- Provenance follows the **draft**, not the current mode toggle (`origin: 'photo'` only when
  `draft.source === 'photo'`, line 152).

**`CategoryFilterSheet`** (98) — eyebrow `Kategória szűrő`; a `{n} kiválasztva · törlés` clear
button (disabled when nothing selected); multi-select category chips with a color dot + count;
empty copy `Nincs szűrhető kategória.`; commit button `Szűrés ({n} tétel)` with a **live tally
computed against the draft selection**.

**`MealPickerSheet`** (130, nested modal) — eyebrow `Hozzáadás az étkezéshez`, title
`Receptből / Kamrából`; two tabs `Receptek` / `Kamra`; one search (`Keress recept vagy
alapanyag…`, recipes by name, pantry by name+brand); recipe rows show name + slot chip +
`{n} hozzávaló · adag` + per-serving `MacroCells` (`/adag`); pantry rows show name +
`{brand}[ · NOVA n]` + `MacroCells` (`/100g`). Pick emits `{source:'recipe', amount:1,
unit:'adag'}` or `{source:'pantry', amount: per||100, unit: unit||'g'}`; **sheet closes on
pick** (LogMealSheet's `addPicked`).

**`IngredientPickerSheet`** (141, nested modal) — eyebrow `Kamra · pick`, title `Válassz
hozzávalót`; search `Keress a Kamrában…`; rows show name + kind badge + `SourceBadge` +
`{brand}[ · NOVA n]` + `MacroCells` (`/{per}{unit}`); an already-added row is a **disabled
check button** (aria `{name} hozzáadva`). **Stays open for multi-add.** Source = the unified
pickables (foods **plus** supplement/stim/med stash).

**`StackPickerSheet`** (146) — eyebrow `Kamra · stack-pick`, title `Mit szedjünk`; search
`Keress a polcon…` (name+brand, autofocus); rows accent-colored by caffeine → `--warning`,
stimulant → `--cat-tendency`, medication → `--error`, else coral; `koffein` label + an
`a stackben` chip for already-occupied items (**still tappable** — a second zone is valid);
subline `{brand} · {dose}`. **Stays open** for multiple adds.

**`StackItemSheet`** (168) — eyebrow `Stack · időzítés`, title = item name, sub = dose.
Placement card: pinned → `„📌 Ide raktad kézzel ({zoneLabel})"` + `Vissza autóra` (unpin,
closes); otherwise `entry.reason ?? 'Automatikusan időzítve.'`. `Mozgatás másik zónába` — all
8 zone chips, the current one disabled and suffixed ` ✓` (move closes the sheet). `Dózis`
input, **save-on-blur**. `+ Még egy bevétel` — zone chips + a `Dózis` input + `＋ Hozzáadás`
chip (**sheet stays open**). `dailyTotalHint` mono line when present. Footer `🗑 Eltávolítás a
stackből` (red, removes **every** occurrence of the item, closes).

**`LogDoseSheet`** (148) — eyebrow `Beadás · {medName|Gyógyszer}`, title `Új beadás`. `Mikor`:
`Dátum` (default today) + `Időpont` (optional; empty → `00:00`). `Dózis` prefilled from the
last dose, else `medication.defaultDose`, unit label from `doseUnit || 'mg'`. `Jegyzet`
(placeholder `pl. hétfő reggel · subQ has`). `Mégse` + `✓ Beadás`, **disabled unless the dose
parses to a finite > 0**. Sends an **offset-bearing** `administeredAt` (never
`.toISOString()`) so the backend's local-date cycle math is right.

**`ReplanSheet`** (244) — **dead code: no importer anywhere** (only its own file + test). Same
for `MealScoreChip` (`components/MealScoreChip.tsx`) and `logic/dayZones.ts`'s `buildDayZones`
(only `isMealSlot` is still consumed).

---

## 3. Data model

All FE types in `frontend/src/data/types.ts`.

**`FuelDay`** (`types.ts:195-201`) — `{ targets: MacroSet; consumed: MacroSet; meals:
FuelMeal[]; pacing: {msg}; micronutrients: Micronutrient[]; supplements: FuelSummary[] }`.
Only `targets/consumed/meals` are query-driven; **`pacing`, `micronutrients`, `supplements`
are always the static mock seed in BOTH modes** (`data/fuel/fuelHooks.ts:50-52`) and rendered
nowhere. `MacroSet = { kcal, p, c, f, water }` (grams; water in ml). Real-mode unresolved
fallback is an **all-zero** day, never the seed (`FUELDAY_EMPTY`, line 30).

**`FuelMeal`** (`types.ts:109-127`) — `id`, `slot` (real: the enum; mock: an HU display string
like `'Reggeli · 09:15 · post-workout'`), `title`, `score: number | null` (0..1),
`kcal/p/c/f`, `fiberG?: number | null`, `nutrients?: Nutrients`, `mealItems: MealItemLine[]`,
`items: string[]` (legacy free-text labels, used by `ScoreHero` chips), `tags`, `loggedAt`
(ISO instant), `mealDate` (day key), `recipeId?`, `breakdown?: MealBreakdown`.
`MealItemLine`: `source: 'recipe'|'pantry'|'estimate'`, `refId`, `amount`, `unit`, `name`
(server snapshot, frozen at log time), `contribution {kcal,p,c,f}`, `nutrients?`,
`nova?: 1..4`.
`Nutrients = { fiberG, sugarG, saltG, saturatedFatG }`, **all `number | null` and null means
"the source carried no value", NOT zero** (`types.ts:316-322`); a rollup field is null only
when every line was null.

**`FuelSlot`** (composed, `types.ts:32-46`) — `time` `'HH:mm'`, `kind: FuelKind`
(`wake|meal|midday|snack|preworkout|workout|sport|evening`), `label`, `slotKey?: MealSlot`
(present on meal/snack windows only — absent on block/protocol slots), `state:
'done'|'now'|'pending'|'missed'`, `mealName?`, `mezoNote?`, `windowTip?`, `kcal/p/c/f?`,
`duration?`, `items?: SlotItem[]`, `mealId?`, `suggestedRecipeId?`.
`SlotItem = { type:'supplement'; refId; label; done; primary?; note? }`.
**`FuelPlanToday`** — `workout {type,start,end,duration}`, `volleyball {start,end,noneToday}`,
`bedtime`, `kitchenClose`, `caffeineCutoff`, `energy {base, activity, balance, target}`,
`slots`.

**Pantry.** `Ingredient` (food, `types.ts:291-300`): `per` + `unit` = macro basis (**per-100
g/ml since mezo-y9ga**), `macros {kcal,p,c,f}`, `fiberG/sugarG/saltG/saturatedFatG?:
number|null`, `price/priceUnit/pkg`, `micros [{name,pct}]`, `nova: NovaGroup` (**nullable on
the wire since mezo-32ko** — an unclassified item is honest null, not a fabricated NOVA 1),
`stock: IngredientStock|null` (`{qty, unit, expires: string|null, lowExpiry?}`), `lastUsed`,
`usedInRecipes`, `scrapedAt?`, `stashRefId?`, `warning?`.
`SupplementStashItem` (`types.ts:206-219`): `type: 'supplement'|'stimulant'|'medication'`,
`dose`, `form`, `stock: number|null`, `stockUnit`, `protocol`, `timing`, `taken`, `caffeine?`,
plus the **optional** nutrition/commerce mirror (`source/per/unit/macros/price/priceUnit/pkg/
micros/nova/fiberG/sugarG/saltG/saturatedFatG`) — absent on pure dose items.
`PantryItem` = the merged card model built by `buildKamraItems` (`logic/kamraItems.ts`): stash
items get id `'stash-'+id`, `isStashOnly: true`, `kind` from type (`medication→med`,
`stimulant→stim`, else `supplement`); food `kind` is derived from the **category string
prefix** (`supplement-stim` → stim, `supplement*` → supplement, else food); stash items
already mirrored by an ingredient (`stashRefId` match) are **skipped to avoid duplicate
cards**.

**Recipe** (`types.ts:323-336`): `id, name, slot (free string), category:
'breakfast'|'lunch'|'dinner'|'snack', createdDate, timesLogged, avgScore, lastLogged,
servings, prepMins, cookMins, tags, ingredients: RecipeIngredientLine[], macros {kcal,p,c,f}`
(**whole-recipe** totals), `nutrients?`, `novaDominant: NovaGroup`, `mezoFit: { score:
number|null; fitsFor: string[] }`, `starred`, `role: 'standard'|'pre_workout'|'post_workout'`,
`recentLogs?`, `templateBreakdown?`.
`RecipeIngredientLine`: `refId` (= pantryItemId), `amount`, `unit`, `note?`, `name?` (server
snapshot — only on persisted recipes), `contribution?`, `nutrients?`.

**Stack / protocol.** `ProtocolOccurrence` (`types.ts:225-230`): `id, pantryItemId, slotKey:
StackZoneKey, dose: string|null, pinned, placementSource: 'rule'|'llm'|'user'|'fallback',
placementReason: string|null, restDayFallback: StackZoneKey|'skip'|null, dailyTotalHint:
string|null`.
`StackZoneKey` order/labels: `wake Ébredés · breakfast Reggeli · pre_workout Edzés előtt ·
post_workout Edzés után · lunch Ebéd · dinner Vacsora · evening Este · bedtime Lefekvés`.
`StackDayEntry`/`StackDaySlot` are the projected VMs (`logic/projectStackDay.ts:24-46`) adding
`persistedZone`, `name` (falls back to `'(törölt Kamra-item)'`), `skippedToday`,
`displacedToday`, `taken`.

**Medication.** `Medication`, `MedicationCycleConfig {cycleLengthDays, phases[{key:
peak|stable|trough, fromDay, toDay, label}]}`, derived `MedicationCycle {cycleDay, phaseKey,
phaseLabel, lastDoseAt?, week: MedicationCycleCell[]}`, `MedicationDose {id, administeredAt,
dose, note?}`. Real-mode ghost = a no-medication zero shape (`medicationHooks.ts:28-34`).

**Slot templates.** `SlotTemplate { dayType: 'rest'|'training_am'|'training_pm'; slots:
SlotTemplateRow[] }`; `SlotTemplateRow { label; slotKind: MealSlot; role: RecipeRole; anchor:
SlotAnchor; budgetPct }`; `SlotAnchor = {type:'fixed', time} |
{type:'wake'|'training_start'|'training_end'|'bed', offsetMin}`.

**`FuelSettings`** — `{ mealsPerDay: number; caffeineCutoff: 'HH:mm' }`; the honest ghost in
BOTH modes before a save is **`{ 4, '14:00' }`** (`fuelSettingsHooks.ts:8`).

### Derived values (the math a redesign must preserve)

Constants: `data/fuel/fuelConfig.ts`
- `EATING_START_OFFSET_MIN = 45` (eating span starts at wake+45), `KITCHEN_CLOSE_OFFSET_MIN =
  90` (kitchenClose = bed−90), `PRE_WORKOUT_SNAP_MIN = 75`, `POST_WORKOUT_SNAP_MIN = 45`,
  `DEFAULT_BLOCK_MIN = 60`, `DEFAULT_RUN_MIN = 45`, `MIN_SLOT_GAP_MIN = 90`, `SLOT_WEIGHT =
  { main: 2, snack: 1, postWorkoutMain: 2.5 }`, `RECIPE_FIT_TOLERANCE = 0.2`,
  `FAT_KCAL_SHARE = 0.275`, `FIBER_TARGET_G = 30`, `MET_BY_KIND = { gym 6.0, sport 4.5,
  run 9.5, default 5.0 }`, `PERI_SNACK_MIN_KCAL = 300`, `PERI_SNACK_MIN_DURATION = 90`,
  `MAX_TEMPLATE_SLOTS = 8`, `PRE_WORKOUT_SLOT_WARN_PCT = 15`, `PRE_WORKOUT_SLOT_WARN_KCAL =
  300`, `EVENING_SHARE_WARN = 0.4`, `ROLE_MACRO_MULTIPLIERS = { standard 1/1/1, pre_workout
  p0.5 c1.6 f0.4, post_workout p1.7 c1.1 f0.7 }`. Zone fractions (dayZones, now only used via
  `isMealSlot`): `morning 0, midday .30, afternoon .52, evening .72`; labels `Reggel / Dél /
  Délután / Este`.

**Daily budget** — `deriveDailyBudget` (`logic/buildDayPlan.ts:133-162`):
- Static path (no `bmr`/`neat`): with no prescription segment the fallback `MacroSet` passes
  through verbatim (water dropped); with a segment, `kcal = segment.kcal`, `p =
  segment.proteinG`, `f = round(baseKcal × 0.275 / 9)`, `c = max(0, round((kcal − p×4 −
  f×9)/4))`; `energy = { base: kcal, activity: 0, balance: 0, target: kcal }`.
- Dynamic path: `maintenance = bmr × neat`, `eat = Σ MET×weightKg×(min/60)` over
  gym/sport/run blocks, `balance = segment.dailyEnergyBalanceKcal ?? 0`, `target = max(bmr,
  maintenance + eat + balance)` (**BMR is the floor**). Protein stays fixed, **fat is tied to
  the BASE segment kcal** (stable), **carbs absorb the whole activity bonus**.
- Segment selection: the ACTIVE goal's prescription segment covering the current goal-week
  (`currentWeekOf(startDate, totalWeeks)`), else the FIRST segment (`timelineHooks.ts:53-62`).

**Window placement** — `placeWindows` (line 170-233): mains `Reggeli / Ebéd / Vacsora` at span
fractions `0 / 0.5 / 1`; snacks by cadence — `≥4` adds `Uzsonna` (midpoint Ebéd↔Vacsora), `≥5`
adds `Tízórai` (Reggeli↔Ebéd), `≥6` adds `Esti snack` (Vacsora − 90). `mealsPerDay` is clamped
to `[3,6]`. A "significant" block (dur ≥ 90 **or** burn ≥ 300 kcal) earns a `Pre-workout
snack` at `blockStart − 60`, deduped against existing windows by the 90-min min-gap. Then
**one** training snap over the whole envelope: the main nearest the LATEST block end moves to
`latestEnd + 45` and gets weight 2.5; the nearest window strictly before the EARLIEST start
moves to `earliestStart − 75`. All clamped into `[eatingStart, kitchenClose]`, sorted,
forward-pushed to keep 90-min spacing.

**Budget split** — `splitBudget` (weight-proportional per macro, `Math.round`, **rounding
drift absorbed by the dinner window** so Σ === daily exactly). `splitBudgetPct` (template
path): kcal straight by pct; p/c/f by `pct × ROLE_MACRO_MULTIPLIERS[role]` then
**column-renormalized** so each macro sums to the daily budget; **drift absorbed by the
largest-pct slot**. Empty window list returns `[]` defensively.

**Slot filling** — `buildDayPlan` steps 2-3: logged meals grouped by `slotKey` (mock
recognizes HU display strings via `mealSlotKey`), each group sorted by `loggedAt`, filled into
windows in order → `state 'done'`, `time` = the meal's local wall clock from `loggedAt`
(invalid ISO → the window time). Otherwise a recipe suggestion (`pickRecipe`: category match +
per-serving kcal within **±20%** of the slot budget; rank `|Δkcal|` → starred → `|Δprotein|`)
→ `state 'pending'` with `suggestedRecipeId`. Otherwise a budget-only slot.
**Step 3b: surplus logged meals are never dropped** — a 2nd snack on a 4-meal day, any snack
on a 3-meal day, or a duplicate main lands as an extra done slot at its own `loggedAt` time.
**Step 6 (fixed plan):** `nowWindow` = the latest unlogged meal window at/before `now` **while
`now <= bedMin`**; if `now` precedes every window the earliest is `now`; **past bedtime there
is no `now` and every unlogged window is `missed`.** Everything before the now-window is
`missed`, everything after is `pending`. All classification/sorting runs on the **unwrapped**
wake→bed axis so a past-midnight bed/slot doesn't misclassify.
Block slots: `gym → kind 'workout'`, `sport|run → 'sport'`; done once `start + duration ≤
now`. Protocol slots: label `"{zoneLabel} stack"`, kind via `ZONE_FUEL_KIND`, items =
non-skipped entries (`label = "{name} · {dose}"` when a dose exists), slot `done` only when
items exist and all are taken; a zone left with zero entries never renders.

**Keret-hero derivations** (`logic/keretHero.ts`): `remainingKcal = budget.kcal −
consumed.kcal` (unclamped); segments only from **done meal windows**, all sharing the
`budget.kcal` denominator; `fiberG = Σ meals.fiberG ?? 0` (a missing value contributes 0,
never fabricated) against the static 30 g target; `aiAverage` ignores null scores and returns
null when nothing is scored.

**Meal-match** (`logic/matchMealsToStack.ts`): fat-bound needles `d3, k2, omega, halolaj,
krill, kurkum, q10, koenzim`; protein-bound `whey, protein, fehérje`; floors `FAT_OK_G = 15`,
`PROTEIN_OK_G = 25` (the latter is **exported but unused** — verdicts are fat-only).
Suggestion candidates are narrowed to the zone's own recipe `category` (fat zones) / `role ===
'post_workout'` (post-workout), ranked by macro-per-serving desc, tie-broken by
`mezoFit.score ?? 0` desc, max 1 per zone. Verdicts only for `breakfast|lunch|dinner` and
compared against `m.f >= 15`.

**Stack projection** (`logic/projectStackDay.ts`): zone times — `wake` = wake;
`breakfast/lunch/dinner` = the placed meal-window time (fallbacks `wake+45` / `12:30` /
`bed−240`); `pre_workout` = `firstBlock − PRE_WORKOUT_STACK_LEAD_MIN`; `post_workout` =
`firstBlock + duration + 30`; `evening` = `bed−120`; `bedtime` = `bed−30`. A zone with a null
time is dropped. **Rest-day regroup:** a `pre_workout`/`post_workout` occurrence with no
training today follows `restDayFallback` — `'skip'` → shown greyed/disabled in
`breakfast`/`lunch`; a zone key → displaced there; default fallback is `breakfast` (pre) /
`lunch` (post). **Stim-aware split:** on ≥2 distinct-time blocks, entries whose names match
`STIM_FREE_NEEDLES` (`stim free, stim-free, stimfree, stimulánsmentes, koffeinmentes,
koffein-mentes, caffeine free, caffeine-free`) anchor to the LAST block; the rest keep the
FIRST; both keep zone key `pre_workout`; an empty partition emits nothing. `resolveTakenKeys`
fans legacy null-`slotKey` intakes out across an item's zone-ordered occurrences.

**Per-line contribution rule (three implementations, one formula):** `round(snapshot.X ×
amount / per)`, `per >= 1` — editor (`RecipeEditorPage.contributionOf`), LogMealSheet
(`lineMeta`), mock cache mutators (`fuelHooks.buildLine`). Recipe lines in a meal:
`round(wholeMacro / servings × adag)`; with overrides the whole recipe is **re-rolled from the
substituted amounts first**, then divided by servings and rounded once at the end.

---

## 4. Write paths

| Action | Hook / call | Contract | Constraints | Mock behavior | XP |
|---|---|---|---|---|---|
| Log meal | `useMealActions().logMeal` → `POST /api/meal` | `MealRequest` | `slot`, `items` required; `items[].source`, `amount`, `unit(minLength 1)` required; `loggedAt` nullable **offset-bearing** ISO; `title` nullable; `provenance.origin ∈ manual\|ai-text\|ai-photo`; estimate lines carry `per/basisUnit/kcal/proteinG/carbsG/fatG`, `nova 1..4`; `MealIngredientOverride: lineOrder ≥ 0, pantryItemId uuid, amount ≥ 0` (0 = line left out) | `mockLog` appends to `['fuelDay', date]` and **recomputes `consumed`** in place (water preserved) | **`awardGamificationEvent(qc, {type:'MEAL'})` — mock only.** `MEAL: 10 XP`, daily cap 5 |
| Update / delete meal | `updateMeal` / `deleteMeal` → `PUT\|DELETE /api/meal/{id}` | full-replace | — | mock patches cache | — |
| AI meal draft | `draftMealFromAi` → `POST /api/meal/ai-draft` (multipart) | `date` required, `text maxLength 2000`, `photo` binary | ephemeral, **nothing persisted**; confirm goes down the normal `POST /api/meal` | mock resolves `MOCK_AI_MEAL_DRAFT` after 600 ms | via the confirm |
| Log water | `useWaterActions().logWater` → `POST /api/water-log` | `amountMl` required, **integer ≥ 1**; `date` defaults server-side | UI adds 250/400/500 or a positive manual ml | mock increments `consumed.water` in place | none |
| Create/update/delete pantry item | `usePantryActions()` → `POST/PUT/DELETE /api/pantry[/{id}]` | `PantryItemRequest`: `kind ∈ food\|supplement\|stim\|med` + `name` required; `category` 18-value enum; `nova 1..4`; `price` integer; `stockExpires` date | UI only requires a non-blank name; create pins `per:100, unit:'g'` | mock add/update/delete on `['pantry']`, **preserving untouched fields** | none |
| Import a confirmed draft | `importItem` → `POST /api/pantry-import` (`mutateAsync`) | `PantryImportRequest`: `name (1..200)`, `per (> 0)`, `unit (1..16)` required; `brand ≤200`, `barcode ≤32`, `category` enum, `nova 1..4`, `sourceUrl ≤2000`, `confidence 0..1`, `origin` pattern `^photo$`, `priceHuf` integer | | mock appends an ingredient + prepends an imports-feed row | none |
| OFF lookup / URL scrape / photo extract | `lookupItems` / `scrapeItem` / `photoExtract` | `GET /api/pantry-import/lookup?q`, `POST /api/pantry-import/scrape` (`url` 12..2000), `POST /api/pantry-import/photo` (multipart) | ephemeral reads, no cache; FE gates: `q.length ≥ 2`, URL starts with `http`, photo ≤ 5 MB | canned fixtures after 600–700 ms | none |
| Create/update/delete recipe | `useRecipeActions()` → `POST/PUT/DELETE /api/recipe[/{id}]` | `RecipeRequest`: `name (minLength 1)`, `category` `^(breakfast\|lunch\|dinner\|snack)$`, `ingredients` **minItems 1** required; `servings` integer ≥ 1 default 1; `prepMins/cookMins` ≥ 0 nullable; `role` `^(standard\|pre_workout\|post_workout)$` default `standard`; `RecipeIngredientRequest.amount` exclusiveMinimum 0, `unit` minLength 1 | Editor gate: name + ≥1 line. Editor always sends `cookMins: 0` and folds prep+cook into `prepMins`; `slot` is passed through unchanged from the existing recipe (never editable) | mock rebuilds the recipe with the shared macro formula, preserving `createdDate/timesLogged/avgScore/lastLogged/mezoFit/recentLogs/templateBreakdown` | none |
| Star toggle | `update(id, {...recipeToInput(r), starred: !starred})` | full-replace | — | — | none |
| Add stack occurrence | `useProtocolActions().addItem` → `POST /api/fuel/protocol/items` | `pantryItemId` required; `slotKey` pattern of the 8 zones; `dose maxLength 60` | omitted `slotKey` ⇒ the engine places it (rule → pantry timing → LLM); duplicate `(item, zone)` → **409 → global toast** | mock mirrors the placement rules; duplicate = silent no-op | none |
| Move / re-dose / unpin occurrence | `moveItem` / `setDose` / `unpinItem` → `PATCH /api/fuel/protocol/items/{id}` | `slotKey` pattern, `dose ≤ 60`, `pinned` (false = unpin) | move sets `pinned: true` + `placementSource 'user'` + reason `Kézzel ide helyezve.`; dose saves **on blur** | mock patches cache | none |
| Remove occurrence(s) | `removeItem` / `removeAllFor` → `DELETE /api/fuel/protocol/items/{id}` | soft delete | `removeAllFor` fires N parallel deletes | mock filters cache | none |
| Log / undo intake | `useStackActions().logIntake/undoIntake` → `POST /api/fuel/intake`, `DELETE /api/fuel/intake/entry/{id}` | `pantryItemId` required; `takenAt` offset-bearing (defaults now); `slotKey`; `dose` (defaults to the pantry item's) | undo resolves the row id from the cached day, matching `(item, zone)` then falling back to a legacy null-zone row | mock adds/removes a row in `['fuelIntake', date]` | none |
| Save / delete slot template | `useSlotTemplateActions()` → `PUT\|DELETE /api/fuel/slot-templates/{dayType}` | `slots` **minItems 2, maxItems 8**; per slot `label ≤ 40`, `slotKind`/`role`/`anchorType` patterns, `time` HH:mm (required for `fixed`), `offsetMin −720..720`, `budgetPct` integer 1..100 | Save blocked by Tier-1 errors only | mock upserts/removes in `['fuelSlotTemplates']` | none |
| Evaluate slot plan (AI) | `useSlotTemplateEvaluation().evaluate` → `POST /api/fuel/slot-templates/evaluate` | `dayType`, `slots (2..8)`, `budget`, `balanceKcal` required; `resolvedTimes[].label ≤ 200` | stateless, nothing persisted; **503 `FUEL_SLOT_TEMPLATE_LLM_UNAVAILABLE` → in-card degrade note** | canned `ok` verdict after 400 ms | none |
| Save fuel settings | `useFuelSettingsActions().setSettings` → `PUT /api/fuel/settings` | `mealsPerDay` **integer 3..6**, `caffeineCutoff` `^([01]\d\|2[0-3]):[0-5]\d$` | Save disabled while loading/pending | mock `setQueryData` | none |
| Log dose | `useMedicationActions().logDose` → `POST /api/medication/{id}/dose` | `dose` required; `administeredAt` offset-bearing nullable; `note` nullable | UI requires dose finite > 0 | mock recomputes the cycle (a today-dated dose re-anchors `cycleDay` to 1) | `MEDICATION: 5 XP`, cap 3 (mock path) |

**Optimistic updates:** there are none in the classic sense. Mock mode writes **directly into
the query cache** via `setQueryData`; real mode is fire-and-forget `mutate` +
`invalidateQueries` (no `onMutate`/rollback). Errors surface only through the global
`MutationCache` toast (QueryProvider), except where a sheet keeps its own local error copy
(`ImportItemSheet`, `AiLogSheet`, the slot-plan degrade note).

**Real-mode invalidation fan-out (easy to lose):**
- `useMealActions.invalidate` → `['fuelDay']`, `['recipes']`, `['pantry']`, **`['habitDay']`**,
  **`['dailyQuests', date]`** (server-derived habit/quest ticks need a read nudge).
- `useWaterActions` → `['fuelDay']` + `['dailyQuests', date]`.
- `useStackActions` → `['fuelIntake', date]` + `['habitDay']` + `['dailyQuests', date]`.
- `usePantryActions.update/remove` → `['pantry']`, **plus** `['recipes']` and the
  **per-recipe** breakdown keys, but **only** for recipes that actually reference the item and
  only when a live-read fact moved (`pantryImpact.movesRecipeScores`).
- `useRecipeActions.update` → lists + **only this recipe's** breakdown key; `remove`
  **removes** (not invalidates) the key so no 404 refetch.
- `useFuelSettingsActions` → `['fuelSettings']` + `['habitDay']` (the `no_stim_after` metric
  re-centers).
- `useMedicationActions` → `['medication']` + `['today']` + `['fuelDay']`.

---

## 5. Cross-links

**Goal / TDEE → kcal target.** `useFuelTimeline` (`data/fuel/timelineHooks.ts:68-148`) pulls
`useGoal()` (`goalResponse.prescription.segments`, `goalResponse.tdeeBootstrap.{bmr,neat,
formula}`, `goalResponse.startDate`, `startWeightKg`), `useBiometricProfile()` (activity band
label), `useSleepGoal()` (**wake/bed anchor**), `useFuelSettings()` (mealsPerDay +
caffeineCutoff), `useTrain()` + `useRunning()` (blocks via `deriveBlocks`),
`useProtocol()/useStack()/useIntakes()` (stack), `useSlotTemplates()` (per-day-type template).
Backend-side, `FuelDayResponse.targets.kcal`/`protein` come from the active goal's prescribed
recept for that goal-week; `c`, `f` and `water` always come from `mezo.nutrition.*` config.
`EnergyBreakdownSheet` is **shared** with the Me/profile Alap-TDEE card.

**Sleep goal** owns wake/bed ⇒ eating span, kitchenClose, and every stack zone anchor.

**Train** owns gym/sport/run schedules; Fuel only reads them (Terv gym times are read-only
since mezo-4t43). Blocks drive MET activity kcal, window snapping, day-type resolution,
`deriveMealRole`, and the stack's rest-day regroup.

**Today (Nap) tab.**
- `useFuelPreview` (`data/today/todayHooks.ts:190-200`) reuses the same `useFuelTimeline()`
  plan: `visible` = 3 slots from the now-slot, `nextStack` = the first not-done slot with any
  unchecked supplement item, plus the whole `plan`.
- `TodayPage.tsx:140` uses **`useWaterActions(date)`** — the water quick-action logs in place
  (`qa.kind === 'water'` → `logWater(qa.amountMl)`, line 373).
- `TodayPage.tsx:401-402` — a `source === 'fuel'` row opens `LogMealSheet` **in place**
  (Fuel's sheet is imported into Today).
- `TodayPage.tsx:470` — day facts `proteinFact(fuelPlan.slots)` + `kcalFact(fuelPlan.energy)`.
- `features/today/logic/useNeeds.ts:33-34` — the needs engine reads **`useFuelDay(today)` and
  `useFuelDay(yesterday)`** (the `energia` need); `NeedRingSheet.tsx:45` labels it
  `🍽️ Étkezés logolása`.
- FAB `QuickInputSheet` tiles `Étkezés`, `Víz` → `/fuel`, `Stack` → `/fuel/stack`
  (navigation only).

**Mezo companion.** Three LLM read surfaces feed Fuel UI: `useMealCoachFor(mealId)` → the
`Mezo · olvasat` card + `improve[]` override in `MealScoreSheet`; `useRecipeBreakdown(id)` →
the recipe `sablon-olvasat` + prose sockets; `useSlotTemplateEvaluation()` → the slot-plan
verdict. Plus three LLM write/ingest surfaces: pantry scrape, pantry photo, `POST
/api/meal/ai-draft`. All degrade to deterministic-only output when the flag or companion is
off (prose null / envelope only / 503 note).

**Habits / quests / gamification.** `caffeineCutoff` is the source for the `no_stim_after`
habit metric (via the backend `CaffeineCutoffPort`); meal/water/intake writes nudge
`['habitDay']` and `['dailyQuests', date]` so server-derived ticks (`protein_breakfast`,
`kitchen_close`, `caffeine`, `protein_target`, `own_recipe_meal`, `water_target`) appear
without a remount. Mock-mode meal logging awards MEAL XP.

**Day-close / ritual.** `data/ritual/recapHooks.ts:37` reads `useFuelDay(date)` for the recap
(with a noted caveat that `fuel.supplements` there is the static demo list in both modes).

**Notifications.** `data/notification/notificationScheduleWriter.ts` re-composes the same
`deriveBlocks` + protocol anchors to schedule reminders.

---

## 6. Latent gaps / known bugs

**Fields collected but never shown**
1. `FuelDay.pacing.msg`, `FuelDay.micronutrients[]`, `FuelDay.supplements[]` are in the type,
   seeded, and returned by `useFuelDay` — **rendered nowhere** (`fuelHooks.ts:50-52`). They
   are also **static in real mode**, so any consumer would show demo data.
2. `WindowIslandVM.meal.fit` is hardcoded `null` (`windowIslands.ts:90-91`) ⇒ the `illik: {n}`
   chip on the Mai window island can never render, even though `Recipe.mezoFit.score` exists.
3. `WindowFacts.dayScore` is hardcoded `null` (`windowIslands.ts:165`) ⇒ the `Nap-score eddig
   {avg} p` + "a heti átlagod felett/alatt" fact cell is fully built but dead.
4. `FuelSlot.mezoNote` and `FuelSlot.windowTip` are **populated** for protocol slots by
   `buildDayPlan` (step 4) — but the Mai river only renders meal windows, so **both are
   unreachable in the current UI**.
5. `Ingredient.lastUsed`, `usedInRecipes`, `scrapedAt`, `warning`, `micros[]`, `priceUnit`,
   `pkg` are read from the contract but never displayed on any Kamra surface.
   `PantryItemRequest.notes` is in the contract and in `PantryItemInput` — **no field in
   `AddPantryItemSheet`**.
6. `MealBreakdown.tagline` (card-sized cut, ≤60 chars) and `MealCoachVerdict.tagline` exist on
   the wire and in mock data — **no surface renders a tagline**.
7. `Recipe.timesLogged`, `avgScore`, `lastLogged` are in the response and preserved by mock
   writes — **never displayed** on card or detail.
8. `ProtocolOccurrence.placementSource` is only used to derive a binary `auto`/`📌` badge —
   `rule` vs `llm` vs `fallback` is invisible. `Protocol.version/confidence/lastReplanReason/
   history` are typed and returned by `GET /api/fuel/protocol` — no UI.
9. `PROTEIN_OK_G = 25` is exported from `matchMealsToStack.ts` but never used — post-workout
   zones get **suggestions only, no verdicts**; verdicts are fat-only.
10. `Medication.activeIngredient`, `MedicationDose.note` are captured (`LogDoseSheet` has a
    `Jegyzet` field) but the dose list shows only date + dose.

**Dead code a redesign should not resurrect blindly**
11. `sheets/ReplanSheet.tsx` (244 lines) — **zero importers**. `useReplanScenarios` is its
    only feed and returns `[]` in real mode.
12. `components/MealScoreChip.tsx` — zero importers.
13. `logic/dayZones.ts::buildDayZones` + the whole `DayZone`/`ZoneState` model — only
    `isMealSlot` is still consumed. `ZONE_FRACTIONS`/`ZONE_LABELS` in `fuelConfig` are
    therefore orphaned too.
14. `useMealActions().updateMeal` / `deleteMeal` are implemented in both modes but **no UI
    calls them** — a logged meal cannot be edited or deleted anywhere in the app.
15. `useStackActions().logIntake` is also reachable without a `slotKey` (legacy per-item
    back-compat) — the current UI always passes `persistedZone`.

**Actual bugs / inconsistencies**
16. **`WeekRhythmGrid` hardcodes the kitchen-close and coffee-cutoff markers**: `'21:00'` /
    `'21:30'` (when a late volleyball exists) and `'14:00'`, plus the legend string
    `coffee cutoff 14:00` (`WeekRhythmGrid.tsx:24-27, 278`). These ignore
    `FuelSettings.caffeineCutoff` and the sleep goal's bed time, which the Mai plan *does*
    honor. Any user with a non-14:00 cutoff sees a wrong Terv page.
17. **`FuelPlanPage`'s medication paragraph is a hardcoded literal** including a `kcal floor
    2500` claim (`FuelPlanPage.tsx:111-113`) — unrelated to any real phase config.
18. **Recipes typebar has no `snack` segment** (`FuelRecipesPage.tsx:21-27`) although the
    `FilterId` union and `countFor` support it — snack recipes are unreachable except under
    `Mind`.
19. **Kamra type switcher has no `med` segment** (`FuelKamraPage.tsx:37-42`); medication items
    only show under `Mind`, yet `TYPE_META`/`TYPE_ORDER` define a `Gyógyszer` group header.
20. **`RecipeEditorPage` collapses prep and cook time** into one `ELŐ + FŐZÉS` stepper and
    always saves `cookMins: 0` (line 176-177), so an edited recipe silently loses its
    cook-time split (the detail's `totalMins` masks it).
21. **`recipe.slot` is never editable** — the editor sends `slot: editing?.slot ?? null`
    (line 172), so the chip that shows on cards/detail can only ever come from a seed/import.
22. **`Recipe` deletion and pantry-item deletion have no confirmation** (`RecipeDetailPage.del`,
    `KamraItemDetailPage.remove`) and navigate away immediately.
23. **`AddPantryItemSheet` defaults `category` to `'protein'`** — a legacy mock key that is
    **not in the contract's 18-value enum**; the sheet's category select is fed by
    `pantryCategoryMeta` (which mixes legacy keys with the catalog enum). A manually created
    item can land on a category the backend enum doesn't know.
24. **`MealScoreSheet` renders nothing at all when `breakdown` is missing** — a
    scored-but-envelope-less meal opens an empty overlay from any other entry point; only
    `DoneWindowsCapsule` guards the tap (`clickable`).
25. **`FuelSettingsSheet`'s "Étkezési ablakok" row is the ONLY path to `/fuel/slots`** — a
    genuinely discoverable-feature gap for a 581-line editor.
26. **Mock seed drift** — `fuelDay.consumed` is 42% of target while `fuelDay.pacing.msg`
    narrates 59% (documented as mezo-bgk8, deliberately unchased).
27. **`DAYS_HU` has a duplicate `'Sz'`** (Szerda + Szombat) — index-based, used by
    `WeeklySupplementGrid`.
28. **No trends anywhere in Fuel.** There is no weekly/monthly kcal, protein, score, NOVA,
    fiber or adherence chart. `RecipeLogsList` even says so out loud: `Csak a mai naptári
    logok látszanak itt. Heti / havi nézet az Insights tabon.` `GET /api/fuel/week/{start}`
    returns 7 days of `targets` + `consumed` and the FE reduces it to **three scalars**
    (`deriveWeeklyStats`: kcalAvgFactor, proteinHitDays, adherence=null) — the per-day series
    is thrown away. *(The fuel-tab prototype's Napló page is the designed answer.)*
29. **Stock/expiry is a whole shipped feature behind `SHOW_PANTRY_STOCK = false`**
    (`data/_client/flags.ts:14`): the 44px qty slot, `lejár`/`⚠ fogy`, the `Lejár`/`Fogy`
    stats, the expiry banner, the detail `Készlet` cell, the sheet's stock inputs. Data and
    columns are intact.
30. **Fiber has a static 30 g target and no settings field** (`FIBER_TARGET_G`) even though it
    gets a full hero ring; water target comes from backend config, not from any user-editable
    field.
31. **The `EnergyBreakdownSheet` cannot be reached on a static-energy day** (chips hidden) — a
    user with no biometric profile has no explanation of their kcal number at all.
32. **Real-mode "not found" flashes**: `RecipeDetailPage`, `RecipeEditorPage` and
    `KamraItemDetailPage` all guard on the *list* hook (no query status), so a cold deep-link
    briefly shows `Nincs ilyen recept.` / `Nincs ilyen tétel.` (documented in each file's
    header).

---

## 7. Risk list — behaviors that are easy to lose in a redesign

**Defaults**
1. Mai landing default selection: `?w=` absent ⇒ `river.defaultKey = nowKey ?? islands[0].key
   ?? null`; **null when every window is done** (nothing goes big — only the done capsule +
   the log row render). A stale/unknown `?w=` must silently fall back, and setting the default
   key must **delete** the param, not write it.
2. `LogMealSheet` slot default: `initialSlot` wins; else the wall clock (`<11 breakfast`,
   `<15 lunch`, `<21 dinner`, else `snack`). A log opened *from a window* must carry that
   window's `slotKey` — `buildDayPlan` files logged meals **by slotKey alone, never by
   timestamp**, so seeding from the clock fills a different window and leaves the tapped one
   `missed` with a `Pótold` for a meal already logged (the mezo-bnsf bug,
   `FuelMaiPage.tsx:175-184`).
3. Meal name: **derived-until-touched** (`deriveMealName`, 64-char cap + `…`). Losing this
   makes every logged meal title-less again.
4. `ServingToggle` defaults to **`serving`** on both the recipe detail and the editor total;
   `RecipeCard` shows **per-serving** macros while `Recipe.macros` is whole-recipe.
5. Fuel settings ghost `{ mealsPerDay: 4, caffeineCutoff: '14:00' }` is the honest pre-save
   value in **both** modes; the sheet must not persist it blindly while the real read is
   pending, and must not clobber an in-flight edit when the server value lands (`touched`
   flag).
6. `NEW_ROW` slot-template default and `NumberField` commit-normalizers (`budgetPct` → `trunc`
   + clamp 1..100; `offsetMin` → clamp ±720; `onBlur` snap-back).
7. `AddPantryItemSheet` create pins `per: 100, unit: 'g'`; **edit must echo the stored basis**
   or the PUT 400s (`validatePerKind`).

**Orderings**
8. Kamra type-group order is fixed `food → supplement → stim → med`; category filter options
   are sorted **by count desc** and only include categories present after the other axes.
9. Recipe suggestion ranking: `|Δkcal|` → `starred` → `|Δprotein|`, within ±20% of the slot
   budget and matching category.
10. Meal-match ranking: macro-per-serving desc, tie-break `mezoFit.score ?? 0` desc, max one
    suggestion per zone.
11. Stack zone order is the canonical `STACK_ZONE_ORDER` (also used to fan legacy intakes
    across occurrences); `pre_workout` may emit **two adjacent slots** (early first).
12. `StackZoneCard` badge precedence: rest-day regroup > user pin > auto. Inverting it hides
    the one fact the row needs to explain.
13. Done-capsule rows are chronological; `DoneWindowsCapsule` sits **first** in the sky.
14. Rounding-drift absorption: `splitBudget` → the **dinner** window; `splitBudgetPct` → the
    **largest-pct** window; `seedRowsFromRecommendation` → the largest-kcal slot. Σ must equal
    the daily budget exactly, per macro.

**Gating logic**
15. Every honesty gate listed in §2 (chips hidden on static energy; done capsule only when
    something is done; `Mezo javaslatok`/`Legutóbbi importok`/`Visszatérő minták`/`Heti
    supplement-térkép`/`Gyógyszer-ciklus`/`StackMealMatch`/`Miért így`/`fitsFor`/`weeklyNote`
    all hidden when empty; `NutrientCells` returns `null` when all four values are null unless
    `empty="dashes"`; `—` not `0` for a null `supplementsAdherence`).
16. `MealScoreSheet` returns `null` without a `breakdown`; done rows are only clickable when
    the meal has one.
17. Recipe breakdown busy states are **two distinct copies** — `Mezo értékeli a receptet…`
    (first) vs `Mezo újraértékeli a receptet…` (`refreshing` = `!mock && isFetching &&
    !isPending && isInvalidated`), and both must **suppress** the stale envelope. Only
    write-driven invalidations may claim a re-evaluation.
18. Slot-plan: Tier-1 `errors` alone gate `Mentés`; warnings never do; the Tier-2 AI button
    never does; the verdict self-clears on any `rows` change or day-type switch; issue list
    keys are `` `${code}-${i}` `` because codes repeat.
19. `Testreszabás` disabled while `useSlotTemplates().isPending` (real-mode cold-load), plus
    the `!forked && existing != null` late-arrival re-sync, plus the per-day-type draft stash
    (`forked` only) and the `clearDraft` on save/reset. Dropping any one of these re-opens a
    silent-overwrite or resurrected-deleted-template bug.
20. Fixed-plan semantics: `now` **paints state only, it never re-flows the schedule**;
    past-unlogged windows stay faded-but-loggable `missed`; past bedtime there is no `now`;
    surplus logged meals become extra done slots rather than being dropped.
21. Midnight-crossing axis convention: `compileTemplate`/`validateSlotPlan`/`buildDayPlan`
    resolve on the **unwrapped** axis but `PlannedWindow.time` is returned as wall-clock mod
    1440 — a consumer comparing against `wakeMin`/`bedMin` must re-`unwrapDayMinute` first.
22. Layout invariant: the Mai sky carries **`sky-flow`** (content-sized, scrollable) — Today's
    plain `.sky-islands` viewport-fill model clips the CTA row on real phone heights (66px
    lost at 852px, 118px at 800px, 0 at the 956px goldens). Covered by
    `frontend/tests/visual/layout.spec.ts`, which also asserts Today's sky must *not* scroll.
23. Offset-bearing timestamps: `LogMealSheet`, `AiLogSheet` and `LogDoseSheet` all send
    `nowOffsetIso()`/`offsetIso(date,time)`, **never `.toISOString()`** — a UTC wall clock
    mis-classifies pre/post-workout roles and can roll the medication cycle's day key back.
24. Save bars are **portaled into `.phone-screen`** (`.recipe-save-bar`) in both
    `RecipeEditorPage` and `FuelSlotsPage`, with 110px page bottom padding; the slot page's
    `Ajánlott visszaállítása` deliberately stays in normal flow so the bar never stacks three
    rows.
25. Multi-add pickers stay open (`IngredientPickerSheet`, `StackPickerSheet`,
    `StackItemSheet`'s "+ Még egy bevétel"); `MealPickerSheet` closes on pick. Duplicate
    refIds are ignored in the recipe editor and disabled in the picker.
26. Overrides only store a **genuine** delta; the frozen-vs-live kcal rule in
    `RecipeOverrideRow` (untouched row shows the server-frozen contribution, an overridden row
    is rescaled from the live source, or from its own frozen contribution when that source is
    gone).

**Dual-mode (mock vs real) differences a designer will only see in one mode**
27. `useDualQuery`'s invariant: **real mode never falls back to the mock seed** — during the
    cold-load window it returns the explicit empty (`FUELDAY_EMPTY` zero day, `PANTRY_EMPTY`,
    `RECIPES_EMPTY`, `[]` templates, the medication ghost, the settings ghost). A guard test
    (`src/data/dualMode.guard.test.ts`) fails the build if the leaky destructuring-default
    pattern reappears.
28. `pending` is **always false in mock** (seeds resolve synchronously via `initialData`) ⇒
    `KamraSkeleton` / `RecipesSkeleton` / the disabled `Testreszabás` / the breakdown twinkle
    are **only visible in real mode**.
29. Mock time is pinned: `MOCK_NOW_HHMM = '13:30'` (`timelineHooks.ts:39`). Every
    "now"/"missed"/marker state on a mock screenshot is that hour.
30. Real-mode-only honest-empties on Terv: `patterns`, `weeklySupplements` → `[]`;
    `weeklyNote`, `supplementsAdherence` → `null`; `medCycleWeek` → `[]` without a medication.
    Mock shows all of them populated — **a mock-based redesign will over-design four sections
    that are empty in production.**
31. `useReplanScenarios` returns `[]` in real mode (mock-only fixtures) — and its only
    consumer is dead anyway.
32. XP is awarded **only in mock mode** (`awardGamificationEvent` inside the mock
    `mutationFn`); real mode's XP is server-side.
33. Mock-mode caches are **client-owned** (`staleTime: Infinity`, never background-refetched)
    — mock writes persist for the session but nothing validates them; real mode has
    `staleTime: 0` on the day/pantry/recipe reads and `5 min` + `refetchOnWindowFocus: false`
    on the recipe breakdown (it's LLM-priced).
34. `Medication` is permanently empty in production (`!med.id` → the honest empty state) and
    **there is no UI to add one** — the whole populated Gyógyszer design only exists in mock.
35. Mock `FuelMeal.slot` is an HU display string, real is the enum — `mealSlotKey` accepts
    both (`buildDayPlan.ts:101-108`); anything new that reads `meal.slot` directly (e.g.
    `MealScoreSheet`'s sub-line, which prints it raw) will look different per mode.
