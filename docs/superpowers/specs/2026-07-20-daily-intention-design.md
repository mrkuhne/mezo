# Napi szándék — vezérelv, napi fókuszok, esti reflexió (design spec)

- **Date:** 2026-07-20 · **bd:** `mezo-a686` · **Driving ADR:** [0010](../../decisions/0010-gamified-growth-xp-feedback-not-payment.md) (XP is feedback, not payment)
- **Source:** owner request — a daily reminder to live with intention: a north-star creed + a deliberate path that drives decisions, countering drift ("csak úgy vagyok"). Surface on the home screen + as a habit + at the daily-quest level.
- **Decided with Daniel in-session** (5 explicit choices, 2026-07-20).
- Builds directly on the just-shipped habit engine ([`feature/habit`](../../features/habit.md)), the quest/activity economy ([growth.md](../../features/growth.md)), and Today.

## 1. Goal

A two-layer intentionality practice: a **standing creed** (a single editable north-star sentence, shown every day) plus up to **three daily foci** (concrete one-line intentions for the day) and a **holistic evening reflection** (`igen`/`részben`/`nem`). It lives in its own `feature/intention` domain and surfaces on three seams: a prominent **`IntentionBanner`** at the top of Today, two **DERIVED habits** in the existing morning/evening chains, and a **DERIVED `growth_intention` quest**. Every XP amount rides the existing HABIT + QUEST completion paths (no new progression source); the **first** focus of the day earns the reward, extra foci are free.

## 2. Decisions

| # | Decision | Choice + rationale |
|---|---|---|
| D1 | Shape | **Standing creed + daily foci.** A persistent creed (the constant reminder) AND a fresh daily focus (the concrete anchor). The creed is quiet/italic; the day's foci are the prominent, display-font lines. |
| D2 | Daily loop | **Morning set + evening reflect.** Morning: set the day's focus(es) via a sheet that shows the creed. Evening: one holistic reflection over the whole day. Maps onto the two existing habit chains. |
| D3 | Architecture | **Own `feature/intention` domain** (not piggybacked on activity-log / goal.identityFrame). Deterministic home-screen reads (today's foci, reflection) and clean testability beat reusing the AI-classified activity journal or the goal identity. |
| D4 | Multiple foci | **Short list, max 3, holistic reflection.** A low cap keeps it a compass, not a todo list. The **first** focus completes the morning habit + quest + earns XP; foci 2–3 are free (no XP farming — ADR 0010). One evening reflection over the whole day. |
| D5 | XP / integration | **No new progression source.** The morning habit `daily_intention` (DERIVED, metric `intention_focus_set`) and evening habit `intention_reflect` (DERIVED, metric `intention_reflected`) award through the existing **HABIT** path; the **DERIVED** `growth_intention` quest awards through the existing **QUEST** path. Both read the same intention signal — no activity-log write, no coupling into the activity feature. Skill: **`mindset` (Szemlélet 🌱)**. |
| D6 | Home surface | **`IntentionBanner` at the top of Today**, under `GreetingHeader`. Signature: a ✦ mark + a faint corner "north-star" glow — the creed as an iránypont. 5 states: no-creed (CTA) · creed-only (focus CTA) · foci-set (list + `+ Fókusz` until cap) · evening (reflect row) · reflected (holistic result). Reflection is inline (3 buttons); the creed and focus open sheets. |

## 3. Backend design — `feature/intention`

Three small owned tables (all `extends OwnedEntity`, soft-delete via `@SQLDelete`/`@SQLRestriction`, UUID pk):

- **`intention_creed`** — the standing creed, **one live row per user**: `text varchar(280)`. Partial-unique `(created_by) where is_deleted = false`. Upserted.
- **`intention_focus`** — the day's foci, **many per day**: `focus_date date`, `text varchar(200)`. Index `(created_by, focus_date) where is_deleted = false`. The **max-3-per-day** cap is enforced in the service (409), not the DB.
- **`daily_intention`** — the day's holistic reflection, **one per day**: `intention_date date`, `reflection varchar(8)` (`ck_` `yes|partial|no`). Partial-unique `(created_by, intention_date) where is_deleted = false`. Upserted.

**`IntentionService`** (gated `mezo.feature.intention.enabled`):
- `getDay(userId, date)` → composes `{ creed?, foci[], reflection?, focusCap }` (creed = the live creed row's text or null; foci = today's non-deleted focus rows, oldest-first; reflection = today's `daily_intention.reflection` or null; focusCap from config).
- `setCreed(userId, text)` — upsert the single creed row (validate non-blank, ≤ `creed-max-len`).
- `addFocus(userId, date, text)` — insert a focus; **409 `INTENTION_FOCUS_CAP`** when the day already holds `focus-cap` (3) live foci; 400 `INTENTION_TEXT_REQUIRED` on blank.
- `removeFocus(userId, focusId)` — soft-delete a focus (typo path); 404 `INTENTION_FOCUS_NOT_FOUND`.
- `reflect(userId, date, value)` — upsert today's `daily_intention.reflection` (value ∈ `yes|partial|no`, else 400 `INTENTION_REFLECTION_INVALID`).

No XP is awarded in these endpoints — completion + XP flow through the habit/quest evaluators reading the intention repos (D5). Errors via `SystemRuntimeErrorException` + `SystemMessage` (`error_handling.md`). Ownership server-side from `CurrentUserId`; every finder owner-scoped + soft-delete aware.

**Habit + quest evaluator wiring** (the intention repos are plain JPA beans, always present — not switch-gated — so the evaluators inject them directly, the `MealItemRepository` cross-feature-read precedent):
- `HabitEvaluator` gains `intention_focus_set` (today's live focus count ≥ 1) and `intention_reflected` (today's `daily_intention.reflection` non-null).
- `QuestEvaluator` gains `intention_focus_set` (same read) for the DERIVED `growth_intention` quest.
- Dependency direction stays one-way (habit → intention, quest → intention; intention depends on neither), so `feature_slices_are_cycle_free` holds.

## 4. API contract (`api/feature/intention/intention.yml`, tag `Intention`)

- `GET /api/intention/day/{date}` → `IntentionDayResponse{ date, creed?: string, foci: IntentionFocusResponse[], reflection?: string(yes|partial|no), focusCap: int }`.
- `PUT /api/intention/creed` `{ text }` → `IntentionCreedResponse{ text }`.
- `POST /api/intention/focus` `{ date, text }` → `IntentionFocusResponse{ id, focusDate, text }` (409 `INTENTION_FOCUS_CAP`, 400 `INTENTION_TEXT_REQUIRED`).
- `DELETE /api/intention/focus/{id}` → 204 (404 `INTENTION_FOCUS_NOT_FOUND`).
- `POST /api/intention/reflect` `{ date, value }` → `IntentionDayResponse` (400 `INTENTION_REFLECTION_INVALID`).

Controller gated on `mezo.feature.intention.enabled` (off → 404, FE honest-empty).

## 5. Catalog + config additions

- **`habit-catalog.json`** +2 entries:
  - `daily_intention` — MORNING, position 7, DERIVED, `metric: intention_focus_set`, `skillKey: mindset`, xp 10, anchor „reggeli rutin után".
  - `intention_reflect` — EVENING, position 5, DERIVED, `metric: intention_reflected`, `skillKey: mindset`, xp 5, anchor „lefekvés előtt".
- **`quest-catalog.json`** +1 entry: `growth_intention` — GROWTH, DERIVED, `metric: intention_focus_set`, `skillKey: mindset`, `skillKind: LIFE`, xp 20, `difficulty` 2, `dayTypes: [ANY]`, `cooldownDays` 1.
- **Config:** `mezo.feature.intention.enabled` (+ `FeaturesConfiguration` constant + `@ConditionalOnProperty`). `IntentionProperties` (`mezo.intention`, `@Validated`): `focus-cap` 3, `creed-max-len` 280, `focus-max-len` 200.
- **Migration** `{ts}_mezo-a686_create_intention.sql` (three tables) registered in `1.0.0_master.yml`; the three tables prepended to `ResetDatabase` TRUNCATE list. No `level_up_event` CHECK change (no new source).

## 6. Frontend design

**Data layer** (`data/intention/`): `intentionTypes.ts`, `intentionApi.ts` (wire ↔ domain off `api.gen.ts`), `intentionMock.ts` (deterministic seed: a creed + 2 foci + no reflection), `intentionHooks.ts` — `useIntentionDay(date)`, `useIntentionActions(date)` (`setCreed`, `addFocus`, `removeFocus`, `reflect`); dual-mode via `useDualQuery` (mock `initialData`, real honest-empty while unresolved), barrel-exported from `data/hooks.ts`. Query key `['intentionDay', date]`; a write invalidates it + `['habitDay', date]` + `['dailyQuests', date]` + `['progressionProfile']` (so the habit/quest cards + XP reflect the derived completion). Mock writes also call `awardGamificationEvent` on the **first** focus of the day only (the account-XP precedent), never on foci 2–3.

**Today — `IntentionBanner`** (`features/today/components/IntentionBanner.tsx`, mounted directly under `GreetingHeader` in `TodayPage`): the design in the approved mockup — a ✦ mark + faint corner glow, `VEZÉRELV` eyebrow + creed (quiet italic) + `szerkeszt`, a divider, then `MA SZÁNDÉKAIM {n}/{cap}` with the foci as ◆-marked display-font lines, a `+ Fókusz` ghost button until the cap (then a „a kevesebb néha több" hint), and — in the evening daypart — a holistic reflect row (`Igen`/`Részben`/`Nem`, the chosen one sage-filled). Empty states: no creed → „Vezérelv megírása" CTA; creed but no focus → „Mi ma a fókuszod?" + `Mai fókusz` CTA. Ghosts (`null`) when the intention switch is off / real mode before data. Exact layout goes through the mockup already approved.

**Sheets** (`features/today/sheets/`): `IntentionSheet` (add a focus — shows the creed read-only + a text field; save → `addFocus`) and `CreedSheet` (edit the standing creed → `setCreed`). Reflection is inline on the banner (no sheet). All chamfer `<Sheet>` consumers, HU copy.

**Habit integration** (RoutineCard): two new `habitAction` kinds — `intention-sheet` (morning `daily_intention` → opens `IntentionSheet`) and `intention-reflect` (evening `intention_reflect` → opens a tiny `ReflectSheet` with the 3 choices, reusing the `reflect` action). The habits stay DERIVED (complete off the intention signal), so the sheet is the log surface, honesty preserved — the `sleep-sheet`/`meal-sheet` precedent.

## 7. Integrations

- **← Habit:** `HabitEvaluator` reads the intention repos for `intention_focus_set` / `intention_reflected`; the two catalog habits complete derived. RoutineCard opens the intention sheets.
- **← Quest:** `QuestEvaluator` reads the focus signal for the DERIVED `growth_intention` quest.
- **→ Progression:** none directly — XP rides the HABIT + QUEST award tails already in place.
- **→ Today:** `IntentionBanner` at the top; reads `useIntentionDay(today())`. No change to the greeting/day-arc.

## 8. Testing

**Backend** (`integration_test_framework.md`): `IntentionApiIT` extends `ApiIntegrationTest` — creed upsert + read; focus add up to the cap then 409; blank → 400; remove focus; reflect upsert + invalid value 400; `getDay` composition (creed + foci oldest-first + reflection); switch-off → 404. `IntentionEvaluatorIT` (or extend `HabitEvaluatorIT`/`QuestEvaluatorIT`): `intention_focus_set` true after a focus, `intention_reflected` true after a reflect, both false when absent; the `daily_intention`/`growth_intention` habit/quest complete derived. New tables → `ResetDatabase` TRUNCATE list + an `IntentionPopulator`. Catalog loader tests updated for the +2 habits / +1 quest counts.

**Frontend:** hook tests both modes (mock seed synchronous, real honest-empty + invalidation fan-out, first-focus-only gamification award); `IntentionBanner` state branches (no-creed / creed-only / foci list + cap / evening reflect / reflected) + daypart; sheet flows; RoutineCard `intention-sheet`/`intention-reflect` actions. Gate: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`. Today visual golden refreshes (a new banner at the top of `/today`); re-baseline darwin + linux.

## 9. Out of scope (v1)

- Per-focus checkable "did I hold this" state (foci are stated intentions; the reflection is holistic).
- A weekly intention review on Insights (D2's third option — a later slice).
- Editing an existing focus in place (v1: remove + re-add); AI suggestions for foci or creed.
- Streaks/analytics over reflections beyond what the habit-strength view already yields (the two habits already feed the Growth Rutin tab's 28-day strength).
- Push/notification reminders.
