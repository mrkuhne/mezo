---
title: Today
type: feature-domain
status: mixed
updated: 2026-08-08
tags: [today, biometrics, frontend, data-layer, ritual]
key_files:
  - frontend/src/features/today
  - frontend/src/data/today
  - frontend/src/data/me/biometricsApi.ts
  - frontend/src/shared/ui/ItemCard.tsx
  - frontend/src/shared/ui/ItemRow.tsx
  - frontend/src/shared/ui/Island.tsx
  - api/feature/checkin/checkin.yml
  - backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/checkin
related: [_platform-data-layer, _platform-design-system, me, insights, train, growth, habit, intention, ritual]
---

# Today — Feature Documentation

> The daily home screen at route `/today` (tab "Ma"), the PWA's default landing page. **Status: 🟢/🔶 mixed** — every section is real in real mode or an explicit honest state (Slice T, `mezo-t16y.3`), the briefing prose is real when generated (proactive B1.2, `mezo-h4wp.2`). Since the **three-islands re-composition** (`mezo-euze`, 2026-08-07) the screen is a **non-scrolling sky of three sleep-anchored islands** — one big (DS Hero + 1–2 contextual facts + one CTA), two floating capsules — with the full item list one layer deeper (L1) and the sheets unchanged (L2). This replaced the daypart-faces stack (pill navigator + card pile per face, ADR 0014); the **day model underneath is unchanged**. Driving decision: **[ADR 0022](../decisions/0022-today-three-islands.md)** over [`specs/2026-08-07-today-three-islands-design.md`](../superpowers/specs/2026-08-07-today-three-islands-design.md).

## 1. Summary

**Today** ("Ma") is mezo's daily aggregation surface. Since `mezo-euze` it renders as **three islands on a non-scrolling sky** between the shared `AppHero` chrome and the tab bar, always in chronological order (🌅 Reggel → ☀️ Nap → 🌙 Este), with **exactly one island big** at a time:

- **The big island (L0)** is the DS **Hero** block in organic dress — a slowly **morphing halo blob**, one Geist-200 **hero numeral**, a data subtitle, **1–2 contextual fact cells** (`IslandFactsStrip` — StatStrip idiom + a toned delta line), **one promoted CTA**, and two quiet handles (`még N ›` and `✓ N kész ma`, both opening L1). **No greeting, no status-eyebrow, no prose** on L0 (user-fixed v3 decision): the island's identity is its position, blob tint and hero.
  - 🌅 hero = last night's sleep (`7,2 óra alvás`, sub: goal distance + weekly debt); facts = weight trend vs goal + HRV (mock-only); CTA = the morning chain's first open step.
  - ☀️ hero = the session's start (`13:00 · Pull A · ~55 perc`, sub: mezó-week; rest day: `Pihenő` + `Saját edzés`); facts = protein-so-far vs target + energy balance (from the fuel plan); the niggle warning survives as the one safety chip.
  - 🌙 hero = a **live countdown to lights-out**; facts = day balance (+XP · n/N) + sleep outlook; CTA = the Napzárás entry (lavender — the app's one non-coral CTA). The island's content **swaps by `windDown` phase** (§2).
- **The capsules** carry a one-line essence (next item / session time / Napzárás opening) + an open-count (`N ›` / `✓ kész` / `—`). The **chronologically-current** island wears a gold `MOST` tag + ring *independent of selection* — „hol tartok” and „mit nézek” never blur (the `DayFaceStrip` dual-signal, inherited).
- **L1** (`IslandList`) is the island's **full item list** — the retired `TodoCard` + `DoneFold` job: grouped `ItemRow`s in first-appearance order, the **briefing** (morning) / **companion note** (day, evening) as a CoachBubble head, the **creed/reflection** under a `Fókusz` group (`IntentionBanner` reused), and the done block (evening: „Ahogy a nap telt” + `Ma összesen +N XP`). Scrolls internally; the sky itself never scrolls.
- **L2** — every sheet unchanged (CheckIn, ActivityLog, LogMeal, SleepLog, Intention, Reflect, CustomWorkout, Creed).
- **Rough day (`?day=rough`)** no longer swaps screens: the capsules collapse and the sky **melts into one warm anchor island** (`AnchorIsland` — three gentle anchors, a warm companion line, `Kilépés`). Checked before everything else, as ever.

Everything on an island is actionable while that island is merely *selected*, not current („act-anywhere”). Status per layer: **FE mock ✅** (deterministic; the mock sleep goal wake 06:45 / bed 23:15 pins the windows), **FE real ✅** (composition over existing reads; the new facts derive from `useSleep`/`useWeight`/`useGoal`/the fuel plan — no new backend), **Backend ✅ check-in only** (unchanged — the re-composition was frontend-only, no API-contract change).

## 2. User-facing behavior

- **Open the app →** lands on `/today` (`router.tsx`); mock renders synchronously.
- **Fixed chrome:** the shared **`AppHero`** (identity + XP ring + 🔥/⚡/🪙; Today passes the ✨ Insights link as `utilities` — the only Today→Insights route). `VulnerabilityCard` (`?vulnerable=on`) renders between the chrome and the sky.
- **Selecting an island.** Tapping a capsule grows it with a **continuous bubble morph** (~550 ms shared spring on flex + radius, cross-fading capsule/content layers — no empty frame, no radius stall) while the old big island shrinks back to its slot; order never changes. `?dp=reggel|nap|este` pins the selection (URL-derived, never mirrored to state; `null`/`''`/unknown → the clock's island; selecting the current island **deletes** the param; writes `{replace:true}`). A face switch always closes an open L1.
- **The promoted CTA** is the island's single primary act: the chain's next step (morning, dispatched through the same `act()`/`habitAction` path as its L1 row — withdawn/disabled while a habit write is in flight), `Indítsuk`→`/train` or `Logold` (day session hero; `Saját edzés`→CustomWorkoutSheet on rest days), the Napzárás CTA (evening; `?ritual=` override wins, `waiting` renders a ghost with the opening time — the window only nudges, `/ritual` always works).
- **`még N ›` / the done line** unfold L1 in place: the hero content yields, rows stagger in (70 ms ladder, open-ended `n+8` tail), the list scrolls internally, `összecsuk ↑` folds back. All row behaviors are inherited unchanged: quest pills wear `questAction`'s own labels (`+250 ml` logs in place; `Check-in` opens the first fillable slot), habit kinds route through `habitAction` (Pipa / Logolás / sheets), fuel rows log **in place** (LogMealSheet), a `skipped` check-in slot stays fillable (`Hogy voltál?` · `HH:mm · elmaradt` · `Pótold`), `linkUrl` renders `↗` beside the action, in-flight habit writes withdraw only habit pills, and **no row ever shows a control this screen cannot serve** (`servableAction` strips + `habitHint` explains).
- **The evening island's four phases** (one hero slot, content cross-slides; countdown always live, 30 s tick):
  | Phase | Window | Content |
  |---|---|---|
  | 🌙 normál | evening, `phase === 'none'` | facts + lavender CTA; sub: napzárás-ablak + villanyoltás |
  | 🌘 ráhangolódás (dim) | `[bed−90, bed−60)` | facts swap to the REM-in-cool-room evidence + sleep outlook; sub: fény &lt;30 lux · ~18 °C |
  | 🌒 leállás (winddown) | `[bed−60, bed)` | the CTA row gains the **`Leállás megvolt ✓`** ghost — the `wind_down` MANUAL habit's check (same `['habitDay', date]` cache as its row; the L1 row is filtered **only while this phase shows the ghost**, so the habit is offered exactly once and stays reachable in dim/none — the `mezo-mvb4.1` rule, relocated) |
  | 🌑 éjszaka (night) | `[bed, wake−30)` | **the island shell itself darkens** (theme-invariant dark, the `.wdb-night` heritage); countdown reads `elmúlt`; a single `Éjszakai mód megnyitása ›` row → `/me/sleep/night`; no facts, no CTA |
  The ritual-owned rows (`ritual:day` + `habit:evening_ritual`) are always filtered from the evening L1 — the hero CTA owns that act (`RitualCard`'s rule, relocated into `IslandEvening`).
- **Ticking something** removes it from the open list (into the island's done block / the evening retrospective); chain completion fires the per-chain toast (`ChainCelebrations` — `🌅 Tökéletes reggel` / `🌙 Tökéletes este` / `✨ {title} kész`); level-ups ride the shared `useLevelUp` overlay (consume-once, unchanged).
- **Scenario deep-links** (dev/demo affordances, unchanged semantics): `?dp=`, `?day=good|medium|rough` (rough → the anchor melt), `?niggle=on|off` (the day island's warn chip), `?vulnerable=on|off`, `?retaDay=N`, `?ritual=waiting|open|done`.
- **Check-in** — the 4 canonical slots bucket onto their islands' L1 by clock time; `CheckInSheet` per slot; real mode reads/writes the server day (unchanged, §4).

## 3. Architecture & data flow

The single FE↔data boundary stays `frontend/src/data/hooks.ts`; every hook is dual-mode. Shape of the screen: **`TodayPage` holds every hook, the pure logic modules derive the day model + item list + facts, and the island components are presentational** (the evening island alone self-fetches its phase/ritual/habit wiring, the `WindDownBanner`/`RitualCard` heritage).

### The three logic modules

- **`logic/dayFace.ts`** — the day model (UNCHANGED, `mezo-ly8c`): three wrap-aware windows off `useSleepGoal()`'s wake/bed anchor (mock: 06:15–11:45 / 11:45–19:15 / 19:15–06:15), degenerate-anchor guard, `dayFace`/`faceWindows`/`faceOf` + `DAY_FACES`/`FACE_LABEL`/`FACE_EMOJI`.
- **`logic/todayItems.ts`** — the six-source normalizer (UNCHANGED): `buildTodayItems`/`itemsForFace`/`openCountByFace`/`isFillableSlot`, dedup tables, quest CTA labels.
- **`logic/islandFacts.ts`** — **NEW (`mezo-euze`)**: pure fact derivations for L0. `IslandFact { label, value, unit?, delta?: { text, tone: good|warn|muted } }`, `IslandHero { value, unit, sub }`. Exports: `morningHero` (sleep hours + goal diff + 7-night debt; null without a last night → `fallbackHero(openCount)`), `weightFact` (7-day delta, toward-target tone, goal distance), `hrvFact` (from the QuickStats cells — **null in real mode**, no source), `proteinFact` + `kcalFact` (from the fuel plan's slots/energy), `dayBalance`, `sleepOutlook`, `bedCountdown` (wraps `minsToBed`; >12 h to next bed = the „elmúlt” state). **Every fact is null on a missing source — the cell simply does not render** (strip philosophy; 0 facts ghost the strip).
- `logic/useWindDownPhase.ts` — the ONE ticking phase derivation, now read by `TodayPage` (the shell's `night` prop) **and** `IslandEvening` (content + countdown). `questAction`/`habitAction`/`growthToday`/`useChainCelebration`/`windDown.ts` unchanged; **`dayArc.ts` still belongs to ritual's recap** (do not delete — see §9).

### The composition root

```
TodayPage.tsx (composition root — every hook; islands are presentational)
  ├─ hooks unchanged from the faces era: useTodayScenario · useToday · useCheckins · useSleepGoal
  │    · useDailyQuests/useQuestActions · useActivities · useHabitDay/useHabitActions/useHabitCatalog
  │    · useRitualDay · useWaterActions · useIntentionDay/Actions · useQuickStats · useCompanionNote
  ├─ NEW readers for the facts: useSleep → {sleepLog, lastNight} · useWeight → weightLog
  │    · useGoal → targetWeight · useFuelPreview → {visible, nextStack, plan}  ← `plan` is the
  │      ADDITIVE mezo-euze extension: the full FuelPlanToday the hook already composed
  ├─ useWindDownPhase → the evening shell's night state
  ├─ sessions: DaySession[] authored ONCE ([0] = hero; face follows the hero; filtered by ID)
  ├─ items = buildTodayItems(...) + servableAction stripping        (unchanged enforcement point)
  ├─ current = dayFace(now, goal);  selected = ?dp= ?? current;  listOpen state (closed on switch)
  ├─ facts: morningFacts/dayFacts/eveningFacts + mHero via islandFacts (plain derivations)
  └─ render: AppHero → VulnerabilityCard? → IslandSky
       ├─ Island reggel  → IslandMorning (hero+facts+chainNext CTA | L1 with BriefingCard head)
       ├─ Island nap     → IslandDay     (DayHero | Pihenő; warn chip; L1 with CompanionNote head)
       ├─ Island este    → IslandEvening (4 phases; ritual CTA; wind_down ghost; L1 retrospective)
       └─ (anchor melt: IslandSky anchor + AnchorIsland — rendered by the ?day=rough early return)
     + the seven sheets (unchanged act()/sheet-host wiring)
Guard order (unchanged, load-bearing): anchorMode FIRST (sync from URL — now renders the melted
sky, still no skeleton flash) → sleepGoalPending → AppHero + TodaySkeleton (island-shaped mirror;
the SAME appHero element in every branch — node-identity contract, TodayPage.skeleton.test).
```

Check-in real path, consume-once level-ups, `act()` dispatch table, session-authored-once and the `?dp=` parse rules are all **verbatim inherited** from the faces era — see §2 and the tests in §8.

## 4. Data model & API

### Frontend types (`frontend/src/data/types.ts`) — unchanged
`DayState`, `CheckinValues`/`CheckinState`/`CheckinSlot`, `Briefing` (`confidence?` optional; `tone?` dead data), `Workout*`, `VolleyballSession`, `TodayMeta`/`UserMeta`, `TodayScenario`, `FuelSlot`/`FuelPlanToday`.

**View/logic shapes live OUTSIDE `data/types.ts`:** `DayFace` + consts (`logic/dayFace.ts`); `TodayItem`/`ItemStatus`/`ItemSource`/`ItemAction`/`SessionItemInput`/`TodayItemsInput` (`logic/todayItems.ts`); **`IslandFact`/`IslandHero`/`FactTone` (`logic/islandFacts.ts`, mezo-euze)**; `DayHero` moved from the retired `FaceDay` to **`components/IslandDay.tsx`**; `ItemTone` stays in `shared/ui/ItemCard.tsx`. **No API-contract change** — the re-composition was frontend-only.

### Mock data — unchanged
`data/today/today.ts` (incl. mock-only `workoutPrediction`/`volleyballNote` — the latter now **unrendered**, see §9), `checkins.ts`, `data/me/sleepGoal.ts` (`mockSleepGoal` wake 06:45 / bed 23:15 — pins the island windows and the goldens).

### Backend check-in (the only real piece) — unchanged
Contract [`api/feature/checkin/checkin.yml`](../../api/feature/checkin/checkin.yml); `GET/POST /api/biometrics/checkin`; backend `feature/biometrics/checkin/` (`CheckInController`/`Service`/`Entity`/`Repository`/`Mapper`), migration `202606101320_mezo-v67_create_check_in.sql`, FE client `data/me/biometricsApi.ts` (`checkinApi` — the shared biometrics client whose other methods belong to `useWeight`/`useSleepGoal`/`useSleepShot`, which is why this file keeps drifting the doc's staleness without Today changing).

## 5. Integrations

Today is an **aggregation surface** — its value is the seams:

- **→ Train** — *live shared data + navigation*. The day island's hero is Train's today session (`useToday` composes `useTrain()`); `Indítsuk` → `/train`; rest day → `CustomWorkoutSheet`. The session is authored once (`DaySession[]`, order = hero precedence, filtered by ID); identity via `sportKinds`. The card language (`ItemCard`/`ItemRow`) is shared code.
- **→ Fuel** — *shared data + a shared write surface*. `useFuelPreview` composes the same `useFuelTimeline()` plan the Fuel „Mai” renders, and **since `mezo-euze` also returns that full `plan`** — the day island's protein/energy facts read `plan.slots`/`plan.energy`, so Today's facts and Fuel's timeline cannot diverge. Fuel rows stay L1 `ItemRow`s (bucketed by `faceOf`), logging in place via `LogMealSheet`. The `nextStack.mezoNote` companion line **lost its surface** (the `.tdc-note` slot retired — §9).
- **→ Me / sleep & weight & goal** — the sleep anchor (`useSleepGoal`) remains the root dependency (one clock: faces = windDown = Napzárás = circadian theme). **New readers (mezo-euze):** `useSleep().lastNight/sleepLog` (the morning hero), `useWeight().weightLog` + `useGoal().goal.targetWeight` (the weight fact). Same caches the Me tab uses.
- **→ Insights** — navigation only (the ✨ `AppHero` utility).
- **← AppHero / progression** — unchanged; [growth.md](growth.md).
- **→ Biometrics backend (real)** — `useCheckins` read+write; the companion's context snapshot reads the latest check-in ([companion.md](companion.md) §5.5).
- **→ Growth (`/me/growth`)** — *live shared data + navigation*. Quests render as L1 rows; the header summary + the ONLY Today→Growth route moved from the retired `TodoCard` header onto the **L1 quest group heading** (`IslandList`'s `{d}/{t} · +XP ›` link). `GrowthPage` still mounts `DailyQuestsCard`/`ActivityLogCard` — **these two components live under `features/today/components/` but their only mount is GrowthPage** (they are NOT orphans; the re-composition kept them for that consumer).
- **← AppLayout / shell** — `useTodayScenario().anchorMode` drives both the warm canvas (`PhoneFrame anchor`) and the sky melt; the two must stay derived from the same hook. The circadian `[data-day]` canvas tint is the app-level „evening cooling” (the spec's screen-cooling is deferred to it — ADR 0022).
- **Shared UI consumed:** `ItemCard` + `ItemRow`, `CoachBubble` (briefing/companion/anchor voices), `Skeleton`, `RefTag`, `Sheet`, `Icon`, `SafeMarkdown`. (`StatStrip` itself is no longer mounted by Today — the fact cells are the island's own `.isl-fact` family on the same idiom.)

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

**Add a new TODO SOURCE** — unchanged recipe: emit in `buildTodayItems` (bucket via `faceOf`, group heading, action with the raw domain object), dedup if needed, wire the hook, teach **both** `act()` and `servableAction()`, test in `todayItems.test.ts` + `TodayPage.dispatch.test.tsx`. It surfaces automatically as L1 rows on its island.

**Add / swap an L0 FACT (the new common case):**
1. Write a pure derivation in `logic/islandFacts.ts` returning `IslandFact | null` — **null whenever the source is absent** (the HRV precedent; never fabricate). Delta text is contextual (trend/goal-distance/forecast), tone `good|warn|muted`.
2. Table-test it in `islandFacts.test.ts` (value formatting — Hungarian decimal comma —, tones, the null branch).
3. Wire the source hook in `TodayPage` and add the fact to the island's `facts` array (max 2 cells per island; the fact catalog in the spec §3 lists vetted candidates).
4. If the source is a new hook on the page, mind the real-mode cost (it runs on every Today visit).

**Change an island's L0 composition** — the island components are presentational: `IslandMorning`/`IslandDay`/`IslandEvening` receive pre-derived props; keep L0 to hero + facts + one CTA + handles (ADR 0022's layer rule — anything more belongs in L1). Evening-phase content lives in `IslandEvening`'s phase blocks; a new phase means a new `windDown.ts` window first.

**Change the day model** — unchanged: constants in `dayFace.ts` (`MORNING_LEAD_MIN` imported from `windDown.ts` on purpose); re-check `dayFace.test.ts` + regenerate the today goldens.

**Promote a mock section to a real backend** — the check-in remains the working template (contract-first → backend package → Liquibase → ITs → dual-mode FE swap); see the references table in `CLAUDE.md` and §4.

## 8. Testing

### Pure logic (`frontend/src/features/today/logic/`)
- **`islandFacts.test.ts` (NEW)** — table tests per fact: morning hero null-without-night / comma formatting / weekly debt at 3+ nights; weight 7-day delta + toward-target tone + single-entry no-delta; HRV cell pick + real-mode null; protein done-vs-target sums; countdown `H:MM` + the `elmúlt` wrap branch; the shape trio (fallback/dayBalance/sleepOutlook/kcal).
- `dayFace.test.ts`, `todayItems.test.ts`, `questAction/habitAction/growthToday/windDown/useChainCelebration` tests — **unchanged and untouched** by the re-composition (the proof the model survived).

### Composition (`frontend/src/features/today/pages/`)
- **`TodayPage.test.tsx`** — island selection end to end (clock → big island; `?dp=` override + the `MOST` capsule marking; blank/unknown fallbacks; capsule tap; current-face param deletion; param preservation; **face switch closes L1**); composition (chrome + sky; the retired surfaces are GONE — `.greet`/`.dfs`/`.faceswap`/`.tdc`/tablist/previews/greeting asserted absent; `?day=rough` melts to the anchor island; the promoted CTA; the sleep hero + fact cells; every chain step actionable **in L1**; mid-chain tick; linked content; the briefing bubble at the L1 head and NOT on L0; Napzárás owned by the CTA with no L1 twin; niggle chip + `?niggle=off`; the quest-group growth link; the evening retrospective + day XP); the wind-down offered-exactly-once trio (winddown: island ghost, no L1 row · dim/none: the L1 row is the only affordance); the **no-dead-control class net** (opens L1 on all three islands, clicks every control, requires an observable effect); the `act()` dispatcher cases; the per-chain celebrations (seeded QueryClient, custom DAY chain).
- **`TodayPage.dispatch.test.tsx`** — the mocked-hook walk of every `habitAction`/`questAction` kind (now opening L1 first), the skipped-slot `Pótold` cases, in-flight withdrawal (L1 rows + the **disabled** promoted CTA), consume-once level-ups, chain toasts, the rest-day `Saját edzés` sheet, session-authored-once (early gym renders nowhere on the morning island — its only trace the day capsule's essence; stacked-day non-hero row with facts; sport-as-hero), catalog-driven bucketing.
- **`TodayPage.skeleton.test.tsx`** — pending gate → island-shaped skeleton (no capsule buttons); resolve → live sky; live transition on the same mount; the `.apphero` **same-DOM-node** contract; anchorMode wins over pending (no skeleton flash into the melt).
- **`TodaySkeleton.test.tsx`** — the island mirror (3 `.isl`, 1 big), inert, `role="status"`.

### Components
- **NEW:** `Island.test.tsx` (capsule spoken label + onSelect; big hides the capsule from the a11y tree; `MOST`; the night shell), `IslandList.test.tsx` (group order; growth link; act payload + stripped-action row; done heading + day XP; `összecsuk`; habitPending withdraws only habit pills; head/focus slots), `IslandMorning.test.tsx` (hero render; empty-facts ghost; CTA → onAct; `még N ›` count excludes the promoted item; doneline; open state = briefing head + Fókusz + összecsuk), `IslandDay.test.tsx` (gym hero + CTA; rest day; warn chip; facts; note head), `IslandEvening.test.tsx` (the four phases incl. the pipa/L1 ownership rules, `?ritual=done`, the ritual-row filter, the retrospective XP line), `AnchorIsland.test.tsx` (three anchors; local tick; exit).
- Kept as-is: `BriefingCard`, `IntentionBanner`, `CompanionNoteCard`, `VulnerabilityCard`, `ChainCelebrations`, sheet tests, `shared/ui/ItemCard|ItemRow` tests. `DailyQuestsCard`/`ActivityLogCard` tests cover GrowthPage's mounts.
- **`todayReducedMotion.test.ts`** — re-anchored onto the island families: string-presence for the four reduce overrides + keyframes (`isl-morph`/`isl-floaty`/`isl-rowin`/`isl-phasein`), the **cascade guard** (specificity + source-order per family — every modifier stays `:where()`-wrapped), and the L1 stagger ladder coverage (open-ended `n+8` tail). Mutation-relevant sanity cases included.
- **Deleted with their components (`mezo-euze`):** `DayFaceStrip`, `GreetingHeader`, `FaceHeroCard`, `TodoCard`, `DoneFold`, `WindDownBanner`, `RitualCard`, `AnchorModeView` tests. Cross-feature re-anchors: `app/navigation.test.tsx` + `ritual/pages/RitualPage.test.tsx` assert the capsule buttons instead of the retired tablist.

### Visual regression
The three goldens keep their names/paths/clocks (`today-reggel|nap|este` × light/dark — `?dp=` pins the island, the frozen clock pins `MOST`/phase): regenerated for the islands on darwin; **linux baselines regenerate via `update-visual-baselines.yml`** on the branch. `train-*` goldens unchanged (shared card language untouched). Known pre-existing failure: `train-session`'s **darwin** baseline is stale on main too (filed separately); CI compares linux.

**Commands** unchanged: `VITE_USE_MOCK=false pnpm test` + `VITE_USE_MOCK=true pnpm test` (both green), `pnpm vitest run src/features/today` focused, `pnpm test:visual`.

## 9. Decisions, gotchas & deferred

- **Decisions:** the current structure is **[ADR 0022 — three islands](../decisions/0022-today-three-islands.md)** over [`specs/2026-08-07-today-three-islands-design.md`](../superpowers/specs/2026-08-07-today-three-islands-design.md) (brainstormed through three in-browser prototype rounds — the interactive mockups live in `specs/assets/`). It supersedes the *render layer* of [ADR 0014](../decisions/0014-today-daypart-faces.md); ADR 0014's day model, card language, act-anywhere and dedup decisions remain in force, as do the honest-completion decisions ([`specs/2026-07-04-…`](../superpowers/specs/2026-07-04-today-honest-completion-design.md)) and ADR 0010 (nothing self-completes).
- **Accepted trades (ADR 0022 records them):** the cross-face **preview rows are gone** (capsule essences carry the job); the **fuel companion line** (`.tdc-note`) and the **stacked-day sport note** (`volleyballNote` — now dead data in `useToday`'s return, kept for signature stability) lost their surfaces — no prose on L0 by design; the **greeting is gone** (AppHero already carries identity). The four ADR 0014 trades stand where still applicable (per-face check-in slots; ritual `nav` action unreachable — now because the evening CTA owns it; the real-mode level-up double-fire).
- **GOTCHA — `DailyQuestsCard`/`ActivityLogCard` are NOT orphans.** They live under `features/today/components/` but mount on **GrowthPage** — deleting them with the faces breaks `/me/growth` (a first-pass mistake in this re-composition, caught by the build). Leave them (and their tests) until Growth gives them a new home.
- **GOTCHA — `.wdb-night*` CSS outlived `WindDownBanner`.** `SleepPage.tsx` renders the same night-entry row; the family stays. Similarly **`.anch-coach` outlived the `.anch*` family** — `AnchorIsland` reuses the muted CoachBubble tint; only that rule survives.
- **GOTCHA — `logic/dayArc.ts` still belongs to ritual's recap** (`DayStoryStep.tsx`); do not delete with anything Today-side (unchanged warning).
- **GOTCHA — the island motion cascade guard.** Every island animation modifier (`[data-face]` delay variants, the L1 `:nth-child` ladder) must stay wrapped in `:where()` — the reduce-block override wins on the source-order tie-break only at equal specificity. `todayReducedMotion.test.ts` computes this structurally; a bare qualifier fails the guard even with green string checks.
- **GOTCHA — the sky fills the scroller via `:has()`.** `.screen-content:has(.sky-islands)` flips the app scroller to a flex column so the sky can `flex: 1`; L0 never scrolls, only `.isl-l1` does. A new Today child outside the sky must be `flex: none` or it will eat the islands' height.
- **GOTCHA — the L1 quest heading is the only Today → Growth route** (the retired `TodoCard` header's job). Removing the `growth` prop from `IslandList` would silently orphan quest management from Today.
- **Inherited gotchas still live:** the dead-control class + `servableAction`'s honest limit; the degenerate-anchor guard's real assertion (`dayFace.test.ts` `'este'`); after-midnight writes land on the NEW day (`localDateString()`); the mock water CTA never completes its quest; the sport hero never renders in mock's default screen (no `today:true` seed); the niggle strip is mock-only (real workouts carry no `niggleWarning`); `useToday`'s meso fields are mostly unconsumed (**exception since mezo-euze: `user.weekInMeso` is read again** — the day island's mezó-week subtitle); `briefing.tone` is dead data; the `useGoal` queryFn-less `['weightLog']` console noise (pre-existing, `mezo-edrv` — now also triggered via TodayPage's own `useGoal`).
- **Deferred / follow-ups:** focus management for island-select/L1-open (beyond default button focus — ADR 0022); the weekly-load fact (needs `weekAgenda` wiring); the evening „heti rang” delta (needs a 7-day XP source); HRV (needs a source, cell auto-returns); real predictions/niggle/vulnerable/anchor signals (proactive epic); `ItemCard`'s `DoneBar` import from a feature folder (inherited, filed); `questAction`'s unmapped `intention_focus_set` (filed).

## 10. Key files

**Frontend — pages** (`frontend/src/features/today/pages/`):
- **`TodayPage.tsx`** — the composition root (§3): every hook, the `items` memo + `servableAction`, `current`/`selected`/`listOpen`, the fact derivations, `act()`, the seven sheets, and the `IslandSky` render. Early returns: `anchorMode` → the melted sky (`IslandSky anchor` + `AnchorIsland`), then `sleepGoalPending` → `TodaySkeleton`; the `appHero` element renders in **every** branch (node identity).
- **`TodaySkeleton.tsx`** (+ test) — the island-shaped loading mirror (1 big + 2 capsule placeholders in a `.sky-islands`), inert, `role="status"`.
- `sheets/` — unchanged (CheckInSheet + observation, ActivityLogSheet, IntentionSheet, CreedSheet, ReflectSheet; cross-feature hosts: LogMealSheet, SleepLogSheet, CustomWorkoutSheet).

**Frontend — the island components** (`frontend/src/features/today/components/`, all `mezo-euze` unless noted):
- **`shared/ui/Island.tsx`** (+ colocated test) — the shell: capsule↔big continuous bubble-morph, the halo blob, the `now`-ring tag, the spoken capsule label (`ariaLabel`, caller-composed), the `night` dark state, a `belt` variant (fixed 54px, no float). **Promoted out of `features/today/components/` to `shared/ui/` by `mezo-jgh9`** (Fuel's window-river became its 2nd consumer) — fully domain-free: `tone: IslandTone` (`'reggel'|'nap'|'este'|'fuel'|'keret'`) + a `capsule: {emoji,title,essence,count,nowTag?}` the caller supplies, `data-tone` on the root (was `data-face`). `TodayPage.tsx` is the Today-side caller: it builds `IslandCapsule`s from `FACE_EMOJI`/`FACE_LABEL` and composes the aria-label with the original formula.
- **`IslandSky.tsx`** — the non-scrolling sky + the anchor-melt layout state.
- **`IslandMorning.tsx` / `IslandDay.tsx` (exports `DayHero`) / `IslandEvening.tsx`** (+ tests) — the three big views (L0 closed / L1 open). `IslandEvening` self-fetches its phase/ritual/habit wiring (the `WindDownBanner` + `RitualCard` successor) and owns the L1 filter rules (`OWNED_BY_RITUAL_HERO`, the phase-scoped `wind_down` filter).
- **`IslandList.tsx`** (+ test) — the L1 layer (the `TodoCard`+`DoneFold` successor): grouped `ItemRow`s, the quest-heading growth link, `head`/`focus` slots, the done block + day-XP line, `összecsuk`.
- **`IslandFactsStrip.tsx`** — the 1–2 fact cells (StatStrip idiom + delta line, ghost on empty).
- **`AnchorIsland.tsx`** (+ test) — the rough-day melt content (the `AnchorModeView` successor; three anchors, local tick, `Kilépés`).
- Reused unchanged: **`BriefingCard`** (the morning L1's CoachBubble head), **`CompanionNoteCard`**, **`IntentionBanner`** (chip → morning/day L1 `Fókusz`; reflect → evening L1), **`VulnerabilityCard`**, **`ChainCelebrations`**. GrowthPage's mounts: `DailyQuestsCard`, `ActivityLogCard` (§9).
- **Deleted by mezo-euze** (with tests): `DayFaceStrip`, `GreetingHeader`, `FaceMorning`, `FaceDay`, `FaceEvening`, `FaceHeroCard`, `TodoCard`, `DoneFold`, `WindDownBanner`, `RitualCard`, `pages/AnchorModeView`.

**Frontend — logic** (`frontend/src/features/today/logic/`): `dayFace.ts`, `todayItems.ts`, **`islandFacts.ts` (+ test, NEW)**, `useWindDownPhase.ts`, `windDown.ts`, `questAction.ts`, `habitAction.ts`, `growthToday.ts`, `useChainCelebration.ts`, `dayArc.ts` (ritual's — §9); feature-root `todayReducedMotion.test.ts` (the island cascade guard).

**Frontend — data & shared:** `data/today/todayHooks.ts` (**`useFuelPreview` now returns `plan` too** — the one data-layer change), `checkinHooks.ts`, `briefingHooks.ts`, `today.ts`, `checkins.ts`; the face anchor `data/me/sleepHooks.ts` + `sleepGoal.ts`; new fact sources `data/me/weightHooks.ts` + `goalHooks.ts` + `sleepHooks.ts` (`useSleep`); `data/me/biometricsApi.ts`; `shared/ui/ItemCard.tsx` + `ItemRow.tsx` + `CoachBubble.tsx`; `app/AppLayout.tsx` / `PhoneFrame.tsx` / `router.tsx`.

**CSS** (`frontend/src/styles/prototype.css`) — the Today-owned family is now **`.sky-islands` + `.isl*`** (`mezo-euze` section, blob tone hooks retargeted to `[data-tone=…]` by `mezo-jgh9` when the shell left for `shared/ui`): the shell (`.isl`/`.isl-big`/`.isl-belt`/`.isl-blob`/`.isl-cap*`/`.isl-nowtag`/`.now-clock`/`.isl-night`/`.isl-anchor`), the big view (`.isl-hero-*`/`.isl-facts`/`.isl-fact*`/`.isl-warnchip`/`.isl-act`/`.isl-cta`/`.isl-more`/`.isl-doneline`/`.isl-openhead`/`.isl-phase`/`.isl-nightrow`), the L1 (`.isl-l1*`/`.isl-grouph*`/`.isl-dayxp`), the keyframes (`isl-morph`/`isl-floaty`/`isl-rowin`/`isl-phasein`) and their `:where()`-guarded reduce block, plus the `.screen-content:has(.sky-islands)` flex flip. Shared families unchanged: `.itemrow*`, `.todaycard*`/`.metapill`/`.donebar*`, `.brief*`, `.creedchip*`/`.reflect*`, `.vuln*`, `.coach-bubble`/`.cb-*`, `.wdb-night*` (SleepPage's), `.anch-coach` (the melt's bubble tint). **Deleted:** `.greet*`, `.dfs*`, `.tdc*`, `.fhc*`, `.donefold*`, `.zoneline`/`.dayxp`, the `.faceswap` motion family, `.anch*` (minus `.anch-coach`). Catalogue in [`_platform-design-system.md`](_platform-design-system.md).

**Visual goldens:** `frontend/tests/visual/visual.spec.ts` + `today-{reggel,nap,este}-{light,dark}-{darwin,linux}.png` (§8).

**API contract + backend** — unchanged (§4).

**Docs:** **[ADR 0022](../decisions/0022-today-three-islands.md)** · [`specs/2026-08-07-today-three-islands-design.md`](../superpowers/specs/2026-08-07-today-three-islands-design.md) + [`plans/2026-08-07-today-three-islands.md`](../superpowers/plans/2026-08-07-today-three-islands.md) (the current structure) · historical layers: [ADR 0014](../decisions/0014-today-daypart-faces.md) + [`specs/2026-07-29-today-daypart-redesign-design.md`](../superpowers/specs/2026-07-29-today-daypart-redesign-design.md), [`specs/2026-07-04-today-honest-completion-design.md`](../superpowers/specs/2026-07-04-today-honest-completion-design.md), [`specs/2026-06-03-mezo-today-design.md`](../superpowers/specs/2026-06-03-mezo-today-design.md); house standards in [`docs/references/`](../references/).
