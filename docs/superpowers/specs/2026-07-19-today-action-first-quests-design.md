# Today action-first re-composition + inline quest logging — design

- **Date:** 2026-07-19
- **Driving bd issue:** `mezo-gj2y`
- **Status:** approved (interactive brainstorm, 2026-07-19)
- **Supersedes on `/today`:** the Growth-summary-row decision of the Napív S3 re-composition
  (`mezo-8141`, [2026-07-04 honest-completion spec](2026-07-04-today-honest-completion-design.md)
  era layout) — quests return to Today in a new, action-focused form.

## 1. Problem

Two user pains on the `/today` screen:

1. **The 3 daily quests are invisible and inert.** Since Napív S3 (`mezo-8141`) Today only shows
   the one-row `GrowthTodayRow` summary; seeing and acting on the quests takes a detour to
   `/me/growth`. The user wants the three quests visible on Today **and instantly actionable**.
2. **No visual hierarchy.** The stack (greeting → arc → hero → briefing → check-in → stats → fuel
   → growth row) renders every card at the same weight — the screen reads as "dumped together"
   with nothing guiding the eye.

## 2. Decisions (user-approved forks)

| Fork | Decision |
|---|---|
| What does "instant logging" mean for DERIVED quests? (ADR 0010: quests are never self-claimed) | **Smart CTA per quest** — each offered quest row carries one action chip that opens the logging surface matching its metric; requires putting `metric` on the quest wire (small contract addition). |
| Growth page's "Ma" block after the move | **Both surfaces** — Today gets a new compact action card; `/me/growth` keeps the full `DailyQuestsCard` + `ActivityLogCard` unchanged. Same query key — cannot diverge. |
| Screen structure | **Action-first zones** — 1) "Most": greeting + day arc + hero; 2) "Teendők ma": quests + check-in; 3) "A napod": briefing/notes/stats/fuel. Zone dividers guide the eye. |
| Quest block form | **A) Compact action card** — one smart CTA per row, no `why` lines, **no reroll on Today** (Csere stays on Growth's full card: Today = act, Growth = manage). `GrowthTodayRow` retires; its `/me/growth` link + XP summary fold into the card header. |

## 3. New `/today` composition

```
AppHero                     (unchanged, sticky)
GreetingHeader + DayArc     (unchanged)                          ─ zone: Most
Hero: WorkoutTeaser | rest-day VolleyballCard (unchanged)
VulnerabilityCard?          (conditional — tone before demands)
── ZoneDivider „Teendők ma” ──
TodayQuestsCard             (NEW — compact, smart CTAs)          ─ zone: Teendők ma
CheckInStrip                (unchanged behavior)
── ZoneDivider „A napod” ──
BriefingCard                (collapsed default, unchanged)       ─ zone: A napod
CompanionNoteCard?          (conditional, unchanged)
secondary VolleyballCard?   (workout day + sport, unchanged)
QuickStatsRow               (unchanged)
FuelTimelinePreview         (unchanged)
CheckInSheet                (modal, unchanged)
```

`GrowthTodayRow` is **deleted** (component + test); its pure derivation `logic/growthToday.ts`
stays — the new card's header reuses it. The reorder moves `BriefingCard` (and the companion
note) **below** the check-in strip: orientation → action → context.

`ZoneDivider` is a Today-local presentational component (`features/today/components/`): a
small-caps faint label + hairline, marking the two zone boundaries. Not a shared primitive until
a second feature needs it.

## 4. `TodayQuestsCard` (new)

`features/today/components/TodayQuestsCard.tsx` — compact, action-focused:

- **Header:** `⚡ Napi küldetések` eyebrow; right side `{done}/{total} · +{xp} XP ›` is a
  `<Link to="/me/growth">` (the retired `GrowthTodayRow`'s job). `{done,total,xp}` come from
  `growthTodaySummary(quests, entries)` — quest completion + combined quest/activity XP, so the
  header keeps parity with what `GrowthTodayRow` showed.
- **Rows (the 3 slots):** state mark (`◦` coral / `✓` success / `—` dimmed, the `DailyQuestsCard`
  idiom) + title (single line) + right-side affordance:
  - `offered` → **one smart CTA chip** (mapping below); no XP chip (the header aggregates).
  - `completed` → `+{xp} XP` chip (success tone).
  - `expired` → dimmed row, no chip (quiet — ADR 0010).
- **Level-up wiring:** same consume-once dance as `DailyQuestsCard` (`showLevelUp(levelUps[0])`
  + `consumeLevelUps()`); the two cards mount on different routes, never simultaneously.
- **Ghost:** `quests.length === 0` → `null` (real mode must not render before the backend has
  a day; matches the `GrowthTodayRow` ghost rule).
- **ActivityLogSheet:** an offered `ACTIVITY` quest's CTA opens the existing
  `ActivityLogSheet` pre-banner-ed with the quest (the `Naplózz` flow, unchanged).

### Smart CTA mapping (`features/today/logic/questAction.ts`, pure + unit-tested)

| metric | CTA | Behavior |
|---|---|---|
| `activity_match` (mode ACTIVITY) | `Naplózz` | opens `ActivityLogSheet(quest)` |
| `water_target` | `+250 ml` | **instant write** `logWater(250)` (`useWaterActions`) — stays on Today; quest re-evaluates via invalidation (§6) |
| `checkin_full` | `Check-in` | opens the next open slot's `CheckInSheet` (callback from `TodayPage`, which owns the sheet state; no open slot → no CTA) |
| `weight_logged` | `Mérés` | navigate `/me/weight` |
| `sleep_target` | `Alvás` | navigate `/me/sleep` |
| `protein_target` | `Fuel` | navigate `/fuel` |
| `own_recipe_meal` | `Főzés` | navigate `/fuel/recipes` |
| `gym_session_done` | `Edzés` | navigate `/train` |
| unknown / missing | — | state-only row (graceful for future metrics) |

## 5. Contract change — `metric` on the quest wire

`api/feature/quest/quest.yml`: `QuestResponse` gains **required** `metric` (string — the
`QuestTargetEnvelope.metric` the evaluator already uses; every catalog entry has one).
Regenerate: `api/generate npm run generate:api` → `frontend pnpm generate:api` → backend
generated types via Maven. Backend: `QuestMapper` maps `target.metric → metric`. FE:
`DailyQuest.metric` in `data/types.ts`, `toQuest` maps it, `questMock` seeds + the MSW reroll
fixture gain honest metric values.

## 6. Freshness — quest evaluation is read-triggered

Derived quests complete on the **next quest-day read**; the global `staleTime: 30s` would make
the card feel dead after logging. Two measures:

1. **`useDailyQuests` real mode gets `staleTime: 0`** — every mount/focus re-reads (the quest
   domain *wants* frequent reads; that's its lazy-evaluation heartbeat, and `AppHero`'s ⚡ chip
   reads the same key on every tab). Endpoint is cheap, single-user.
2. **Quest-relevant same-screen writes invalidate `['dailyQuests', date]`** (real mode):
   `useWaterActions.logWater` and `checkinHooks.saveCheckIn` — so `+250 ml` / the 4th check-in
   flips the quest row (and fires the level-up) without leaving Today. Other metrics log on
   other screens; returning to Today re-reads via (1).

Mock mode: the quest seed is static — the water CTA updates the fuel ring but the quest row
stays offered (same accepted mock-demo limitation as the deterministic activity classifier).

## 7. Testing

- `logic/questAction.test.ts` — the mapping table, unknown-metric null.
- `TodayQuestsCard.test.tsx` — header counts + `/me/growth` link, water CTA fires
  `logWater(250)`, check-in CTA calls the callback, nav CTAs navigate, ACTIVITY CTA opens the
  sheet, completed `+XP` chip, expired dimmed, ghost on empty day, level-up fire + consume.
- `TodayPage.test.tsx` — new order (quest card after hero, check-in after quests, briefing after
  check-in), both zone dividers, `GrowthTodayRow` markup absent.
- Data: `questApi`/`questHooks` tests extended for `metric` + `staleTime`; water/check-in
  invalidation asserted in their hook tests.
- Backend IT: quest contract test asserts `metric` on the day + reroll responses.
- Both FE modes green (`pnpm test` + `VITE_USE_MOCK=true pnpm test`) + `pnpm build`; backend
  focused ITs locally, full suite in CI (self-PR gate).

## 8. Out of scope

- Reroll on Today (stays Growth-only), water progress bar on the quest row, quest-completion
  push feedback beyond the existing level-up overlay, any change to Growth's "Ma" block, the
  QuickInputSheet tiles, AnchorMode.
