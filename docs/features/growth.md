---
title: Growth — Daily Quests & Gamified Progression
type: feature-domain
status: done
updated: 2026-07-11
tags: [today, backend, frontend, data-layer]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/quest
  - backend/src/main/resources/content/quest-catalog.json
  - backend/src/main/java/io/mrkuhne/mezo/feature/progression/quest
  - frontend/src/data/quest
  - frontend/src/features/today/components/DailyQuestsCard.tsx
  - api/feature/quest/quest.yml
related: [today, me, train, _platform-data-layer, _platform-api-backend]
---

# Growth — Daily Quests & Gamified Progression

> No route of its own — surfaces as the **"Napi küldetések"** card on `/today` (E1) and will grow a Me "Growth" card (E2). **Status: ✅ E1 done** (FE mock + FE real + backend) — daily quest core shipped 2026-07-11 (`mezo-df7q`); LIFE band seeded with `recovery` only. E2 (full LIFE band + activity log + traits + GrowthCard) and E4 (shop/coins) are planned epics under umbrella `mezo-52vz`.

## 1. Summary

**Growth** is the gamified personal-growth layer: **2 daily side quests** (BODY + FUELBIO slots; GROWTH slot activates in E2) selected deterministically from a static catalog, completed **by derived evaluation over already-logged data** (never self-claimed), granting XP through the existing progression economy. The psychological contract is [ADR 0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md): *XP is feedback, not payment* — quests are offers, uncompleted quests expire quietly (no failure state), one reroll/day preserves autonomy, and quest XP stays a garnish (15–40/quest) next to workout XP.

Status per layer: **backend** ✅ (`feature/quest` + progression `QUEST` source + `LIFE` skill-kind seed), **FE real** ✅ (day read + reroll + level-up overlay), **FE mock** ✅ (static seed day, inert reroll swap). Driving spec: [`2026-07-11-gamified-growth-quests-design.md`](../superpowers/specs/2026-07-11-gamified-growth-quests-design.md); plan: [`2026-07-11-gamified-growth-e1-quest-core.md`](../superpowers/plans/2026-07-11-gamified-growth-e1-quest-core.md).

## 2. User-facing behavior

- **"Napi küldetések" card on Today** (below the check-in strip / companion note, above the workout teaser): each quest shows its HU identity-vote title, benefit-first "why" line, an `+N XP` chip, and a state mark — `◦` offered (brand glow), `✓` completed (success green), `—` expired (dimmed, quiet — no red, per ADR 0010). Header counts `done/total ma`.
- **Reroll ("Csere"):** offered quests show a `Csere` chip-button while the daily reroll budget (1) lasts; it swaps the quest for the next eligible catalog candidate in the same slot.
- **Completion is passive:** the user never taps "done" — logging the underlying thing (weight, water, check-ins, sleep, the planned workout, protein) completes the quest on the next Today read (or the nightly cron). A completion detected by the current read fires the global **level-up overlay** exactly once (source chip 📜, headline „Napi győzelem.").
- **Empty day** (no rows, e.g. switch off or past day without offers): the card renders nothing.

## 3. Architecture & data flow

`DailyQuestsCard` → `useDailyQuests(date)` / `useQuestActions(date)` (from `@/data/hooks`) → mock: `questMock.ts` seed · real: `questApi.ts` → `GET /api/quest/day/{date}` → `QuestService.getDay` → lazy `QuestSelector.generate` (today only, guarded against the morning-cron race) + `QuestService.evaluateAndFinalize` (complete/expire + `ProgressionService.applyQuest`) → `daily_quest` table.

- **Generation is deterministic** (`QuestSelector`): seeded by `(userId, date, slot)` hash over the eligible catalog pool — filters: slot, day type (planned gym template via `WorkoutService.findPlannedTemplateForDate` → GYM, else REST), goal-prescription requirement, per-key cooldown (yields to availability), distinct metrics per day. No LLM anywhere in the economy (ADR 0010).
- **Evaluation is pure reads** (`QuestEvaluator.satisfied`): per-metric switch over check-in count, weight-log presence, water sum, sleep duration, fuel-day protein, gym done-dates. Unknown metric → `false` + warn.
- **XP path:** completion → `ProgressionService.applyQuest(QuestSignal)` → the shared idempotent `award(...)` tail (`source_type=QUEST`, `source_ref_id=questId`) → `skill_progress`/`level_up_event`; gated by `ObjectProvider<ProgressionGate>` so quests work with progression off (no XP, no overlay).
- **Crons** (`QuestJob`, both switch-gated): morning generate backstop (06:35) and nightly finalize (00:05) share `evaluateAndFinalize` with the GET path; per-user failures isolated.
- **Dual-mode seam:** the hook follows the `useChallenges` manual shape (not `useDualQuery` — the read carries `levelUps`/`rerollsLeft` beside the list); real mode returns the empty day while unresolved, never the seed.

## 4. Data model & API

- **Table `daily_quest`** (migration [`202607111300_mezo-df7q_create_daily_quest.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607111300_mezo-df7q_create_daily_quest.sql)): `quest_date`, `slot` (BODY|FUELBIO|GROWTH), `catalog_key`, `skill_key`+`skill_kind` (ATHLETIC|MUSCLE|LIFE), HU `title`/`why`, `completion_mode` (DERIVED|ACTIVITY — ACTIVITY is the E2 seam), `target` jsonb (`QuestTargetEnvelope{metric, threshold}`), `xp`, `coins` (always 0 until the E4 shop), `status` (offered|completed|expired|rerolled), `source_activity_id` (E2 seam). Identity: partial unique `(created_by, quest_date, slot)` among non-rerolled, non-deleted rows. The same migration **relaxes two released CHECKs additively**: `level_up_event.source_type` += `QUEST`, `skill_progress.skill_kind` += `LIFE`.
- **Catalog** (`content/quest-catalog.json`, loaded fail-fast by `QuestCatalog` — the `PerkCatalog` pattern): 7 entries in E1; `bio_protein.threshold` is resolved at generation time from the goal prescription's current segment.
- **Contract** ([`api/feature/quest/quest.yml`](../../api/feature/quest/quest.yml), tag `Quest`): `GET /api/quest/day/{date}` → `QuestDayResponse{date, quests[], levelUps[], rerollsLeft}` (levelUps = payloads produced by THAT evaluation pass only; honest empty `quests: []`), `POST /api/quest/{id}/reroll` → `QuestResponse` (409 codes: `QUEST_NOT_OFFERED`, `QUEST_NOT_TODAY`, `QUEST_REROLL_EXHAUSTED`, `QUEST_REROLL_NO_ALTERNATIVE`). `LevelUpResult.source`/`LevelUpGain.kind` enums extended (`QUEST`/`LIFE`) in `api/feature/train/train.yml`.
- **FE types:** `DailyQuest`/`QuestSlot`/`QuestStatus` in `data/types.ts`; wire types off `api.gen.ts` in `data/quest/questApi.ts`.
- **Config:** switches `mezo.feature.quest.enabled` + `mezo.techcore.cron.quest-job.enabled`; tunables in `QuestProperties` (`mezo.quest`: `reroll-per-day`, `generate-cron`, `finalize-cron`). XP amounts live in the catalog, never code.

## 5. Integrations

- **← Train:** day-type seam `WorkoutService.findPlannedTemplateForDate` (extracted from `getToday`); `gym_session_done` evaluates via `WorkoutSessionRepository.findDoneInstanceDates`.
- **← Goal:** protein target resolved from the active goal's prescription segment (`GoalPrescriptionJson.currentSegment`); `bio_protein` is only eligible when a prescription exists.
- **← Fuel:** protein consumed via `FuelDayService.getDay`, water via `WaterLogService.sumForDay`.
- **← Biometrics:** check-in count, weight-log presence, sleep duration repositories.
- **→ Progression:** `applyQuest` → idempotent `award(...)`; first `LIFE`-kind skill row (`recovery`) is born here. `ProgressionTaxonomy.LIFE` seeded.
- **→ Today:** the `DailyQuestsCard` mount; level-up payloads feed the global `LevelUpProvider` overlay (`useLevelUp`), with QUEST source meta in `levelUpMeta.ts`.

## 6. How to use it (consume)

```ts
import { useDailyQuests, useQuestActions } from '@/data/hooks'
const { quests, levelUps, rerollsLeft, mode } = useDailyQuests(date) // date = 'YYYY-MM-DD'
const { reroll, pending } = useQuestActions(date)
```
`quests` excludes rerolled rows; `levelUps` is non-empty only on the read that performed the completion (safe to feed `showLevelUp(levelUps[0])` from an effect — re-reads return `[]`). Real mode returns the empty day while loading (no seed fallback). Query key: `['dailyQuests', date]`.

## 7. How to extend it

- **New quest:** add a catalog entry (`content/quest-catalog.json`) → if its metric is new, add a case to `QuestEvaluator.satisfied` + a label to `QuestDisplay.targetLabel` → ITs for the metric. XP must stay in the 15–40 band (loader fails fast otherwise).
- **New slot (E2 GROWTH):** extend `QuestSelector.E1_SLOTS`; the DB CHECK already allows GROWTH.
- **Activity-mode quests (E2):** `completion_mode=ACTIVITY` + `source_activity_id` are already in the schema; wire the activity write to check open activity-mode quests.
- **Coins/shop (E4):** `coins` column + catalog field exist (always 0); per ADR 0010 coins ship only together with the shop.
- House standards: contract-first (`api_contract_conventions.md`), backend per `docs/references/*.md`, dual-mode hook recipe in [`_platform-data-layer.md`](_platform-data-layer.md).

## 8. Testing

- **Backend ITs** (`backend/src/test/java/io/mrkuhne/mezo/feature/quest/`): `DailyQuestEntityIT` (DDL/jsonb/partial-unique), `QuestCatalogIT` (band/coins invariants), `QuestSelectorIT` (composition, determinism via soft-delete regen, cooldown), `QuestEvaluatorIT` (metric truth table), `QuestApiIT` (HTTP: lazy gen, completion→XP→levelUps idempotency, quiet expiry, reroll + 409s), `QuestJobIT` (cron backstops), `ProgressionQuestIT` (award idempotency + LIFE row). Data via `QuestPopulator`; `daily_quest` is in the `ResetDatabase` TRUNCATE list. Run: `./mvnw clean test -Dtest='Quest*,ProgressionQuestIT' -DargLine=-Xmx3g`.
- **FE** (both modes green): `data/quest/questHooks.test.tsx` (wire mapping, reroll invalidation, mock seed), `features/today/components/DailyQuestsCard.test.tsx` (render states, reroll-for-offered-only, empty-day null). MSW defaults return the honest empty day.

## 9. Decisions, gotchas & deferred

- **[ADR 0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md)** resolves the parked XP-vs-narrative tension; it is the contract every extension must respect (no failure states, no XP-gated content, no gambling mechanics, coins only with a shop).
- **Gotcha — robustness cannot carry quest XP:** the award tail recomputes `robustness` to an absolute streak target, wiping additive deltas. That is *why* FUELBIO quests route to the `recovery` LIFE skill and why the LIFE CHECK relax landed in E1.
- **Gotcha — LIFE rows are invisible until E2:** `recovery` accrues XP in `skill_progress` but `GET /api/progression/profile` doesn't surface LIFE yet; the level-up overlay does (via `levelUpMeta.ts` LIFE_META).
- **Gotcha — reroll rollback:** `QUEST_REROLL_NO_ALTERNATIVE` rolls back the whole transaction, so the old quest stays offered and no reroll is consumed.
- **Deferred:** GROWTH slot + full LIFE band + activity log + traits + Me GrowthCard (E2), savings stat + adaptive difficulty + companion flavor copy (E3), shop/coins (E4) — umbrella epic `mezo-52vz`.

## 10. Key files

- **Backend:** `backend/src/main/java/io/mrkuhne/mezo/feature/quest/` (entity/repository/QuestCatalog/service{QuestSelector,QuestEvaluator,QuestService,QuestJob}/controller/mapper/config) · `backend/src/main/resources/content/quest-catalog.json` · migration `backend/src/main/resources/db/changelog/1.0.0/script/202607111300_mezo-df7q_create_daily_quest.sql`
- **Progression seam:** `backend/src/main/java/io/mrkuhne/mezo/feature/progression/quest/QuestSignal.java` · `ProgressionService.applyQuest` · `ProgressionTaxonomy.LIFE`
- **Contract:** `api/feature/quest/quest.yml` (+ enum extension in `api/feature/train/train.yml`)
- **FE data:** `frontend/src/data/quest/{questApi,questMock,questHooks}.ts` (+ barrel line in `data/hooks.ts`, types in `data/types.ts`)
- **FE UI:** `frontend/src/features/today/components/DailyQuestsCard.tsx` · `frontend/src/features/progression/logic/levelUpMeta.ts` (QUEST/LIFE meta)
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/quest/` · `frontend/src/data/quest/questHooks.test.tsx` · `frontend/src/features/today/components/DailyQuestsCard.test.tsx`
- **Docs:** spec `docs/superpowers/specs/2026-07-11-gamified-growth-quests-design.md` · plan `docs/superpowers/plans/2026-07-11-gamified-growth-e1-quest-core.md` · [ADR 0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md)
