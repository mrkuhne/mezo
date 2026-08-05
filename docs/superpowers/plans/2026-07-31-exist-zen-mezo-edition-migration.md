# Exist Zen "Mezo Edition" — design-system migration plan & checklist

**Date:** 2026-07-31 · **Status:** draft (plan approved in-session, checklist pending review)
**Source design system:** `exist-zen-edition/docs/design-system.html` (Design System v2, 52 color tokens, 33 components, 21 anti-patterns) + `MOBILE_UX.md`
**Target:** `frontend/src` (Napív → Exist Zen Mezo Edition)
**Driving bd issue:** epic **mezo-setx**, phases **mezo-setx.1** (P0) → **mezo-setx.10** (P9), chained as blocking deps; every page/sheet in §6 has its own child bead (56 of them, all labeled `ds-migration`, blocked by P3 + their domain `*Section` bead).
**Fresh-context entry point:** [`2026-08-04-ds-migration-handover.md`](2026-08-04-ds-migration-handover.md) — any agent (Claude / Codex / local LLM) reads that doc, runs `bd ready -l ds-migration`, and executes the current bead.

---

## 1. Goal

Replace mezo's current visual system ("Napív") with the Exist Zen design system, **merged** — not copied verbatim:

- the DS supplies the *system*: token structure (5-stop ramps), type role table, spacing/radius/shadow/motion/z-index scales, the 33-component vocabulary, the 21 anti-pattern rules;
- mezo supplies the *identity*: the coral/orange main line, the warm cream surfaces, the 3-mode theme (light / dark "Pulse" / circadian), the domain-accent color coding, the PWA shell (PhoneFrame, frosted TabBar + FAB, circadian sky), and all existing features/flows — **no functionality is lost**, existing UI elements are re-expressed in DS vocabulary.

## 2. Decisions (settled 2026-07-31, in-session)

| # | Decision | Choice |
|---|---|---|
| D1 | Color fusion | **Coral becomes the primary ramp** (from `#FF6B4A`/`#C4622F`); mezo's warm cream surfaces (`#FBF6EF` family) stay as the surface scale; DS gold accent ramp stays as secondary emphasis; lavender demoted to a domain/data color. |
| D2 | Typography | **Adopt Geist + Fraunces** wholesale, including the DS role table (Display 56/200, h1 36/700 … eyebrow 12/700/0.22em) and the Coach voice (Geist 200 ultralight). Bricolage Grotesque + Plus Jakarta Sans retired. |
| D3 | Dark / circadian | **Keep the 3-mode theme.** Every DS ramp gets dark ("Pulse" graphite) stop overrides; the circadian sky band and the `CircadianTheme` resolver stay. The DS gains a "Dark mode" chapter in the Mezo edition. |
| D4 | Domain accents | **Kept, but confined to the data-viz exception band** (like the DS macro colors): Train=coral*, Fuel=sage, Sleep/Me=lav, Sport=rose, Futás=sky, plus amber — legal in charts, rings, icons, heatmaps, signal tints; **illegal** on buttons, badges, links, surfaces. (*coral doubles as primary — inside UI it means "primary", inside data-viz it means "Train".) |

An **ADR** must be written in P0 capturing D1–D4 (`docs/decisions/000X-adopt-exist-zen-design-system.md`).

## 3. Proposed token mapping (P0 input, to be finalized in the Mezo-edition doc)

**Primary · Coral** (derived; contrast-check before freezing — coral-base on white fails AA for text, use hover/deep for text like the DS does with gold):

```
--primary-bg:    #FFF4EF   (light coral wash)
--primary-soft:  #FFDFD3
--primary-base:  #FF6B4A   (mezo --coral)
--primary-hover: #E05535
--primary-deep:  #C4622F   (mezo --coral-deep — verify it reads darker than hover; adjust to ~#A84A26 if not)
```

**Surfaces / text — from mezo (warm), replacing the DS lavender-tinted scale:**

```
--surface-page:   #FBF6EF   (mezo --canvas)      --text-primary:   #2B2118
--surface-card:   #FFFFFF                        --text-secondary: #5F5346
--surface-recess: rgba(43,33,24,0.05)            --text-muted:     #8A7A6A
--divider:        rgba(43,33,24,0.10)            --text-disabled:  #A5978A
```

**Kept from the DS as-is:** accent (gold) ramp, success/warning/error ramps, spacing (`--sp-1..9`, divisible-by-4 — replaces mezo's 8pt names), radius, shadows, motion, z-ladder, halos (re-tint to warm).
**Secondary ramp:** rebuilt from mezo's warm ink (`#2B2118` family) instead of plum.
**Data-viz band:** DS macro-* colors + mezo domain accents (sage/lav/rose/sky/amber + coral-as-Train).
**Dark stops:** each ramp gets a `data-theme="dark"` override block seeded from the existing Pulse values (`#221E1B` surfaces, `#F5EFE6` ink, lifted accents `#FF7E5C` …).
**CTA gradient:** the FAB/CTA coral→amber gradient (`--cta-g1/g2`) survives as the primary-CTA treatment.

## 4. Phase plan

Each phase = one bd issue + one branch + CI-green self-PR. Gate for every phase: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`, plus the `verify` skill for visual checks (light + dark + circadian), plus feature-doc updates + `node scripts/lint-docs.mjs`.

- **P0 — "Mezo edition" DS document.** Port `design-system.html` into `docs/references/design-system-mezo.html` (or split into md), re-skinned per §3: coral primary, warm surfaces, dark chapter, domain-accent/data-viz chapter, Hungarian sample copy. Write the ADR. This document becomes the normative reference the checklist points at.
- **P1 — Token foundation.** Rework `prototype.css` `:root` + dark blocks to the new ramps/scales; alias-bridge every legacy token (`--coral → --primary-base`, `--ink → --text-primary`, `--sp-lg → --sp-4`, …) so unmigrated call sites keep rendering (same technique as the Napív swap); load Geist/Fraunces in `fonts.css`, retire Bricolage/Jakarta; update the Tailwind `@theme inline` bridge in `index.css`; sync `index.html` pre-paint script + PWA manifest theme colors.
- **P2 — `shared/ui` primitive convergence.** Map/rename/extend the ~25 primitives to DS components (table in §5); add the missing DS primitives the pages will need; restyle `prototype.css` component classes (`.card`, `.chip`, `.tab-bar`, `.sheet`, `.toast`…) to DS specs (radius, shadow, type roles, motion tokens).
- **P3 — Shell.** `AppLayout` / `PhoneFrame` / `StatusBar` / `TabBar` (DS BottomNav spec: 12/700 uppercase labels, 48dp targets) / FAB / circadian sky re-tint / `AppHero` + `SubNavDropdown` to DS Hero + Tabs idiom.
- **P4 — Today + Ritual + QuickInput** (3 pages, 7 sheets).
- **P5 — Train** (17 pages, 14 sheets) — the biggest slice; split into 3 sub-passes: landing/week/gym-sport-run · builders (meso/custom/running) · active-session/review.
- **P6 — Fuel** (11 pages, 13 sheets).
- **P7 — Me + Progression** (12 pages, 12 sheets + AppHero overlays).
- **P8 — Insights** (8 pages).
- **P9 — Cleanup & hardening.** Delete the alias bridge + dead tokens/classes/fonts, run an anti-pattern sweep (grep: inline hex, literal ms durations, off-scale font sizes, arbitrary z-index, `<div onClick>`), update `docs/references/frontend_conventions.md` + `docs/features/_platform-design-system.md` + every touched `docs/features/<domain>.md`, final lint-docs.

## 5. Component mapping (P2 worklist)

| DS component | mezo today | Action |
|---|---|---|
| Button / FAB / IconButton | `Cta.tsx`, `.icon-btn`, `.tab-fab` | Restyle to DS variants (primary/secondary/ghost/destructive + sizes); keep CTA gradient as primary |
| Inputs · NumberInput | ad-hoc inputs in sheets | New `Input`/`NumberInput` primitives (Rule 4: `number \| null`, no auto-zero) |
| Chips · Tabs · RangePicker | `Chip.tsx`, `ToolChip`, tabs in `AppHero`/`tabs.ts` | Converge on DS chip/tab specs |
| Pills · Badges · Alerts · Banner · Tag | scattered `.chip`/`.eyebrow` variants | New small primitives per DS |
| ProgressBar · AdherenceBar | `ProgressBar.tsx` | Restyle + add AdherenceBar |
| Toast / Notification | `ToastProvider.tsx` | Restyle to DS notification spec (keep single-host + toastBus) |
| Spinner · Skeleton · Empty · full-page states | `Skeleton*`, `ScreenSkeleton`, `GhostState`, `ErrorBoundary` fallback | Restyle; align GhostState with DS empty/error/loading full-page triad |
| Sheet · Modal · Tooltip · snap heights | `Sheet.tsx` (async dismiss — **keep the requestClose machinery**) | Restyle chrome; adopt snap-height vocabulary |
| Stepper / wizard | builder flows (meso planner, goal planner) | New primitive |
| ListItem | `ItemRow.tsx` / `ItemCard.tsx` | Converge naming + spec (canonical row) |
| StatCard · StatStrip · Hero | `StatCell.tsx`, `Display.tsx`, `AppHero` | Converge; hero numerals to Display 56/200 |
| CoachBubble | briefing/insight cards (`briefing-body`) | New primitive (Geist 200 voice) |
| MacroRing · TrendChart · HeatmapCell | `ScoreRing.tsx`, feature-local charts | Converge/new under data-viz band |
| Avatar | `PeoplePage` initials | New (only if People needs it) |
| DropZone | — (no upload flows) | Skip until needed |
| BottomNav | `TabBar.tsx` | Restyle (P3) |
| **mezo-only, keep as DS extensions:** `SortableList`, `DayNavigator`, `CountUp`, `SubNavDropdown`, `Toggle`, `DatePicker`, circadian sky | — | Restyle to tokens; document in the Mezo-edition DS as extensions |

## 6. Per-page migration checklist

Standard checklist applied to **every** page/sheet (the "8-point check"):

1. ☐ Tokens only — no legacy Napív token refs, no inline hex/rgba (Rule 1)
2. ☐ Type roles from the role table only (no 13/17/20px; hero numbers Display 56/200; eyebrows 12/700/0.22em)
3. ☐ Components swapped to P2 primitives (Rule 8 — nothing re-implemented inline)
4. ☐ Spacing/radius/shadow/motion from the scales (Rule 7)
5. ☐ States: loading skeleton / empty / error per DS full-page-states spec
6. ☐ Dark + circadian verified visually
7. ☐ A11y: 48dp tap targets (Rule 6), `<button>`/`<a>` semantics (Rule 5), focus ring
8. ☐ Both-mode tests green + the feature's `docs/features/*.md` updated

Page-by-page (route → page → notable DS components to apply):

**Shell (P3)**
- ☐ `AppLayout` + `PhoneFrame` + `StatusBar` — surfaces, sky re-tint
- ☐ `TabBar` — DS BottomNav + FAB
- ☐ `AppHero` (+ `TitleShopSheet`, `StreakSheet`, `LevelUpProvider` overlays) — Hero spec
- ☐ `ToastProvider` host — Notification spec

**Today + Ritual + QuickInput (P4)**
- ☐ `/today` `TodayPage` — Hero, StatStrip, CoachBubble (briefing), ListItem agenda, HeatmapCell?
- ☐ `/today` `AnchorModeView` — muted variant on new tokens
- ☐ `/ritual` `RitualPage` — dark-takeover flow on new dark ramps
- ☐ Sheets: `QuickInputSheet`, `ActivityLogSheet`, `CheckInSheet`, `CreedSheet`, `IntentionSheet`, `ReflectSheet`
- ☐ `TodaySkeleton`

**Train (P5)** — pass A: ☐ `TrainSection` · ☐ `/train` `TrainTodayPage` · ☐ `/train/week` `TrainWeekPage` · ☐ `/train/gym` `GymPage` · ☐ `/train/sport` `SportPage` · ☐ `/train/futas` `RunningPage` · ☐ `/train/exercises` `ExercisesPage` (+ 5 skeletons)
pass B (builders, Stepper): ☐ `/train/mesocycles` `MesocycleLibraryPage` · ☐ `…/new` `MesocyclePlannerPage` · ☐ `…/:id` `MesocycleBuilderPage` · ☐ `…/:id/overview` `MesoOverviewPage` · ☐ `/train/custom/new|:id` `CustomWorkoutBuilderPage` · ☐ `/train/futas/:id` `RunningBlockBuilderPage`
pass C (session): ☐ `/train/session` `ActiveWorkoutPage` (rest timer, SortableList) · ☐ `/train/review/:id` `WorkoutReviewPage`
Sheets: ☐ `CatalogExerciseSheet` ☐ `CustomWorkoutSheet` ☐ `DayDetailSheet` ☐ `ExerciseActionSheet` ☐ `ExerciseOverviewSheet` ☐ `ExercisePickerSheet` ☐ `ExerciseRecordSheet` ☐ `FeedbackModal` ☐ `GymScheduleSheet` ☐ `MuscleWeekSheet` ☐ `RunLogSheet` ☐ `SportLogSheet` ☐ `SportScheduleSheet` ☐ `VideoUrlSheet`

**Fuel (P6)** — ☐ `FuelSection` · ☐ `/fuel` `FuelMaiPage` (MacroRing, MealCard idiom, StatStrip) · ☐ `/fuel/plan` `FuelPlanPage` · ☐ `/fuel/stack` `FuelStackPage` · ☐ `/fuel/recipes` `FuelRecipesPage` · ☐ `/fuel/recipes/new|:id/edit` `RecipeEditorPage` · ☐ `/fuel/recipes/:id` `RecipeDetailPage` · ☐ `/fuel/kamra` `FuelKamraPage` · ☐ `/fuel/kamra/:id` `KamraItemDetailPage` · ☐ `/fuel/gyogyszer` `FuelMedicationPage` (+ 2 skeletons)
Sheets: ☐ `AddPantryItemSheet` ☐ `AiLogSheet` ☐ `CategoryFilterSheet` ☐ `EnergyBreakdownSheet` ☐ `FuelSettingsSheet` ☐ `ImportItemSheet` ☐ `IngredientPickerSheet` ☐ `LogDoseSheet` ☐ `LogMealSheet` ☐ `MealPickerSheet` ☐ `MealScoreSheet` ☐ `ReplanSheet` ☐ `StackPickerSheet`

**Me + Progression (P7)** — ☐ `MeSection` · ☐ `/me` `ProfilePage` · ☐ `/me/growth` `GrowthPage` · ☐ `/me/goals` `GoalsPage` · ☐ `/me/goals/new` `GoalPlannerPage` (Stepper) · ☐ `/me/weight` `WeightPage` (TrendChart) · ☐ `/me/sleep` `SleepPage` · ☐ `/me/sleep/night` `NightPage` · ☐ `/me/people` `PeoplePage` (Avatar) · ☐ `/me/knowledge` `KnowledgePage` · ☐ `/me/ertesitesek` `NotificationsPage` (+ `GoalsSkeleton`)
Sheets: ☐ `AttachPlanSheet` ☐ `BiometricSheet` ☐ `EditGoalSheet` ☐ `PersonDetailSheet` ☐ `PersonLogSheet` ☐ `SettingsSheet` ☐ `SleepGoalSheet` ☐ `SleepLogSheet` ☐ `SleepStatsSheet` ☐ `WeightLogSheet`

**Insights (P8)** — ☐ `InsightsSection` · ☐ `/insights` `PatternsPage` · ☐ `/insights/weekly` `WeeklyPage` · ☐ `/insights/memoir` `MemoirPage` (Fraunces pull-quotes) · ☐ `/insights/knowledge` `KnowledgeListPage` · ☐ `/insights/chat` `ChatPage` (CoachBubble) · ☐ `/insights/predictions` `PredictionsPage` · ☐ `/insights/experiments` `ExperimentsPage`

## 7. Risks / open points

- **Coral contrast:** `#FF6B4A` on white fails AA for text — the ramp must push text/link uses to hover/deep (the DS already does this for gold; encode it in P0).
- **Alias-bridge discipline:** P1 must not visually regress unmigrated pages; the bridge maps old→new so everything renders "in-family" until its sweep phase.
- **Sheet machinery:** the async `requestClose` dismissal + unmount-guard in `Sheet.tsx` is battle-tested (CI-flake fix `mezo-91rw`) — restyle only, do not rewrite.
- **Dual test modes:** every phase gates on mock + real vitest runs; visual baselines will churn — budget for test-snapshot updates per phase.
- **DS is a spec, not code:** Exist's React implementation (`@/components/ds`) is JSX/JS and stays in Exist; mezo re-implements against the spec in its own TS primitives.
