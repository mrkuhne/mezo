# Lifegoal kontraktus- és hibakezelés-kör (mezo-iwoc + mezo-iizd.8 + mezo-iizd.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the silent 400 on AI-proposed target pillars (proposer fills the missing rule
fields), make wizard save errors visible, and clear the deferred lifegoal engine/job/slice-1
minors — one branch, one PR, one contract regeneration.

**Architecture:** Backend fixes live in `feature/lifegoal` (propose service, scorer, progress
service, lifecycle); frontend fixes in `data/lifegoal` + `features/me`. Three issues touch
`api/feature/lifegoal/lifegoal.yml`, so contract edits are batched up front.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven (backend), React 19 + Vite + vitest (frontend),
OpenAPI contract-first (`api/`).

## Global Constraints

- **Worktree:** `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081`
  — NEVER cd into the primary repo. Bash cwd persists between calls → absolute paths everywhere.
- **Branch:** `feat/lifegoal-kontraktus` (already created from origin/main a5228a6ff).
- **Commit subjects:** conventional, driving id per issue: `(mezo-iwoc)` for tasks 3–4,
  `(mezo-iizd.8)` for tasks 2, 5–8, `(mezo-iizd.3)` for tasks 1, 9–10. End commit messages with
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Backend tests:** `cd <worktree>/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='...'`
  — `clean` + the testcontainers flag are MANDATORY. ArchUnit separately: `-Dtest='*Arch*Test'`.
  Never touch the archunit freeze store.
- **FE tests:** ALWAYS twice, separate commands, explicit mode, `--`:
  `cd <worktree>/frontend && VITE_USE_MOCK=true pnpm test -- --run <files>` then
  `VITE_USE_MOCK=false pnpm test -- --run <files>`. Add `--maxWorkers=2` (shared machine).
- **No `pnpm lint` script.** Type/dead-code gate: `cd <worktree>/frontend && pnpm build`.
- **Contract regen:** `cd <worktree>/api/generate && npm run generate:api` then
  `cd <worktree>/frontend && pnpm generate:api`. Backend Java types regen in `./mvnw` runs.
- **Visual goldens:** only if a test fails on them. Before `pnpm test:visual`, check
  `lsof -i :4318 -sTCP:LISTEN` (another worktree's server = false goldens). Commit only affected
  `*-darwin.png`; linux via `gh workflow run update-visual-baselines.yml -r feat/lifegoal-kontraktus`.
- **House refs to read before coding:** backend → `docs/references/error_handling.md`,
  `spring_patterns.md`, `testing_standards.md`, `integration_test_framework.md`,
  `api_contract_conventions.md`; frontend → `docs/references/frontend_conventions.md`.
- **No mocks in backend integration tests.** AssertJ only. `test{Method}_should{Result}_when{Condition}`.
- Design 2.0 for any UI: clay SVG icons, never emoji; honest loading/empty/error triad.

**Verified context (don't re-derive):**
- The global mutation error toast EXISTS since 2026-07-03 (`frontend/src/app/providers/QueryProvider.tsx:11-20`,
  MutationCache onError → `Mentés sikertelen` toast). So a wizard 400 is not 100% silent today —
  the gap is: no inline error state, and `save(true)` navigates before/regardless of `changeStatus`.
- `LifeGoalProposeRequest` already carries `targetDate` (lifegoal.yml:259) and the wizard sends it
  (`CelWizardPage.tsx:54`). `PillarRule` already has startDate/targetDate/direction (yml:169-171).
  **No contract change is needed for mezo-iwoc.**
- `LifeGoalProperties.maxPillars` pin-comment (mezo-iizd.3 item 9) is ALREADY done
  (`LifeGoalProperties.java:14-24`) — nothing to do.
- The outer per-user catch javadoc (mezo-iizd.8 item) is ALREADY done (`LifeGoalEvalJob.java:22-26`).
- Fragments missing 401 declarations: `lifegoal`, `admin`, `gamification`, `llm-usage`, `needs`
  (all 33 others declare the standard line; pattern in `api/feature/goal/goal.yml:18`).
- `FakeCompanionLlm` supports scripting the propose answer via `LIFEGOAL_PROPOSE_SENTINEL` planted
  in `whyText` (see `LifeGoalProposeIT.java` header comment).

---

### Task 1: Contract — 401 normalization across fragments (mezo-iizd.3 item 1)

**Files:**
- Modify: `api/feature/lifegoal/lifegoal.yml` (every operation)
- Modify: `api/feature/admin/*.yml`, `api/feature/gamification/*.yml`, `api/feature/llm-usage/*.yml`,
  `api/feature/needs/*.yml` (every authenticated operation)
- Regenerated: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`, backend generated sources

**Interfaces:** none new — response declarations only; generated types gain no new fields.

- [ ] **Step 1: Survey the exceptions.** Read `api/feature/auth/auth.yml` and note which endpoints
  are unauthenticated (login/register/invite-redeem style) — those must NOT get a 401. Check
  whether `admin` endpoints use bearer auth (look at `backend/.../feature/admin` controller
  security or `security_conventions.md`); if any endpoint is genuinely tokenless, skip it and note
  it in the commit body.
- [ ] **Step 2: Add the standard 401 line** to every operation in the five missing fragments,
  matching the house pattern exactly (same indentation style as the file):

```yaml
        '401': { description: Missing/invalid token, content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

  In `lifegoal.yml` that is all 11 operations (list/create, signals, propose, get/put/delete,
  status, pillars, today, progress, evaluate). Keep the response order: 200/201 → 400 → 401 → 404 → 409.
- [ ] **Step 3: Verify no partial gaps remain elsewhere.** Run a quick audit and fix any operation
  in ANY fragment that lacks 401 (excluding the Step-1 exceptions):

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/api/feature && for f in */*.yml; do ops=$(grep -c 'operationId' "$f"); f401=$(grep -c "'401'" "$f"); echo "$f ops=$ops 401s=$f401"; done
```

  (Counts need not match 1:1 where an unauthenticated endpoint exists — judge per file.)
- [ ] **Step 4: Regenerate.**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/api/generate && npm run generate:api
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/frontend && pnpm generate:api
```

- [ ] **Step 5: FE type gate:** `cd <worktree>/frontend && pnpm build` — must pass (401 additions
  are response-only; a failure means a YAML syntax slip).
- [ ] **Step 6: Commit** — `fix(api): declare 401 on every authenticated operation across fragments (mezo-iizd.3)`
  (include `api/openapi.yml` + `api.gen.ts`).

### Task 2: Contract — progress `from>to` 400 (mezo-iizd.8)

**Files:**
- Modify: `api/feature/lifegoal/lifegoal.yml` (`/api/life-goals/{id}/progress` GET responses)
- Regenerated: same as Task 1

**Interfaces:** none — documents behavior that `LifeGoalProgressService.progress` already has
(`VALIDATION_INVALID_VALUE` on field `to`, LifeGoalProgressService.java:77-80).

- [ ] **Step 1: Add the 400** to the progress GET (before 401/404):

```yaml
        '400': { description: from after to (VALIDATION_INVALID_VALUE), content: { application/json: { schema: { $ref: '#/components/schemas/SystemMessageList' } } } }
```

- [ ] **Step 2: Regenerate** (same two commands as Task 1 Step 4).
- [ ] **Step 3: Confirm the behavior is IT-covered.** Grep `LifeGoalProgressApiIT` for a
  `from`-after-`to` test; if absent, add one using the `ApiIntegrationTest` HTTP helpers
  (`ownerAuthHeaders()`, SystemMessage assert on `VALIDATION_INVALID_VALUE`), run it:

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/mace-auto-approval-295081/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalProgressApiIT'
```

- [ ] **Step 4: Commit** — `fix(api): declare the progress from>to 400 in the lifegoal contract (mezo-iizd.8)`.

### Task 3: Backend — proposer fills the target pillar's pace line (mezo-iwoc a)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/service/LifeGoalProposeService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalProposeIT.java`

**Interfaces:**
- Consumes: `LifeGoalProposeRequest.getTargetDate()` (already in the DTO), `PillarRule` builder
  fields `startDate`/`targetDate`/`direction` (already generated).
- Produces: propose responses whose `target`-kind pillars always satisfy
  `LifeGoalPillarService.requireRuleShape` — later tasks rely on "a propose response is always
  savable verbatim".

**Design (decided, do not revisit):** the proposer FILLS the fields, does not ban the kind.
`startDate` = today; `targetDate` = the request's goal deadline; `direction` derived
(`targetValue > startValue` ⇒ `up`, else `down`). A target pillar is DROPPED when the request has
no `targetDate`, when `targetDate` is not after today (the scorer's pace line needs `total > 0`),
or when the LLM left `startValue`/`targetValue` null. And because dropping can now empty an AI
proposal, the ai/template decision must move AFTER the mapping (the existing kind-whitelist filter
had the same latent hole: an all-filtered AI answer currently returns `source=ai` with zero
pillars and strands wizard step 3).

- [ ] **Step 1: Write the failing tests** in `LifeGoalProposeIT` (follow the file's existing
  sentinel-scripting idiom — the scripted JSON rides in `whyText`; copy an existing test's request
  plumbing). Three tests:

```java
@Test
void testPropose_shouldFillTargetRulePaceLine_whenRequestHasTargetDate() {
    // script: one target pillar on activity_financial (startValue 0, targetValue 50000)
    // + one habit pillar so the proposal stays non-empty either way
    // request: targetDate = LocalDate.now().plusMonths(3)
    // assert: response source == ai; the target pillar's rule has
    //   startDate == LocalDate.now(), targetDate == the request's date, direction == UP,
    //   startValue/targetValue echoed
    // then: POST /api/life-goals with the response pillars verbatim → 201 (the real point)
}

@Test
void testPropose_shouldDropTargetPillar_whenRequestHasNoTargetDate() {
    // same script, request WITHOUT targetDate
    // assert: 200, no pillar with kind target in the response; the habit pillar survives; source == ai
}

@Test
void testPropose_shouldFallBackToTemplate_whenEveryAiPillarIsDropped() {
    // script: ONLY a target pillar, request without targetDate
    // assert: 200, source == template, pillars non-empty (never an empty-pillared ai response)
}
```

  Also assert direction derivation `down`: in the first test add a second scripted target pillar
  with startValue 90 / targetValue 80 → `direction == DOWN`.
- [ ] **Step 2: Run to verify they fail:**
  `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalProposeIT'`
  (from `<worktree>/backend`). Expected: new tests fail on missing rule fields / source=ai with
  empty pillars.
- [ ] **Step 3: Implement** in `LifeGoalProposeService`:

```java
public LifeGoalProposeResponse propose(UUID userId, LifeGoalProposeRequest req) {
    Set<String> skills = new HashSet<>(ProgressionTaxonomy.LIFE);
    skills.addAll(ProgressionTaxonomy.ATHLETIC);
    LifeGoalProposePort p = port.getIfAvailable();
    Optional<Proposal> ai = p == null ? Optional.empty()
        : p.propose(userId, req.getTitle(), req.getWhyText(), catalog.promptText(), skills);
    // The ai/template decision happens AFTER mapping: the per-pillar filters below (kind
    // whitelist, undated target drop) can empty an AI answer, and an ai-sourced response with
    // zero pillars would strand wizard step 3 (canNext needs one active pillar).
    if (ai.isPresent()) {
        LifeGoalProposeResponse aiResponse = toResponse(ai.get(), "ai", req.getTargetDate());
        if (!aiResponse.getPillars().isEmpty()) {
            return aiResponse;
        }
    }
    return toResponse(template.propose(req.getTitle(), req.getWhyText()), "template", req.getTargetDate());
}
```

  In `toResponse(Proposal p, String source, LocalDate goalTargetDate)`'s pillar stream, after the
  existing `kinds()` filter add:

```java
// A target pillar without a deadline has no pace line — requireRuleShape would 400 the save,
// so an undated (or already-due) target proposal is dropped rather than emitted unsavable.
.filter(x -> !"target".equals(x.kind())
    || (x.startValue() != null && x.targetValue() != null
        && goalTargetDate != null && goalTargetDate.isAfter(LocalDate.now())))
```

  and in the `PillarRule.builder()` chain replace the two rule lines:

```java
.startDate("target".equals(x.kind()) ? LocalDate.now() : null)
.targetDate("target".equals(x.kind()) ? goalTargetDate : null)
.direction(directionFor(x))
```

  with the helper (keeps the baseline default):

```java
/** target: derived from the pace (target > start ⇒ up); baseline: the fixtures' up default. */
private static PillarRule.DirectionEnum directionFor(PillarProposal x) {
    if ("target".equals(x.kind())) {
        return x.targetValue().compareTo(x.startValue()) > 0
            ? PillarRule.DirectionEnum.UP : PillarRule.DirectionEnum.DOWN;
    }
    return "baseline".equals(x.kind()) ? PillarRule.DirectionEnum.UP : null;
}
```

  (import `java.time.LocalDate` and `io.mrkuhne.mezo.feature.companion.LifeGoalProposePort.PillarProposal`).
- [ ] **Step 4: Run the tests to green:** same command; then the neighbors:
  `-Dtest='LifeGoalProposeIT,LifeGoalApiIT,LifeGoalPillarApiIT'`.
- [ ] **Step 5: Commit** — `fix(be): proposer fills the target pillar pace line; undated targets are dropped, an emptied AI proposal falls back to template (mezo-iwoc)`.

### Task 4: Frontend — wizard save errors are visible (mezo-iwoc b)

**Files:**
- Modify: `frontend/src/data/lifegoal/lifegoalHooks.ts` (create/changeStatus wrappers)
- Modify: `frontend/src/features/me/pages/CelWizardPage.tsx`
- Test: `frontend/src/features/me/pages/CelWizardPage.test.tsx`

**Interfaces:**
- Produces: `create(req, opts?: { onSuccess?, onError? })` and
  `changeStatus(id, status, opts?: { onSuccess?, onError? })` on `useLifeGoalMutations` —
  additive, existing callers unchanged.

**Design (decided):** the global MutationCache toast already fires on failure; this task adds the
wizard's own inline error state (house triad) and fixes the blind navigation. Create failure →
stay on step 4 with an error card (retrying re-uses the same draft; nothing is lost). Create
success + activation failure → STILL navigate to the goal detail (the goal exists as draft;
staying would make a retry create a duplicate — the toast + the detail page's draft state tell
the truth). Other lifegoal mutation callers keep the toast-only behavior (verified acceptable:
they don't navigate on assumption of success).

- [ ] **Step 1: Write the failing tests** in `CelWizardPage.test.tsx` (follow the file's existing
  wizard-walk helpers/MSW idiom; real mode scripts MSW, mock mode can be made to fail via a >5
  pillar draft after Task 10 — for THIS task script the real-mode MSW handler):

```tsx
test('a failed create keeps the wizard on the summary with an inline error card', async () => {
  // MSW: POST /api/life-goals → 400 SystemMessageList (LIFE_GOAL_INVALID_RULE)
  // walk to step 4, click 'Mentés tervezettként'
  // assert: screen shows 'Nem sikerült elmenteni' card; navigation did NOT happen;
  //         clicking the save button again re-fires the request (retry works)
})

test('activation failure after a successful create still lands on the goal detail', async () => {
  // MSW: POST /api/life-goals → 201; POST /:id/status → 409
  // click 'Aktiválás'; assert navigate(`/me/goals/<id>`) happened (spy on useNavigate or assert route)
})
```

- [ ] **Step 2: Run to verify failure:**
  `cd <worktree>/frontend && VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelWizardPage.test.tsx`
- [ ] **Step 3: Implement.** In `lifegoalHooks.ts` return block:

```ts
create: useCallback((req: LifeGoalUpsertRequest, opts?: { onSuccess?: (g: LifeGoalResponse) => void; onError?: () => void }) =>
  create.mutate(req, { onSuccess: opts?.onSuccess, onError: opts?.onError }), [create]),
changeStatus: useCallback((id: string, status: LifeGoalStatus, opts?: { onSuccess?: () => void; onError?: () => void }) =>
  changeStatus.mutate({ id, status }, { onSuccess: opts?.onSuccess, onError: opts?.onError }), [changeStatus]),
```

  In `CelWizardPage.tsx`: add `const [saveFailed, setSaveFailed] = useState(false)`; rewrite `save`:

```tsx
const save = (activate: boolean) => {
  setSaveFailed(false)
  create({
    /* unchanged request body */
  }, {
    onSuccess: (g) => {
      if (!activate) { navigate('/me/goals'); return }
      // Aktiválás-bukás után is a cél-oldalra megyünk: a cél már létezik draftként, a
      // varázslóban maradva egy újrapróba DUPLIKÁLNÁ; a globális toast + a draft állapot mondja el.
      changeStatus(g.id, 'active', {
        onSuccess: () => navigate(`/me/goals/${g.id}`),
        onError: () => navigate(`/me/goals/${g.id}`),
      })
    },
    onError: () => setSaveFailed(true),
  })
}
```

  Render on step 4, above the button row (reuse the step-1 error card idiom, `lg-fcard`):

```tsx
{step === 4 && saveFailed && (
  <div className="lg-fcard">
    <span className="lg-flabel">Nem sikerült elmenteni</span>
    <div style={{ fontSize: 12.5, fontWeight: 300 }}>A cél nem veszett el — próbáld újra, vagy nézd át a pilléreket.</div>
  </div>
)}
```

- [ ] **Step 4: Run both modes:**
  `VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelWizardPage.test.tsx src/data/lifegoal/lifegoalHooks.test.tsx`
  then the same with `VITE_USE_MOCK=true`.
- [ ] **Step 5: Commit** — `fix(fe): wizard save failures render an inline error card; activation failure still lands on the created goal (mezo-iwoc)`.

### Task 5: Backend — scorer fixes: target clamp + linked maintenance band (mezo-iizd.8)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/lifegoal/engine/LifeGoalScorer.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine/LifeGoalScorerTest.java`

**Interfaces:** pure static scorer; no signature change.

- [ ] **Step 1: Failing unit tests** (plain JUnit + AssertJ, no Spring — match the file's style):

```java
@Test
void testScoreTarget_shouldClampExpectedAtTargetValue_whenDayIsPastTargetDate() {
    // rule: start 0 → target 100 over 10 days, direction up; day = startDate + 20
    // value 100 on that day → expected must be 100 (not 200) → status hit
}

@Test
void testScoreTarget_shouldClampExpectedAtStartValue_whenDayIsBeforeStartDate() {
    // day = startDate - 5, value = startValue → expected == startValue → hit (not below-start extrapolation)
}

@Test
void testScoreLinked_shouldUseSymmetricBand_whenTargetLineIsFlat() {
    // targets: two days, SAME value (maintenance goal); trend = expected + 0.5 (outside ±0.3) → partial
    // and trend = expected + 0.2 → hit; and trend = expected - 0.5 → partial (today's code would call this hit)
}
```

- [ ] **Step 2: Verify they fail:**
  `cd <worktree>/backend && ./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalScorerTest'`
- [ ] **Step 3: Implement.** In `scoreTarget` replace the `elapsed` line:

```java
// Clamp to the pace line's ends: past targetDate the expectation stays the target value
// (otherwise an achieved goal decays into an eternal miss as the line extrapolates), and
// before startDate it stays the start value.
long elapsed = Math.clamp(ChronoUnit.DAYS.between(rule.startDate(), day), 0, total);
```

  In `scoreLinked`'s multi-target branch:

```java
int paceDirection = latestVal.compareTo(earliestVal);
if (paceDirection == 0) {
    // Maintenance line (target == start): both drifting up AND drifting down is off-plan,
    // so the single-point symmetric band applies, not the one-sided losing/gaining rule.
    hit = trend.subtract(expected).abs().compareTo(LINKED_TOLERANCE) <= 0;
} else {
    boolean losing = paceDirection < 0;
    hit = losing
        ? trend.compareTo(expected.add(LINKED_TOLERANCE)) <= 0
        : trend.compareTo(expected.subtract(LINKED_TOLERANCE)) >= 0;
}
```

- [ ] **Step 4: Green:** same command; then `-Dtest='LifeGoalScorerTest,SignalSourceIT,LifeGoalProgressApiIT'`.
- [ ] **Step 5: Commit** — `fix(be): scorer clamps the target pace line to its ends; flat linked line gets a symmetric band (mezo-iizd.8)`.

### Task 6: Backend — progress/eval/job minors (mezo-iizd.8)

**Files:**
- Modify: `backend/.../lifegoal/service/LifeGoalProgressService.java`
- Modify: `backend/.../lifegoal/service/LifeGoalEvalJob.java`
- Modify: `backend/.../lifegoal/service/LifeGoalTriggerService.java`
- Modify: `backend/.../lifegoal/service/LifeGoalSignalService.java`
- Modify: `backend/.../lifegoal/service/LifeGoalXpService.java` (javadoc only)
- Modify: `backend/.../lifegoal/entity/LifeGoalEntity.java` (new constant)
- Modify: `backend/.../lifegoal/engine/WeightGoalSignalSource.java`
- Modify: `backend/.../goal/repository/GoalRepository.java` (ordered finder, if absent)

**Interfaces:**
- Produces: `LifeGoalEntity.STATUS_ACTIVE` (`public static final String STATUS_ACTIVE = "active";`)
  — Task 9/10 do NOT depend on it, but any lifegoal code touched later should use it.
- Produces: `LifeGoalProgressService.evaluateDays(UUID userId, LifeGoalEntity goal, LocalDate today)`
  (existing two-arg method becomes a delegating overload — `LifeGoalEvalJob` keeps compiling).

Six independent minors, one commit:

- [ ] **Step 1: `STATUS_ACTIVE` constant.** Add to `LifeGoalEntity`:
  `public static final String STATUS_ACTIVE = "active";` and replace the `"active"` literals in
  `LifeGoalProgressService` (its private constant goes away; also the two inline literals in
  `today()` and `findConflicts`), `LifeGoalEvalJob.runEval`, `LifeGoalTriggerService`,
  `LifeGoalSignalService`. Do NOT touch `WeightGoalSignalSource.ACTIVE_STATUS` (that is the
  weight-goal `GoalEntity`'s status, a different table) nor `LifeGoalService.TRANSITIONS` keys.
- [ ] **Step 2: Wide stored-row load.** In `LifeGoalProgressService.compute`, the stored-rows
  query currently loads `[from, to]` while scoring `[wideFrom, to]` — computed values silently
  shadow stored verdicts in the warm-up window (arrow/goal-point inputs). Change to:

```java
: pillarDayRepository.findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(pillarIds, wideFrom, to)) {
```

- [ ] **Step 3: findConflicts hoist.** Prefetch the other goals' pillars once instead of N×M:

```java
Map<UUID, List<LifeGoalPillarEntity>> theirPillarsByGoal = new LinkedHashMap<>();
for (LifeGoalEntity other : otherActiveGoals) {
    theirPillarsByGoal.put(other.getId(), activePillars(other.getId()));
}
```

  before the `mine` loop; the inner loop reads `theirPillarsByGoal.get(other.getId())`.
- [ ] **Step 4: evaluate() clock unification.** Add the `today` parameter:

```java
@Transactional
public void evaluateDays(UUID userId, LifeGoalEntity goal) {
    evaluateDays(userId, goal, LocalDate.now());
}

@Transactional
public void evaluateDays(UUID userId, LifeGoalEntity goal, LocalDate today) {
    // body unchanged, minus its own LocalDate.now()
}
```

  and in `evaluate(...)`: capture `LocalDate today = LocalDate.now();` FIRST, pass it to
  `evaluateDays(userId, goal, today)` and reuse it for the window bounds (kills the
  midnight-crossing window skew; the duplicate `activePillars` query stays — it is one cheap read
  on the manual path only, and threading the list through would couple the writer to the reader).
- [ ] **Step 5: WeightGoal deterministic pick.** Check `GoalRepository` for an ordered
  status finder; add if absent:

```java
List<GoalEntity> findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy, String status);
```

  and in `WeightGoalSignalSource.window` use it + `active.get(0)` becomes the newest active goal
  (add a one-line comment: multiple actives → the newest one is the pace-line truth).
- [ ] **Step 6: `refIdFor` javadoc.** Document the decided ruling (documentation, not re-keying):

```java
/**
 * The D-1 XP idempotency key: {@code lifegoal:<pillarId>:<day>} hashed to a stable UUID.
 *
 * <p>Keyed on the pillar's row identity ON PURPOSE: it must survive the job's 3-day rewrite and
 * an in-place retune (mezo-iizd.2 keeps the UUID through edits). The accepted narrow leak: a
 * pillar DELETED and then re-created as an equivalent new row mints a new UUID, so up to the
 * last 3 hit-days can award XP twice (≤ 3 × xp-per-hit, feedback-only currency). Keying on
 * content (source+kind) instead would close that but break idempotency across a legitimate
 * source/kind edit, which drops and honestly re-evaluates history — the wrong trade.
 */
```

- [ ] **Step 7: Full lifegoal backend suite:**
  `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoal*,SignalSourceIT,WeightGoalSignalSourceIT'`
  and ArchUnit: `-Dtest='*Arch*Test'` (new repository method + constant moves).
- [ ] **Step 8: Commit** — `fix(be): lifegoal eval minors — shared active-status constant, wide stored-row window, conflict prefetch, clock unification, ordered weight-goal pick (mezo-iizd.8)`.

### Task 7: Backend — test gaps (mezo-iizd.8)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine/LifeGoalScorerTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/engine/WeightGoalSignalSourceIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalTodayApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalProgressApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalXpIT.java`

**Interfaces:** consumes Task 5's clamp/band semantics (write these AFTER Task 5).

- [ ] **Step 1: Scorer unit gaps** in `LifeGoalScorerTest`:

```java
@Test
void testScoreAverage_shouldReturnMiss_whenThresholdIsZeroAndAverageMisses() {
    // threshold=0, comparator=lte, avg=0.5 → the ±10% band around 0 is degenerate → miss, never partial
}

@Test
void testScoreAverage_shouldReturnPartial_whenAverageSitsExactlyOnTheTenPercentBoundary() {
    // threshold=10, comparator=gte, avg=9.0 → |9-10|/10 == 0.10 → partial (<= comparison)
}

@Test
void testArrow_shouldReturnInsufficient_whenOnlyFourDataDaysInShortWindow() {
    // 4 points in the last 7 days, plenty in the long window → insufficient (min is 5)
}
```

- [ ] **Step 2: Weight no-data branches** in `WeightGoalSignalSourceIT` (check what it already
  covers first; add the missing of): no active goal → empty window; active goal with
  `targetWeightKg == null` → empty window; active goal but empty EWMA series → empty window.
  Data via the existing goal/weight populators (`*Populator` factories, no mocks).
- [ ] **Step 3: Response-shape asserts.** In `LifeGoalTodayApiIT`: assert `pillarsTotal` equals
  the seeded active-pillar count on an existing happy-path test. In `LifeGoalProgressApiIT` (or
  `LifeGoalEvalJobIT`, whichever asserts stored rows): after an evaluate, assert the stored
  `life_goal_pillar_day` row's `computedAt` is non-null and recent (`isAfter(testStart)`).
- [ ] **Step 4: `partial` non-award branch** in `LifeGoalXpIT`: seed an ACTIVE goal with an
  `average`-kind pillar over a metric an existing populator can feed (e.g. `CHECKIN_ENERGY` via
  the checkin populator — verify with `docs/CODEMAP.md` which populators exist; sleep or checkin
  both work) such that yesterday's 7-day average lands within the 10% band on the miss side →
  scorer says `partial`; run the evaluate path; assert NO XP row was granted (the award seam is
  hit-only). If NO existing populator can produce the needed series without a new fixture class,
  do NOT build a MetricSeries populator in this round: instead add the javadoc note on
  `LifeGoalXpService.awardIfHit` ("partial non-award is unit-guarded by the scorer's status
  contract; IT pending a MetricSeries populator") and record the leftover for the close-out
  (Task 11 Step 3 collects it).
- [ ] **Step 5: Run:**
  `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoalScorerTest,WeightGoalSignalSourceIT,LifeGoalTodayApiIT,LifeGoalProgressApiIT,LifeGoalXpIT'`
- [ ] **Step 6: Commit** — `test(be): lifegoal gap coverage — zero-threshold band, band boundary, 4-day arrow, weight no-data, computedAt/pillarsTotal, partial non-award (mezo-iizd.8)`.

### Task 8: Frontend — dead evaluate client + PillarCard copy (mezo-iizd.8)

**Files:**
- Modify: `frontend/src/data/lifegoal/lifegoalApi.ts` (remove `evaluate`)
- Modify: `frontend/src/features/me/components/PillarCard.tsx:32` (copy, if the spec disagrees)

**Interfaces:** removal only; verified no consumer (`grep lifegoalApi.evaluate` finds none —
`goalHooks`/`slotTemplate` evaluates are different APIs). The backend endpoint STAYS (manual
evaluation is a real endpoint with ITs); only the unused FE client method goes.

- [ ] **Step 1: Remove** the `evaluate:` entry from `lifegoalApi`. Run
  `grep -rn "lifegoalApi.evaluate" frontend/src` → must be empty.
- [ ] **Step 2: PillarCard copy.** Read the base spec's wording for the missing-hit-days line
  (`docs/superpowers/specs/*lifegoal*` / `*permah*` — grep for `fordulás` or `hit`). The spec
  speaks in "hét" terms; today's copy is `még ${n} hit-nap a fordulásig`. If the spec's wording
  includes the week frame, change to `még ${n} hit-nap a héten a fordulásig` and update
  `CelPage.test.tsx:62-67`'s expectation; if the spec matches current copy, leave it and note that
  in the commit body.
- [ ] **Step 3: Gates:** `cd <worktree>/frontend && pnpm build`, then both-mode focused tests:
  `VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2 src/features/me/pages/CelPage.test.tsx src/data/lifegoal/lifegoalHooks.test.tsx`
  and the same with `VITE_USE_MOCK=false`.
- [ ] **Step 4: Commit** — `chore(fe): drop the consumerless lifegoal evaluate client; align PillarCard hit-day copy with the spec (mezo-iizd.8)`.

### Task 9: Backend — lifecycle + propose-port slice-1 items (mezo-iizd.3 items 5, 6, 7, 8)

**Files:**
- Modify: `backend/.../lifegoal/service/LifeGoalService.java` (changeStatus)
- Modify: `backend/.../techcore/configuration/FeaturesConfiguration.java:233` (javadoc)
- Modify: `backend/.../companion/LifeGoalProposePort.java` (signature)
- Modify: `backend/.../companion/llm/LifeGoalProposeLlmAdapter.java`
- Modify: `backend/.../lifegoal/catalog/SignalCatalog.java` (new `ids()`)
- Modify: `backend/.../lifegoal/service/LifeGoalProposeService.java` (call site)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/lifegoal/LifeGoalApiIT.java` (status tests live where the existing transition tests are — check, may be `LifeGoalApiIT`)

**Interfaces:**
- Produces: `LifeGoalProposePort.propose(UUID userId, String title, String whyText,
  String catalogText, Set<String> catalogIds, Set<String> skillKeys)` and
  `SignalCatalog.ids()` → `Set<String>`.

- [ ] **Step 1: Failing ITs** (add next to the existing transition tests):

```java
@Test
void testChangeStatus_shouldBeIdempotentNoOp_whenTargetEqualsCurrentStatus() {
    // seed an active goal; POST status {active} → 200, status stays active,
    // activatedAt UNCHANGED (assert equal to the pre-call value, not refreshed)
}

@Test
void testChangeStatus_shouldKeepCompletionDate_whenArchivingADoneGoal() {
    // active → done (closedAt set = T1); then done → archived; assert closedAt == T1
}
```

- [ ] **Step 2: Verify failure** (`-Dtest='LifeGoalApiIT'` or the file that hosts them).
- [ ] **Step 3: Implement `changeStatus`:**

```java
String to = target.getValue();
if (to.equals(g.getStatus())) {
    // Idempotent no-op: a same-status request re-affirms the state instead of 409-ing —
    // a double-tap or a replayed request must not read as an "illegal transition".
    return mapper.toResponse(g, pillarRepository.findByGoalIdAndDeletedFalseOrderByPositionAsc(id));
}
if (!TRANSITIONS.getOrDefault(g.getStatus(), Set.of()).contains(to)) { /* unchanged 409 */ }
g.setStatus(to);
if ("active".equals(to) && g.getActivatedAt() == null) g.setActivatedAt(Instant.now());
// done→archived keeps the completion date: closedAt is when the goal ENDED, not when it was tidied away.
if (("done".equals(to) || "archived".equals(to)) && g.getClosedAt() == null) g.setClosedAt(Instant.now());
```

- [ ] **Step 4: FeaturesConfiguration javadoc** (line 233) — make it literally true:

```java
/** Életcél-rendszer (bd mezo-iizd) — off ⇒ /api/life-goals 404s; the gated beans (controller,
 *  services, jobs, signal sources) are absent, while SignalCatalog, LifeGoalMapper and
 *  LifeGoalTemplateProposer remain as ungated, stateless components. */
```

- [ ] **Step 5: Port signature.** `SignalCatalog`:

```java
/** The legal catalog-id set — handed to the propose port so the adapter never re-derives it from prompt text. */
public Set<String> ids() {
    return ENTRIES.stream().map(SignalCatalogEntry::id).collect(Collectors.toUnmodifiableSet());
}
```

  `LifeGoalProposePort.propose` gains `Set<String> catalogIds` (between `catalogText` and
  `skillKeys`); `LifeGoalProposeService` passes `catalog.ids()`; in the adapter DELETE the
  `catalogText.lines()...` derivation block (and its comment) and use the parameter. Grep for
  other implementors/callers: `grep -rn "LifeGoalProposePort" backend/src` — update all.
- [ ] **Step 6: Run:** `-Dtest='LifeGoal*'` plus `-Dtest='*Arch*Test'`.
- [ ] **Step 7: Commit** — `fix(be): idempotent same-status transition, done→archived keeps closedAt, catalog ids through the propose port, honest switch javadoc (mezo-iizd.3)`.

### Task 10: Frontend — mock/real parity (mezo-iizd.3 items 2, 3, 4)

**Files:**
- Modify: `frontend/src/data/lifegoal/lifegoalHooks.ts` (mock arms)
- Modify: `frontend/src/data/lifegoal/lifegoalMock.ts` (seed order + id-keyed arrows)
- Test: `frontend/src/data/lifegoal/lifegoalHooks.test.tsx`

**Interfaces:** consumes Task 9's backend semantics (mirror them exactly). Mock validation errors
`throw new Error('<CODE>')` so the mutation rejects → global toast + the wizard's Task-4 error
card fire in mock mode too.

- [ ] **Step 1: Failing tests** in `lifegoalHooks.test.tsx` (mock-mode describe block):

```tsx
test('mock changeStatus rejects an illegal transition like the backend (draft → done)', ...)
test('mock changeStatus is a no-op for same-status (active → active), not an error', ...)
test('mock changeStatus keeps closedAt on done → archived', ...)
test('mock create rejects a 6th pillar (LIFE_GOAL_TOO_MANY_PILLARS)', ...)
test('mock create rejects a kind the catalog entry does not allow (kind=linked on sleep_duration)', ...)
test('mock update full-replaces: an omitted whyText/targetDate/obstacleText is cleared, frame defaults to unset', ...)
test('mock seed lists goals newest-first like the backend createdAt DESC ordering', ...)
```

- [ ] **Step 2: Verify failure** (mock mode command).
- [ ] **Step 3: Implement in `lifegoalHooks.ts`.** Top of file, mirror the backend table
  (comment: `// Mirrors LifeGoalService.TRANSITIONS — keep in sync.`):

```ts
const MOCK_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'archived'], active: ['parked', 'done', 'archived'],
  parked: ['active', 'done', 'archived'], done: ['archived'], archived: [],
}

// Mirrors LifeGoalPillarService.validate's cap + catalog/kind gate (habit-source pillars skip the
// catalog check there too). Skill validation is NOT mirrored — the FE has no taxonomy mirror, and
// inventing one here would drift; the real backend remains the authority.
function mockValidatePillars(pillars: LifeGoalPillarInput[] | undefined) {
  const list = pillars ?? []
  if (list.length > 5) throw new Error('LIFE_GOAL_TOO_MANY_PILLARS')
  for (const p of list) {
    if (p.source.type === 'habit') continue
    const entry = MOCK_SIGNAL_CATALOG.find((e) =>
      e.source.type === p.source.type && e.source.key === p.source.key
      && e.source.skillKey === p.source.skillKey && e.source.measure === p.source.measure
      && e.source.ring === p.source.ring)
    if (!entry) throw new Error('LIFE_GOAL_UNKNOWN_SIGNAL')
    if (!entry.kinds.includes(p.kind)) throw new Error('LIFE_GOAL_KIND_NOT_ALLOWED')
  }
}
```

  - `create` mock arm: call `mockValidatePillars(req.pillars)` first.
  - `replacePillars` mock arm: call `mockValidatePillars(v.pillars)` first.
  - `changeStatus` mock arm:

```ts
if (mock) {
  const cur = (qc.getQueryData<LifeGoalResponse[]>(LIFE_GOALS_KEY) ?? MOCK_LIFE_GOALS).find((g) => g.id === v.id)
  if (!cur) throw new Error('RESOURCE_NOT_FOUND')
  if (cur.status === v.status) return   // idempotent no-op, mirrors LifeGoalService
  if (!MOCK_TRANSITIONS[cur.status]?.includes(v.status)) throw new Error('LIFE_GOAL_INVALID_STATUS_TRANSITION')
  patch((l) => l.map((g) => (g.id === v.id ? { ...g, status: v.status,
    activatedAt: v.status === 'active' ? (g.activatedAt ?? new Date().toISOString()) : g.activatedAt,
    closedAt: (v.status === 'done' || v.status === 'archived') && !g.closedAt ? new Date().toISOString() : g.closedAt } : g)))
  return
}
```

  - `update` mock arm full-replace (mirror `LifeGoalService.apply` — absent optionals clear):

```ts
patch((l) => l.map((g) => (g.id !== v.id ? g : {
  id: g.id, status: g.status, pillars: g.pillars, activatedAt: g.activatedAt, closedAt: g.closedAt,
  title: v.req.title, whyText: v.req.whyText, frame: v.req.frame ?? 'unset',
  dimension: v.req.dimension, secondaryDimension: v.req.secondaryDimension,
  startDate: v.req.startDate, targetDate: v.req.targetDate, obstacleText: v.req.obstacleText,
  ifThenPlans: v.req.ifThenPlans ?? [],
})))
```

- [ ] **Step 4: Seed order** in `lifegoalMock.ts`: reorder `MOCK_LIFE_GOALS` to newest-first
  (backend orders `createdAt DESC`; startDate is the seed's creation proxy):
  `lg-hustle` (08-24), `lg-kockahas` (08-10), `lg-baratno` (08-01), `lg-spanyol` (06-01),
  `lg-felmarathon` (02-02). To keep every existing test's semantics (kockahas trends `up`, hustle
  `down` with `missingHitDays: 2`), re-key the deterministic progress off the goal ID instead of
  the list index — replace `arrowFor`/`recentPatternFor`'s `goalIndex` parameter with the id:

```ts
function arrowFor(goalId: string): TrendArrow {
  if (goalId === 'lg-kockahas') return 'up'
  if (goalId === 'lg-hustle') return 'down'
  return 'insufficient'
}
```

  and thread `goalId` through `recentPatternFor`/`statusFor`/`buildPillarProgress`/`buildGoalDays`
  (`mockProgress` already has it; drop the now-unused `goalIndex` plumbing — `pnpm build`'s
  noUnusedParameters will catch stragglers). Update the header comment ("first seed goal" → name
  the ids).
- [ ] **Step 5: Ripples.** Run the full FE suite both modes (order change touches hub/today
  consumers): `VITE_USE_MOCK=true pnpm test -- --run --maxWorkers=2` then
  `VITE_USE_MOCK=false pnpm test -- --run --maxWorkers=2`; fix order-sensitive expectations
  (CelokPage/NapPage tile order). Then `pnpm build`. If a VISUAL test fails on tile order: check
  `lsof -i :4318 -sTCP:LISTEN` is empty first, `pnpm test:visual` to see the diff,
  `pnpm test:visual:update`, commit ONLY the affected `*-darwin.png`, revert the rest
  (`git checkout -- <paths>`), and note that the linux baselines need the bot run after push.
- [ ] **Step 6: Commit** — `fix(fe): lifegoal mock mirrors the backend — transition table, pillar cap + catalog/kind gate, full-replace update, newest-first seed (mezo-iizd.3)`.

### Task 11: Docs + close-out bookkeeping

**Files:**
- Modify: `docs/features/lifegoal.md` (propose behavior §, error handling §, mock parity §10 pointers)
- Modify: `docs/features/_platform-data-layer.md` (ONLY if it documents the mutation-options
  contract — check; the create/changeStatus opts widened)

- [ ] **Step 1: `docs/features/lifegoal.md`** — update the affected sections in place (no
  changelog): propose now fills/drops target pillars (ai→template fallback on emptied proposal);
  wizard save error card + activation-failure navigation rule; scorer clamp + symmetric linked
  band; idempotent same-status + closedAt preservation; STATUS_ACTIVE constant; mock parity
  (transition table, cap, kind gate, newest-first seed); FE evaluate client removed. Refresh any
  stale `file:line` pointers you touched.
- [ ] **Step 2: Lint:** `cd <worktree> && node scripts/lint-docs.mjs --errors-only` → 0 errors.
- [ ] **Step 3: Leftover bookkeeping (for the close, do not code):** collect what stays open from
  `mezo-iizd.8`'s comment backlog (items 7, 12, 13, 14, 15, fedPillars-order test,
  AppNotificationKindTest name — plus `findAll` paging and, if Task 7 Step 4 fell back to javadoc,
  the MetricSeries populator). These go into a NEW bd issue at session close so `.8` can close
  honestly. Note: `AppNotificationKindTest` rename ("Twelve" → count-accurate) is trivial — do it
  here if it is still stale, include in the docs commit.
- [ ] **Step 4: Commit** — `docs(lifegoal): kontraktus-kör updates — propose target fill, wizard error triad, parity + lifecycle rules (mezo-iwoc)`.

### Task 12: Gates, PR, merge ritual (checklist)

- [ ] Backend focused suite green:
  `./mvnw clean test -Dmezo.test.use-testcontainers=true -Dtest='LifeGoal*,SignalSourceIT,WeightGoalSignalSourceIT'` + `-Dtest='*Arch*Test'`.
- [ ] FE: `pnpm build` + full suite both modes (`--maxWorkers=2`). Mass unrelated failures →
  suspect machine load FIRST (`uptime`), rerun before touching code.
- [ ] `git push -u origin feat/lifegoal-kontraktus` → self-PR (`gh pr create`), body lists the
  three issues; end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] If goldens changed: `gh workflow run update-visual-baselines.yml -r feat/lifegoal-kontraktus`;
  bot commit does NOT trigger CI → `git pull` + empty commit.
- [ ] CI green → `git fetch origin && git checkout main && git pull --rebase` →
  `git merge --no-ff feat/lifegoal-kontraktus` (conflicts on goldens → REGENERATE from the merged
  tree, never pick a side) → `node scripts/gen-codemap.mjs --check` (stale → regen + `--amend`) →
  `node scripts/lint-docs.mjs --errors-only` → `git push` → delete branch.
- [ ] `bd close mezo-iwoc mezo-iizd.8 mezo-iizd.3` (with the Task-11 leftover issue filed first);
  `git pull --rebase && bd dolt push && git push`; `git status` = up to date.

---

## Self-review notes

- Spec coverage: mezo-iwoc (a)→Task 3, (b)→Task 4; mezo-iizd.8 description items → Tasks 2, 5, 6,
  7, 8 (already-done items verified: outer-catch javadoc, XP_PER_HIT deliberate pin, cron watch =
  no action; findAll paging + comment backlog → Task 11 Step 3 leftover issue); mezo-iizd.3 items
  1→Task 1, 2/3/4→Task 10, 5/6/7/8→Task 9, 9→verified already done.
- Type consistency: `evaluateDays(UUID, LifeGoalEntity, LocalDate)` produced in Task 6 is not
  consumed later; port signature change (Task 9) lands AFTER Task 3 edits the same service —
  Task 9 Step 5 must re-run `LifeGoalProposeIT`, which its Step 6 does via `LifeGoal*`.
- Order matters: Task 5 before Task 7 (tests pin clamp semantics); Task 4 before Task 10 (mock
  throws feed the wizard error card); Tasks 1–2 first (single contract surface, regen twice but
  cheap and keeps commits per-issue).
