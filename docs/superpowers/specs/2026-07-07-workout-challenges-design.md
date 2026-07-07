# Workout Challenges — Design Spec (make live)

> **Status:** APPROVED (design + visual direction confirmed 2026-07-07) — ready for the implementation plan.
> **Driving bd:** `mezo-hbwi` · Builds on the proactive P2 (N=1 experiments) template.
> **Date:** 2026-07-07.

## 1. Summary

The companion proposes **per-exercise micro-challenges** inside a workout — a PR attempt, an
extra-depth set, or an extra volume set on a specific exercise. The user **accepts with one tap
(L2)**; the system tracks the accepted challenge and, after the workout, **evaluates hit/miss
deterministically from the logged sets**. Today this is a **mock-only** surface
(`ChallengesCarousel` + `ChallengeCard` in `features/train`, empty in real mode); this makes it live.

It is the **workout-scoped sibling of the P2 N=1 experiments**: same proactive L2 idiom
(pattern/history-grounded proposal → L2 decision → deterministic outcome → un-ghost), but with two
differences that reshape the design:

1. **Set-level, structured evaluation.** A challenge is judged from `exercise_set` rows
   (`weightKg`/`reps`/`rir`/`setIndex`/`skipped`), not a daily metric window. This forces
   **structured, code-evaluable targets** (not free prose) and a **new `ChallengeOutcomeEvaluator`**
   (the shared `MetricWindowEvaluator` does not apply).
2. **Planned-session + day bound, not standing.** A challenge belongs to one *planned* workout
   session (the template day) on one date, targeting one exercise. It is generated **lazily when the
   workout-prep screen is read** (before "Kezdjük el"), preserving the current pre-start UX.

**Key enabling fact (verified in `WorkoutService`):** starting a workout does **not** copy exercises
into the instance. Instance sessions carry only `templateSessionId`; `logSet` attaches each
`exercise_set` **directly to the template exercise** (`exercise.workout_session_id == templateSessionId`,
`WorkoutService.java:204`) with `workoutSessionId = instance.id`. So a challenge that stores the
**template exercise id** needs **no template→instance mapping** at evaluation — the logged sets already
FK to that exact exercise. This is what makes pre-start generation and clean set-level evaluation
coexist.

## 2. Decisions (this spec)

| # | Decision | Rationale |
|---|---|---|
| **a** | **Backend in `feature/proactive`** (`/api/proactive/challenge`). FE hook in `data/train/challengeHooks.ts` (consumed by `ActiveWorkoutPage`). | The experiments precedent: all "companion speaks first" surfaces live in proactive; generation uses `CompanionLlm`. The briefing precedent puts the FE hook in the consuming feature's data folder. proactive→train dependency already exists (`MetricWindowEvaluator` reads `WorkoutSessionRepository`). |
| **b** | **Identity = (`created_by`, `template_session_id`, `workout_date`); target = the template `exercise_id`.** Generated **lazily on the prep-read** (`GET …/challenge?templateSessionId=&date=`), for `date == today` only. **No generation cron.** | Preserves the pre-start UX (challenges visible before "Kezdjük el", as the mock shows). Because exercises live on the template and logged sets FK back to them, evaluation needs no instance mapping. `workout_date` scopes a re-used weekly template to one day. |
| **c** | **Type catalog v1 = `PR` / `Depth` / `Volume`. `Tempo` deferred.** | No tempo is logged (`exercise_set` has no tempo field) ⇒ Tempo cannot be evaluated deterministically. The P1 metric-catalog precedent: ship only what you can honestly evaluate. |
| **d** | **Structured targets** on the entity (`target_weight_kg?`, `target_reps?`, `target_sets?`, `target_rir?`); the display string is derived. | Deterministic eval needs typed numbers; free prose (`"107.5 kg × 8"`) is unparseable. |
| **e** | **Confidence: pattern-copied or null → "tanulom".** No fabricated `confidence`. | The P1/experiment honest-numbers rule. The mock's `0.72` is demo fiction and is removed. *(Visual-approved.)* |
| **f** | **`refs`: code-collected candidates, model-selected by index.** `tools`: **hidden in live, kept in mock.** | Briefing/memoir ref rule (model can never invent a ref). The `tools` chips are fabricated transparency theatre = false affordance ⇒ hidden in live, per the W1/W2 lesson. *(Visual-approved.)* |
| **g** | **Lifecycle:** `proposed` →(accept)→ `accepted` or →(dismiss)→ `dismissed`; `accepted` →(outcome eval, workout done)→ `hit` / `miss` / `inconclusive`. Outcome chips: **✓ Megerősítve / ◯ Nem igazolódott / ◌ Nem értékelhető** (consistent with the experiments tab). | Mirrors the experiment lifecycle at set granularity. `inconclusive` (= `outcome_good null`) is the honest "target exercise had no logged sets" state — never a fabricated miss. *(Visual-approved.)* |
| **h** | **Grounding gate = the exercise's set history** (last-week set, PR history), optionally a CONFIRMED pattern. No history for an exercise ⇒ no challenge for it. | Honest absence, the emptiness-gate precedent. A PR target with no prior sets is fabrication. |

## 3. Data model

New table `challenge` (proactive-owned; UUID PK, `created_by`, soft-delete):

```sql
create table challenge (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    template_session_id uuid         not null,  -- the planned session (template day) this is for
    workout_date       date          not null,  -- the day it applies to (scopes a weekly template)
    exercise_id        uuid          not null,  -- the TEMPLATE exercise the challenge targets
    exercise_name      varchar(120)  not null,  -- denormalized at generation (card render, no join)
    type               varchar(10)   not null,  -- PR | Depth | Volume  (CHECK)
    status             varchar(12)   not null default 'proposed', -- proposed|accepted|dismissed|hit|miss|inconclusive (CHECK)
    risk               varchar(4)    not null default 'low',  -- low | mid  (CHECK) — qualitative, not a fabricated number
    title              varchar(120)  not null,
    why                text          not null,
    glory              varchar(200)  not null,
    -- structured, code-evaluable target (subset used per type)
    target_weight_kg   numeric(6,2),
    target_reps        integer,
    target_sets        integer,
    target_rir         integer,
    confidence         numeric(4,3),             -- NULLABLE: pattern-copied or null ("tanulom")
    refs               jsonb         not null default '[]',  -- typed envelope: [{kind,label}]
    outcome            text,                     -- code-formatted, set once evaluated
    outcome_good       boolean,                  -- null = inconclusive (no logged sets)
    generated_at       timestamptz   not null,
    constraint pk_challenge_id primary key (id),
    constraint fk_challenge_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_challenge_template_session foreign key (template_session_id) references workout_session (id) on delete cascade,
    constraint fk_challenge_exercise foreign key (exercise_id) references exercise (id) on delete cascade,
    constraint ck_challenge_type check (type in ('PR','Depth','Volume')),
    constraint ck_challenge_status check (status in ('proposed','accepted','dismissed','hit','miss','inconclusive'))
);
create index idx_challenge_session_date on challenge (created_by, template_session_id, workout_date) where is_deleted = false;
```

- `refs` is a **typed jsonb envelope** (`ChallengeRefsEnvelope{List<Ref(kind,label)>}`), the memoir
  `anchors` precedent.
- Identity is **not** a unique index (several challenges per session/day); the generator's idempotence
  probe is "does (created_by, template_session_id, workout_date) already have any live row?".

## 4. Generation (`ChallengeGenerator`, proactive service, smart tier)

Lazy, on the prep-read, for today's planned session — mirrors `ExperimentProposalGenerator` scoped to
one session/day:

```
generate(userId, templateSessionId, date):
  0. date != today ⇒ return []                                 (past/future days never generate)
  1. existing live challenges for (userId, templateSessionId, date)? ⇒ return them (idempotent, NO LLM call)
  2. gather(userId, templateSessionId)                          PURE CODE, LLM-free
       exercises = template exercises for this session (ordered)
       per exercise: last-week set + PR history + volume-vs-plan  (the eval inputs)
       drop exercises with no history                            (grounding gate — decision h)
       none left ⇒ return []                                     (honest absence)
       payload = snapshot(today) + facts + patterns
               + "GYAKORLATOK" numbered list (index → {exercise, lastWeek, PR, plannedSets})
               + "KIHÍVÁS-TÍPUSOK: PR|Depth|Volume" + rules
       refCandidates = code-collected (PR row, last workout, pattern, meso-phase) per exercise
  3. companionLlm.completeSmart(CHALLENGE_MARKER prompt, payload)   ONE smart-tier call
  4. parse → per proposal: {exerciseIndex, type, targetWeightKg?, targetReps?, targetSets?,
                            targetRir?, why, glory, refIndexes[], patternIndex?}
  5. per proposal (bounds-checked exerciseIndex → template exercise):
       - validate type ∈ {PR,Depth,Volume} and the target fields REQUIRED by that type are present
         (PR needs weight+reps; Depth needs targetRir; Volume needs targetSets) else DROP
       - confidence = patternIndex bounds-checked → pattern.confidence, else null   (decision e)
       - refs = resolveRefs(refIndexes, refCandidates)  (model selects by index; never invented)
       - title/target display string derived in code from the structured fields
       - cap at max-per-workout (config, default 3)
       persist proposed rows (workout_date = date, template_session_id, exercise_id = template exercise)
```

- **Structured targets required** (decision d): a proposal missing its type's required fields is
  dropped (unevaluatable — the P1 "drop unvalidatable rows" precedent).
- **Fake sentinel:** `CHALLENGE_MARKER = "EDZES-KIHIVAS-FELADAT"` (literal-mirror rule, proactive.md §9
  gotcha a); GREEDY sentinel (nested payload), planted via a check-in note (the gather renders a
  snapshot).

## 5. Evaluation (`ChallengeOutcomeEvaluator` — NEW, set-level, LLM-free)

For each `accepted` challenge whose workout day has a **completed** (or past) instance:

```
evaluate(challenge):
  instance = the completed/active instance for (createdBy, templateSessionId, workout_date)   // by date
  if none / not yet done ⇒ leave untouched (still accepted)
  sets = exerciseSetRepository.findByWorkoutSessionIdAndExerciseId(instance.id, challenge.exerciseId)
  logged = sets where !skipped and reps != null
  if logged.isEmpty ⇒ status=inconclusive, outcome="Nem értékelhető — nem lett logolva.", outcome_good=null
  else switch type:
    PR     → hit if ∃ set: weightKg ≥ target_weight_kg AND reps ≥ target_reps
    Depth  → hit if lastLoggedSet.rir ≤ target_rir            (deeper = lower RIR)
    Volume → hit if logged.count ≥ target_sets
  status = hit ? 'hit' : 'miss'; outcome = code-formatted HU line (actual vs target); outcome_good = (status=='hit')
```

- **Only `accepted` challenges are evaluated** — a `proposed`/`dismissed` one never gets an outcome.
- **`inconclusive`** (decision g) is the honest "target exercise had no logged sets" state
  (`outcome_good null`), never a fabricated miss.
- **Trigger (no train→proactive coupling):** evaluate **lazily on the GET read** (when the session's
  instance is done — the recap/re-open resolves it immediately) **+ a daily backstop cron**
  (`ChallengeJob.runOutcome`) so outcomes resolve even if the user never re-opens. This mirrors the
  briefing "lazy + cron" hybrid and avoids `feature/train` calling into `feature/proactive`.
- Deterministic and LLM-free (the P1 validation / P2 outcome precedent).

## 6. Endpoints (`/api/proactive/challenge`, contract-first)

| Verb + path | Purpose | Notes |
|---|---|---|
| `GET /api/proactive/challenge?templateSessionId={id}&date={YYYY-MM-DD}` | The planned session's live challenges for that day (proposed/accepted/hit/miss/inconclusive; dismissed excluded). | Lazily **generates** when none exist and `date == today`; lazily **evaluates** accepted ones when the instance is done. `200 []` = honest empty (never 404) — the P1 list precedent. Owner-scoped. |
| `POST /api/proactive/challenge/{id}/decision` `{decision: accept\|dismiss}` | L2 accept/dismiss a proposed challenge. | fetch-owned-or-404 → **proposed-state guard (409 `PROACTIVE_CHALLENGE_NOT_PROPOSED`)** → accept sets `accepted`, dismiss sets `dismissed`. The `PatternService.decide` / experiment-decision idiom. `decision` `@Pattern ^(accept\|dismiss)$` ⇒ 400 on garbage. |

No `propose` endpoint (unlike experiments): challenges are generated implicitly by the prep-read GET;
there is no "+ propose more" affordance in the workout UI. Only one cron (`ChallengeJob.runOutcome`,
daily) behind `CHALLENGE_JOB_SWITCH` — outcome backstop only, no propose cron.

## 7. Frontend

- **`data/train/challengeHooks.ts`** — `useChallenges(templateSessionId | null, date)` (dual-mode:
  mock → seed from `train.ts`; real → `GET …/challenge?templateSessionId=&date=`, `[]`→[], disabled
  until a `templateSessionId` exists) + `useChallengeActions()` (`useMutation` accept/dismiss,
  invalidates `['challenges', templateSessionId, date]`; mock = local cache toggle for Phase-1
  parity). Barrel export from `data/hooks.ts`.
- **`ActiveWorkoutPage`** — feed `useChallenges(todaySession.templateSessionId, localToday)` into
  `W.challenges`; replace the local `acceptedChallenges` state with the real accept/dismiss mutation
  in live mode (mock keeps the local toggle for byte-parity). The carousel + card render unchanged
  except:
  - `ChallengeCard` confidence line → **"tanulom"** when `confidence == null` (the predictions
    precedent), else `conf {n}%`.
  - `tools` chips **hidden in live** (mock keeps them) — decision f.
  - completed challenges render the outcome chip + line (§5 states) — the carousel shows resolved
    challenges when the session is done (secondary surface; the primary is propose→accept).
- **`data/types.ts`** — extend `Challenge`: `confidence?: number | null`, `status: ChallengeStatus`,
  structured target fields optional, `outcome?`, `outcomeGood?`; keep the mock seed compiling.

## 8. Honest-numbers & guardrails

- No fabricated `confidence` (decision e); no fabricated `refs` (model selects by index);
  `tools` hidden in live (decision f).
- Structured targets ⇒ the displayed target is always backed by a code-evaluable number.
- Emptiness gates: no exercise history ⇒ no challenge; no logged sets ⇒ `inconclusive`, never a miss.
- No med-dose / clinical suggestions in the prompt (the companion guardrail).

## 9. Testing (integration-first)

- `ChallengePersistenceIT` — round-trip a proposed row (null targets where N/A, null confidence);
  status/type CHECK rejects; `(created_by, template_session_id, workout_date)` finder is owner-scoped.
- `ChallengeGeneratorIT` (`companion-fake`) — gather composes exercises+candidates; grounding gate
  (exercise with no history dropped); proposal persists structured rows; a proposal missing its
  type's required target fields is dropped; cap at max-per-workout; `date != today` ⇒ [].
- `ChallengeOutcomeEvaluatorIT` — PR hit/miss from set data; Depth via last-set RIR; Volume via
  count; no logged sets ⇒ inconclusive (outcome_good null); instance not done ⇒ untouched.
- `ProactiveApiChallengeIT` — GET lazily proposes for today's session; accept → 200 accepted;
  second decide → 409; dismiss → 200 + excluded from next GET; GET after a done instance resolves
  outcomes; 401.
- `ProactiveApiSwitchOffIT` (+) — GET + decision 404 when proactive off; `ChallengeJobSwitchOffIT`.
- FE: `challengeHooks.test.tsx` (dual-mode map, [] default, mock seed, accept invalidates);
  `ActiveWorkoutPage` real describe (proposed → Vállaljuk posts accept; "tanulom" on null confidence;
  tools hidden in live).

## 10. Out of scope (v1)

- `Tempo` challenges (no tempo logging) — deferred until a tempo signal exists.
- Any "propose more" affordance / a challenges history archive.
- Cross-workout streaks / glory ledger (the `glory` string is display-only).
- A dedicated post-workout recap surface for outcomes (they render in the existing carousel when
  the session is done).

## 11. Resolved forks

All three brainstorm forks are settled:

1. **Package** → `feature/proactive` backend, FE hook in `data/train`.
2. **Identity + trigger** → **(template_session + date)-bound, lazy on prep-read** (option B) —
   preserves the pre-start UX; clean eval because sets FK to the template exercise (no mapping).
3. **`tools` chips** → hidden in live, kept in mock. Plus visual-approved: outcome chips
   (✓/◯/◌ consistent with experiments), `tanulom` on null confidence.
