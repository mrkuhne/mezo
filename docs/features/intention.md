---
title: Intention — Daily Creed, Foci & Evening Reflection
type: feature-domain
status: done
updated: 2026-07-24
tags: [today, habit, growth, backend, frontend, data-layer, progression]
key_files:
  - backend/src/main/java/io/mrkuhne/mezo/feature/intention
  - frontend/src/data/intention
  - frontend/src/features/today/components/IntentionBanner.tsx
  - api/feature/intention/intention.yml
related: [today, habit, growth, _platform-data-layer, _platform-api-backend]
---

# Intention — Daily Creed, Foci & Evening Reflection

> A two-layer intentionality practice — a standing **creed** (one editable north-star sentence) + up to **3 daily foci** + a holistic **evening reflection** (`igen`/`részben`/`nem`) — surfaced as the **`IntentionBanner`** at the top of Today (`/today`, under `GreetingHeader`), plus two **DERIVED** habits in the morning/evening chains and one **DERIVED** `growth_intention` daily quest. **Status: ✅ done** (backend + FE real + FE mock). It has **no route/tab of its own** — it rides Today, [habit.md](habit.md), and [growth.md](growth.md). Driving spec: [`2026-07-20-daily-intention-design.md`](../superpowers/specs/2026-07-20-daily-intention-design.md); tone ADR [0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP is feedback, not payment). bd `mezo-a686`.

## 1. Summary

**Intention** is a small deliberate-living practice built to counter drift ("csak úgy vagyok"). It has two layers plus a nightly close:

- a **standing creed** — a single editable north-star sentence shown every day (the constant reminder, quiet/italic);
- up to **3 daily foci** — concrete one-line intentions for *this* day (the prominent, display-font lines);
- a **holistic evening reflection** — one `yes|partial|no` answer over the whole day.

It lives in its **own `feature/intention` domain** (not piggybacked on the activity log or `goal.identityFrame`) so the home-screen reads are deterministic and cleanly testable. It surfaces on three seams: the **`IntentionBanner`** on Today, two **DERIVED** habits in the existing chains (`daily_intention` MORNING / `intention_reflect` EVENING), and a **DERIVED** `growth_intention` GROWTH quest. Crucially it adds **no new progression source** — every XP amount rides the existing **HABIT** + **QUEST** completion tails ([habit.md](habit.md), [growth.md](growth.md)); the intention endpoints award nothing themselves. Only the **first** focus of the day earns the reward (habit + quest + XP); extra foci are free (no XP farming — ADR 0010). The LIFE skill is **`mindset` (Szemlélet)**.

Status per layer: **backend** ✅ (`feature/intention` — 3 tables, `IntentionService`, `IntentionController`, `IntentionProperties`, switch-gated), **FE real** ✅ (`IntentionBanner` + sheets over the real endpoints), **FE mock** ✅ (deterministic seed: a creed + 2 foci + no reflection; first-focus mock also moves the account XP total). Design decisions are spec §2 **D1–D6**.

## 2. User-facing behavior

Intention has no page of its own — it is exercised through three surfaces:

### `IntentionBanner` on Today (`features/today/components/IntentionBanner.tsx`)
Mounted directly **under `GreetingHeader`, above `DayArc`** (`TodayPage.tsx:54`). Signature look: a `✦` mark + `VEZÉRELV` eyebrow. **Five states** (`daypartNow()`-aware):

1. **No creed** — the eyebrow + a prompt ("Fogalmazd meg az irányt…") + a `+ Vezérelv megírása` CTA (opens `CreedSheet`).
2. **Creed, no focus** — the creed in quiet italics (`„…"`) + a `szerkeszt` button, a divider, then `Mi ma a fókuszod?` + a `+ Mai fókusz` CTA (opens `IntentionSheet`).
3. **Foci set** — a `Ma szándékaim {n} / {cap}` eyebrow, the foci as `◆`-marked display-font lines, and a `+ Fókusz` ghost button until the cap; at the cap it shows the hint „Elérted a napi {cap} fókuszt — a kevesebb néha több."
4. **Evening (reflect row)** — in the `este` daypart, with foci present, a `Szándékkal élted a napot?` question + three inline buttons **`Igen` / `Részben` / `Nem`** (write `reflect(value)` directly — no sheet).
5. **Reflected** — once answered, the row collapses to `✓ {label} — a mai szándékodra reflektáltál.`

**Honest ghost:** renders `null` when the day is still unresolved (real mode before data / switch off) — `isPending && no foci && no creed` (`IntentionBanner.tsx:19`). The evening eyebrow reads „Ma szándékaim voltak" (past tense) vs the daytime „Ma szándékaim".

### Two DERIVED habits in `RoutineCard` ([habit.md](habit.md))
- **`daily_intention`** (MORNING, position 7, „Napi szándék", anchor „reggeli rutin után", xp 10) — its `Logolás` button opens `IntentionSheet` (add a focus). The habit completes **derived** off `intention_focus_set` (today has ≥ 1 focus), never self-claimed.
- **`intention_reflect`** (EVENING, position 3, „Szándékkal éltem?", anchor „konyhazárás után", xp 5) — its button opens a tiny `ReflectSheet` (the 3 choices), completing derived off `intention_reflected` (today's reflection is set).

Both map to the `mindset` LIFE skill. The CTA kinds are `intention-sheet` / `intention-reflect` in `features/today/logic/habitAction.ts` (the `sleep-sheet`/`meal-sheet` precedent — the sheet is the honest log surface, the habit stays DERIVED).

### One DERIVED `growth_intention` quest ([growth.md](growth.md))
A GROWTH-slot daily quest („Fogalmazd meg a mai szándékod", xp 20, `metric: intention_focus_set`) that completes derived on the same focus signal via `QuestEvaluator`.

## 3. Architecture & data flow

```
IntentionBanner (Today) / RoutineCard (habit CTAs)
  → useIntentionDay(date) / useIntentionActions(date)   (@/data/hooks)
      mock: mockIntentionDay seed (+ awardGamificationEvent on the FIRST focus only)
      real: intentionApi → GET /api/intention/day/{date}
                         | PUT /creed | POST /focus | DELETE /focus/{id} | POST /reflect
              → IntentionController (implements IntentionApi, INTENTION_SWITCH-gated)
              → IntentionService (getDay / setCreed / addFocus[cap→409] / removeFocus / reflect)
              → {IntentionCreedRepository, IntentionFocusRepository, DailyIntentionRepository}
              → intention_creed | intention_focus | daily_intention (Postgres)

  HabitEvaluator / QuestEvaluator read the intention repos directly (intention_focus_set /
  intention_reflected) → completion + XP flow through the HABIT + QUEST award tails.
```

- **`useIntentionDay`** (`data/intention/intentionHooks.ts:12`) is a **`useDualQuery`**: mock returns `mockIntentionDay` synchronously via `initialData`; real fetches and, while unresolved, returns the **honest-empty** `EMPTY(date)` (`{ creed:null, foci:[], reflection:null, focusCap:3 }`) — never the seed. Query key `['intentionDay', date]`.
- **`useIntentionActions`** exposes `setCreed / addFocus / removeFocus / reflect` (+ `pending`). A **real** write invalidates `['intentionDay',date]` **+ `['habitDay',date]` + `['dailyQuests',date]` + `['progressionProfile']`** (so the habit/quest cards and account XP reflect the derived completion). **Mock** writes patch the cache directly and, on the **first** focus of the day only, call `awardGamificationEvent(qc, { type:'HABIT', xpOverride:10 })` (`intentionHooks.ts:49` — the account-XP precedent; the side effect is lifted out of the pure updater, mirroring `habitHooks`); foci 2–3 award nothing.
- **Backend** (`IntentionService`): `getDay` composes `{ creed?, foci[] (oldest-first), reflection?, focusCap }`; `setCreed`/`reflect` **upsert** the single creed row / the day's `daily_intention` row; `addFocus` inserts a focus and throws **409 `INTENTION_FOCUS_CAP`** when the day already holds `focus-cap` (3) live foci — the **cap is service-enforced, not a DB constraint** (`IntentionService.java:83-87`); `removeFocus` soft-deletes (the typo path). **No XP is awarded in any endpoint** — completion is derived by the habit/quest evaluators reading these repos.
- **Ownership** is server-side from `CurrentUserId`; every finder is owner-scoped + soft-delete-aware. Text is stripped, blank-rejected (400 `INTENTION_TEXT_REQUIRED`), and truncated to the configured limit (`requireText`).

## 4. Data model & API

### Frontend types (`frontend/src/data/types.ts:840-849`)
- `Reflection = 'yes' | 'partial' | 'no'`
- `IntentionFocus { id, focusDate, text }`
- `IntentionDay { date, creed: string|null, foci: IntentionFocus[], reflection: Reflection|null, focusCap: number }`

Wire↔domain mapping in `data/intention/intentionApi.ts` (`toDay`/`toFocus` off `api.gen.ts`); mock seed in `data/intention/intentionMock.ts` (`mockIntentionDay` — a creed + 2 foci, no reflection).

### Contract ([`api/feature/intention/intention.yml`](../../api/feature/intention/intention.yml), tag `Intention` → `IntentionApi`, `IntentionController implements IntentionApi`, gated `mezo.feature.intention.enabled` — off ⇒ the whole surface 404s and no intention beans exist)

| Method + path | Operation | Returns | Errors |
|---|---|---|---|
| `GET /api/intention/day/{date}` | `getIntentionDay` | `IntentionDayResponse{date, creed?, foci[], reflection?(yes\|partial\|no), focusCap}` | — |
| `PUT /api/intention/creed` (`{text}`) | `setCreed` | `IntentionCreedResponse{text}` | 400 `INTENTION_TEXT_REQUIRED` |
| `POST /api/intention/focus` (`{date, text}`) | `addFocus` | `IntentionFocusResponse{id, focusDate, text}` | 400 `INTENTION_TEXT_REQUIRED`; **409 `INTENTION_FOCUS_CAP`** |
| `DELETE /api/intention/focus/{id}` | `removeFocus` | 204 | 404 `INTENTION_FOCUS_NOT_FOUND` |
| `POST /api/intention/reflect` (`{date, value}`) | `reflect` | `IntentionDayResponse` | 400 `INTENTION_REFLECTION_INVALID` |

Errors go through `SystemRuntimeErrorException` + `SystemMessage` (codes in `backend/src/main/resources/messages.properties:34-37`) per [`error_handling.md`](../references/error_handling.md).

### Tables (migration [`202607201200_mezo-a686_create_intention.sql`](../../backend/src/main/resources/db/changelog/1.0.0/script/202607201200_mezo-a686_create_intention.sql) — all `extends OwnedEntity`, UUID pk, soft-delete via `@SQLDelete`/`@SQLRestriction`)
- **`intention_creed`** — the standing creed, **one live row per user**: `text varchar(280)`; partial-unique `uq_intention_creed_user (created_by) where is_deleted = false`. Upserted.
- **`intention_focus`** — the day's foci, **many per day**: `focus_date date`, `text varchar(200)`; index `idx_intention_focus_user_date (created_by, focus_date) where is_deleted = false`. The **max-3-per-day cap is enforced in the service (409)**, not the DB.
- **`daily_intention`** — the day's holistic reflection, **one per day**: `intention_date date`, `reflection varchar(8)` (`ck_daily_intention_reflection` CHECK `yes|partial|no`); partial-unique `uq_daily_intention_user_date (created_by, intention_date) where is_deleted = false`. Upserted.

**No `level_up_event` CHECK change** — intention adds no progression source (XP rides HABIT + QUEST). The three tables are prepended to the `ResetDatabase` TRUNCATE list (`support/ResetDatabase.java:40`).

### Config
- **Switch:** `mezo.feature.intention.enabled` (`FeaturesConfiguration.INTENTION_SWITCH`, default `true`; `@ConditionalOnProperty` on the controller + service).
- **Tunables:** `IntentionProperties` (`@Validated`, prefix `mezo.intention`): `focus-cap` 3, `creed-max-len` 280, `focus-max-len` 200 (`application.yml:541`). Never code constants ([`configuration_conventions.md`](../references/configuration_conventions.md)).

## 5. Integrations

All inbound edges are **pure reads** — habit/quest depend on intention; intention depends on neither (`feature_slices_are_cycle_free` holds).

- **← Habit** (`HabitEvaluator`, `mezo-a686`): injects `IntentionFocusRepository` + `DailyIntentionRepository` directly (plain JPA beans, always present — the `MealItemRepository` cross-feature-read precedent) and gains two metrics, both in `INTRADAY_METRICS`: **`intention_focus_set`** (today's live focus count ≥ 1) and **`intention_reflected`** (today's `daily_intention.reflection` non-null). The `daily_intention` / `intention_reflect` catalog habits complete derived off these. RoutineCard opens `IntentionSheet` / `ReflectSheet`. Contract: the two metric signals + the `mindset` LIFE skill. See [habit.md §3/§5](habit.md).
- **← Quest** (`QuestEvaluator`, `mezo-a686`): injects `IntentionFocusRepository` and gains the **`intention_focus_set`** case for the DERIVED `growth_intention` GROWTH quest. Contract: the focus signal + the `mindset` skill. See [growth.md §4](growth.md).
- **→ Progression:** **none directly** — intention writes no `level_up_event`; XP lands only through the **HABIT** + **QUEST** award tails already in place (`ProgressionService.applyHabit` / `applyQuest`).
- **→ Today:** `IntentionBanner` at the top of `/today` reads `useIntentionDay(localDateString())`; no change to the greeting/day-arc data. See [today.md §2](today.md).
- **↔ Account progression / `AppHero` (mock-mode side-effect):** the first-focus mock write calls `awardGamificationEvent({type:'HABIT', xpOverride:10})` so the account XP ledger moves in an offline demo (one more call site of the mock account-XP precedent, [growth.md §2](growth.md)); real mode never calls it (account XP is derived from the profile). Foci 2–3 award nothing in either mode.

## 6. How to use it (consume)

```ts
import { useIntentionDay, useIntentionActions } from '@/data/hooks'

const date = localDateString()                                  // shared/lib/dates.ts (local tz)
const { data, isPending } = useIntentionDay(date)               // IntentionDay (real: EMPTY(date) while unresolved)
const { setCreed, addFocus, removeFocus, reflect, pending } = useIntentionActions(date)

await addFocus('Ma jelen leszek minden beszélgetésben')         // 409 INTENTION_FOCUS_CAP past the cap
await reflect('partial')                                        // yes | partial | no
```

- **Ghost-guard:** render nothing while `isPending && data.foci.length === 0 && !data.creed` (real mode before data / switch off) — the `IntentionBanner` honest ghost.
- Never import `intentionApi` / `mockIntentionDay` directly — go through `@/data/hooks`.
- The cap is enforced both server-side (409) and, in mock, by an under-cap check before the optimistic patch; the banner simply hides `+ Fókusz` at the cap.

## 7. How to extend it

- **New focus/reflection-derived habit or quest:** the signal already exists — reuse `intention_focus_set` / `intention_reflected` in a new catalog entry (`content/habit-catalog.json` or `quest-catalog.json`, `metric` = one of those) with a `mindset` (or other LIFE) skill; no evaluator change needed. A *new* intention signal → add a `case` to `HabitEvaluator.satisfied` / `QuestEvaluator.satisfied` reading the intention repos (pure reads only — honest completion) and register it in the right closure set.
- **New intention field/endpoint:** contract-first ([`api_contract_conventions.md`](../references/api_contract_conventions.md)) → `IntentionService` + repo/entity per [`docs/references/*.md`](../references/) → migration ([`liquibase_conventions.md`](../references/liquibase_conventions.md), remember the `ResetDatabase` TRUNCATE list) → dual-mode hook (`useDualQuery` recipe in [`_platform-data-layer.md`](_platform-data-layer.md)) → both `pnpm test` modes green.
- **New tunable** → `IntentionProperties` (`mezo.intention.*`), never a code constant ([`configuration_conventions.md`](../references/configuration_conventions.md)).
- **Mock parity:** mirror any new field in `data/intention/intentionMock.ts` so both test modes stay green.

## 8. Testing

- **Backend ITs** (`feature/intention/`, extend `ApiIntegrationTest`/`AbstractIntegrationTest` + real Postgres; data via `support/populator/IntentionPopulator`, the three tables in `ResetDatabase`):
  - `IntentionApiIT` — creed upsert + read, focus add up to the cap then **409**, blank → 400, remove focus, reflect upsert + invalid value 400, `getDay` composition + `focusCap`, switch-off → 404.
  - `IntentionServiceIT` — `setCreed` single-row upsert, `addFocus` cap-at-three, `removeFocus` frees capacity, `reflect` upsert, `getDay` exposes cap.
  - `IntentionDerivedIT` — `intention_focus_set` / `intention_reflected` satisfy the habit metrics after a focus / reflection.
  - `IntentionEntityIT` — owner-scoped soft-delete round-trip.
  - **Sibling counts:** `HabitCatalogIT` / `QuestCatalogIT` cover the +2 habits / +1 quest; `HabitApiIT` + `HabitServiceIT` were updated for the new chain sizes (MORNING **7**, EVENING **5**, catalog **12**) and the perfect-day chain now includes `daily_intention` / `intention_reflect`.
- **FE** (both modes green): `data/intention/intentionHooks.test.tsx` (dual-mode read; mock cache-patch + first-focus-only `awardGamificationEvent`; real invalidation fan-out) and `features/today/components/IntentionBanner.test.tsx` (the five state branches + daypart reflect row). Sheet/RoutineCard coverage under `features/today`.
- **Gate:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`; `cd backend && ./mvnw clean test -Dtest='Intention*IT,Habit*IT,QuestApiIT,QuestCatalogIT' -DargLine=-Xmx3g`.

## 9. Decisions, gotchas & deferred

- **Decisions (spec §2 D1–D6):** standing creed + daily foci (D1); morning set + evening reflect mapping onto the two habit chains (D2); own `feature/intention` domain, not the activity log / goal identity (D3); short list, max 3, holistic single reflection, first-focus-earns (D4); **no new progression source** — HABIT + QUEST tails, skill `mindset` (D5); `IntentionBanner` at the top of Today, five states (D6). Tone: ADR [0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md).
- **Gotcha — the focus cap is service-only.** `intention_focus` has no DB row-count constraint; the max-3 is enforced in `IntentionService.addFocus` (409) and echoed as `focusCap` in `getDay`. A direct insert would bypass it — intentional (spec §3).
- **Gotcha — only the FIRST focus earns.** Foci 2–3 are free by design (no XP farming, ADR 0010). In mock mode the account-XP award is gated on `current.foci.length === 0`; real mode simply completes the habit/quest once (idempotent per `habit_day.id` / quest id).
- **Gotcha — no XP in the intention endpoints.** All XP is derived by the habit/quest evaluators reading the intention repos; the intention writes only invalidate the habit/quest/profile query keys so the FE reflects it.
- **Gotcha — creed & reflection upsert to a single live row.** `setCreed` (one per user) and `reflect` (one per user × day) reuse the existing non-deleted row, so repeated saves don't accumulate rows.
- **Out of scope (spec §9):** per-focus checkable "did I hold this" state (foci are stated intentions; the reflection is holistic); a weekly intention review on Insights; editing a focus in place (v1: remove + re-add); AI suggestions for foci/creed; streaks/analytics beyond the two habits' 28-day strength; push/notification reminders.

## 10. Key files

- **Backend** (`backend/src/main/java/io/mrkuhne/mezo/feature/intention/`): `service/IntentionService.java` · `controller/IntentionController.java` (implements `IntentionApi`) · `entity/{IntentionCreedEntity,IntentionFocusEntity,DailyIntentionEntity}.java` · `repository/{IntentionCreedRepository,IntentionFocusRepository,DailyIntentionRepository}.java` · `mapper/IntentionMapper.java` · `config/IntentionProperties.java`. Switch: `techcore/configuration/FeaturesConfiguration.INTENTION_SWITCH`. Evaluator seams: `feature/habit/service/HabitEvaluator.java` (`intention_focus_set`/`intention_reflected` cases + `INTRADAY_METRICS`) · `feature/quest/service/QuestEvaluator.java` (`intention_focus_set` case).
- **Migration:** `backend/src/main/resources/db/changelog/1.0.0/script/202607201200_mezo-a686_create_intention.sql` (3 tables) · messages `INTENTION_TEXT_REQUIRED`/`INTENTION_FOCUS_CAP`/`INTENTION_FOCUS_NOT_FOUND`/`INTENTION_REFLECTION_INVALID` in `messages.properties`.
- **Catalog:** `content/habit-catalog.json` (`daily_intention` MORNING/pos7/xp10 + `intention_reflect` EVENING/pos3/xp5) · `content/quest-catalog.json` (`growth_intention` GROWTH/xp20).
- **Contract:** `api/feature/intention/intention.yml` (tag `Intention`, 5 endpoints, `IntentionDayResponse`/`IntentionCreedResponse`/`IntentionFocusResponse`/`SetCreedRequest`/`AddFocusRequest`/`ReflectRequest`).
- **FE data:** `frontend/src/data/intention/{intentionApi,intentionMock,intentionHooks}.ts` (+ barrel line in `data/hooks.ts:37`; types `Reflection`/`IntentionFocus`/`IntentionDay` in `data/types.ts`).
- **FE UI:** `frontend/src/features/today/components/IntentionBanner.tsx` (mounted `TodayPage.tsx:54`) · `features/today/sheets/{IntentionSheet,CreedSheet,ReflectSheet}.tsx` · `features/today/logic/habitAction.ts` (`intention-sheet`/`intention-reflect` kinds) · `.intent-*`/`.reflect`/`.fx-*` CSS in `prototype.css`.
- **Tests:** `backend/src/test/java/io/mrkuhne/mezo/feature/intention/{IntentionApiIT,IntentionServiceIT,IntentionDerivedIT,IntentionEntityIT}.java` + `support/populator/IntentionPopulator.java` · `frontend/src/data/intention/intentionHooks.test.tsx` + `frontend/src/features/today/components/IntentionBanner.test.tsx`.
- **Docs:** spec [`docs/superpowers/specs/2026-07-20-daily-intention-design.md`](../superpowers/specs/2026-07-20-daily-intention-design.md) · ADR [0010](../decisions/0010-gamified-growth-xp-feedback-not-payment.md).
