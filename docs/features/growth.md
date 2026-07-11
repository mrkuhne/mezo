---
title: Growth — Daily Quests, Activity Log & Gamified Progression
type: feature-domain
status: done
updated: 2026-07-11
tags: [today, me, backend, frontend, data-layer]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/quest
  - backend/src/main/java/io/mrkuhne/mezo/feature/activity
  - backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/TraitCalculator.java
  - backend/src/main/resources/content/quest-catalog.json
  - frontend/src/data/quest
  - frontend/src/data/activity
  - frontend/src/features/today/sheets/ActivityLogSheet.tsx
  - frontend/src/features/me/components/GrowthCard.tsx
related: [today, me, train, _platform-data-layer, _platform-api-backend]
---

# Growth — Daily Quests, Activity Log & Gamified Progression

> No route of its own — surfaces as the **"Napi küldetések"** + **"Tevékenységnapló"** cards on `/today` and the **"Growth — LIFE"** card on `/me` (Profil). **Status: ✅ E1 + E2 done** — daily-quest core shipped 2026-07-11 (`mezo-df7q`, E1); the growth layer (full 8-skill LIFE band + free-text activity log with AI categorization + the GROWTH quest slot + computed discipline/consistency traits + the Me GrowthCard) shipped 2026-07-11 (`mezo-jzca`, E2). **E3** (savings aggregate + adaptive difficulty + companion flavor copy) and **E4** (shop/coins) remain, under umbrella epic `mezo-52vz`.

## 1. Summary

**Growth** is the gamified personal-growth layer. Two loops feed one XP economy:

1. **Daily side quests** — **3 slots** (BODY + FUELBIO + GROWTH), selected deterministically from a static catalog, completed **by derived evaluation over already-logged data** (never self-claimed), granting XP through the existing progression economy.
2. **Activity log (E2)** — a **free-text mini-journal**: the user types what they did ("olvastam 30 percet", "átraktam 50 ezret megtakarításba"), the **companion cheap-tier LLM proposes** a LIFE skill + XP, and the **server disposes** — clamping/capping the amount deterministically before it lands on one of the **8 LIFE skills**. A confident entry also completes the day's matching open **activity-mode** GROWTH quest.

The psychological contract is [ADR 0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md): *XP is feedback, not payment* — quests are offers, uncompleted quests expire quietly (no failure state), one reroll/day preserves autonomy, quest XP stays a garnish (15–40/quest), and the **behavior traits are computed/mirrored back, never self-claimed**. The LLM only ever *proposes*; every XP amount that actually lands is deterministic (catalog value for quests, `[xpMin,xpMax]`-clamped + per-skill/per-day-capped for activities).

Status per layer: **backend** ✅ (`feature/quest` + `feature/activity` + progression `QUEST`/`ACTIVITY` sources + full `LIFE` band + `TraitCalculator`), **FE real** ✅ (quest day + reroll, activity log/categorize, GrowthCard, level-up overlay), **FE mock** ✅ (static seed day, deterministic mock classifier). Driving spec: [`2026-07-11-gamified-growth-quests-design.md`](../superpowers/specs/2026-07-11-gamified-growth-quests-design.md); plans: [E1 quest-core](../superpowers/plans/2026-07-11-gamified-growth-e1-quest-core.md) · [E2 growth-layer](../superpowers/plans/2026-07-11-gamified-growth-e2-growth-layer.md).

## 2. User-facing behavior

- **"Napi küldetések" card on Today** (below the check-in strip / companion note, above the workout teaser): each quest shows its HU identity-vote title, benefit-first "why" line, an `+N XP` chip, and a state mark — `◦` offered (brand glow), `✓` completed (success green), `—` expired (dimmed, quiet — no red, per ADR 0010). Header counts `done/total ma`. The GROWTH slot now yields a third quest; an offered **activity-mode** GROWTH quest carries a **`Naplózz` chip** that opens the activity-log sheet pre-banner-ed with the quest (`DailyQuestsCard.tsx:57-63`).
- **Reroll ("Csere"):** offered quests show a `Csere` chip-button while the daily reroll budget (1) lasts; it swaps the quest for the next eligible catalog candidate in the same slot.
- **Derived completion is passive:** the user never taps "done" — logging the underlying thing (weight, water, check-ins, sleep, the planned workout, protein, **a meal cooked from their own recipe**) completes the DERIVED quest on the next Today read (or the nightly cron). A completion detected by the current read fires the global **level-up overlay** exactly once (source chip 📜, headline „Napi győzelem.").
- **"Tevékenységnapló" card on Today (E2)** — always rendered under the quest card (`ActivityLogCard.tsx`). A `+ Bejegyzés` chip opens the **`ActivityLogSheet`**; the day's entries list each show a LIFE-skill emoji, the text, an `+N XP` chip once awarded, and — for an **uncategorized** entry (the AI wasn't confident) — a **`Besorolás?` chip** that reopens the sheet in its picker phase.
  - **`ActivityLogSheet`** is a 3-phase flow (`compose → pick → done`): type free text → **Naplózom** (POST) → if the AI was confident the sheet jumps to `done` (LIFE skill + `+N XP` chip, plus a "Küldetés teljesítve" banner when a matching quest completed), otherwise it drops into `pick` (an 8-button LIFE grid) and the manual choice grants the XP. Any XP-earning write surfaces the **level-up overlay** once. Opened from a quest's `Naplózz` chip it shows the quest banner; opened from `Besorolás?` it starts in `pick`.
- **"Growth — LIFE" card on Me → Profil (E2)** — after the muscle-levels card (`GrowthCard.tsx`, rendered by `ProfilePage.tsx:38`): a hand-rolled **SVG octagon radar** of the 8 LIFE skill levels (emoji axis labels), the **top-3 LIFE skills** as meter rows, and two **computed** trait meters — **Fegyelem** (discipline %) + **Következetesség** (consistency, in weeks) — with the caption „A számaid mondják ki — nem önbevallás." Before any LIFE XP it renders a **ghost prompt** ("Az élet is edzés.") pointing at the Today activity log.
- **Empty states:** the quest card renders nothing on a day with no rows; the activity card always renders (with a "Mi történt ma?" prompt when empty); the GrowthCard ghosts until the first LIFE XP.

## 3. Architecture & data flow

**Quests:** `DailyQuestsCard` → `useDailyQuests(date)` / `useQuestActions(date)` (from `@/data/hooks`) → mock: `questMock.ts` seed · real: `questApi.ts` → `GET /api/quest/day/{date}` → `QuestService.getDay` → lazy `QuestSelector.generate` (today only, guarded against the morning-cron race) + `QuestService.evaluateAndFinalize` (complete/expire + `ProgressionService.applyQuest`) → `daily_quest` table.

- **Generation is deterministic over 3 slots** (`QuestSelector.SLOTS` = BODY, FUELBIO, GROWTH): seeded by `(userId, date, slot)` hash over the eligible catalog pool — filters: slot, day type (planned gym template via `WorkoutService.findPlannedTemplateForDate` → GYM, else REST), goal-prescription requirement, per-key cooldown (yields to availability), distinct metrics per day. No LLM anywhere in the economy (ADR 0010).
- **Evaluation is DERIVED-guarded** (`QuestService.evaluateAndFinalize`): only `MODE_DERIVED` quests auto-complete via `QuestEvaluator.satisfied` (pure reads — check-in count, weight-log presence, water sum, sleep duration, fuel-day protein, gym done-dates, **own-recipe meal**). **`MODE_ACTIVITY` quests never auto-complete** — they complete only through the activity-write hook, and otherwise **expire quietly** like any offered quest once the day passes.
- **XP path (quests):** completion → `ProgressionService.applyQuest(QuestSignal)` → the shared idempotent `award(...)` tail (`source_type=QUEST`, `source_ref_id=questId`) → `skill_progress`/`level_up_event`; gated by `ObjectProvider<ProgressionGate>`.

**Activity log (E2):** `ActivityLogCard`/`ActivityLogSheet` → `useActivities(date)` / `useActivityActions(date)` (from `@/data/hooks`, dual-mode via `useDualQuery`) → `activityApi.ts` → `POST /api/activity` (+ `GET /api/activity/day/{date}`, `POST /api/activity/{id}/category`) → `ActivityService`.

- **Write flow** (`ActivityService.create`): persist the entry → `ActivityClassifier.classify` (companion cheap tier) proposes `{skillKey, confidence, xpSuggestion(5..25), durationMin?, amountHuf?}` → the suggestion is **clamped** into `[xpMin,xpMax]` and stored in `xp_suggested`; **confident** (`skillKey` set, a LIFE key, `confidence ≥ confidenceThreshold` 0.6) → set `skill_key` + `categorized_by = AI` → **`grantXp`** awards `min(xpSuggested, perSkillDailyCap − skillUsedToday, dailyCap − dayUsedToday)` and, when > 0, calls `ProgressionService.applyActivity` (source `ACTIVITY`, idempotent per entry id) → then **`completeMatchingActivityQuest`** completes the day's first open activity-mode quest whose LIFE skill matches, stamping `source_activity_id` (quest XP rides on top). **Low confidence / classifier off** → the entry lands **uncategorized** (`skill_key` null), **no XP yet**.
- **Categorize / override** (`ActivityService.categorize`, `POST /api/activity/{id}/category`): validates the key against `ProgressionTaxonomy.LIFE`. First categorization of an uncategorized entry (`xp_awarded == 0`) → `grantXp` within the day's remaining caps. **Override** of an already-awarded entry → `ProgressionService.moveActivityXp(from, to, xp)` — a **direct skill-row adjustment** (decrement the old LIFE row, increment/create the new one, recompute levels), **no new `level_up_event`**. Either path also runs `completeMatchingActivityQuest`. `categorized_by` becomes `USER`.
- **Response shape** (`ActivityWriteResponse`): `{ entry, completedQuest?, levelUps[] }` — 0–2 level-up payloads (the activity award and/or the completed quest's award). The FE surfaces the first payload with a level-up through the global overlay.

**Traits (E2, read-time):** `ProgressionService.getProfile` calls `TraitCalculator.traits(createdBy, today)` (`TraitCalculator.java`):
- **Discipline** (`disciplinePct`, nullable): a 28-day (`DISCIPLINE_WINDOW_DAYS`) completion ratio, the **average of the available components** — planned-vs-done training (`TrainingCommitmentSource.commitmentStats`, implemented in train by `TrainingCommitmentCalculator`) blended with closed-quest `completed / (completed + expired)` (`QuestLedgerSource.closedQuestStats`, implemented in quest by `QuestLedgerAdapter`, consumed via `ObjectProvider` since the quest switch may be off). **Null** (not 0) when there are no commitments in the window.
- **Consistency** (`consistencyWeeks`): the current streak of consecutive ISO weeks with **≥ 4 active days** (`ACTIVE_DAYS_PER_WEEK`), an active day = any XP-earning row in `level_up_event.occurred_at` (`findOccurredAtSince`, 400-day horizon). The **running week can't break the streak** — it counts only once it already meets the bar (grace, mirrors the robustness streak's tone).

Both ports (`TrainingCommitmentSource`, `QuestLedgerSource`) keep the dependency **one-directional** (train/quest → progression, never back — `feature_slices_are_cycle_free`), the same pattern as `RobustnessSource`.

- **Dual-mode seams:** quests use the `useChallenges` manual shape (`levelUps`/`rerollsLeft` ride beside the list); activities use `useDualQuery` (real → `[]` while unresolved, never the mock seed). `useActivityActions` invalidates `['activities', date]` + `['dailyQuests', date]` + `['progressionProfile']` on a real write so the card, the quest card, and the GrowthCard all refresh. Mock mode has a deterministic classifier (`activityHooks.ts:mockWrite` → always `learning`, 15 XP) so the whole flow is demoable offline.

## 4. Data model & API

- **Table `daily_quest`** (E1, migration [`202607111300_mezo-df7q_create_daily_quest.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607111300_mezo-df7q_create_daily_quest.sql)): `quest_date`, `slot` (BODY|FUELBIO|GROWTH), `catalog_key`, `skill_key`+`skill_kind` (ATHLETIC|MUSCLE|LIFE), HU `title`/`why`, `completion_mode` (DERIVED|ACTIVITY), `target` jsonb (`QuestTargetEnvelope{metric, threshold}`), `xp`, `coins` (always 0 until the E4 shop), `status` (offered|completed|expired|rerolled), `source_activity_id` (stamped by an activity-completed quest). Identity: partial unique `(created_by, quest_date, slot)` among non-rerolled, non-deleted rows. The E1 migration relaxed two released CHECKs additively: `level_up_event.source_type` += `QUEST`, `skill_progress.skill_kind` += `LIFE`.
- **Table `activity_log`** (E2, migration [`202607112000_mezo-jzca_create_activity_log.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607112000_mezo-jzca_create_activity_log.sql)): `id uuid pk`, `created_by`, soft-delete cols, `occurred_on date`, `text`, `skill_key varchar(40)` (null = uncategorized), `confidence numeric(4,3)`, `xp_awarded int` (clamped+capped, actually granted), `xp_suggested int` (the clamped AI proposal — so a later manual categorization grants a deterministic amount), `extracted jsonb` (`ActivityExtract{durationMin, amountHuf}`), `categorized_by varchar(6)` (`ck_…` AI|USER). Index `idx_activity_log_user_day (created_by, occurred_on) where is_deleted = false`. The **same migration relaxes `level_up_event.source_type` additively: += `ACTIVITY`**.
- **Catalog** (`content/quest-catalog.json`, fail-fast `QuestCatalog` loader — the `PerkCatalog` pattern): **14 entries** — 2 BODY + 5 FUELBIO + **7 GROWTH**. Each `QuestDef` now carries a **`mode`** (DERIVED|ACTIVITY). The 7 GROWTH entries: 6 **ACTIVITY** (`growth_read`/learning, `growth_gratitude`/mindset, `growth_mindfulness`/mindfulness, `growth_finance_review`/financial, `growth_deepwork`/productivity, `growth_connect`/connection — all `metric=activity_match`) + 1 **DERIVED** (`growth_cook_own`/cooking, `metric=own_recipe_meal`). `bio_protein.threshold` still resolves at generation time from the goal prescription's current segment.
- **Quest contract** ([`api/feature/quest/quest.yml`](../../api/feature/quest/quest.yml), tag `Quest`): `GET /api/quest/day/{date}` → `QuestDayResponse{date, quests[], levelUps[], rerollsLeft}`; `POST /api/quest/{id}/reroll` → `QuestResponse` (409: `QUEST_NOT_OFFERED`/`QUEST_NOT_TODAY`/`QUEST_REROLL_EXHAUSTED`/`QUEST_REROLL_NO_ALTERNATIVE`). **`QuestResponse.completionMode`** (DERIVED|ACTIVITY) is now on the wire so the FE can render the `Naplózz` affordance.
- **Activity contract** ([`api/feature/activity/activity.yml`](../../api/feature/activity/activity.yml), tag `Activity` → `ActivityApi`, `ActivityController implements ActivityApi`, gated on `mezo.feature.activity.enabled`):
  - `POST /api/activity` — `ActivityCreateRequest{text (≤500), occurredOn?}` → **200** `ActivityWriteResponse{entry, completedQuest?, levelUps[]}`; blank text → 400 `ACTIVITY_TEXT_REQUIRED`.
  - `GET /api/activity/day/{date}` → `ActivityResponse[]` (newest first; **empty array, never 404**).
  - `POST /api/activity/{id}/category` — `ActivityCategoryRequest{skillKey}` → 200 `ActivityWriteResponse`; unknown LIFE key → 400 `ACTIVITY_SKILL_UNKNOWN`; missing/foreign entry → 404 `ACTIVITY_NOT_FOUND`.
- **Profile contract** ([`api/feature/progression/progression.yml`](../../api/feature/progression/progression.yml)): `GET /api/progression/profile` → `ProgressionProfileResponse` now also carries **`life[]`** (all 8 LIFE `SkillLevel`s in taxonomy order — missing row → level 1, 0 XP) and **`traits`** (`ProfileTraits{disciplinePct nullable, consistencyWeeks}`).
- **FE types:** `DailyQuest`/`QuestSlot`/`QuestStatus` + `ActivityEntry`/`LifeSkillKey` in `data/types.ts`; wire types off `api.gen.ts` in `data/quest/questApi.ts` + `data/activity/activityApi.ts`.
- **Config:** switches `mezo.feature.quest.enabled`, `mezo.feature.activity.enabled` (+ `mezo.techcore.cron.quest-job.enabled`); tunables in `QuestProperties` (`mezo.quest`) and **`ActivityProperties` (`mezo.activity`: `xp-min` 5, `xp-max` 25, `per-skill-daily-cap` 40, `daily-cap` 100, `confidence-threshold` 0.6, `default-xp` 10)**. Quest XP lives in the catalog; activity XP amounts are all config, never code.

## 5. Integrations

- **← Train:** day-type seam `WorkoutService.findPlannedTemplateForDate`; `gym_session_done` via `WorkoutSessionRepository.findDoneInstanceDates`; the **discipline trait's training half** via `TrainingCommitmentSource` (impl `feature/train/signal/TrainingCommitmentCalculator`).
- **← Goal:** protein target from the active goal's prescription segment (`GoalPrescriptionJson.currentSegment`); `bio_protein` only eligible when a prescription exists.
- **← Fuel:** protein via `FuelDayService.getDay`, water via `WaterLogService.sumForDay`, and the **`own_recipe_meal`** GROWTH metric via `MealItemRepository.existsByCreatedByAndDeletedFalseAndSourceAndMeal_MealDate(user, "recipe", date)` — the "cook from your own recipe" quest.
- **← Biometrics:** check-in count, weight-log presence, sleep duration repositories.
- **← Companion (E2):** `ActivityClassifier` calls `CompanionLlm.complete` on the **cheap tier** (the `FactExtractionService` pattern: marker-prefixed system prompt `CLASSIFY_MARKER = "TEVEKENYSEG-BESOROLAS-FELADAT"`, strict-JSON answer, defensive parse — a broken/garbage answer degrades to *uncategorized*, never an error). The classifier bean is **dual-gated** on `ACTIVITY_SWITCH` **+** `COMPANION_SWITCH` (consumed via `ObjectProvider` so activity logging still works with the companion off — everything just lands uncategorized). `FakeCompanionLlm` mirrors the marker (`ACTIVITY_MARKER_MIRROR`) and reads a **`[fake-activity:{…}]`** sentinel planted in the entry text, so ITs are LLM/provider-free.
- **→ Progression:** `applyQuest` (source `QUEST`) and **`applyActivity` (source `ACTIVITY`)** ride the shared idempotent `award(...)` tail; `moveActivityXp` adjusts LIFE rows directly on an override. The **full 8-skill `LIFE` band** and the two computed **traits** are surfaced by `getProfile`. `QuestLedgerSource` feeds the discipline trait's quest half.
- **→ Today:** the `DailyQuestsCard` + `ActivityLogCard` mounts; level-up payloads feed the global `LevelUpProvider` overlay (`useLevelUp`), with QUEST/ACTIVITY source meta (headline + chip icon ✍️) in `levelUpMeta.ts`.
- **→ Me:** the `GrowthCard` mounts on Profil, reading the same `useProgressionProfile()` as the athletic/muscle cards; `LIFE_SKILLS` (name+emoji, mirrors `ProgressionTaxonomy.LIFE` order) lives in `levelUpMeta.ts` and is shared by the card, the octagon, the activity card, and the sheet.

## 6. How to use it (consume)

```ts
import { useDailyQuests, useQuestActions, useActivities, useActivityActions } from '@/data/hooks'
const { quests, levelUps, rerollsLeft } = useDailyQuests(date)         // date = 'YYYY-MM-DD'
const { reroll } = useQuestActions(date)
const { data: entries } = useActivities(date)                          // ActivityEntry[]
const { logActivity, categorize, pending } = useActivityActions(date)
await logActivity('Olvastam 30 percet')                                // → ActivityWriteResult (entry + completedQuest? + levelUps)
await categorize(entryId, 'learning')                                  // pick/override a LIFE skill
```
`quests` excludes rerolled rows; `quests[i].completionMode === 'ACTIVITY'` marks the `Naplózz`-affordance quests. `levelUps` on the quest read is non-empty only on the read that performed the completion. `logActivity`/`categorize` return the write result — feed `result.levelUps` to `showLevelUp(...)` (the sheet does this) and read `result.completedQuest` for the "quest completed" banner. Real mode returns the empty day while loading (no seed fallback). Query keys: `['dailyQuests', date]`, `['activities', date]`.

## 7. How to extend it

- **New LIFE skill:** add the token to `ProgressionTaxonomy.LIFE` (backend, taxonomy order == octagon order) **and** the matching `{key, name, icon}` to `LIFE_SKILLS` in `frontend/src/features/progression/logic/levelUpMeta.ts` — the two lists must agree in order and membership. The classifier prompt (`ActivityClassifier.CLASSIFY_PROMPT`) enumerates the keys, so extend it too, and add the new key to the `LifeSkillKey` FE type. The octagon/`radarGeometry` is already N-axis (driven by `LIFE_SKILLS.length`).
- **New GROWTH quest:** add a catalog entry with `slot: "GROWTH"` + a `mode`. An **ACTIVITY** quest (`mode: "ACTIVITY"`, `metric: "activity_match"`) completes via a matching activity-log entry — no evaluator work needed. A **DERIVED** quest needs a new `metric` case in `QuestEvaluator.satisfied` + a label in `QuestDisplay.targetLabel`. Quest XP must stay in the 15–40 band (loader fails fast otherwise).
- **New derived metric:** add the `case` to `QuestEvaluator.satisfied` reading the owning feature's repository/service (pure reads only — honest completion). `own_recipe_meal` is the template for a Fuel-sourced metric.
- **Tune the activity economy:** all guardrails are `ActivityProperties` (`mezo.activity.*`) — never hardcode XP/caps/thresholds (`configuration_conventions.md`).
- House standards: contract-first (`api_contract_conventions.md`), backend per `docs/references/*.md`, dual-mode hook recipe in [`_platform-data-layer.md`](_platform-data-layer.md).

## 8. Testing

- **Backend ITs — quest** (`feature/quest/`): `DailyQuestEntityIT`, `QuestCatalogIT` (band/coins invariants + `mode`), `QuestSelectorIT` (3-slot composition, determinism, cooldown), `QuestEvaluatorIT` (metric truth table incl. `own_recipe_meal`), `QuestApiIT` (HTTP), `QuestJobIT` (crons), **`QuestActivityCompletionIT`** (the `completeMatchingActivityQuest` synergy). Progression: `ProgressionQuestIT`.
- **Backend ITs — activity** (`feature/activity/`): `ActivityLogEntityIT` (DDL/jsonb/soft-delete), `ActivityClassifierIT` (confident/low-confidence/garbage/hallucinated-key via the `[fake-activity:…]` sentinel), `ActivityApiIT` (HTTP: confident→XP+quest, low-confidence→uncategorized, categorize→grant, override→move, caps, 400/404). Data via `support/populator/ActivityPopulator`; `activity_log` heads the `ResetDatabase` TRUNCATE list.
- **Backend ITs — progression** (`feature/progression/`): `ProgressionActivityIT` (`applyActivity` idempotency + `moveActivityXp`), **`ProfileTraitsIT`** (discipline blend + null-without-commitments, consistency streak + running-week grace), `ProgressionProfileServiceIT`/`ProgressionProfileApiIT` (life[] + traits on the profile). Run: `./mvnw clean test -Dtest='Activity*,Quest*,Progression*,ProfileTraitsIT' -DargLine=-Xmx3g`.
- **FE** (both modes green): `data/quest/questHooks.test.tsx`, `data/activity/activityHooks.test.tsx` (dual-mode read/write, mock classifier, invalidations); `features/today/components/{DailyQuestsCard,ActivityLogCard}.test.tsx`, `features/today/sheets/ActivityLogSheet.test.tsx` (compose→pick→done, quest banner, level-up), `features/me/components/GrowthCard.test.tsx` (octagon, top-3, trait meters, ghost), `features/me/logic/radarGeometry.test.ts`, `features/progression/logic/levelUpMeta.test.ts` (LIFE_SKILLS ↔ taxonomy). MSW defaults return honest empty days.

## 9. Decisions, gotchas & deferred

- **[ADR 0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md)** is the contract every extension must respect (no failure states, no XP-gated content, no gambling mechanics, coins only with a shop, **the LLM proposes but the server disposes**, traits computed not self-claimed).
- **Gotcha — XP move keeps the original event payload:** an activity **category override** adjusts the LIFE `skill_progress` rows directly (`moveActivityXp`) and writes **no new `level_up_event`**; the original grant's ledger event still names the *old* skill. An accepted correction-history trade-off (documented in `ProgressionService.moveActivityXp`), not a bug.
- **Gotcha — uncategorized entries carry 0 XP until a pick:** a low-confidence (`< 0.6`) or classifier-off entry lands with `skill_key` null and `xp_awarded` 0; the stored `xp_suggested` (already clamped) is what a later manual categorization grants, within the day's remaining caps.
- **Gotcha — the caps make bad-faith logging economically irrelevant:** every activity is clamped to `[5,25]` XP and bounded by `per-skill-daily-cap` (40) and `daily-cap` (100). Spamming the log can't out-earn honest training, so the honor system needs no anti-cheat.
- **Gotcha — ACTIVITY quests don't auto-complete:** `evaluateAndFinalize` completes only DERIVED quests; an activity-mode GROWTH quest completes solely via `completeMatchingActivityQuest` on an activity write, and otherwise **expires quietly** with the day (no failure state).
- **Gotcha — robustness cannot carry quest XP** (E1, still true): the award tail recomputes `robustness` to an absolute streak target, wiping additive deltas — that is why FUELBIO quests route to the `recovery` LIFE skill.
- **Deferred (E3):** the **savings aggregate** (the activity log already extracts `amountHuf` into `extracted`, but the total/streak view is E3), **adaptive difficulty**, and **companion flavor copy**. **Deferred (E4):** shop/coins (the `coins` column + catalog field exist, always 0). Umbrella epic `mezo-52vz`.

## 10. Key files

- **Backend — quest:** `feature/quest/` (entity/repository/QuestCatalog/service{QuestSelector,QuestEvaluator,QuestService,QuestJob,QuestLedgerAdapter}/controller/mapper/config) · `content/quest-catalog.json` · migration `…/202607111300_mezo-df7q_create_daily_quest.sql`
- **Backend — activity:** `feature/activity/` (entity{ActivityLogEntity,ActivityExtract}/repository/config{ActivityProperties}/service{ActivityService,ActivityClassifier}/controller/mapper) · migration `…/202607112000_mezo-jzca_create_activity_log.sql` · messages `ACTIVITY_NOT_FOUND`/`ACTIVITY_TEXT_REQUIRED`/`ACTIVITY_SKILL_UNKNOWN`
- **Backend — progression seam:** `feature/progression/quest/QuestSignal.java` · `feature/progression/activity/ActivitySignal.java` · `ProgressionService.{applyQuest,applyActivity,moveActivityXp,getProfile}` · `service/TraitCalculator.java` · ports `TrainingCommitmentSource`/`QuestLedgerSource` (+ impls `train/signal/TrainingCommitmentCalculator`, `quest/service/QuestLedgerAdapter`) · `ProgressionTaxonomy.LIFE` (8 skills) · `feature/companion/llm/FakeCompanionLlm.java` (`[fake-activity:…]`)
- **Contract:** `api/feature/quest/quest.yml` (+ `completionMode`) · `api/feature/activity/activity.yml` · `api/feature/progression/progression.yml` (`life[]` + `traits`) · enum extensions in `api/feature/train/train.yml`
- **FE data:** `frontend/src/data/quest/{questApi,questMock,questHooks}.ts` · `frontend/src/data/activity/{activityApi,activityMock,activityHooks}.ts` (+ barrel lines in `data/hooks.ts`, types in `data/types.ts`)
- **FE UI:** `frontend/src/features/today/components/{DailyQuestsCard,ActivityLogCard}.tsx` · `frontend/src/features/today/sheets/ActivityLogSheet.tsx` · `frontend/src/features/me/components/GrowthCard.tsx` · `frontend/src/features/me/logic/radarGeometry.ts` · `frontend/src/features/progression/logic/levelUpMeta.ts` (LIFE_SKILLS + QUEST/ACTIVITY meta)
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/{quest,activity}/` + `feature/progression/{ProfileTraitsIT,ProgressionActivityIT}.java` · `frontend/src/data/{quest,activity}/*Hooks.test.tsx` · `frontend/src/features/today/{components,sheets}/*.test.tsx` · `frontend/src/features/me/components/GrowthCard.test.tsx`
- **Docs:** spec `docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md` · plans `…/plans/2026-07-11-gamified-growth-{e1-quest-core,e2-growth-layer}.md` · [ADR 0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md)
