# Proactive Coaching Round 2 · S3 — Retro/Batch-Logging Awareness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or
> superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship spec item (9) — when a user habitually **reconstructs** their meal log later
(≥ 40 % of the last 14 days' meals were written on a different calendar day than they are
about), the midday/evening window prompt receives a **batch-logger FACT block** carrying the
measured ratio and today's actual logging state, and is explicitly forbidden from reading
"nothing logged yet" as "hasn't eaten". For everyone else — and for anyone with too few meals
to measure — the block is empty and nothing changes.

**Architecture:** Slice S3 of
[`docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md`](../specs/2026-09-05-proactive-coaching-round2-design.md)
§b / §(9). One new deterministic probe (`RetroLoggingProbe`, the `LogFreshnessProbe` /
`HydrationShortfallProbe` idiom) + one package-private fact block on
`CompanionMessageGenerator` (the `hydrationBlock` / `missedWorkoutsBlock` idiom) + one
`WINDOW_PROMPT` rule line + config. **No flag, no advice card, no day gate, no mutation, no
migration, no new feed kind, no OpenAPI change, no frontend change.** This is the smallest
slice in round 2 and it deliberately reuses S2's shape end-to-end.

**Tech Stack:** Spring Boot backend (`backend/`) only. JUnit ITs extending
`AbstractIntegrationTest`.

**Driving issue:** `mezo-d58h.7.3` (child of `mezo-d58h.7`). Branch:
`feat/proactive-round2-s3-retro-logging` (already cut from `origin/main`).

---

## The three things that make this slice dangerous

**1. `created_at` is `@CreationTimestamp` and `updatable = false`.** A test CANNOT choose a
meal's `created_at`; it is always "now". That is not a problem — it is the whole fixture
strategy: a meal persisted **now** with `mealDate = today` is same-day, and the identical row
with `mealDate = 5 days ago` is retro. Never try to force `created_at` in a populator (Hibernate
overwrites it on insert), and never write the probe so it needs a forced timestamp to be
testable.

**2. The window must NOT include today.** Today is half-finished by construction: a meal about
today can only ever be same-day *so far*, and every meal the batch logger has not written yet is
simply absent. Including today therefore drags the ratio *down* precisely for the user the rule
is about. The window is `[date - windowDays, date - 1]`; today is read separately, and only as
"how many meals exist for today right now" — a state fact for the prompt, never an input to the
ratio.

**3. This block changes what the LLM is allowed to say, not just what it knows.** The existing
`WINDOW_PROMPT` midday branch contains rule (3): "*ha ma még hiányzik egy szokásos napló …, ezt
mondd ki egy mondatban*". For a batch logger that instruction is exactly the harm the spec names.
The new block therefore carries its own explicit counter-instruction, and `WINDOW_PROMPT` gains
one rule line that subordinates rule (3) to it. Adding the fact without the counter-instruction
would ship a *worse* prompt than today's, because the model would then have evidence to scold with.

---

## Decisions already made — do not re-litigate

- **Meals only.** The spec's item (9) is about the "*haven't you eaten?*" assumption, and
  `MealEntity` is the one domain with a clean `(mealDate, createdAt)` pair. `RetroLoggingRatioDetector`
  (character) splits event vs reflection genres; that is a *character-dossier* claim with its own
  window and vocabulary, and it is deliberately NOT reused here — this slice needs one number for
  one prompt, not a dossier signal. The convention (same calendar day ⇒ immediate) is what is
  borrowed, not the class.
- **The block goes to BOTH window kinds, not only midday.** *(Deliberate, flagged widening of the
  spec's wording, which says "the midday prompt".)* The evening closing prompt asks the model to
  say "*miben maradt el*" from today's actual data — on a batch logger's day that data is often
  still empty at 19:00, so gating the fact to midday would knowingly leave the identical defect
  live in the evening note. The block's text is window-agnostic, so one block serves both.
- **`retroPct` is measured, not banded.** The character detector bands into
  azonnali/vegyes/utolagos; here the prompt gets the actual integer percentage, because the
  companion is allowed to be concrete about a fact it can cite (S2's precedent: real millilitres,
  not "kevés").
- **Nothing is a card, nothing is a flag.** No `FlagKey`, no `AdvicePriority` entry, no
  Liquibase CHECK widening, no intervention-library entry. If a future round wants this as a
  card, it starts from the probe, which stays reusable.
- **Silence is cheap and mandatory.** Fewer than `min-meals` meals in the window ⇒
  `Optional.empty()`. A user who logs nothing is *unobserved*, not a batch logger.
- **Pre-logging counts as retro.** A meal written the evening *before* the day it is about also
  has `created_at`'s day ≠ `meal_date`. That is still "not written in the moment", which is what
  the fact claims, so it is counted — and said so in the javadoc rather than silently special-cased.

---

## Global Constraints

- **Every threshold is config** (`ProactiveProperties.RetroLogging`, Bean-Validation ranges,
  `application.yml` defaults). No numbers in the probe or the generator.
- **Switches:** `COMPANION_SWITCH` + `PROACTIVE_SWITCH` on the probe (`@ConditionalOnProperty`),
  exactly like `HydrationShortfallProbe`; the generator already carries them.
- **Wall-clock convention:** `created_at` is an `Instant`; convert with
  `ZoneId.systemDefault()` (`HydrationShortfallProbe`/`LateEatingRule` precedent). No UTC games.
- **Best-effort, never fatal.** The window prompt must not die because a fact block threw.
- ArchUnit (CI): constructor DI only, method-level `@Transactional` only, no `@Value`. The only
  cross-feature direction used is `proactive → meal`, which already exists (`LogFreshnessProbe`).
- Backend runs REQUIRE `-Dmezo.test.use-testcontainers=true`, and Maven's OWN exit code — never a
  pipeline's. "Tests run: 0", or a `-Dtest` filter matching nothing, is a FAILURE to report.
- Run everything from this worktree root; never `cd` to the primary repo. Commit subjects carry
  `(mezo-d58h.7.3)` plus the `Co-Authored-By:` trailer. Regenerate `docs/CODEMAP.md` in the same
  change as any new file, and AFTER any docs edit.

---

## File Structure

| File | Responsibility |
|---|---|
| `feature/proactive/config/ProactiveProperties.java` (M) | `RetroLogging` nested record + field |
| `backend/src/main/resources/application.yml` (M) | `mezo.proactive.retro-logging` block |
| `feature/proactive/service/RetroLoggingProbe.java` (C) | the whole detection: window ratio + today's state |
| `feature/proactive/service/CompanionMessageGenerator.java` (M) | `batchLoggerBlock` + window payload append + one `WINDOW_PROMPT` rule line |
| `support/populator/MealPopulator.java` (M, test) | `createBareMeal(owner, mealDate, slot)` |
| `feature/proactive/RetroLoggingPropertiesIT.java` (C, test) | config binding |
| `feature/proactive/service/RetroLoggingProbeIT.java` (C, test) | fire + every silence gate |
| `feature/proactive/service/CompanionMessageRetroLoggingIT.java` (C, test) | the fact block on both windows |
| `docs/features/proactive.md`, `docs/CODEMAP.md` (M) | docs |

---

### Task 1: config — `ProactiveProperties.RetroLogging` + `application.yml`

- [x] Add `@NotNull @Valid RetroLogging retroLogging` to the `ProactiveProperties` record
      components (after `hydration`).
- [x] Add the nested record, javadoc'd like `Hydration`:
      `windowDays` `@Min(7) @Max(60)`, `minMeals` `@Min(1) @Max(200)`,
      `retroPct` `@Min(1) @Max(100)`.
- [x] Add the `retro-logging:` block under `mezo.proactive` in `application.yml`
      (after `hydration:`), with commented defaults `window-days: 14`, `min-meals: 10`,
      `retro-pct: 40`.
- [x] Write `RetroLoggingPropertiesIT` (the `HydrationPropertiesIT` shape): assert the three
      bound values.
- [x] **Verify:** `./mvnw -q clean test -Dmezo.test.use-testcontainers=true -Dtest=RetroLoggingPropertiesIT`
      — green, `Tests run: 1`.

### Task 2: `RetroLoggingProbe` — the detection

- [x] New `feature/proactive/service/RetroLoggingProbe.java`: `@Slf4j @Service
      @RequiredArgsConstructor @ConditionalOnProperty({COMPANION_SWITCH, PROACTIVE_SWITCH})`.
      Dependencies: `ProactiveProperties`, `MealRepository`.
- [x] `public record BatchLogging(int windowDays, int totalMeals, int retroMeals, int retroPct,
      int mealsLoggedToday) {}`.
- [x] `@Transactional(readOnly = true) public Optional<BatchLogging> evaluate(UUID userId,
      LocalDate date)`:
      1. window = `[date.minusDays(windowDays), date.minusDays(1)]`, read via
         `mealRepository.findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc`;
      2. `total < cfg.minMeals()` ⇒ `Optional.empty()` (too little data ⇒ silence);
      3. `retro` = rows whose `LocalDate.ofInstant(getCreatedAt(), ZoneId.systemDefault())`
         differs from `getMealDate()`; skip rows with a null `createdAt` defensively;
      4. `retroPct = (int) Math.round(retro * 100.0 / total)`; `< cfg.retroPct()` ⇒ empty;
      5. `mealsLoggedToday` = size of
         `findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date)`;
      6. otherwise the record.
- [x] Javadoc carries: the "window excludes today, and why" rule (danger 2), the pre-logging
      decision, the `RetroLoggingRatioDetector` convention credit, and the "unlogged ≠
      non-compliant" policy line.
- [x] Write `RetroLoggingProbeIT` (extends `AbstractIntegrationTest`) — see Task 2a for the
      fixture strategy the assertions depend on.
- [x] **Verify:** `-Dtest=RetroLoggingProbeIT` green.

#### Task 2a: the fixture problem, and its resolution

Because `created_at` is always "now", **every** row a test persists with a `mealDate` inside
`[date-14, date-1]` is retro by definition — a 0 %-retro fixture is impossible through the
populator alone. Resolve it in the test layer, not by weakening the probe:

- [x] Add to `MealPopulator` a `createBareMeal(UUID owner, LocalDate mealDate, String slot)`
      (uses the existing private `newMeal`, sets `mealDate`, saves — no items, no pantry FK) and
      `createBareMealCreatedAt(UUID owner, LocalDate mealDate, String slot, Instant createdAt)`
      which persists first and then forces `created_at` with a **native `UPDATE`** through the
      injected `EntityManager` (`@CreationTimestamp` + `updatable = false` means JPA cannot),
      followed by `em.clear()` so the next read sees the stored value.
- [x] Same-day rows in the window are then `createBareMealCreatedAt(owner, d, "lunch",
      d.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant())`; retro rows use the plain
      `createBareMeal`.
- [x] The IT covers: fires at exactly the threshold; silent just under it; silent under
      `min-meals`; silent with zero meals; `mealsLoggedToday` counts today's rows and today's
      rows never enter the ratio; a foreign user's meals are invisible (B-user rule).

### Task 3: the prompt fact — `batchLoggerBlock` on the window payload

- [x] Inject `RetroLoggingProbe` into `CompanionMessageGenerator`.
- [x] Package-private `String batchLoggerBlock(UUID userId, LocalDate date)` returning `""` when
      the probe is empty, else a Hungarian FACT block in the `hydrationBlock` shape:
      header `NAPLÓZÁSI SZOKÁS (tény — NE olvasd ki belőle, hogy ma nem evett)`, lines for the
      measured ratio (`retroPct` % of `totalMeals` meals in the last `windowDays` days written on
      a different day), today's state (`mealsLoggedToday` meals recorded so far today), and the
      explicit instruction: do not treat missing logs as missed eating; if it comes up at all, one
      neutral sentence ("amit naplózol, azt beszámolom"), never a reprimand or a demand.
- [x] Append it to `generateWindow`'s payload (right after `hydrationBlock`), for **both** kinds.
- [x] Add ONE rule line to `WINDOW_PROMPT`: if a `NAPLÓZÁSI SZOKÁS` block is present, the
      missing-log rule (3) must not be read as missed eating/activity — at most one neutral
      sentence, no reprimand, no demand.
- [x] Wrap the probe call in the generator in a try/catch that logs and returns `""` — a fact
      block must never take the window message down.
- [x] Write `CompanionMessageRetroLoggingIT` in the `...proactive.service` package (so it can call
      the package-private block directly, the `CompanionMessageHydrationIT` precedent): block
      carries the real numbers when the ratio holds; block empty for a same-day logger; block
      empty when there is too little data.
- [x] **Verify:** `-Dtest=CompanionMessageRetroLoggingIT` green.

### Task 4: gates, docs, CODEMAP

- [x] `./mvnw -q clean test -Dmezo.test.use-testcontainers=true -Dtest='RetroLogging*IT,CompanionMessage*IT,ArchitectureTest'`
      — green, and the `Tests run` count is non-zero for each.
- [x] `docs/features/proactive.md`: new §5.15 in the S2 (§5.14) shape — what the probe measures,
      why today is excluded, why both windows get it (flagged as a spec widening), the
      counter-instruction, and the fixture note. Bump `updated:`.
- [x] `node scripts/gen-codemap.mjs` and `node scripts/lint-docs.mjs` — both clean.
- [x] Commit with `(mezo-d58h.7.3)` + trailer.

### Task 5: ship it through the CI gate

- [ ] `git push -u origin feat/proactive-round2-s3-retro-logging`; `gh pr create` (body: commits,
      gate output, deviations); wait for CI green; `gh workflow run premerge.yml -f pr=<n>`;
      `git pull --rebase` on main, merge `--no-ff`, push, delete the branch.
- [ ] `bd close mezo-d58h.7.3`; `node scripts/check-beads-backup.mjs --fix` and commit.

---

## Self-review notes

- The one real design risk is prompt regression: the block only helps if the counter-instruction
  outranks the existing "say what is missing" rule. Task 3 makes that explicit in both places
  (block text *and* `WINDOW_PROMPT`), which is the only lever available without rewriting the
  midday branch.
- The fixture trick (native `UPDATE` on `created_at`) is confined to the populator and documented
  there; nothing in production code exists to make the probe testable.
