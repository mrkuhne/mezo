# Today Action-First Re-composition + Inline Quest Logging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bring the 3 daily quests back onto `/today` as a compact card with one smart log-CTA per quest, and re-order the screen into action-first zones (Most → Teendők ma → A napod).

**Architecture:** Contract-first `metric` addition to `QuestResponse` (backend maps `target.metric`); a new pure `questAction` mapping + `TodayQuestsCard` on the FE; freshness via `staleTime: 0` on the quest-day read plus `['dailyQuests', date]` invalidation from the water and check-in writes; `GrowthTodayRow` retires into the card header.

**Tech Stack:** OpenAPI contract (`api/`), Spring Boot 4 + MapStruct (backend), React 19 + TanStack Query + Vitest/RTL (frontend).

**Driving spec:** [`docs/superpowers/specs/2026-07-19-today-action-first-quests-design.md`](../specs/2026-07-19-today-action-first-quests-design.md) · **bd:** `mezo-gj2y` · **branch:** `feat/today-action-first`

## Global Constraints

- Contract-first: edit `api/feature/quest/quest.yml` BEFORE code; regenerate (`api/generate npm run generate:api`, `frontend pnpm generate:api`); never hand-write boundary DTOs.
- FE hooks only via `@/data/hooks`; deep absolute `@/*` imports; tests colocated; no new `*Screen`/`*View`.
- ADR 0010: quests are never self-claimed — no "complete" button; CTAs only open/perform the underlying log.
- Both FE modes must stay green: `pnpm test` AND `VITE_USE_MOCK=true pnpm test`; build via `pnpm build`.
- Backend: only focused ITs locally (`./mvnw clean test -Dtest='QuestApiIT'`, compose Postgres up); CI runs the full suite (self-PR gate).
- Conventional commits carrying `(mezo-gj2y)`.

---

### Task 1: Contract + backend — `metric` on the quest wire

**Files:**
- Modify: `api/feature/quest/quest.yml` (QuestResponse schema, ~:98-112)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/quest/mapper/QuestMapper.java:14`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/quest/QuestApiIT.java` (2 asserts)
- Generated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` (via generators)

**Interfaces:**
- Produces: wire field `QuestResponse.metric: string` (required) = `QuestTargetEnvelope.metric`.

- [x] **Step 1:** In `quest.yml` add `metric` to `QuestResponse.required` and properties:
  ```yaml
  required: [id, questDate, slot, skillKey, title, why, targetLabel, xp, status, completionMode, metric]
  ...
  metric: { type: string, description: 'QuestTargetEnvelope.metric — drives the FE smart log-CTA (gym_session_done | checkin_full | weight_logged | water_target | protein_target | sleep_target | own_recipe_meal | activity_match)' }
  ```
- [x] **Step 2:** Regenerate: `cd api/generate && npm run generate:api`, then `cd frontend && pnpm generate:api`.
- [x] **Step 3:** `QuestMapper`: add `@Mapping(target = "metric", source = "target.metric")` above `toQuestResponse`.
- [x] **Step 4:** Extend `QuestApiIT`: in `testGetQuestDay_shouldLazilyGenerateThreeSlots_whenTodayAndNoRows` add
  `assertThat(day.getQuests()).allSatisfy(q -> assertThat(q.getMetric()).isNotBlank());`
  and in `testReroll_shouldReplaceQuestInSlot_whenOfferedToday` add
  `assertThat(replacement.getMetric()).isNotBlank();`
- [x] **Step 5:** Run: `cd backend && docker compose up -d && ./mvnw clean test -Dtest='QuestApiIT'` → PASS.
- [x] **Step 6:** Commit: `feat(api): expose quest target metric on the wire (mezo-gj2y)`

### Task 2: FE data layer — `metric` + freshness

**Files:**
- Modify: `frontend/src/data/types.ts:803-815` (DailyQuest)
- Modify: `frontend/src/data/quest/questApi.ts` (toQuest)
- Modify: `frontend/src/data/quest/questMock.ts` (all seeds)
- Modify: `frontend/src/data/quest/questHooks.ts:32` (staleTime)
- Modify: `frontend/src/test/msw/handlers.ts:256-262` (reroll fixture)
- Modify: `frontend/src/data/fuel/fuelHooks.ts:109-127` (useWaterActions invalidation)
- Modify: `frontend/src/data/today/checkinHooks.ts:58-62` (save invalidation)
- Test: extend `frontend/src/data/quest/questHooks.test.tsx`, `frontend/src/data/fuel/fuelHooks.test.tsx`, `frontend/src/data/today/checkinHooks.test.tsx`

**Interfaces:**
- Produces: `DailyQuest.metric: string`; real-mode `useDailyQuests` re-reads on every mount (`staleTime: 0`); `logWater`/`saveCheckIn` (real) invalidate `['dailyQuests', date]`.

- [x] **Step 1:** `types.ts`: add `metric: string` to `DailyQuest` (after `targetLabel`).
- [x] **Step 2:** `questApi.toQuest`: add `metric: w.metric ?? ''` (defensive default keeps old fixtures alive).
- [x] **Step 3:** `questMock.ts`: seed metrics — `dq1: gym_session_done`, `dq2: weight_logged`, `dq3g: activity_match`; history `qh1: weight_logged`, `qh2: gym_session_done`, `qh3: activity_match`, `qh4: water_target`; spare `mockRerollSpare: sleep_target`.
- [x] **Step 4:** MSW reroll fixture gets `metric: 'weight_logged'`.
- [x] **Step 5:** `questHooks.ts`: `staleTime: mock ? Infinity : 0` with a comment (read-triggered evaluation heartbeat — the quest domain wants frequent reads).
- [x] **Step 6:** `useWaterActions` real `onSuccess` also invalidates `{ queryKey: ['dailyQuests', date] }`; `useCheckins`'s mutation `onSuccess` likewise.
- [x] **Step 7:** Extend the three hook tests: metric present on the mock seed / parsed wire; water + check-in saves invalidate the quest key (spy on `queryClient.invalidateQueries`).
- [x] **Step 8:** Run: `cd frontend && pnpm test src/data` (both modes) → PASS.
- [x] **Step 9:** Commit: `feat(data): quest metric on FE types + quest-day freshness invalidation (mezo-gj2y)`

### Task 3: `questAction` pure mapping

**Files:**
- Create: `frontend/src/features/today/logic/questAction.ts`
- Test: `frontend/src/features/today/logic/questAction.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type QuestAction =
    | { kind: 'water'; label: string; amountMl: number }
    | { kind: 'checkin'; label: string }
    | { kind: 'activity'; label: string }
    | { kind: 'nav'; label: string; to: string }
  export function questAction(q: DailyQuest): QuestAction | null
  ```
- Mapping per spec §4: ACTIVITY→`Naplózz`; `water_target`→`+250 ml` (250); `checkin_full`→`Check-in`; `weight_logged`→`Mérés` `/me/weight`; `sleep_target`→`Alvás` `/me/sleep`; `protein_target`→`Fuel` `/fuel`; `own_recipe_meal`→`Főzés` `/fuel/recipes`; `gym_session_done`→`Edzés` `/train`; unknown → `null`.

- [x] **Step 1:** Write `questAction.test.ts` (table-driven over the 8 metrics + ACTIVITY precedence + unknown→null). Run → FAIL (module missing).
- [x] **Step 2:** Implement `questAction.ts`. Run → PASS.
- [x] **Step 3:** Commit: `feat(today): questAction smart-CTA mapping (mezo-gj2y)`

### Task 4: `TodayQuestsCard` + `ZoneDivider`

**Files:**
- Create: `frontend/src/features/today/components/TodayQuestsCard.tsx`
- Create: `frontend/src/features/today/components/ZoneDivider.tsx`
- Modify: `frontend/src/styles/prototype.css` (`.zonediv` block, after `.secthead-np` ~:1262)
- Test: `frontend/src/features/today/components/TodayQuestsCard.test.tsx`

**Interfaces:**
- Consumes: `useDailyQuests/useActivities/useQuestActions/useWaterActions` (`@/data/hooks`), `useLevelUp`, `questAction`, `growthTodaySummary`, `ActivityLogSheet`.
- Produces: `TodayQuestsCard({ onCheckIn }: { onCheckIn?: () => void })` — ghost (`null`) on empty quest day; header `⚡ Napi küldetések` + `{done}/{total} · +{xp} XP ›` Link to `/me/growth`; per-row smart CTA (checkin CTA hidden when `onCheckIn` undefined); level-up consume-once. `ZoneDivider({ label })` — small-caps label + hairline, `role="separator"`.

- [x] **Step 1:** Write `TodayQuestsCard.test.tsx` (header + link, water CTA → `logWater(250)`, checkin CTA → callback / hidden without it, nav CTA navigates, ACTIVITY opens sheet, completed `+XP` chip, expired dimmed + no chip, ghost, level-up fire+consume). Run → FAIL.
- [x] **Step 2:** Implement `ZoneDivider.tsx` + `.zonediv` CSS + `TodayQuestsCard.tsx` (2-line title clamp, `.card`/`.chip`/`.eyebrow` idiom, same level-up effect as `DailyQuestsCard`).
- [x] **Step 3:** Run the component test in both modes → PASS.
- [x] **Step 4:** Commit: `feat(today): compact TodayQuestsCard with smart log CTAs + ZoneDivider (mezo-gj2y)`

### Task 5: TodayPage re-composition + GrowthTodayRow retirement

**Files:**
- Modify: `frontend/src/features/today/pages/TodayPage.tsx`
- Delete: `frontend/src/features/today/components/GrowthTodayRow.tsx` + `GrowthTodayRow.test.tsx`
- Modify: `frontend/src/features/today/pages/TodayPage.test.tsx`
- Keep: `logic/growthToday.ts` (+ test) — consumed by the card header.

**Interfaces:**
- Consumes: `TodayQuestsCard`, `ZoneDivider` from Task 4.
- Produces: new order — AppHero → Greeting → DayArc → hero → Vulnerability? → `ZoneDivider "Teendők ma"` → TodayQuestsCard → CheckInStrip → `ZoneDivider "A napod"` → Briefing → CompanionNote? → volley2? → QuickStats → FuelPreview; `onCheckIn` = first `now`/`pending` slot (none → undefined).

- [x] **Step 1:** Update `TodayPage.test.tsx`: order assertions (both dividers via `role="separator"` names, quest header before `Hogy vagy ma?`, briefing text after it), GrowthTodayRow markup (`Növekedés ma`) absent. Run → FAIL.
- [x] **Step 2:** Rewrite `TodayPage.tsx` composition; delete `GrowthTodayRow.tsx` + its test; remove the `.growrow` CSS block if now-unused (grep first).
- [x] **Step 3:** Run the whole today feature suite in both modes → PASS.
- [x] **Step 4:** Commit: `feat(today): action-first zones — quests inline, briefing below check-in, GrowthTodayRow retired (mezo-gj2y)`

### Task 6: Docs + full gates

**Files:**
- Modify: `docs/features/today.md` (§2 order + quest card behavior, §3 flow, §5 Growth seam, §8 tests, §10 key files), `docs/features/growth.md` (§2 + §5 →Today seam)
- Run: `node scripts/lint-docs.mjs`

- [x] **Step 1:** Update both feature docs to the new composition (GrowthTodayRow → TodayQuestsCard; metric on the wire; freshness rules).
- [x] **Step 2:** `node scripts/lint-docs.mjs` → clean.
- [x] **Step 3:** Full FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` → all green.
- [x] **Step 4:** Commit: `docs(features): today action-first re-composition + quest metric seam (mezo-gj2y)`

### Task 7: Ship (self-PR CI gate)

- [x] **Step 1:** `git push -u origin feat/today-action-first`; `gh pr create` (self-PR = CI trigger).
- [x] **Step 2:** Wait for CI green (`gh pr checks --watch`).
- [x] **Step 3:** `git checkout main && git pull --rebase && git merge --no-ff feat/today-action-first && git push`; delete the branch.
- [x] **Step 4:** `bd close mezo-gj2y`; `bd dolt push`; `git status` → up to date.

## Self-Review

- **Spec coverage:** §3 composition → Task 5; §4 card+mapping → Tasks 3-4; §5 contract → Task 1; §6 freshness → Task 2; §7 testing → embedded per task + Task 6 gates; §8 out-of-scope respected (no reroll on Today, Growth untouched). ✓
- **Placeholders:** none — every step names exact files/values. ✓
- **Type consistency:** `QuestAction` union consumed verbatim in Task 4; `metric: string` defensive `?? ''` matches `questAction`'s `default → null`. ✓
