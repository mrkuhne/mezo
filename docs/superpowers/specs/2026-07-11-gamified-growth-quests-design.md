# Gamified Growth — Daily Quests, XP Expansion & LIFE Skills — Design

**Date:** 2026-07-11 · **Status:** validated in brainstorm, staged into epics · **Driving issue:** `mezo-52vz` (umbrella epic)

## 1. Summary & intent

Extend the existing progression system (XP + levels, epic `mezo-8e4`) and the workout-challenge concept (`mezo-hbwi`) into a **gamified personal-growth layer**:

- **3 daily side quests** tied to the day's real context (today's gym session / run / volleyball, macros, sleep, weight log, check-in),
- **XP from daily actions**, not only workouts, flowing into the one existing economy,
- a new **LIFE skill band** (8 skills) alongside ATHLETIC/MUSCLE — personal growth, not just athletic growth,
- **computed traits** (discipline, consistency) derived from behavior, never self-claimed,
- a **free-text activity log with AI categorization** that routes XP to the right skill and doubles as the honest completion mechanism for self-reported quests,
- a **shop-ready reward envelope** (coins prepared architecturally, shipped only with a future shop).

**Purpose:** a motivational instrument that promotes app usage *as a side effect of promoting real-life action*. The XP certifies that life happened; it is never the point of the action. This design resolves the parked "XP-vs-narrative tension" (roadmap 2026-07-03, Phase-3 mapping) — an ADR accompanies Epic 1.

## 2. Psychological foundation (drives every mechanic below)

| Principle | Mechanic it dictates |
|---|---|
| **Self-Determination Theory** (Deci & Ryan) | *Competence:* visible levels, quests calibrated to ~80% expected success. *Autonomy:* quests are offers — no accept ceremony, no penalty, 1 reroll/day. *Relatedness:* `connection` skill; companion voice on quest copy (later epic). |
| **Overjustification guard** | XP is *feedback, not payment*. Quest copy always names the real-life benefit first ("7.5h alvás = holnapi erőnléted"); XP amounts are deliberately small vs. workout XP (~10–15% of weekly potential). No XP-gated content. |
| **Identity-based habits** (Clear) | Quest copy phrased as identity votes ("Egy szakács ma is főz"), never as point transactions. |
| **Implementation intentions** | Quests bind to existing cues (check-in slots, today's planned session) rather than floating abstractions. |
| **No failure state / grace** | An uncompleted quest silently expires at midnight — no red X, no streak shame. Mirrors the existing "a try maga a jutalom" challenge philosophy and the robustness streak's tone. |
| **Evidence-based mindset practice** | The `mindset` skill channels gratitude journaling, visualization and goal-writing through their evidence-based core (gratitude interventions, mental contrasting / WOOP) — aspirational copy, no magical-thinking claims. |
| **Ethical boundary** | No loot boxes, no variable-reward gambling, no FOMO countdowns, no loss-aversion blackmail, never pay-to-win or real money. Retention comes from an achievable daily rhythm. |

**Traits over self-claimed virtue skills:** "discipline" and "consistency" are *not* quest skills — you cannot "do a discipline". The app **computes** them from behavior and mirrors them back ("a számaid szerint fegyelmezett vagy"). Evidence-based identity feedback beats self-assigned points and protects economy integrity.

## 3. Skill taxonomy

Existing bands stay untouched: 12 ATHLETIC + 13 MUSCLE (`ProgressionTaxonomy.java`). New band:

**LIFE (8 skills — octagon radar on Me, the counterpart of the athletic hexagon):**

| key | HU name | Completion sources |
|---|---|---|
| `mindfulness` | Tudatosság | activity log (meditation, breathwork, journaling) |
| `mindset` | Szemlélet | activity log (gratitude, visualization/WOOP, goal-writing) |
| `cooking` | Konyha | **partially derived**: own recipe logged as meal → auto; meal-prep etc. via activity log |
| `financial` | Pénzügyek | activity log (budget review, no-spend day, savings action; AI-extracted amounts) |
| `productivity` | Produktivitás | activity log (deep-work block, day planning, finishing a dreaded task) |
| `learning` | Tanulás | activity log (reading, course, language practice) |
| `connection` | Kapcsolatok | activity log (call a friend/family, quality time, help someone) |
| `recovery` | Regeneráció | **mostly derived**: sleep target hit, mobility block, check-in completeness |

LIFE XP inflow = quest completions + activity-log entries, nothing else; "derived" above means the signal is auto-detected from already-logged data (own-recipe meal, sleep, mobility block, check-ins) instead of free text — such signals auto-complete matching quests and may auto-create a categorized activity entry. Same level curve as today (`base=100, exp=1.6`); LIFE skills level slower than athletic ones (smaller XP inflow) — acceptable: a level certifies accumulated effort.

**Computed traits (no levels, no XP):**

- **Fegyelem (discipline):** 28-day rolling completion ratio over *commitments* = planned training sessions done + daily quests completed, blended 50/50. Displayed as a 0–100 meter.
- **Következetesség (consistency):** current streak of consecutive weeks with ≥4 *active days* (a day with any XP-earning action). Displayed as a week count.

Both derivable on read from the `level_up_event` ledger + `daily_quest` table — **no new tables**, computed in `GET /api/progression/profile`.

## 4. Daily quest system

**Composition — 3 quests/day, fixed slots:**

1. **Body** — bound to today's plan: gym day → session-specific (e.g. "tartsd a RIR≤2-t a fő gyakorlaton", "vidd fel a 3. munkaszettet is"); run day → distance/tempo; volleyball day → attendance/sets; rest day → recovery quest (mobility, walk, sleep hygiene).
2. **Fuel/Bio** — protein/kcal target *from the goal-engine prescription* (never invented), water, weight log, sleep target, check-in completeness.
3. **Growth** — LIFE skill rotation ("10 perc olvasás", "írj le 3 dolgot, amiért hálás vagy", "nézd át a heti költéseid").

**Catalog:** master-data JSON (`quest-catalog.json`, pattern of `progression-perks.json`). Entry shape: `{key, slot, skillKey, titleTemplate (HU), why (HU), completion: {mode: derived|activity, metric, targetExpr}, difficulty: 1..3, conditions (dayType, requiresGoalPrescription, …), xp, coins, cooldownDays}`. Templates parameterize from context (today's template session, goal prescription, recent averages).

**Selection:** deterministic, seeded by `(userId, date)` — filter by conditions → exclude keys within cooldown window (anti-repeat) → pick one per slot, difficulty targeting ~80% expected success (static tiers in v1, adaptive difficulty in Epic 3). Rule-based, testable, no LLM in the economy. LLM may later rewrite *flavor copy only* (Epic 3), never targets or XP.

**Lifecycle:** `offered → completed | expired` (+ `rerolled` terminal for replaced quests). No accept step. Generation is lazy on first Today read of the day (challenge pattern) + morning cron backstop. Derived quests auto-complete on evaluation (on Today read + nightly finalize cron, mirroring `ChallengeJob`); activity-mode quests complete when a matching activity-log entry lands. Expiry at midnight is silent.

**Reroll:** 1/day, `POST /api/quest/{id}/reroll` — replaces with the next eligible catalog candidate; old row marked `rerolled`. (A shop item can raise the daily reroll cap later.)

**XP grant:** at completion, via the existing idempotent `ProgressionService.award(...)` tail — new `source_type = QUEST`, `source_ref_id = quest id`. Level-ups ride the existing `level_up_event` + `LevelUpProvider` overlay.

## 5. Activity log with AI categorization (new domain)

Free-text logging of life activities; the AI routes the reward.

**Flow:** user logs text ("olvastam 30 percet a Psychology of Money-ból", "átraktam 50 ezret megtakarításba") → one cheap-tier companion LLM call classifies → `{skillKey (from LIFE taxonomy only), confidence, xpSuggestion, extracted: {durationMin?, amountHuf?}}` → server clamps XP into the deterministic band and persists. Low confidence (<0.6) → entry stored *uncategorized*, FE prompts the user to pick the skill; XP granted on categorization. User can always override the category (override also grants/moves the XP; a correction signal we can learn from later).

**Guardrails (anti-farm, deterministic — the LLM proposes, the server disposes):**
- XP per activity clamped to **5–25**;
- per-skill daily cap **40 XP** from activities;
- per-day total activity XP cap **100**;
- idempotent award per activity id (same `award(...)` tail, `source_type = ACTIVITY`).

**Quest synergy:** after an activity write, the day's open activity-mode quests are checked; a match completes the quest (its XP on top). The self-report "tap" is therefore never an empty checkbox — it is a mini-journal entry, aligned with the honest-completion philosophy.

**Finance thin-slice (no budget app in v1):** `financial` activities carry an optional AI-extracted, user-editable `amountHuf`. The Growth card shows a **"Megtakarítás (30 nap)"** aggregate. A fuller finance domain is a separate future brainstorm if this proves valuable.

**LLM dependency:** classification requires the companion switch ON; with it OFF the log degrades gracefully to manual category picking. Tests use the `companion-fake` profile (network never touched).

## 6. Reward envelope & shop readiness (future Epic 4 — prepared, not shipped)

- Quest catalog entries and the resolve path carry a reward envelope `{xp, coins}`; **coins are 0 and invisible in v1** — an unspendable currency is a broken promise, so coins ship together with the shop.
- Recorded principles for the future shop: **XP = permanent progress, never spendable; coins = spendable** on convenience/cosmetic items only (extra reroll, quest swap, themes). Never pay-to-win, never real money.
- Prep cost now: reward envelope shape in catalog + quest table (`coins int default 0`); a wallet/ledger table is *documented* here but **not created** until Epic 4.

## 7. UI placement

- **Today — `DailyQuestsCard`** (new, `features/today/components/`): the 3 quests with state, silent-expiry styling, reroll affordance; activity-mode quests open the **`ActivityLogSheet`** (new, `features/today/sheets/`) prefilled with the quest context. The activity log is also reachable standalone from Today (quick-add).
- **Me — `GrowthCard`** (new, `features/me/components/`, below `MuscleLevelsCard`): 8-axis LIFE octagon radar (generalize `features/me/logic/radarGeometry.ts` from fixed-6 to N axes), top LIFE skills with level/progress, the two trait meters (Fegyelem 0–100, Következetesség week-streak), and the "Megtakarítás (30 nap)" stat.
- **Level-up:** reuse the global `LevelUpProvider` / `useLevelUp` overlay (mounted in `app/AppLayout.tsx`) for LIFE level-ups; Today page triggers it on quest-completion responses carrying a `levelUp` payload (same pattern as workout finish).
- No new tab. Hungarian UI copy throughout, identity-vote phrasing, benefit-first.

## 8. Data model & backend architecture

**New tables** (UUID PKs, `created_by`, soft delete, per house rules):

- `daily_quest` — `quest_date`, `slot` (CHECK BODY|FUELBIO|GROWTH), `catalog_key`, `skill_key`, `title`, `why`, `completion_mode` (CHECK DERIVED|ACTIVITY), `target` jsonb (typed envelope), `xp`, `coins` (default 0), `status` (CHECK offered|completed|expired|rerolled), `completed_at`, `source_activity_id` nullable. Identity: `(created_by, quest_date, slot)` unique among non-rerolled rows.
- `activity_log` — `occurred_on`, `text`, `skill_key` nullable (null = uncategorized), `confidence`, `xp_awarded`, `extracted` jsonb (`durationMin`, `amountHuf`), `categorized_by` (CHECK AI|USER).

**Altered:** `skill_progress` — relax `ck_skill_progress_kind` to allow `LIFE`; `level_up_event` — relax source CHECK to allow `QUEST|ACTIVITY`. New migration scripts under the driving epic ids; released changesets untouched.

**New packages:** `feature/quest` (controller/service/repository/entity/dto/mapper + `QuestSelector`, `QuestEvaluator`, `QuestJob` crons) and `feature/activity` (+ `ActivityClassifier` calling `CompanionLlm`). Switches: `mezo.feature.quest.enabled`, `mezo.feature.activity.enabled` (+ constants in `FeaturesConfiguration`, `@ConditionalOnProperty` per house pattern). Tunables under `mezo.quest.*` / `mezo.activity.*` as `@Validated` properties records (XP bands, caps, reroll limit, confidence threshold, cron switches) — no hardcoded tunables.

**Progression integration:** new `ProgressionService.applyQuest(...)` / `applyActivity(...)` building single-skill XP deltas, funneling into the existing idempotent `award(...)` tail; `ProgressionTaxonomy` extended with the LIFE band; `getProfile()` extended with `life[]`, `traits`, `savings30d`.

**Contract-first endpoints** (`api/feature/quest/quest.yml`, `api/feature/activity/activity.yml`, merged via `api/generate`):

- `GET /api/quest/day/{date}` → `DailyQuestResponse[]` (lazy-generates for today; honest `[]` when switch off — pattern of challenges)
- `POST /api/quest/{id}/reroll` → replacement quest (409 when daily reroll exhausted or quest not `offered`)
- `POST /api/activity` `{text, occurredOn?}` → entry + classification (+ optional completed-quest + `levelUp` payload)
- `GET /api/activity?date=` → entries
- `POST /api/activity/{id}/category` `{skillKey}` → categorize/override (grants/moves XP)
- extended `GET /api/progression/profile`

**Frontend data layer:** `data/quest/{questHooks,questApi,questMock}.ts`, `data/activity/{activityHooks,activityApi,activityMock}.ts`; barrel entries in `data/hooks.ts`; dual-mode via `useDualQuery`; generated types from `api.gen.ts` (`satisfies` on request bodies). Mock seeds provide a representative day (1 completed, 1 offered-derived, 1 offered-activity quest; a few categorized activities).

## 9. Economy calibration

- Workouts remain the primary XP source (hundreds of XP/session across skills). Quests: **15–40 XP each** (~90/day max); activities: 5–25 within daily caps. Target share: quests+activities ≈ **10–15% of weekly XP potential** — a garnish, not the main course (overjustification guard).
- All amounts are config (`application.yml` under `mezo.quest.*` / `mezo.activity.*`), tunable without code, mirroring `mezo.progression.*`.
- Anti-abuse: deterministic clamps + caps (above); derived quests are data-verified by construction; the activity honor-system is bounded by the caps so even bad-faith logging cannot distort the economy meaningfully.

## 10. Epic staging

| Epic | Content | Ships value |
|---|---|---|
| **E1 — Quest core** | ADR (XP-vs-narrative resolution) + `feature/quest` + catalog + selection/evaluation + *derived* quests + Today `DailyQuestsCard` + reroll + XP wiring + LIFE kind CHECK relax with a single `recovery` skill (FUELBIO XP routing — robustness is recomputed absolutely and cannot carry quest XP; full LIFE band stays E2). BODY + FUELBIO slots; GROWTH slot activates in E2 | 2 live daily quests on real data, day one |
| **E2 — Growth layer** | LIFE band (taxonomy + migration) + `feature/activity` + AI classification + `ActivityLogSheet` + activity-mode quests + Me `GrowthCard` (octagon + traits) | Personal-growth loop complete |
| **E3 — Life integrations & polish** | savings aggregate, adaptive quest difficulty, companion flavor copy on quests, weekly-summary integration | Depth & personalization |
| **E4 — Shop & coins** *(future, out of scope)* | wallet ledger, shop UI, coin visibility, spendable items | — |

Each epic: own bd issues, own `feat/` branch + self-PR CI gate, own feature-doc updates (`docs/features/today.md`, `me.md`, new `docs/features/growth.md` for quest+activity domains) per house rules.

## 11. Testing approach

- **Backend:** integration-first per `testing_standards.md` / `integration_test_framework.md` — new `QuestPopulator`, `ActivityPopulator`; `daily_quest`, `activity_log` added to `ResetDatabase` TRUNCATE list; deterministic selection tests (fixed seed/date), evaluation matrix per completion metric, `award` idempotency for QUEST/ACTIVITY sources, reroll 409s, switch-off honesty (`[]`/404), classifier tests on `companion-fake`.
- **Frontend:** vitest both modes green (`pnpm test` + `VITE_USE_MOCK=true pnpm test`); card/sheet tests colocated; UI verified by running the app (per memory: visual verification, mockup→approve→implement loop for the two new cards).

## 12. Decisions log (brainstorm 2026-07-11)

1. Full vision in one design, staged epics — **approved**.
2. LIFE set expanded to 8 (productivity, learning, connection added; "the secret" → evidence-based `mindset`; "full life" → `connection`) — **delegated to design, chosen here**.
3. Discipline/consistency as computed traits, not skills — **approved**.
4. Self-report via activity log + AI categorization; finance as thin savings-slice — **approved (user-requested addition)**.
5. Reroll 1/day; shop prepared via reward envelope, shipped later — **approved (user-requested addition)**.
