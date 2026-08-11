---
title: Today
type: feature-domain
status: mixed
updated: 2026-08-11
tags: [today, biometrics, frontend, data-layer, ritual]
key_files:
  - frontend/src/features/today
  - frontend/src/data/today
  - frontend/src/data/me/biometricsApi.ts
  - frontend/src/shared/ui/ItemCard.tsx
  - frontend/src/shared/ui/ItemRow.tsx
  - api/feature/checkin/checkin.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin
related: [_platform-data-layer, _platform-design-system, me, insights, train, growth, habit, intention, ritual]
---

# Today — Feature Documentation

> The daily home screen at route `/today` (tab "Ma"), the PWA's default landing page. **Status: 🟢/🔶 mixed** — every section is real in real mode or an explicit honest state (Slice T, `mezo-t16y.3`), the briefing prose is real when generated (proactive B1.2, `mezo-h4wp.2`). Since the **napszak-tabok re-composition** (`mezo-puci`, 2026-08-10) the screen is a normally-scrolling page: `AppHero` → a `.segtabs` **daypart switcher** (Reggel · Nap · Este) → a full-bleed, never-truncated **mezo-message band** → the selected daypart's **complete content with no outer card frame** — hero, facts, every group's every row, one collapsed done-fold. This replaced the sky of three islands (capsule↔big morph + an L1 unfold behind every item, ADR 0022), itself a replacement of the daypart-faces stack (pill navigator + card pile per face, ADR 0014); the **day model underneath is unchanged for the third render-layer in a row**. Driving decision: **[ADR 0025](../decisions/0025-today-daypart-tabs.md)** over [`specs/2026-08-10-today-daypart-tabs-design.md`](../superpowers/specs/2026-08-10-today-daypart-tabs-design.md).

## 1. Summary

**Today** ("Ma") is mezo's daily aggregation surface. Since `mezo-puci` it renders top to bottom as an ordinary scrolling page (`.screen-content`'s own scroll — Today no longer flips the app scroller into a flex column):

- **`AppHero`** (unchanged chrome) → **`VulnerabilityCard?`** (`?vulnerable=on`).
- **`DaypartTabs`** — a `.segtabs` switcher (🌅 Reggel · ☀️ Nap · 🌙 Este, the Sport/Futás precedent — not a new control), `role="group" aria-label="Napszak"`, each segment `aria-pressed`. The chronologically-current daypart wears a small gold `.daytab-now` dot **independent of the pressed segment** — the ADR 0014 dual-signal ("hol tartok" vs "mit nézek") inherited verbatim.
- **`MezoMessage`** — a full-bleed `CoachBubble` band (`.coach-bubble.cb-band`): no avatar, no card frame, **never truncated** (no clamp, no `bővebben`). It renders once, above the selected daypart's content, and **always** carries the day's briefing regardless of which daypart is selected.
- **`DaypartPanel`** — the selected daypart's **complete content, with no outer card**: a left-aligned hero number (`DaypartHero`, Geist 200, ~30px), the unchanged `IslandFactsStrip`, an optional warn-chip/CTA row, an optional companion-note head (day/evening only — morning's note is the briefing band above it), the item groups (`DayGroups`), and the **one surviving collapsed element**: the done-fold (`✓ N kész · +M XP ▾`).
  - 🌅 **`DaypartMorning`** — hero = last night's sleep (`7,2 óra alvás`, sub: goal distance + weekly debt); facts = weight trend vs goal + HRV (mock-only); **no promoted CTA** (the chain's first open step is already a row in the list — a promoted CTA would have duplicated it); focus = `IntentionBanner`.
  - ☀️ **`DaypartDay`** — hero = the session's start (`13:00 · Pull A`, sub: mezó-week; rest day: `Pihenő` + `Saját edzés`); facts = protein-so-far vs target + energy balance (from the fuel plan); the niggle warning survives as the one warn-chip; the companion note heads `DayGroups`.
  - 🌙 **`DaypartEvening`** — hero = a **live countdown to lights-out**; content **swaps by `windDown` phase** (§2) in the same hero/CTA band rather than a big-island hero block; the éjszaka phase darkens the **panel itself** (`DaypartPanel`'s `night` prop — theme-invariant dark, the `.isl-night`/`.wdb-night` heritage).
- **L2** — every sheet unchanged (CheckIn, ActivityLog, LogMeal, SleepLog, Intention, Reflect, CustomWorkout, Creed).
- **Rough day (`?day=rough`)** still melts to `AnchorIsland`'s content (unchanged), now wrapped in a `DaypartPanel` with a **constant `tone="reggel"`** — never the clock-derived daypart, because a clock flip mid-session would remount the melt via `DaypartPanel`'s `key={tone}` and silently discard `AnchorIsland`'s local tick state (persisted nowhere). Checked before everything else, as ever (`anchorMode` first in the guard order).

Everything in the panel is actionable while its daypart is merely *selected*, not current („act-anywhere”, unchanged). This replaces the sky of three islands (ADR 0022) — itself a replacement of the daypart-faces stack (ADR 0014) — for the **third render layer over the same day model in a row**: `dayFace.ts`/`todayItems.ts`/`islandFacts.ts`/`questAction.ts`/`habitAction.ts`/`windDown.ts` carry no commits in this branch. Status per layer: **FE mock ✅** (deterministic; the mock sleep goal wake 06:45 / bed 23:15 pins the windows), **FE real ✅** (composition over existing reads; the facts still derive from `useSleep`/`useWeight`/`useGoal`/the fuel plan — no new backend), **Backend ✅ check-in only** (unchanged — the re-composition was frontend-only, no API-contract change).

## 2. User-facing behavior

- **Open the app →** lands on `/today` (`router.tsx`); mock renders synchronously.
- **Fixed chrome:** the shared **`AppHero`** (identity + XP ring + 🔥/⚡/🪙; Today passes the ✨ Insights link as `utilities` — the only Today→Insights route). `VulnerabilityCard` (`?vulnerable=on`) renders between the chrome and `DaypartTabs`.
- **Selecting a daypart.** Tapping a tab cross-fades `DaypartPanel`'s content with an 8px rise (`isl-phasein`, reused verbatim — not a new keyframe) and scrolls `.screen-content` to the top — the successor to the old "face switch closes L1" rule; there is no L1 to close anymore, everything is already visible. `?dp=reggel|nap|este` pins the selection (URL-derived, never mirrored to state; `null`/`''`/unknown → the clock's daypart; selecting the current daypart **deletes** the param; writes `{replace:true}` — this logic is untouched, only its consumer changed).
- **The promoted CTA** — day and evening only (morning has none, see §1): `Indítsuk`→`/train` or `Logold` (day session hero; `Saját edzés`→CustomWorkoutSheet on rest days), the Napzárás CTA (evening; `?ritual=` override wins, `waiting` renders a ghost with the opening time — the window only nudges, `/ritual` always works).
- **The done-fold** is the one collapsed element left on the page: `✓ N kész · +M XP ▾` expands in place (`DayGroups`' own height animation) to show the done rows, `▴` folds back. Every OPEN row is already visible with no unfold — all row behaviors are inherited unchanged: quest pills wear `questAction`'s own labels (`+250 ml` logs in place; `Check-in` opens the first fillable slot), habit kinds route through `habitAction` (Pipa / Logolás / sheets), fuel rows log **in place** (LogMealSheet), a `skipped` check-in slot stays fillable (`Hogy voltál?` · `HH:mm · elmaradt` · `Pótold`), `linkUrl` renders `↗` beside the action, in-flight habit writes withdraw only habit pills, and **no row ever shows a control this screen cannot serve** (`servableAction` strips + `habitHint` explains).
- **The evening daypart's four phases** (one hero/CTA band, content cross-slides; countdown always live, 30 s tick):
  | Phase | Window | Content |
  |---|---|---|
  | 🌙 normál | evening, `phase === 'none'` | facts + lavender CTA; sub: napzárás-ablak + villanyoltás |
  | 🌘 ráhangolódás (dim) | `[bed−90, bed−60)` | facts swap to the REM-in-cool-room evidence + sleep outlook; sub: fény &lt;30 lux · ~18 °C |
  | 🌒 leállás (winddown) | `[bed−60, bed)` | the CTA row gains the **`Leállás megvolt ✓`** ghost — the `wind_down` MANUAL habit's check (same `['habitDay', date]` cache as its row; the row is filtered **only while this phase shows the ghost**, so the habit is offered exactly once and stays reachable in dim/none — the `mezo-mvb4.1` rule, relocated again) |
  | 🌑 éjszaka (night) | `[bed, wake−30)` | **the panel itself darkens** (`DaypartPanel`'s `night` prop, theme-invariant dark — the `.isl-night`/`.wdb-night` heritage); countdown reads `elmúlt`; a single `Éjszakai mód megnyitása ›` row → `/me/sleep/night`; no facts, no CTA |
  The ritual-owned rows (`ritual:day` + `habit:evening_ritual`) are always filtered from the evening groups — the hero CTA owns that act (`RitualCard`'s rule, relocated into `DaypartEvening`).
- **Ticking something** removes it from the open list (into the done block / the evening retrospective); chain completion fires the per-chain toast (`ChainCelebrations` — `🌅 Tökéletes reggel` / `🌙 Tökéletes este` / `✨ {title} kész`); level-ups ride the shared `useLevelUp` overlay (consume-once, unchanged).
- **Scenario deep-links** (dev/demo affordances, unchanged semantics): `?dp=`, `?day=good|medium|rough` (rough → the anchor melt), `?niggle=on|off` (the day daypart's warn chip), `?vulnerable=on|off`, `?retaDay=N`, `?ritual=waiting|open|done`.
- **Check-in** — the 4 canonical slots bucket onto their daypart's groups by clock time; `CheckInSheet` per slot; real mode reads/writes the server day (unchanged, §4).

## 3. Architecture & data flow

The single FE↔data boundary stays `frontend/src/data/hooks.ts`; every hook is dual-mode. Shape of the screen: **`TodayPage` holds every hook, the pure logic modules derive the day model + item list + facts, and the daypart components are presentational** (the evening daypart alone self-fetches its phase/ritual/habit wiring, the `WindDownBanner`/`RitualCard` heritage).

### The three logic modules

- **`logic/dayFace.ts`** — the day model (UNCHANGED, `mezo-ly8c`): three wrap-aware windows off `useSleepGoal()`'s wake/bed anchor (mock: 06:15–11:45 / 11:45–19:15 / 19:15–06:15), degenerate-anchor guard, `dayFace`/`faceWindows`/`faceOf` + `DAY_FACES`/`FACE_LABEL`/`FACE_EMOJI`.
- **`logic/todayItems.ts`** — the six-source normalizer (UNCHANGED): `buildTodayItems`/`itemsForFace`/`openCountByFace`/`isFillableSlot`, dedup tables, quest CTA labels.
- **`logic/islandFacts.ts`** — **NEW (`mezo-euze`)**: pure fact derivations for L0. `IslandFact { label, value, unit?, delta?: { text, tone: good|warn|muted } }`, `IslandHero { value, unit, sub }`. Exports: `morningHero` (sleep hours + goal diff + 7-night debt; null without a last night → `fallbackHero(openCount)`), `weightFact` (7-day delta, toward-target tone, goal distance), `hrvFact` (from the QuickStats cells — **null in real mode**, no source), `proteinFact` + `kcalFact` (from the fuel plan's slots/energy), `dayBalance`, `sleepOutlook`, `bedCountdown` (wraps `minsToBed`; >12 h to next bed = the „elmúlt” state). **Every fact is null on a missing source — the cell simply does not render** (strip philosophy; 0 facts ghost the strip).
- `logic/useWindDownPhase.ts` — the ONE ticking phase derivation, read only by `DaypartEvening` (content + countdown) since `mezo-puci` — `TodayPage` itself no longer calls it directly (it did in the islands era, for the shell's `night` prop; that shell is gone). `questAction`/`habitAction`/`growthToday`/`useChainCelebration`/`windDown.ts` unchanged; **`dayArc.ts` still belongs to ritual's recap** (do not delete — see §9).

### The composition root

```
TodayPage.tsx (composition root — every hook; daypart components are presentational)
  ├─ hooks unchanged from the islands era: useTodayScenario · useToday · useCheckins · useSleepGoal
  │    · useDailyQuests/useQuestActions · useActivities · useHabitDay/useHabitActions/useHabitCatalog
  │    · useRitualDay · useWaterActions · useIntentionDay/Actions · useQuickStats · useCompanionNote
  ├─ readers for the facts (unchanged since mezo-euze): useSleep → {sleepLog, lastNight} · useWeight
  │    → weightLog · useGoal → targetWeight · useFuelPreview → {visible, nextStack, plan}
  ├─ useWindDownPhase → the evening daypart's phase/countdown state
  ├─ sessions: DaySession[] authored ONCE ([0] = hero; day daypart follows the hero; filtered by ID)
  ├─ items = buildTodayItems(...) + servableAction stripping        (unchanged enforcement point)
  ├─ current = dayFace(now, goal);  selected = ?dp= ?? current
  ├─ facts: morningFacts/dayFacts/eveningFacts + mHero via islandFacts (plain derivations, unchanged)
  └─ render: AppHero → VulnerabilityCard? → DaypartTabs → MezoMessage → one of:
       ├─ DaypartMorning → DaypartPanel tone="reggel" (hero+facts | DayGroups w/ Fókusz focus slot)
       ├─ DaypartDay     → DaypartPanel tone="nap"    (DayHero | Pihenő; warn chip; DayGroups w/
       │                    CompanionNoteCard head)
       ├─ DaypartEvening → DaypartPanel tone="este"|night (4 phases; ritual CTA; wind_down ghost;
       │                    DayGroups retrospective)
       └─ (anchor melt: DaypartPanel tone="reggel" CONSTANT wrapping AnchorIsland — the ?day=rough
            early return; the constant tone is deliberate, see §9)
     + the seven sheets (unchanged act()/sheet-host wiring)
Guard order (unchanged, load-bearing): anchorMode FIRST (sync from URL — still no skeleton flash)
→ sleepGoalPending → AppHero + TodaySkeleton (tab-row + message-band + panel skeleton mirror; the
SAME appHero element in every branch — node-identity contract, TodayPage.skeleton.test).
```

Check-in real path, consume-once level-ups, `act()` dispatch table, session-authored-once and the `?dp=` parse rules are all **verbatim inherited** from the faces era — see §2 and the tests in §8.

## 4. Data model & API

### Frontend types (`frontend/src/data/types.ts`) — unchanged
`DayState`, `CheckinValues`/`CheckinState`/`CheckinSlot`, `Briefing` (`confidence?` optional; `tone?` dead data), `Workout*`, `VolleyballSession`, `TodayMeta`/`UserMeta`, `TodayScenario`, `FuelSlot`/`FuelPlanToday`.

**View/logic shapes live OUTSIDE `data/types.ts`:** `DayFace` + consts (`logic/dayFace.ts`); `TodayItem`/`ItemStatus`/`ItemSource`/`ItemAction`/`SessionItemInput`/`TodayItemsInput` (`logic/todayItems.ts`); **`IslandFact`/`IslandHero`/`FactTone` (`logic/islandFacts.ts`, mezo-euze)**; `DayHero` moved again from the retired `IslandDay` to **`components/DaypartDay.tsx`** (unchanged shape — `TodayPage.tsx`'s `heroCardOf` still builds it); the new `DaypartHero` **component** (not to be confused with the `DayHero` type) lives in `components/DaypartPanel.tsx`; `ItemTone` stays in `shared/ui/ItemCard.tsx`. **No API-contract change** — the re-composition was frontend-only.

### Mock data — unchanged
`data/today/today.ts` (incl. mock-only `workoutPrediction`/`volleyballNote` — the latter now **unrendered**, see §9), `checkins.ts`, `data/me/sleepGoal.ts` (`mockSleepGoal` wake 06:45 / bed 23:15 — pins the daypart windows and the goldens).

### Backend check-in (the only real piece) — unchanged
Contract [`api/feature/checkin/checkin.yml`](../../api/feature/checkin/checkin.yml); `GET/POST /api/biometrics/checkin`; backend `feature/biometrics/checkin/` (`CheckInController`/`Service`/`Entity`/`Repository`/`Mapper`), migration `202606101320_mezo-v67_create_check_in.sql`, FE client `data/me/biometricsApi.ts` (`checkinApi` — the shared biometrics client whose other methods belong to `useWeight`/`useSleepGoal`/`useSleepShot`, which is why this file keeps drifting the doc's staleness without Today changing).

## 5. Integrations

Today is an **aggregation surface** — its value is the seams:

- **→ Train** — *live shared data + navigation*. The day daypart's hero is Train's today session (`useToday` composes `useTrain()`); `Indítsuk` → `/train`; rest day → `CustomWorkoutSheet`. The session is authored once (`DaySession[]`, order = hero precedence, filtered by ID); identity via `sportKinds`. The card language (`ItemCard`/`ItemRow`) is shared code.
- **→ Fuel** — *shared data + a shared write surface*. `useFuelPreview` composes the same `useFuelTimeline()` plan the Fuel „Mai” renders, and **since `mezo-euze` also returns that full `plan`** — the day daypart's protein/energy facts read `plan.slots`/`plan.energy`, so Today's facts and Fuel's timeline cannot diverge. Fuel rows stay `DayGroups` `ItemRow`s (bucketed by `faceOf`), logging in place via `LogMealSheet`. The `nextStack.mezoNote` companion line **still has no surface** (the `.tdc-note` slot retired in the islands era — §9).
- **→ Me / sleep & weight & goal** — the sleep anchor (`useSleepGoal`) remains the root dependency (one clock: dayparts = windDown = Napzárás = circadian theme). **Readers since mezo-euze, unchanged:** `useSleep().lastNight/sleepLog` (the morning hero), `useWeight().weightLog` + `useGoal().goal.targetWeight` (the weight fact). Same caches the Me tab uses.
- **→ Insights** — navigation only (the ✨ `AppHero` utility).
- **← AppHero / progression** — unchanged; [growth.md](growth.md).
- **→ Biometrics backend (real)** — `useCheckins` read+write; the companion's context snapshot reads the latest check-in ([companion.md](companion.md) §5.5).
- **→ Growth (`/me/growth`)** — *live shared data + navigation*. Quests render as `DayGroups` rows; the header summary + the ONLY Today→Growth route lives on the **quest group heading** (`DayGroups`' `{d}/{t} · +XP ›` link — the `IslandList`/`TodoCard` header's job before it, relocated twice now). `GrowthPage` still mounts `DailyQuestsCard`/`ActivityLogCard` — **these two components live under `features/today/components/` but their only mount is GrowthPage** (they are NOT orphans; each render-layer swap has kept them for that one consumer — see the gotcha in §9).
- **← AppLayout / shell** — `useTodayScenario().anchorMode` drives both the warm canvas (`PhoneFrame anchor`) and `TodayPage`'s `anchorMode` early return (the constant-`tone="reggel"` `DaypartPanel` wrapping `AnchorIsland` — §9); the two must stay derived from the same hook. The circadian `[data-day]` canvas tint is the app-level „evening cooling” (the spec's screen-cooling is deferred to it — unchanged since ADR 0022).
- **Shared UI consumed:** `ItemCard` + `ItemRow`, `CoachBubble` (the mezo-message band + the day/evening companion-note head + the anchor melt's voice — the `BriefingCard` wrapper it used to ride through is retired, its job is `MezoMessage` now), `Skeleton`, `RefTag`, `Sheet`, `Icon`, `SafeMarkdown`. (`StatStrip` itself is still not mounted by Today — the fact cells are `IslandFactsStrip`'s own `.isl-fact` family on the same idiom.) **`shared/ui/Island` is no longer Today's at all** — Fuel's `WindowIsland`/`FuelMaiPage` are its only remaining callers; Today's one remaining `.isl-*` footprint is `AnchorIsland` reusing a handful of individual classes directly (`isl-openhead`, `isl-hero-v/-u/-sub`, `isl-anchor-rows`, `isl-act`, `isl-more`), never the capsule↔big shell itself (see §9).

## 6. How to use it (consume)

Mount: `{ path: 'today', element: <TodayPage /> }` (wired in `app/router.tsx`). Data through `@/data/hooks` exactly as before; the new bits:

```tsx
const { visible, nextStack, plan } = useFuelPreview()   // plan: FuelPlanToday — facts read slots/energy
const { sleepLog, lastNight, logSleep } = useSleep()
const { weightLog } = useWeight()
const { goal } = useGoal()                              // goal.targetWeight → weightFact

import { morningHero, fallbackHero, weightFact, hrvFact, proteinFact, kcalFact,
         dayBalance, sleepOutlook, bedCountdown } from '@/features/today/logic/islandFacts'
const hero = morningHero(lastNight, sleepLog, sleepGoal) ?? fallbackHero(openCount)
const facts = [weightFact(weightLog, goal?.targetWeight ?? null), hrvFact(stats)]
  .filter((f): f is IslandFact => f != null)             // null = no source = no cell
```

The day model + item list consumption is unchanged (`dayFace`, `buildTodayItems`, `itemsForFace`). Scenario links: `/today?dp=este`, `/today?day=rough`, `/today?ritual=open`, etc.

## 7. How to extend it

**Add a new TODO SOURCE** — unchanged recipe: emit in `buildTodayItems` (bucket via `faceOf`, group heading, action with the raw domain object), dedup if needed, wire the hook, teach **both** `act()` and `servableAction()`, test in `todayItems.test.ts` + `TodayPage.dispatch.test.tsx`. It surfaces automatically as a `DayGroups` row on its daypart — no unfold to wire.

**Add / swap a hero FACT (still the common case):**
1. Write a pure derivation in `logic/islandFacts.ts` returning `IslandFact | null` — **null whenever the source is absent** (the HRV precedent; never fabricate). Delta text is contextual (trend/goal-distance/forecast), tone `good|warn|muted`.
2. Table-test it in `islandFacts.test.ts` (value formatting — Hungarian decimal comma —, tones, the null branch).
3. Wire the source hook in `TodayPage` and add the fact to the relevant daypart's `facts` array (max 2 cells per panel — passed into `IslandFactsStrip`; the fact catalog in the ADR 0022 spec §3 lists vetted candidates).
4. If the source is a new hook on the page, mind the real-mode cost (it runs on every Today visit).

**Change a daypart's composition** — `DaypartMorning`/`DaypartDay`/`DaypartEvening` are presentational, each wrapping its own `DaypartPanel`: keep the panel to hero + facts + an optional CTA/warn-chip + an optional note head + `DayGroups` (ADR 0025's layer rule — there is no deeper layer to push overflow into anymore, so keep the hero/CTA band itself lean). Evening-phase content lives in `DaypartEvening`'s phase blocks; a new phase means a new `windDown.ts` window first.

**Change the day model** — unchanged: constants in `dayFace.ts` (`MORNING_LEAD_MIN` imported from `windDown.ts` on purpose); re-check `dayFace.test.ts` + regenerate the today goldens.

**Promote a mock section to a real backend** — the check-in remains the working template (contract-first → backend package → Liquibase → ITs → dual-mode FE swap); see the references table in `CLAUDE.md` and §4.

## 8. Testing

### Pure logic (`frontend/src/features/today/logic/`)
- **`islandFacts.test.ts` (NEW)** — table tests per fact: morning hero null-without-night / comma formatting / weekly debt at 3+ nights; weight 7-day delta + toward-target tone + single-entry no-delta; HRV cell pick + real-mode null; protein done-vs-target sums; countdown `H:MM` + the `elmúlt` wrap branch; the shape trio (fallback/dayBalance/sleepOutlook/kcal).
- `dayFace.test.ts`, `todayItems.test.ts`, `questAction/habitAction/growthToday/windDown/useChainCelebration` tests — **unchanged and untouched** by the re-composition (the proof the model survived).

### Composition (`frontend/src/features/today/pages/`)
- **`TodayPage.test.tsx`** — re-anchored onto the tab/panel model (behavioral assertions carried over, the "open L1 first" step dropped everywhere): daypart selection end to end (clock → the tab's `.daytab-now` dot; `?dp=` override; blank/unknown fallbacks; tab tap; current-daypart param deletion; param preservation; **daypart switch scrolls `.screen-content` to the top**); composition (chrome + tabs + message band + panel; the retired surfaces are GONE — `.greet`/`.dfs`/`.faceswap`/`.tdc`/`.sky-islands`/`.isl-l1`/tablist/`még N ›`/`összecsuk` asserted absent); `?day=rough` melts to the constant-tone anchor panel; the promoted CTA (day/evening only); the sleep hero + fact cells; every chain step actionable **with no unfold**; mid-chain tick; linked content; the mezo-message band showing the briefing **on every daypart** and NOT truncated; Napzárás owned by the CTA with no list twin; niggle chip + `?niggle=off`; the quest-group growth link; the evening retrospective + day XP; the wind-down offered-exactly-once trio (winddown: the ghost row, no list row · dim/none: the list row is the only affordance); the **no-dead-control class net** (clicks every control on all three daypart panels, requires an observable effect); the `act()` dispatcher cases; the per-chain celebrations (seeded QueryClient, custom DAY chain).
- **`TodayPage.dispatch.test.tsx`** — the mocked-hook walk of every `habitAction`/`questAction` kind, the skipped-slot `Pótold` cases, in-flight withdrawal (rows + the **disabled** promoted CTA), consume-once level-ups, chain toasts, the rest-day `Saját edzés` sheet, session-authored-once (early gym renders nowhere on the morning daypart — its only trace the day tab's own hero; stacked-day non-hero row with facts; sport-as-hero), catalog-driven bucketing.
- **`TodayPage.skeleton.test.tsx`** — pending gate → the tab-row/message-band/panel skeleton (no tab buttons); resolve → live content; live transition on the same mount; the `.apphero` **same-DOM-node** contract; anchorMode wins over pending (no skeleton flash into the melt).
- **`TodaySkeleton.test.tsx`** — the new layout mirror (a `.daytabs`/`.segtabs` placeholder row, a `.coach-bubble.cb-band` block, a `.dayview` block with row placeholders), inert, `role="status"`.

### Components
- **NEW (`mezo-puci`):** `DaypartTabs.test.tsx` (selection, the `MOST` dot follows the CLOCK not the pressed segment, `onSelect` payload), `MezoMessage.test.tsx` (no avatar, no clamp/`bővebben`, full text + refs render), `DayGroups.test.tsx` (group order; growth link; act payload + stripped-action row; the one done-fold open/close; day XP; habitPending withdraws only habit pills; head/focus slots), `DaypartPanel.test.tsx` (hero/fact/CTA slot, `key={tone}` cross-fade, `night` prop), `DaypartMorning.test.tsx`, `DaypartDay.test.tsx` (gym hero + CTA; rest day; warn chip; facts; note head), `DaypartEvening.test.tsx` (the four phases incl. the pipa/list-ownership rules, `?ritual=done`, the ritual-row filter, the retrospective XP line), `TodaySkeleton.test.tsx` rebuilt for the tab layout (see above).
- **Unchanged, not part of this branch's commit range:** `AnchorIsland.test.tsx` (three anchors; local tick; exit — the component itself didn't change, only its `TodayPage` wrapper did).
- Kept as-is: `IntentionBanner`, `CompanionNoteCard`, `VulnerabilityCard`, `ChainCelebrations`, sheet tests, `shared/ui/ItemCard|ItemRow` tests. `DailyQuestsCard`/`ActivityLogCard` tests cover GrowthPage's mounts. `shared/ui/Island.test.tsx` moved conceptually to Fuel's territory — it still lives under `shared/ui/`, but Today's own tests no longer exercise it at all.
- **`todayReducedMotion.test.ts`** — re-anchored onto the surviving families: string-presence for the reduce overrides + keyframes (`isl-phasein` — the only motion keyframe Today still uses; `isl-morph`/`isl-floaty`/`isl-rowin` dropped from this test's scope, they are Fuel's now), the **cascade guard** (specificity + source-order per family — every modifier stays `:where()`-wrapped). Mutation-relevant sanity cases included.
- **Deleted with their components (`mezo-puci`):** `IslandSky`, `IslandMorning`, `IslandDay`, `IslandEvening`, `IslandList`, `BriefingCard` tests. (The islands-era deletions — `DayFaceStrip`, `GreetingHeader`, `FaceHeroCard`, `TodoCard`, `DoneFold`, `WindDownBanner`, `RitualCard`, `AnchorModeView` — were already gone before this branch; see the historical layers in §9.)

### Visual regression
The three goldens keep their names/paths/clocks (`today-reggel|nap|este` × light/dark — `?dp=` still pins the daypart, the frozen clock still pins `MOST`/phase): regenerated for the tab/panel layout on darwin (`mezo-puci`); **linux baselines regenerate via `update-visual-baselines.yml`** on the branch. `train-*` goldens unchanged (shared card language untouched). Known pre-existing failure: `train-session`'s **darwin** baseline is stale on main too (filed separately); CI compares linux.

**Commands** unchanged: `VITE_USE_MOCK=false pnpm test` + `VITE_USE_MOCK=true pnpm test` (both green), `pnpm vitest run src/features/today` focused, `pnpm test:visual`.

## 9. Decisions, gotchas & deferred

- **Decisions:** the current structure is **[ADR 0025 — napszak-tabok](../decisions/0025-today-daypart-tabs.md)** over [`specs/2026-08-10-today-daypart-tabs-design.md`](../superpowers/specs/2026-08-10-today-daypart-tabs-design.md). It supersedes the *render layer* of **[ADR 0022 — three islands](../decisions/0022-today-three-islands.md)** (itself over [`specs/2026-08-07-today-three-islands-design.md`](../superpowers/specs/2026-08-07-today-three-islands-design.md), brainstormed through three in-browser prototype rounds — the interactive mockups live in `specs/assets/`), which in turn superseded the *render layer* of [ADR 0014](../decisions/0014-today-daypart-faces.md). ADR 0014's day model, card language, act-anywhere and dedup decisions remain in force through all three render layers, as do the honest-completion decisions ([`specs/2026-07-04-…`](../superpowers/specs/2026-07-04-today-honest-completion-design.md)) and ADR 0010 (nothing self-completes).
- **Accepted trades (ADR 0025 records the newest; ADR 0022's still hold too):** the capsule buborék-morph motion language and the L1 unfold-behind-a-tap model are both gone — everything on the selected daypart is visible with no interaction beyond picking the tab; the daypart colour identity moved from the retired blob tint onto the tab chrome + the circadian canvas. From ADR 0022, still true: the cross-daypart **preview rows are gone** (the old capsule essences' job has no successor — there is no capsule); the **fuel companion line** (`.tdc-note`) and the **stacked-day sport note** (`volleyballNote` — dead data in `useToday`'s return, kept for signature stability) have no surface; the **greeting is gone** (AppHero already carries identity). The four ADR 0014 trades stand where still applicable (per-daypart check-in slots; ritual `nav` action unreachable — the evening CTA owns it; the real-mode level-up double-fire).
- **GOTCHA — `.isl-*` is Fuel's now; leaving Today did NOT bring a CSS cleanup.** `shared/ui/Island.tsx` and almost the entire `.isl-*` family (the shell, the fact/CTA/group micro-components) survive `mezo-puci` untouched — `TodayPage.tsx` no longer builds `IslandCapsule`s or imports the shell at all, but Fuel's `WindowIsland`/`FuelMaiPage` are still live consumers of the same classes, so nothing there could be deleted. Only four rules had zero life outside Today's retired big-island hero and were actually deletable: `.isl-doneline`, `.isl-nightrow`, `.isl-nightrow-arr`, `.isl-phase`. `AnchorIsland.tsx` — the one Today component still standing on `.isl-*` — reuses a handful of those surviving classes directly as plain content styling (`isl-openhead`, `isl-hero-v/-u/-sub`, `isl-anchor-rows`, `isl-act`, `isl-more`), not the shell's capsule↔big morph mechanism. Do not read "Today stopped using islands" as "the `.isl-*` family is dead code" — check `frontend/src/features/fuel/` before touching any of it.
- **GOTCHA — `DaypartPanel`'s anchor-melt tone is a CONSTANT `"reggel"`, never the clock-derived daypart.** `DaypartPanel` puts `key={tone}` on its root so a daypart switch cross-fades cleanly; `current` is re-derived from `new Date()` on every render, so wiring the anchor melt's tone to `current` would risk the `key` flipping mid-session (e.g. a focus refetch crossing a daypart boundary) and remounting `AnchorIsland`, silently discarding its local tick state (persisted nowhere — see `TodayPage.tsx`'s comment at the anchor-mode early return). The melt is not a daypart, so it has no tone of its own to be "right" — keep it constant if you ever touch this branch.
- **GOTCHA — `DailyQuestsCard`/`ActivityLogCard` are NOT orphans.** They live under `features/today/components/` but mount on **GrowthPage** — deleting them breaks `/me/growth`. Leave them (and their tests) until Growth gives them a new home. (Surfaced originally during the daypart-faces re-composition; still true after two more render-layer swaps.)
- **GOTCHA — `.wdb-night*` CSS outlived `WindDownBanner`.** `SleepPage.tsx` renders the same night-entry row; the family stays. Similarly **`.anch-coach` outlived the `.anch*` family** — `AnchorIsland` reuses the muted CoachBubble tint; only that rule survives.
- **GOTCHA — `logic/dayArc.ts` still belongs to ritual's recap** (`DayStoryStep.tsx`); do not delete with anything Today-side (unchanged warning — the render layer has swapped three times without this file moving).
- **GOTCHA — the motion cascade guard, now covering a much smaller family.** Every surviving Today animation modifier (`.dayview`'s `isl-phasein` cross-fade) must stay wrapped in `:where()` — the reduce-block override wins on the source-order tie-break only at equal specificity. `todayReducedMotion.test.ts` computes this structurally; a bare qualifier fails the guard even with green string checks. The capsule-morph/stagger-ladder guards (`isl-morph`/`isl-floaty`/`isl-rowin`) left this test's scope with the islands — they're still guarded, just under Fuel's own coverage now.
- **GOTCHA — the quest-group heading is still the only Today → Growth route** (the retired `TodoCard`/`IslandList` header's job, now `DayGroups`'). Removing the `growth` prop from `DayGroups` would silently orphan quest management from Today.
- **Inherited gotchas still live:** the dead-control class + `servableAction`'s honest limit; the degenerate-anchor guard's real assertion (`dayFace.test.ts` `'este'`); after-midnight writes land on the NEW day (`localDateString()`); the mock water CTA never completes its quest; the sport hero never renders in mock's default screen (no `today:true` seed); the niggle strip is mock-only (real workouts carry no `niggleWarning`); `useToday`'s meso fields are mostly unconsumed (**exception since mezo-euze: `user.weekInMeso` is read again** — the day daypart's mezó-week subtitle); `briefing.tone` is dead data; the `useGoal` queryFn-less `['weightLog']` console noise (pre-existing, `mezo-edrv` — still triggered via TodayPage's own `useGoal`).
- **Deferred / follow-ups:** focus management for tab-select (beyond default button focus); the weekly-load fact (needs `weekAgenda` wiring); the evening „heti rang” delta (needs a 7-day XP source); HRV (needs a source, cell auto-returns); real predictions/niggle/vulnerable/anchor signals (proactive epic); `ItemCard`'s `DoneBar` import from a feature folder (inherited, filed); `questAction`'s unmapped `intention_focus_set` (filed).

## 10. Key files

**Frontend — pages** (`frontend/src/features/today/pages/`):
- **`TodayPage.tsx`** — the composition root (§3): every hook, the `items` memo + `servableAction`, `current`/`selected` (no more `listOpen` — nothing to open), the fact derivations, `act()`, the seven sheets, and the `DaypartTabs`/`MezoMessage`/`DaypartPanel` render. Early returns: `anchorMode` → the constant-`tone="reggel"` `DaypartPanel` wrapping `AnchorIsland`, then `sleepGoalPending` → `TodaySkeleton`; the `appHero` element renders in **every** branch (node identity).
- **`TodaySkeleton.tsx`** (+ test) — rebuilt for the new layout: a `.daytabs`/`.segtabs` placeholder row, a `.coach-bubble.cb-band` block, a `.dayview` block with row placeholders, `role="status" aria-busy="true"`.
- `sheets/` — unchanged (CheckInSheet + observation, ActivityLogSheet, IntentionSheet, CreedSheet, ReflectSheet; cross-feature hosts: LogMealSheet, SleepLogSheet, CustomWorkoutSheet).

**Frontend — the daypart components** (`frontend/src/features/today/components/`, all `mezo-puci` unless noted):
- **`DaypartTabs.tsx`** (+ test) — the `.segtabs` switcher: `{ selected, current, onSelect }`, owns no state and reads no hook. Renders the `.daytab-now` gold dot on the chronologically-current segment, independent of `selected`.
- **`MezoMessage.tsx`** (+ test) — the `BriefingCard` successor: the same `CoachBubble`, `avatar={false} className="cb-band"`, never clamped — no `bővebben`, nothing hidden.
- **`DaypartPanel.tsx`** (+ test) — exports `DaypartPanel` (the frameless shell: `{ tone, night?, children }`, `key={tone}` for the cross-fade, `.dayview`/`.is-night`) and `DaypartHero` (the left-aligned hero number: `{ value, unit?, sub? }`, `.dv-hero*`).
- **`DaypartMorning.tsx` / `DaypartDay.tsx` (exports `DayHero`) / `DaypartEvening.tsx`** (+ tests) — the `IslandMorning`/`IslandDay`/`IslandEvening` content successors, each wrapping its own `DaypartPanel`. `DaypartEvening` self-fetches its phase/ritual/habit wiring (`useWindDownPhase`, the `WindDownBanner` + `RitualCard` successor) and owns the group filter rules (`OWNED_BY_RITUAL_HERO`, the phase-scoped `wind_down` filter); its `night` phase early-returns its own `DaypartPanel tone="este" night key="night"` branch, separate from the `key={ph}` cross-fade the other three phases share.
- **`DayGroups.tsx`** (+ test) — the `IslandList` successor minus its internal scroller and `összecsuk` toggle: grouped `ItemRow`s, the quest-heading growth link, `head`/`focus` slots, and the one surviving collapsed element, the done-fold.
- **`IslandFactsStrip.tsx`** (unchanged) — the 1–2 fact cells (StatStrip idiom + delta line, ghost on empty).
- **`AnchorIsland.tsx`** (+ test, unchanged content — only its `TodayPage` wrapper changed, see §9) — the rough-day melt content (the `AnchorModeView` successor; three anchors, local tick, `Kilépés`).
- Reused unchanged: **`CompanionNoteCard`**, **`IntentionBanner`** (chip → morning/day `Fókusz`; reflect → evening groups), **`VulnerabilityCard`**, **`ChainCelebrations`**. GrowthPage's mounts: `DailyQuestsCard`, `ActivityLogCard` (§9).
- **`shared/ui/Island.tsx`** — no longer imported anywhere under `features/today/` (moved to Fuel's exclusive ownership; see [`_platform-design-system.md`](_platform-design-system.md) and §9's gotcha). Still documented for its own sake in [fuel.md](fuel.md).
- **Deleted by mezo-puci** (with tests): `IslandSky.tsx`, `IslandMorning.tsx`, `IslandDay.tsx`, `IslandEvening.tsx`, `IslandList.tsx`, `BriefingCard.tsx`. (Deleted earlier, by `mezo-euze`, and still gone: `DayFaceStrip`, `GreetingHeader`, `FaceMorning`, `FaceDay`, `FaceEvening`, `FaceHeroCard`, `TodoCard`, `DoneFold`, `WindDownBanner`, `RitualCard`, `pages/AnchorModeView`.)

**Frontend — logic** (`frontend/src/features/today/logic/`, **untouched by `mezo-puci`** — the proof the day model survived a third render-layer swap): `dayFace.ts`, `todayItems.ts`, `islandFacts.ts`, `useWindDownPhase.ts`, `windDown.ts`, `questAction.ts`, `habitAction.ts`, `growthToday.ts`, `useChainCelebration.ts`, `dayArc.ts` (ritual's — §9); feature-root `todayReducedMotion.test.ts` (re-anchored onto the surviving `isl-phasein` cross-fade, §8).

**Frontend — data & shared:** `data/today/todayHooks.ts` (`useFuelPreview` returns `plan` too, unchanged since mezo-euze), `checkinHooks.ts`, `briefingHooks.ts`, `today.ts`, `checkins.ts`; the daypart anchor `data/me/sleepHooks.ts` + `sleepGoal.ts`; the fact sources `data/me/weightHooks.ts` + `goalHooks.ts` + `sleepHooks.ts` (`useSleep`); `data/me/biometricsApi.ts`; `shared/ui/ItemCard.tsx` + `ItemRow.tsx` + `CoachBubble.tsx`; `app/AppLayout.tsx` / `PhoneFrame.tsx` / `router.tsx`.

**CSS** (`frontend/src/styles/prototype.css`) — the Today-owned family is now **`.daytabs`/`.daytab-now`, `.coach-bubble.cb-band`, and `.dayview`/`.dv-*`** (`mezo-puci` section): the tab switcher (`.daytabs`, `.daytabs .segtab`, `.daytab-now`); the message band (`.coach-bubble.cb-band`, `.cb-band .cb-head`/`.brief-lead`/`.brief-refs`); the frameless panel (`.dayview`, `.dv-hero`/`.dv-hero-v`/`.dv-hero-u`/`.dv-hero-sub`, `.dv-act`, `.dv-done`/`.dv-done-arr`, `.dayview.is-night` + its dark overrides, `.dv-nightrow`/`.dv-nightrow-arr`, `.dv-state`) and its `isl-phasein`-reusing `:where()`-guarded reduce block. **`.isl-*` is Fuel's alone now** (§9's gotcha) — `.dayview` reuses several of its micro-components as-is via compound selectors (`.dayview .isl-facts`, `.isl-warnchip`, `.isl-cta`, `.isl-grouph`) rather than duplicating them under `.dv-*`. **Deleted:** `.isl-doneline`, `.isl-nightrow`, `.isl-nightrow-arr`, `.isl-phase` — the only four `.isl-*` rules with no consumer outside Today's retired big-island hero; the `.sky-islands`/`.isl-big`/`.isl-cap*`/`.isl-blob`/`isl-morph`/`isl-floaty`/`isl-rowin` shell + L1 families **survive untouched, owned by Fuel**. Shared families unchanged: `.itemrow*`, `.todaycard*`/`.metapill`/`.donebar*`, `.creedchip*`/`.reflect*`, `.vuln*`, `.wdb-night*` (SleepPage's), `.anch-coach` (the melt's bubble tint). **`.brief*` survives, but split:** `MezoMessage` still consumes `.briefing-body`/`.brief-lead`/`.brief-rest`/`.brief-refs`/`.brief-refs-l`/`.brief-foot`/`.brief-meta` (the prose/reference classes, now composed with `.cb-band` rather than the old card frame) — but the frame-and-clamp apparatus the frame itself needed (`.brief-bubble`, bare `.brief`, `.brief-clamp`, `.brief-more`) has **no consumer left on Today** (`BriefingCard`'s own wrapper is gone). Left in place pending a dedicated sweep; it isn't `mezo-puci`'s to delete on a hunch. Catalogue in [`_platform-design-system.md`](_platform-design-system.md).

**Visual goldens:** `frontend/tests/visual/visual.spec.ts` + `today-{reggel,nap,este}-{light,dark}-{darwin,linux}.png` (§8).

**API contract + backend** — unchanged (§4).

**Docs:** **[ADR 0025](../decisions/0025-today-daypart-tabs.md)** · [`specs/2026-08-10-today-daypart-tabs-design.md`](../superpowers/specs/2026-08-10-today-daypart-tabs-design.md) + [`plans/2026-08-10-today-daypart-tabs.md`](../superpowers/plans/2026-08-10-today-daypart-tabs.md) (the current structure) · historical layers: [ADR 0022](../decisions/0022-today-three-islands.md) + [`specs/2026-08-07-today-three-islands-design.md`](../superpowers/specs/2026-08-07-today-three-islands-design.md), [ADR 0014](../decisions/0014-today-daypart-faces.md) + [`specs/2026-07-29-today-daypart-redesign-design.md`](../superpowers/specs/2026-07-29-today-daypart-redesign-design.md), [`specs/2026-07-04-today-honest-completion-design.md`](../superpowers/specs/2026-07-04-today-honest-completion-design.md), [`specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md); house standards in [`docs/references/`](../references/).
