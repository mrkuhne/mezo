# Fuel „Mai" slot-timing + fuel_settings + slot-level AI logging (design spec)

- **Date:** 2026-07-23 · **bd:** `mezo-53su` · **Related:** [`2026-07-23-sleep-anchor-design.md`](2026-07-23-sleep-anchor-design.md) (slice A — the anchor this slice consumes) · [`2026-07-23-sleep-routine-cluster-notes.md`](2026-07-23-sleep-routine-cluster-notes.md) §3 (the "consumers" row)
- **The first anchor consumer.** Slice A made the sleep goal the day's wake/bed source and already repointed the Fuel timeline's anchors. This slice finishes the promise: the Mai timeline becomes *live* (now-aware re-flow, demo-faithful mock), the last planner settings move to a Fuel-owned home (`mealsPerDay` + the caffeine cutoff), slots gain identity, and AI logging becomes slot-targeted.
- **Decided with Daniel in-session** (4 explicit choices, 2026-07-23): all four slot-timing pains in scope; `fuel_settings` singleton with caffeine cutoff as a user setting; now-aware redistribution; per-slot AI chip with slot-lock.

## 1. Goal

Make the Mai timeline a living plan: pending meal windows re-flow around what actually happened (never stuck in the past), the demo follows the anchor, the timing knobs (`mealsPerDay`, caffeine cutoff) live in a Fuel-owned per-user setting editable on the Mai page, every slot carries its identity, and each open meal slot can launch AI logging pre-targeted at that slot.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Scope | **All four slot-timing pains in one slice:** late-log re-flow, hardcoded timing constants, mock/demo anchor-blindness, missing slot identity — they share one logic core (`buildDayPlan`) and one settings home. |
| D2 | Settings home | **New `fuel_settings` per-user singleton** (`meals_per_day int` 3..6, `caffeine_cutoff varchar(5)` HH:mm) — third instance of the `intention_creed`/`sleep_goal` shape. `GET /api/fuel/settings` **never 404s** (config-ghost 4 / "14:00"); PUT upserts. `mealsPerDay` leaves the weight goal's editing surface (column stays on the wire, unread — dropped later with wake/bed); the caffeine cutoff becomes personal (Ethier's rec is a default, not a law). |
| D3 | Habit unification | The habit engine's `caffeine_cutoff` metric reads a **fuel-owned, UNGATED `CaffeineCutoffPort`** (resolver: row → cutoff, else ghost) — the `SleepAnchorPort` pattern verbatim. `HabitProperties.caffeineCutoff` + the `mezo.habit.caffeine-cutoff` yml key are REMOVED (dead config forbidden). One cutoff, three consumers (Mai chip, day plan, habit metric). |
| D4 | Re-flow semantics | **Now-aware redistribution.** On every plan build, PENDING meal windows are re-spaced evenly between `max(now, last logged meal + 90 min)` and kitchen-close; the 90-min minimum-gap forward-push runs **first**, then the future-block training snaps are **re-applied last** (the snap is the hard physiological anchor — a snapped post-workout main wins the tie, so the 90-min gap may be **locally undercut** around it). A pending slot never renders in the past. Deterministic — same inputs, same plan (`nowHHmm` stays an injected input). Done slots keep rendering at their actual `loggedAt`. |
| D5 | Slot identity | `PlannedWindow.slotKey` survives into **`FuelSlot.slotKey?: SlotKey`** (absent for block/water/protocol slots). `slotKeyOfLabel` label-guessing is deleted; slot actions and meal→window matching use the key. |
| D6 | Demo fidelity | The mock timeline **runs `buildDayPlan` over the mock data** (mock meals/blocks/budget + mock sleep goal + mock fuel settings) instead of the hand-authored static `fuelPlan.today` seed, which retires. The demo finally reacts to the anchor and the settings. Accepted cost: the Today-page agenda derives from the same plan → **today visual goldens are expected to change** (refresh via the established baseline flow). |
| D7 | Slot-level AI | Open meal-slot cards gain an **AI chip** next to `Logolás`; the sheet opens with `initialSlot` = the tapped slot and **slot-lock**: a slot passed in is NOT overwritten by the draft's proposed slot (the review selector still allows manual change). The header AI button keeps today's behavior (no slot → the draft proposes). No backend change — the slot already rides `MealInput.slot`. |
| D8 | Settings UI | The Mai page's `.fuelchips` row (where cutoff/kitchen-close already display) gains a `szerkeszt` chip → new **`FuelSettingsSheet`** (mealsPerDay stepper 3..6 + cutoff `<input type="time">`). `EditGoalSheet` loses its whole "Napi ritmus" section (the cadence now lives on Fuel; the wake/bed hint already points to the Alvás page). |

## 3. Backend design (`feature/fuel/settings` — new subpackage under the fuel feature)

- **Table `fuel_settings`** (migration `{ts}_mezo-53su_create_fuel_settings.sql`): per-user singleton — `meals_per_day int not null` (`ck` 3..6), `caffeine_cutoff varchar(5) not null`, `OwnedEntity` columns, soft delete, partial-unique `uq_fuel_settings_user on (created_by) where is_deleted = false`. Entity mirrors constraints (`@Min(3) @Max(6)`, `length = 5`).
- **`FuelSettingsService`** (gated `mezo.feature.fuel-settings.enabled`): `getSettings(userId)` → row or config-ghost (never 404); `setSettings(userId, req)` find-or-create upsert. Contract-generated validation only (mealsPerDay 3..6, cutoff HH:mm pattern) — no hand-written duplicates.
- **`CaffeineCutoffPort`** (fuel feature, interface: `LocalTime resolve(UUID userId)`) + **UNGATED `CaffeineCutoffResolver`** (row → parse cutoff, else ghost from properties) — same reasoning as `SleepAnchorResolver`: the habit switch must not depend on the fuel-settings switch. `HabitEvaluator`'s `caffeine_cutoff` metric consumes the port; `HabitProperties` drops `caffeineCutoff` (+ yml key removed; existing habit ITs that pinned 14:00 re-seed via a `FuelSettingsPopulator` or assert the ghost — never weakened).
- **Config:** `FeaturesConfiguration.FUEL_SETTINGS_SWITCH = "mezo.feature.fuel-settings.enabled"`; `FuelSettingsProperties` (`mezo.fuel-settings`, `@Validated`): `default-meals-per-day 4`, `default-caffeine-cutoff "14:00"`.
- **Test plumbing:** `fuel_settings` → `ResetDatabase` TRUNCATE list; new `FuelSettingsPopulator` registered in `AbstractIntegrationTest`.

## 4. API contract (`api/feature/fuel-settings/fuel-settings.yml`, tag `FuelSettings`, registered in `merge.yml`)

- `GET /api/fuel/settings` → `FuelSettingsResponse{ mealsPerDay (int 3..6), caffeineCutoff (HH:mm pattern) }`, both required (ghost composition when unset — never 404); 401.
- `PUT /api/fuel/settings` `SetFuelSettingsRequest{ mealsPerDay, caffeineCutoff }` (both required, same bounds/pattern) → `FuelSettingsResponse`; 400 (`VALIDATION_INVALID_VALUE` FIELD errors), 401.
- `goal.yml` untouched — `mealsPerDay` stays on the goal wire, pass-through unread (cleanup migration later, together with wake/bed).

## 5. Frontend design

- **Data layer** (`data/fuel/fuelSettingsHooks.ts` + client in `fuelApi`-style module): `useFuelSettings()` → `{ settings: { mealsPerDay, caffeineCutoff }, isPending }` via `useDualQuery` (key `['fuelSettings']`; mock seed = 4 / "14:00"; `realEmpty` = the same ghost); `useFuelSettingsActions().setSettings` — mock patches the cache, real PUT + invalidates `['fuelSettings']` and `['habitDay']` (the caffeine metric re-centers). The timeline is derived — it recomputes from `['fuelSettings']` automatically. Barrel exports.
- **`timelineHooks.ts`**: `mealsPerDay` + `caffeineCutoff` from `useFuelSettings()` (settings are always present — ghost); `PLANNER_DEFAULTS` and the `CAFFEINE_CUTOFF` const are deleted from `fuelConfig.ts`. `goal.mealsPerDay` becomes unread on the FE.
- **`buildDayPlan.ts`**: `DayPlanInput` gains `caffeineCutoff: string`; `PlannedWindow.slotKey` flows into `FuelSlot.slotKey?`; **now-aware re-flow** — after matching logged meals into windows, the remaining pending meal windows are re-placed evenly on `[max(now, lastLoggedMealTime + MIN_SLOT_GAP_MIN), kitchenClose]` (order preserved; the min-gap forward-push runs first, then the future-block snaps are re-applied **last** as the hard anchor — a snapped post-workout main may locally undercut the 90-min gap, D4); done/block slots untouched. Pure, deterministic, `nowHHmm`-driven.
- **Mock timeline** (`timelineHooks` mock path): builds the plan with `buildDayPlan` over the mock inputs (mock meals/blocks/recipes/budget + `mockSleepGoal` + mock fuel settings + a FIXED mock `nowHHmm` — e.g. "13:30" — so the demo is deterministic); the static `fuelPlan.today` seed and its file retire.
- **`FuelMaiPage` + components**: `.fuelchips` row gains the `szerkeszt` chip → `{settingsOpen && <FuelSettingsSheet onClose={...} />}`; `SlotCard` gains the AI chip on open meal slots (`slotKey` present, state ≠ done) → `onAiLog?.(slot)` → `AiLogSheet` with `initialSlot={slot.slotKey}` and the new slot-lock prop/behavior (`initialSlot` present → skip `setSlot(d.slot)` on draft resolve). `handleLogMeal` switches from `slotKeyOfLabel(slot.label)` to `slot.slotKey`.
- **`EditGoalSheet`**: the "Napi ritmus" section (stepper + hint + save button) is removed entirely; `savePlanner`/`goalResponseToUpsert` keep the pass-through (wire unchanged).

## 6. Integrations

- **→ Habit:** the `caffeine_cutoff` metric reads `CaffeineCutoffPort` (was `HabitProperties.caffeineCutoff`); behavior identical while unset (ghost "14:00").
- **→ Sleep (slice A):** unchanged — wake/bed keep coming from `useSleepGoal`/`SleepAnchorPort`; this slice only consumes.
- **→ Today:** the agenda reads the same `useFuelTimeline` plan — re-flow + demo fidelity apply there automatically; goldens refresh expected (D6).
- **→ Me / weight goal:** `EditGoalSheet` loses its last planner control; `goal.mealsPerDay` unread on both sides (column kept for the joint later drop).

## 7. Testing

**Backend:** `FuelSettingsApiIT` (ghost-when-unset, upsert round-trip, 400 on 2/7/"25:99", 401), `FuelSettingsSwitchOffApiIT` (404), caffeine-port IT (`HabitEvaluator` caffeine metric centers on a seeded `fuel_settings` cutoff; ghost when none — existing habit caffeine ITs re-seeded, not weakened). Populator + TRUNCATE growth rules.

**Frontend:** `buildDayPlan` pure tests — the heart of the slice: late-lunch re-flow (dinner/snack redistribute after `max(now, lunch+90)`), kitchen-close clamping, snap preservation under re-flow, pending-never-in-past, determinism (same inputs → same plan), `slotKey` presence on meal slots and absence on block slots; `useFuelSettings` both modes; `FuelSettingsSheet` (stepper clamp, cutoff edit, save payload); `SlotCard` AI chip (only open meal slots) + `AiLogSheet` slot-lock (draft does not override `initialSlot`; manual change still works); FuelMaiPage integration render; mock-timeline snapshot updates. Gate: build + both modes; **today/fuel visual goldens refreshed** via the baseline workflow if changed.

## 8. Out of scope (this slice)

- Dropping `goal.meals_per_day` (+ wake/bed) columns — one joint cleanup migration later.
- Stock tracking (`mezo-6nu`), the Fuel P8 AI layer (`mezo-0h6w`).
- The manual `LogMealSheet` flow (untouched beyond receiving `slot.slotKey`).
- Morning-training reschedule + protocol setup (the second anchor-consumer slice, separate spec).
- Any change to the AI draft extraction backend (slot already rides `MealInput.slot`).
