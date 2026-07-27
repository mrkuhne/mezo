# LLM meal-coach layer (hybrid step 2)

- **Date:** 2026-07-27
- **Driving issue:** mezo-mr4n
- **Status:** design approved (implementation pending)
- **Builds on:** `2026-07-27-training-aware-meal-scoring-design.md` (mezo-ta8p — the deterministic, training-aware number this layer narrates), ADR 0006 (the breakdown jsonb envelope), ADR 0012 (consumer-owned LLM ports)
- **Mirrors:** `RecipeBreakdownProseService` / `RecipeBreakdownService` (mezo-bw3y — the same idea on the recipe surface)

## 1. Context & problem

The logged-meal score is now a deterministic, training-aware **number** (`MealScoringService.scoreMeal(slot, lines, localTime, role)`) plus an 8-dimension breakdown of *how* it was computed. What it cannot do is tell you what the number **means for you, today**: "AI 62" with a WHO row at 0.30 says nothing about the fact that this was your pre-workout meal before a Pull day and that you are 700 kcal into a 3100 kcal budget.

The envelope was designed for exactly this: `MealBreakdownJson.summary` and `improve[]` are documented as "Phase-3 (P8) prose — `null`/empty in v0, never fabricated" (`nutrition/entity/MealBreakdownJson.java:19`). The FE already renders both — `MealScoreSheet.tsx:47` hides the summary card while it is null, `ScoreBreakdownBody.tsx:24` the improve list. **The sockets exist and are empty.**

This spec fills them. It is step 2 of the hybrid direction agreed in the `ta8p` spec §2: the deterministic number stays the stable, comparable, reproducible baseline; the LLM adds the qualitative reading on top and **never touches a number**.

## 2. Decision summary

| Question | Decision |
|---|---|
| What the coach sees | the meal + its deterministic breakdown + its `MealRole` + the day's workouts **+ the day's fuel state as of that meal's `loggedAt`** |
| What it produces | `tagline` (new) + `summary` + `improve[]` — **no** per-dimension detail override, **no** number is ever LLM-authored |
| When it runs | **lazily**, never in the write path; inputs are frozen so the output is cacheable |
| Batch shape | **one** LLM call per day-view for all still-verdictless meals of that day |
| Today vs history | the day batch generates **only for today**; older days show what is already cached, and generate only on an explicit score-sheet open |
| Where it shows | the `MealScoreSheet` (summary + improve) **and** a one-line tagline on the Mai timeline `SlotCard` |
| Degradation | flag off / companion off / LLM error / unparseable → nothing persisted, no verdict shown, never a 5xx |

## 3. What the coach produces

One verdict per meal:

- **`tagline`** — a deliberately short (~50–60 char) card-sized cut, e.g. *"Remek pre-workout üzemanyag"*. **New nullable field** on the breakdown envelope + the `MealBreakdown` OpenAPI schema. It exists because the summary is 2–3 sentences and would break a mobile card; a FE-side "first sentence" truncation was rejected as uncontrollable in length.
- **`summary`** — 2–3 sentences, Hungarian, tegeződve: what this meal was good/bad for **in its context**.
- **`improve[]`** — 0–3 concrete suggestions, each `{text, impact}` where impact is a short qualitative tag (`"+rost"`, `"-NOVA4"`), exactly as the recipe prose layer emits them.

Explicitly **not** produced: per-dimension `detail` prose (unlike the recipe surface — see §11), and any numeric field. The deterministic dimension scores, weights, details, and the `Szerep` context row stay byte-for-byte as the scorer wrote them.

## 4. What the coach sees (prompt input)

**Day header (once per call):** the date · the day's targets (`NutritionTargetsProperties` — the same kcal/P/C/F set `FuelDayService.targetSet()` puts in the Fuel header, so the coach and the UI can never disagree) · the day's workouts as `{time, kind, label, done}`.

**Per meal:** name + lines (with amounts) · slot + logged time · the **full deterministic breakdown** (per dimension: id, label, weight, score, detail; plus the final value and confidence) · its `MealRole` and the matching workout window · **the day's fuel state up to that meal**: which meal of the day it is, kcal/P/C/F consumed before it, and what remained of the budget.

That last part is the reason the output is cacheable. The state is computed **as of the meal's `loggedAt`**, not "now": `MealRepository.findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc` (already used by `FuelDayService.java:38`) gives the day's meals in log order, and the running sum before the meal in question is a fold over that list. No new query, and the same meal always produces the same prompt — so a breakfast opened in the evening is judged against the morning's state, not the evening's.

## 5. When it runs

Two entry points, both **outside** the write path (`POST /api/meal` stays exactly as fast as today):

| Endpoint | Called by | Generates? |
|---|---|---|
| `GET /api/meal/coach?date=YYYY-MM-DD` | the Mai/Fuel day view, as a **separate** request from `GET /api/fuel/day/{date}` | one batch LLM call for that day's verdictless meals — **only when `date` is today** (server zone, like the rest of the day logic) |
| `GET /api/meal/{id}/coach` | opening `MealScoreSheet` | always, when that meal has no cached verdict — any date (an explicit open is explicit intent) |

Both return the same `MealCoachResponse { verdicts: [...] }`; the single-meal one carries 0–1 entries.

The timeline never blocks on this: the deterministic data renders immediately from the `fuel/day` payload, and the tagline rows appear as the coach response lands. Browsing back through history therefore costs **zero** LLM calls.

**Batch, not N calls:** three verdictless meals are one call, not three — cheaper, and the model sees the day's arc, so the sentences are coherent with each other. The prompt still gives each meal only its own up-to-that-point state (§4), and already-cached meals are not re-sent, so a later meal never rewrites an earlier verdict.

## 6. Architecture & layering

Consumer-owned port, per ADR 0012 — the `RecipeBreakdownLlm` shape:

1. **`MealCoachLlm`** (`feature/meal/service`) — one method, `complete(systemPrompt, userMessage)`. The meal slice never imports `feature.companion`.
2. **`MealCoachLlmAdapter`** (`feature/companion/llm`) — delegates to `CompanionLlm`'s cheap-tier overload, `@ConditionalOnProperty(FeaturesConfiguration.COMPANION_SWITCH)`, exactly like `RecipeBreakdownLlmAdapter`. Companion off → no bean. The only cross-feature edge is companion → meal, the direction the graph already runs; the ArchUnit slice-cycle rule stays closed with no exception.
3. **`MealCoachService`** (`feature/meal/service`) — `@ConditionalOnProperty(FeaturesConfiguration.MEAL_COACH_SWITCH)`, new constant for `mezo.feature.meal-coach.enabled`. Owns prompt assembly, the permissive parse, the merge into the envelope, and persistence. Reached through `ObjectProvider<MealCoachService>` from the controller/service so a switched-off feature is a missing bean, not a branch.
4. The day's workout windows come from the existing `WorkoutWindowQueryService.windowsFor(userId, date)` (`feature/train`) — the same seam `MealService.applyScore` (`MealService.java:164`) already uses.

**Transaction shape — deliberately different from the recipe precedent.** `RecipeBreakdownService` holds one read-write transaction across its LLM roundtrip (documented in its javadoc as an accepted single-user compromise). For a batch that would pin a pooled connection for the length of an N-meal call, so here: **read in a short read-only tx → close → LLM call outside any transaction → short write tx to persist**. Persisting re-reads the meals by id and writes only the prose fields.

### 6.1 New: `Window.label`

The target sentence ("great pre-workout fuel for your Pull day") needs the workout's *name*, but `WorkoutWindowQueryService.Window` carries only `{start, end, kind, done}` (`WorkoutWindowQueryService.java:38`). It gains a **`label`**:

- **gym** — the meso template day planned for that date (the `findPlannedTemplateForDate` idiom the companion snapshot already uses), i.e. the day label / type;
- **sport** — the session's (or slot's) `sport` value (volleyball / cross / trx);
- **run** — the `RunPrescribedSession.label`.

`MealScoringService.WorkoutWindow` does **not** grow this field: `classifyRole` has no use for it, and the scorer must stay a pure value-in/value-out function. `MealCoachService` consumes the train `Window` directly.

## 7. Cache & invalidation

The verdict lives in the **existing** `meal.breakdown` jsonb (`summary` / `improve` / the new `tagline`). No new table, no new column, and **no migration at all** — jsonb is schemaless, so the typed record simply gains a field (old rows read it back as `null`, which is exactly "no verdict yet").

Invalidation is free. `meal.breakdown` is a frozen micro-snapshot (ADR 0006): it is written once at log time and **never recomputed on read** — so unlike the recipe cache there is nothing to drift against, and the recipe's `matches()` numeric comparison has no analogue here. When a meal is edited, `MealService.applyScore` recomputes the whole envelope and `scoreMeal` always writes `summary = null` / `improve = []` — the stale prose disappears by construction and the meal simply looks verdictless again on the next view.

## 8. Degradation

Flag off · companion off (no adapter bean) · LLM throws · answer not parseable · a verdict whose `mealId` is unknown or whose `summary` is blank → that verdict is **dropped, nothing is persisted**, and the FE renders as it does today (no tagline row, no summary card). Never a 5xx: the feature's core is deterministic and already served, so this is the recipe-style silent degrade (`RecipeBreakdownProseService.java:83-100`), not the scrape/ai-draft 502/503 (whose whole feature *is* the LLM). Because nothing is persisted on failure, the next view self-heals once the LLM is available again.

Caps mirror the recipe layer: `improve` limited to 3 non-blank rows, `tagline` truncated to its max length server-side, unknown JSON keys ignored.

## 9. Contract & FE changes

**OpenAPI** (`api/feature/meal/meal.yml`, contract-first per `api_contract_conventions.md`):
- `MealBreakdown`: one new nullable `tagline` string (mirrored in `MealBreakdownJson`).
- New `MealCoachResponse { verdicts: [ { mealId, tagline, summary, improve[] } ] }` + the two operations of §5.

**Frontend:**
- `data/meal/coachHooks.ts` — `useMealCoach(date)` and `useMealCoachFor(mealId)` on `useDualQuery`, exported through the `data/hooks.ts` barrel.
- `SlotCard` — a tagline line under the title (next to the existing AI-score chip at `SlotCard.tsx:120`); absent verdict = no row, no layout shift.
- `MealScoreSheet` — the summary card already exists (`:47`); it gains a skeleton while the coach request is in flight.
- Mock mode gets plausible canned taglines/summaries so `VITE_USE_MOCK=true` never needs a backend.

## 10. Testing

Backend, per `testing_standards.md` / `integration_test_framework.md` — **no Mockito, no network**: the profile-gated `FakeCompanionLlm` with a new `[fake-meal-coach:{json}]` sentinel (the sibling of `[fake-recipe-fit:{json}]`, `RecipeBreakdownApiIT:25`) planted in a meal title and echoed back as the LLM answer, under `@ActiveProfiles("companion-fake")`.

Cases: batch over two meals returns two verdicts and persists both · a second call returns them from cache **without** invoking the LLM · a past date does not generate (but still returns cached verdicts) · a single-meal open **does** generate on a past date · editing a meal drops its prose · each degradation path of §8 leaves the deterministic envelope intact and persists nothing · the prompt actually carries the up-to-that-meal fuel state and the workout label (assertable because the fake echoes the prompt).

Frontend: hook tests in both modes; a `SlotCard` test for the absent-verdict (no row) and present-verdict cases.

## 11. Out of scope (explicit)

- **A day-level summary sentence** — that is the companion's `DailySummaryService` territory; duplicating it here would give two voices narrating the same day.
- **Per-dimension `detail` prose** (which the recipe surface does have) — the meal dimension details are already concrete deterministic facts; overriding them adds cost and eight more places for the model to contradict the numbers.
- **Touching the recipe surface** — `RecipeBreakdownProseService` stays as is.
- **Streaming** and **a dedicated model tier** — the cheap tier, one-shot, like every other feature LLM (ADR 0008).
- **Backfilling** verdicts for old meals — they materialize on demand, one score-sheet open at a time.

## 12. Open tunables to settle in implementation

1. `tagline` max length (~50–60 chars) and how hard the prompt is told to respect it.
2. Whether the day batch has an upper bound on meals per call (a 6-meal day is fine; the cap only matters if a day ever gets pathological).
3. The exact system prompt wording — tone is fixed (Hungarian, tegeződő, concise, the recipe prompt's register), the emphasis between "verdict" and "advice" is worth one round of real-output review.
