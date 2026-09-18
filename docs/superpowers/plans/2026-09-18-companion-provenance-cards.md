# Companion provenance cards (S9.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every companion answer discloses what it looked up and what came back — one card per retrieval, in Hungarian, honest about failures — persisted per message, with the result half expiring after 90 days.

**Architecture:** The turn already produces everything needed in memory and throws it away at persistence. `TurnPlan.PlanStep.why` exists and dies in `PlanExecutor`; the plan-truth outcome list (`ChatService.PlanLapResult.outcomes`) never reaches `persistMessage`. This slice carries `why` through execution, adds ONE new jsonb column (`ai_message.tool_outcomes`) for the result half, extends the existing `tool_calls` envelope with `why` for the ask half, builds both envelopes from a single `List<ToolOutcome>` (plan-truth on pipeline turns, ran-truth on legacy turns — never mixed within a row), exposes them through the existing `MessageTool` wire item, and renders them in the chat's existing `ToolWorkStrip` disclosure. A nightly job NULLs `tool_outcomes` after 90 days; the ask half survives forever.

**Tech Stack:** Spring Boot / JPA `@JdbcTypeCode(SqlTypes.JSON)` typed record envelopes, Liquibase, contract-first OpenAPI (`api/feature/companion/companion.yml` → `api/openapi.yml` → `frontend/src/data/_client/api.gen.ts`), React + TanStack Query, Vitest + MSW.

**Driving issue:** `mezo-rj214.7` (epic `mezo-rj214`). Spec: `docs/superpowers/specs/2026-09-16-companion-plan-execute-answer-design.md` §6.6 + §9.

---

## Global Constraints

- **Branch:** `feat/companion-provenance-cards` (already created from `origin/main`). Conventional commits carrying `(mezo-rj214.7)`.
- **Config keys live under `mezo.companion.turn.provenance.*`** — spec §9's block nests provenance under `turn:`, and every companion turn key already lives there. (Spec §6.6 writes the key as `mezo.companion.provenance.retention-days` — that is an inconsistency inside the spec; §9's placement wins. Do not create a second top-level `mezo.companion.provenance` namespace.) Values: `retention-days: 90`, `cron: "0 55 3 * * *"`, `max-chars: { per-outcome: 4000, total: 20000 }`.
- **Every new Spring bean carries `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")`** — an ungated companion bean broke every `*SwitchOffIT` in S9.1 (standing rule). A job bean ANDs its own job switch on top, like `MemoryRetrievalRetentionJob`.
- **Two truths never mix inside one row.** A pipeline turn's provenance is built ENTIRELY from the plan-truth outcome list (`PlanExecutor` output + `capToRemainingBudget` synthetic drops). A legacy turn's provenance is built ENTIRELY from `audit.toolOutcomes()` (ran-truth). See `docs/features/companion.md` "Three seams" — reading both as if they agreed surfaces either an unvalidated plan or an outcome that silently changed.
- **jsonb envelopes are typed records with a static `ofOrNull(...)`** returning `null` (never an empty envelope) when nothing happened — `RecalledMemoriesEnvelope` is the precedent. New envelope records live in `feature/companion/entity/` (ArchUnit enforces subpackage placement).
- **Liquibase**: additive one-line `alter table` SQL under `backend/src/main/resources/db/changelog/1.0.0/script/`, filename `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`, registered as a new `changeSet` appended to the tail of `1.0.0_master.yml`. No backfill, no index, no NOT NULL.
- **Contract is generated, never hand-edited**: edit `api/feature/companion/companion.yml`, then `cd api/generate && npm run generate:api`, then regenerate FE types. `pnpm generate:api` needs a TTY — run `npx openapi-typescript ../api/openapi.yml -o src/data/_client/api.gen.ts` from `frontend/` instead. CI's contract-drift job recompiles both byte-for-byte.
- **Backend gate**: `./mvnw test -Dtest='io.mrkuhne.mezo.feature.companion.**' -Dmezo.test.use-testcontainers=true` (the Testcontainers flag is mandatory — the default fixed-DB mode races and fakes failures), plus `-Dtest=ArchitectureTest`.
- **Frontend gate, both modes EXPLICITLY**: `cd frontend && pnpm build && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test`. Known local-only failures — name them, never chase: `chatApi.test.ts` transcribe-multipart (MSW formData 500) and `TutorialProvider.test.tsx` StrictMode `seenAt`.
- **Docs mandate**: `docs/features/companion.md` + `docs/features/insights.md` updated in the same change; `node scripts/lint-docs.mjs` clean for both; `node scripts/gen-codemap.mjs` then `--check`.
- **`TurnPipelineIT` and any IT asserting rows written by a `PlanExecutor` pool thread must NOT be `@Transactional`** — the pool thread uses its own connection and cannot see the JUnit thread's uncommitted rows.
- **Never bare `git stash`.**

---

## File structure

**Backend — new**
- `entity/ToolOutcomesEnvelope.java` — the result half: `record ToolOutcomesEnvelope(List<Outcome> outcomes)`, `record Outcome(String name, String text, boolean failed)`.
- `service/TurnProvenance.java` — the builder + its output pair. Turns ONE `List<ToolCallAudit.ToolOutcome>` into `(ToolCallsEnvelope ask, ToolOutcomesEnvelope result)`, applying compact-args rendering, truncation and failure detection.
- `service/ProvenanceRetentionJob.java` — nightly NULL of `tool_outcomes` past the cutoff.
- `db/changelog/1.0.0/script/202609180900_mezo-rj214.7_ai_message_tool_outcomes.sql`.

**Backend — modified**
- `entity/ToolCallsEnvelope.java` — `ToolCall` gains a 4th `why` component + a 3-arg compatibility constructor.
- `entity/AiMessageEntity.java` — new `toolOutcomes` jsonb field.
- `tools/ToolCallAudit.java` — `ToolOutcome` gains a 4th `why` component + a 3-arg compatibility constructor.
- `service/PlanExecutor.java` — passes `step.why()` into the outcome it builds.
- `service/ChatService.java` — `capToRemainingBudget`'s synthetic drops carry `why`; `PlanLapResult`/`pipelineAnswer` thread the final outcome list out; `completeTurn`/`sendMessage`/`persistMessage` persist both envelopes.
- `service/ChatStreamService.java` — `PipelineResult` gains the outcome list; the trailing done row persists provenance.
- `repository/AiMessageRepository.java` — `scrubToolOutcomesOlderThan`.
- `config/CompanionProperties.java` — `Turn` gains a `Provenance` record.
- `techcore/configuration/FeaturesConfiguration.java` — `COMPANION_PROVENANCE_RETENTION_JOB_SWITCH`.
- `mapper/CompanionMapper.java` — zips both envelopes into `MessageTool`.
- `application.yml` — the new config block + the job switch.

**Contract**
- `api/feature/companion/companion.yml` — `MessageTool` gains `why`, `outcome`, `failed` (all optional).

**Frontend — modified**
- `frontend/src/shared/ui/ToolChip.tsx` — the shared `Tool` interface gains `why?`, `outcome?`, `failed?`.
- `frontend/src/data/insights/chatApi.ts` — `toChatMessage` passes the new fields through.
- `frontend/src/features/insights/components/ToolWorkStrip.tsx` — the expanded rows become provenance cards.
- `frontend/src/test/msw/handlers.ts` — conversation-history + stream fixtures carry the new fields.
- `frontend/src/features/insights/components/*.test.tsx` / `ChatPage.test.tsx` — coverage.

---

### Task 1: The storage shape (dark)

Adds the column, the envelope and the `why` slot on the ask envelope. Nothing writes them yet.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/ToolOutcomesEnvelope.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609180900_mezo-rj214.7_ai_message_tool_outcomes.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append one changeSet at the tail)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/ToolCallsEnvelope.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/AiMessageEntity.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/AiMessageJsonbRoundTripIT.java` (extend)

**Interfaces:**
- Produces: `ToolOutcomesEnvelope.ofOrNull(List<Outcome>)`, `ToolOutcomesEnvelope.Outcome(String name, String text, boolean failed)`, `ToolCallsEnvelope.ToolCall(String type, String name, String args, String why)` with the 3-arg constructor kept.

- [ ] **Step 1: Write the failing round-trip assertions.** In `AiMessageJsonbRoundTripIT`, extend the existing persist-and-reload test (keep its current `{type,name,args}` assertions intact — they pin the legacy shape) with: a message carrying `ToolOutcomesEnvelope.ofOrNull(List.of(new Outcome("get_recovery", "Kedd óta 7,2 óra átlag.", false), new Outcome("get_meals", "A lekérés nem sikerült.", true)))` reloads with both outcomes, `jsonb_typeof(tool_outcomes) = 'object'`; a `ToolCall` written with a `why` reloads with that `why`; a `ToolCall` written through the 3-arg constructor reloads with `why == null`; and `ofOrNull(List.of())` / `ofOrNull(null)` both yield a null column.

- [ ] **Step 2: Run it and watch it fail** — `./mvnw test -Dtest=AiMessageJsonbRoundTripIT -Dmezo.test.use-testcontainers=true`. Expected: compile error (no such type / no such setter).

- [ ] **Step 3: The migration.** `202609180900_mezo-rj214.7_ai_message_tool_outcomes.sql`:

```sql
alter table ai_message add column tool_outcomes jsonb;
```

Append to the tail of `1.0.0_master.yml`, matching the neighbouring blocks exactly:

```yaml
  - changeSet:
      id: "1.0.0:202609180900_mezo-rj214.7_ai_message_tool_outcomes"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609180900_mezo-rj214.7_ai_message_tool_outcomes.sql
```

- [ ] **Step 4: The envelope.**

```java
package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.tool_outcomes (S9.7, mezo-rj214.7) — the RESULT half of a
 * turn's provenance, positionally parallel to {@link ToolCallsEnvelope#calls()}. Split from the
 * ask half on purpose: the 90-day retention scrub NULLs this column and keeps the plan, so the
 * two must be nullable independently.
 *
 * <p>{@code text} is the tool's own Hungarian output, already truncated by the builder;
 * {@code failed} marks a step that timed out, errored or was dropped for budget — shown honestly
 * rather than hidden.
 */
public record ToolOutcomesEnvelope(List<Outcome> outcomes) {

    public record Outcome(String name, String text, boolean failed) {
    }

    /** Null (not an empty envelope) when the turn retrieved nothing — every pre-S9.7 row is null. */
    public static ToolOutcomesEnvelope ofOrNull(List<Outcome> outcomes) {
        return outcomes == null || outcomes.isEmpty() ? null : new ToolOutcomesEnvelope(List.copyOf(outcomes));
    }
}
```

- [ ] **Step 5: `why` on the ask envelope.** In `ToolCallsEnvelope`, replace the `ToolCall` record body with the 4-component form plus the compatibility constructor (the `RecalledMemoriesEnvelope.Item` precedent — legacy JSON and every existing caller keep the old shape, the new key stays absent/null):

```java
    public record ToolCall(String type, String name, String args, String why) {

        /** Legacy JSON and the ran-truth audit path keep the pre-S9.7 shape; {@code why} exists
         *  only on a planned (pipeline) turn, where the planner said why it wanted this read. */
        public ToolCall(String type, String name, String args) {
            this(type, name, args, null);
        }
    }
```

- [ ] **Step 6: The entity field**, next to `recalledMemories`:

```java
    /** S9.7: what each planned read returned — NULLed by the retention scrub after 90 days,
     *  while {@link #toolCalls} (the ask) is kept forever. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tool_outcomes", columnDefinition = "jsonb")
    private ToolOutcomesEnvelope toolOutcomes;
```

- [ ] **Step 7: Green** — the same command as Step 2, now passing. Also run `-Dtest=ArchitectureTest`.

- [ ] **Step 8: Commit** — `feat(companion): tool_outcomes column + why on the ask envelope (mezo-rj214.7)`

---

### Task 2: `why` survives execution

`TurnPlan.PlanStep.why` is parsed and then dropped at `PlanExecutor.java:139`. Carry it to the outcome record so ONE list holds everything provenance needs.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAudit.java` (the `ToolOutcome` record, ~:38-41; `toolOutcomes()` ~:151)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/PlanExecutor.java` (~:139-143)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` (`capToRemainingBudget`'s synthetic dropped outcomes)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/PlanExecutorTest.java` (extend) and the existing `capToRemainingBudget` coverage

**Interfaces:**
- Produces: `ToolCallAudit.ToolOutcome(String name, String args, String result, String why)` with the 3-arg constructor preserved (ran-truth passes no `why`).
- Consumes: `TurnPlan.PlanStep.why()`.

- [ ] **Step 1: Failing tests.** In `PlanExecutorTest`, add: a plan whose step carries `why = "hogy lássam a mai étkezést"` produces an outcome whose `why()` is that string; a step with a blank `why` produces `""` (the parser's default — do not translate it to null here). In the existing `capToRemainingBudget` test, assert a budget-dropped step's synthetic outcome also carries its step's `why`.

- [ ] **Step 2: Run, watch fail** — `./mvnw test -Dtest=PlanExecutorTest -Dmezo.test.use-testcontainers=true`. Expected: compile error, no `why()` accessor.

- [ ] **Step 3: The record.** In `ToolCallAudit`:

```java
    /** One executed tool call as the verdict judge sees it (mezo-indo). {@code result} is the raw
     *  tool output — the digest that renders it into the judge payload owns truncation.
     *  {@code why} is the planner's half-sentence for a PLANNED read (S9.7 provenance); the
     *  ran-truth list from {@link #toolOutcomes()} has none. */
    public record ToolOutcome(String name, String args, String result, String why) {

        public ToolOutcome(String name, String args, String result) {
            this(name, args, result, null);
        }
    }
```

`toolOutcomes()` keeps calling the 3-arg form — ran-truth has no `why`, and that absence is the honest signal a card renders (no reason line).

- [ ] **Step 4: `PlanExecutor`** — the one line at ~:139:

```java
            outcomes.add(new ToolCallAudit.ToolOutcome(
                    entry.step().tool(), entry.args(), collect(entry, deadlineNanos), entry.step().why()));
```

- [ ] **Step 5: `capToRemainingBudget`** — find where the synthetic `BUDGET_EXHAUSTED` outcomes are built for `dropped()` and pass that step's `why()` as the 4th argument, exactly as above.

- [ ] **Step 6: Green**, then the full pipeline neighbourhood: `-Dtest=PlanExecutorTest,TurnPipelineIT,ChatServicePipelineIT`.

- [ ] **Step 7: Commit** — `feat(companion): the plan's why survives execution (mezo-rj214.7)`

---

### Task 3: The provenance builder

One pure class converts a `List<ToolOutcome>` into the two envelopes. Every caller — pipeline and legacy, sync and streamed — goes through it, which is what keeps the two truths from mixing.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnProvenance.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java` (`Turn` gains `Provenance`)
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnProvenanceTest.java` (new, plain unit test — no Spring context)

**Interfaces:**
- Produces: `TurnProvenance.Built(ToolCallsEnvelope ask, ToolOutcomesEnvelope result)` and `TurnProvenance.build(List<ToolCallAudit.ToolOutcome> outcomes, CompanionProperties.Provenance limits)` — a static method, no bean, so no switch-off gate is needed and no constructor wiring changes.
- Consumes: `ToolCallAudit.ToolOutcome`, the failure markers already defined for executor steps (`PlanExecutor.STEP_TIMEOUT`, `STEP_FAILED`) and `RecordingToolCallback.BUDGET_EXHAUSTED`.

- [ ] **Step 1: Write `TurnProvenanceTest` first.** Cases:
  1. An empty list yields `Built(null, null)` — a tool-less turn persists exactly like today.
  2. A plan-truth outcome (`name="get_meals"`, `args="{\"day\":\"2026-09-18\"}"`, `result="Reggeli: …"`, `why="hogy lássam a mai étkezést"`) yields one ask entry with `type="read"`, `name="get_meals"`, `args="day=2026-09-18"` (compact form, NOT raw JSON), `why` preserved — and one result entry with the text and `failed=false`.
  3. An outcome whose `result` equals `PlanExecutor.STEP_TIMEOUT` yields `failed=true` and keeps the marker text (honest, not hidden).
  4. Same for `STEP_FAILED` and for the budget-exhausted marker.
  5. A `result` longer than `per-outcome` is truncated to that length with the suffix `" …(rövidítve)"`, and the untruncated prefix is preserved.
  6. Once the running total passes `total`, every further outcome's text becomes exactly `"…(a többi részlet nem fér ide)"` with `failed` untouched — a cap must never silently drop an entry, only its text.
  7. A ran-truth outcome (3-arg, `why == null`, `args` already compact like `"days=7"`) passes `args` through unchanged and yields `why == null`.
  8. A null `result` (call whose output never arrived — `toolOutcomes()` allows it) yields `failed=true` and a non-null placeholder text.

- [ ] **Step 2: Run, watch fail** — `./mvnw test -Dtest=TurnProvenanceTest`.

- [ ] **Step 3: The config record.** In `CompanionProperties.Turn`, add `@NotNull @Valid Provenance provenance` as a component, and the nested record:

```java
        /**
         * S9.7 provenance (spec §6.6). {@code retentionDays} is the age past which the RESULT half
         * is NULLed — the ask half is kept forever. The char caps bound what a single message row
         * can store: a tool may return thousands of characters and every turn writes a row.
         */
        public record Provenance(
                @Min(1) int retentionDays,
                @NotBlank String cron,
                @Min(200) int perOutcomeChars,
                @Min(1000) int totalChars) {
        }
```

and in `application.yml` under `mezo.companion.turn:`

```yaml
      # S9.7 (mezo-rj214.7): what each answer looked up and what came back. The RESULT half is
      # NULLed after retention-days (the ask half is kept forever) — 03:55 is the verified-free
      # minute after the 03:40 llm-log scrub and the 03:50 audit-retention + monthly pair.
      provenance:
        retention-days: 90
        cron: "0 55 3 * * *"
        per-outcome-chars: 4000
        total-chars: 20000
```

- [ ] **Step 4: The builder.**

```java
package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import java.util.ArrayList;
import java.util.List;

/**
 * S9.7: turns ONE outcome list into the two persisted provenance envelopes. Every persistence
 * path goes through here, which is what keeps plan-truth and ran-truth from mixing inside one
 * row: a PIPELINE turn passes the executor's plan-ordered list (synthetic budget drops included),
 * a LEGACY turn passes {@code audit.toolOutcomes()}. Whichever list arrives, both envelopes
 * describe the same one.
 *
 * <p>Static by design — no bean, so no COMPANION_SWITCH gate and no constructor churn on the two
 * already-dense call sites.
 */
public final class TurnProvenance {

    /** Wire/FE tool type; V0.5 emits only reads and the planner can only plan reads. */
    private static final String READ = "read";
    private static final String TRUNCATED = " …(rövidítve)";
    private static final String OVER_BUDGET = "…(a többi részlet nem fér ide)";
    private static final String NO_OUTPUT = "Erre a lekérésre nem érkezett válasz.";

    private TurnProvenance() {
    }

    /** The two envelopes of one turn; either side is null when there was nothing to disclose. */
    public record Built(ToolCallsEnvelope ask, ToolOutcomesEnvelope result) {
    }

    public static Built build(List<ToolCallAudit.ToolOutcome> outcomes, CompanionProperties.Provenance limits) {
        if (outcomes == null || outcomes.isEmpty()) {
            return new Built(null, null);
        }
        List<ToolCallsEnvelope.ToolCall> ask = new ArrayList<>(outcomes.size());
        List<ToolOutcomesEnvelope.Outcome> result = new ArrayList<>(outcomes.size());
        int spent = 0;
        for (ToolCallAudit.ToolOutcome outcome : outcomes) {
            ask.add(new ToolCallsEnvelope.ToolCall(READ, outcome.name(), compactArgs(outcome.args()), outcome.why()));
            String raw = outcome.result() == null ? NO_OUTPUT : outcome.result();
            String text;
            if (spent >= limits.totalChars()) {
                text = OVER_BUDGET;
            } else if (raw.length() > limits.perOutcomeChars()) {
                text = raw.substring(0, limits.perOutcomeChars()) + TRUNCATED;
            } else {
                text = raw;
            }
            spent += text.length();
            result.add(new ToolOutcomesEnvelope.Outcome(outcome.name(), text, failed(outcome.result())));
        }
        return new Built(new ToolCallsEnvelope(List.copyOf(ask)), ToolOutcomesEnvelope.ofOrNull(result));
    }
```

`compactArgs` renders the plan's JSON args (`{"days":7,"scope":"sleep"}`) into the chip display form (`days=7, scope=sleep`) and passes an already-compact ran-truth string through untouched (detect by a leading `{`). Parse with the repo's Jackson 3 idiom (`tools.jackson.databind`, `asString` not `asText`), and on ANY parse failure return the input unchanged — provenance must never fail a turn. `failed(String result)` returns true for null and for a result equal to (or starting with) `PlanExecutor.STEP_TIMEOUT`, `PlanExecutor.STEP_FAILED` or `RecordingToolCallback.BUDGET_EXHAUSTED`; read those constants rather than re-typing their text, and widen their visibility only if needed.

- [ ] **Step 5: Green** — `./mvnw test -Dtest=TurnProvenanceTest`.

- [ ] **Step 6: Commit** — `feat(companion): the provenance builder (mezo-rj214.7)`

---

### Task 4: The sync path persists provenance

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `sendMessage` (pipeline + legacy branches, ~:324-360), `persistMessage` (~:788-802), `pipelineAnswer`/`PlanLapResult` so the FINAL merged outcome list (lap 1 + replan lap) reaches the caller
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatServicePipelineIT.java` (extend; non-`@Transactional` rules apply)

**Interfaces:**
- Consumes: `TurnProvenance.build(...)`, `PlanLapResult.outcomes()`.
- Produces: `persistMessage(..., ToolCallsEnvelope toolCalls, ToolOutcomesEnvelope toolOutcomes, ...)` — the new parameter; `pipelineAnswer` returns its answer AND the outcome list that produced it (introduce a small record rather than an out-parameter; name it `PipelineAnswer(String answer, List<ToolCallAudit.ToolOutcome> outcomes)`).

- [ ] **Step 1: Failing ITs.** In `ChatServicePipelineIT`: (a) a scripted pipeline turn persists an assistant row whose `tool_calls` carries the planned steps WITH `why` and whose `tool_outcomes` carries one entry per step with the tool's Hungarian text; (b) a replan turn persists lap-1 AND lap-2 outcomes (the merged list), in that order; (c) a turn whose planner returns an empty usable plan persists null/null rather than empty envelopes.

- [ ] **Step 2: Run, watch fail.**

- [ ] **Step 3: Thread the outcomes out.** `pipelineAnswer` currently returns the answer string; the replan lap builds `merged`. Return both. Where the replan lap does not run, the returned list is lap 1's. Keep the existing guard/fallback semantics byte-identical — a pipeline exception still falls back to legacy (`pipelineAnswerGuarded`), and a fallback turn persists LEGACY provenance (ran-truth), never a half-built plan.

- [ ] **Step 4: Persist.** At the pipeline branch call site, `TurnProvenance.Built built = TurnProvenance.build(answer.outcomes(), properties.turn().provenance());` and pass `built.ask()` / `built.result()` into `persistMessage`. At the LEGACY branch, pass `TurnProvenance.build(audit.toolOutcomes(), …)` — note this REPLACES the previous `audit.toToolCallsEnvelope()` argument, and the builder reproduces the same ask entries (type `read`, same name, same compact args, `why` null), so legacy rows keep today's shape. Assert that explicitly in the IT.

- [ ] **Step 5: Green** — `-Dtest=ChatServicePipelineIT,ChatServiceIT,AiMessageJsonbRoundTripIT`.

- [ ] **Step 6: Commit** — `feat(companion): the sync turn persists its provenance (mezo-rj214.7)`

---

### Task 5: The streamed path persists provenance

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java` — `PipelineResult` (~:388-392) gains the outcome list; the trailing done-Mono passes provenance into `completeTurn`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` — `completeTurn` takes the two envelopes
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamPipelineIT.java` (extend)

**Interfaces:**
- Produces: `completeTurn(..., ToolCallsEnvelope toolCalls, ToolOutcomesEnvelope toolOutcomes, boolean degraded, RecalledMemoriesEnvelope recalled)`.

- [ ] **Step 1: Failing ITs.** A streamed LOOKUP turn's persisted done row carries both envelopes; a streamed ANALYSIS (sync-answer) turn likewise; a turn that fell back to legacy carries ran-truth provenance with no `why`; a CHAT turn (no retrieval) carries null/null.

- [ ] **Step 2: Run, watch fail.**

- [ ] **Step 3: Implement.** Add `List<ToolCallAudit.ToolOutcome> outcomes` to `PipelineResult` (null/empty for the LEGACY mode), build the envelopes inside the trailing done-Mono, pass them to `completeTurn`. **Do not disturb the S9.6 invariants in this method**: `toolSink.tryEmitComplete()` stays the FIRST statement of the callable, the whole callable body stays inside `LlmActorContext.runAsCaptured(actor, …)`, and the eager 404/429 preflight stays before `Flux.defer`. Read the class javadoc before editing.

- [ ] **Step 4: Green** — `-Dtest=ChatStreamPipelineIT,ChatStreamServiceIT,ChatStreamAdvisorIT,CompanionStreamApiIT,ChatStreamBudgetIT`.

- [ ] **Step 5: Commit** — `feat(companion): the streamed turn persists its provenance (mezo-rj214.7)`

---

### Task 6: The wire — contract + mapper

**Files:**
- Modify: `api/feature/companion/companion.yml` (`MessageTool`, ~:876-882; and the `MessageResponse.tools` description)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java` (`toMessageResponse` ~:44-55, `toTools` ~:171-182)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapperTest.java` (new or extend)

**Interfaces:**
- Produces: `MessageTool { type, name, why?, outcome?, failed? }`.

- [ ] **Step 1: Failing mapper tests.** Both envelopes present → each `MessageTool` carries its `why`, its `outcome` text and its `failed` flag. Ask-only (result NULLed by retention) → `why` present, `outcome` absent, `failed` false. Result envelope shorter or longer than the ask list → the mapper zips by INDEX and tolerates the mismatch without throwing (missing side simply absent). Null ask → `[]`, exactly as today.

- [ ] **Step 2: Contract.** In `companion.yml`:

```yaml
    MessageTool:
      type: object
      required: [type, name]
      properties:
        type: { type: string, description: "'read' | 'compute' (mirrors the FE ToolType) — V0.5 emits only 'read'" }
        name: { type: string }
        why:
          type: string
          description: >-
            S9.7 provenance: the planner's half-sentence for WHY this read was requested, in
            Hungarian. Absent on legacy (non-planned) turns and on pre-S9.7 rows.
        outcome:
          type: string
          description: >-
            S9.7 provenance: what this read returned, as the tool's own Hungarian text (truncated
            server-side). Absent once the 90-day retention scrub has emptied the result half, and
            on pre-S9.7 rows — the ask half above survives.
        failed:
          type: boolean
          description: >-
            True when this step timed out, errored or was dropped for budget. Rendered honestly
            rather than hidden; `outcome` then carries the in-band marker text.
```

Then `cd api/generate && npm run generate:api`, and from `frontend/`: `npx openapi-typescript ../api/openapi.yml -o src/data/_client/api.gen.ts`.

- [ ] **Step 3: The mapper.** `toMessageResponse` passes both envelopes into a widened `toTools(ToolCallsEnvelope, ToolOutcomesEnvelope)`; the name is still built as today (`name(args)`), `why` comes from the ask entry, `outcome`/`failed` from the result entry at the same index when one exists.

- [ ] **Step 4: Green** — mapper tests + `-Dtest=CompanionApiIT,CompanionStreamApiIT`, then verify contract-drift locally: re-run the generators and confirm `git diff --exit-code api/openapi.yml frontend/src/data/_client/api.gen.ts` is empty after committing.

- [ ] **Step 5: Commit** — `feat(api): provenance on the companion message tool item (mezo-rj214.7)`

---

### Task 7: The 90-day scrub

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ProvenanceRetentionJob.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/AiMessageRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Modify: `backend/src/main/resources/application.yml` (the job switch, in the `mezo.techcore.cron.*` block next to its siblings)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ProvenanceRetentionJobIT.java` (new)

**Interfaces:**
- Consumes: `CompanionProperties.Provenance.retentionDays()/cron()`.
- Produces: `int scrubToolOutcomesOlderThan(Instant cutoff)`.

- [ ] **Step 1: Failing IT.** A message older than the cutoff with both envelopes: after `run()`, `tool_outcomes` is null and `tool_calls` is untouched (including its `why`). A message inside the window is untouched. A message already scrubbed is not counted again (the query's `tool_outcomes is not null` guard). The returned count matches.

- [ ] **Step 2: Run, watch fail.**

- [ ] **Step 3: The repository method**, mirroring `LlmLogRepository.scrubPayloadsOlderThan`:

```java
    @Modifying
    @Query("""
        update AiMessageEntity m
           set m.toolOutcomes = null
         where m.createdAt < :cutoff
           and m.toolOutcomes is not null
        """)
    int scrubToolOutcomesOlderThan(@Param("cutoff") Instant cutoff);
```

- [ ] **Step 4: The job**, mirroring `LlmLogRetentionJob` — `@Component`, `@RequiredArgsConstructor`, `@Slf4j`, `@Transactional`, `@Scheduled(cron = "${mezo.companion.turn.provenance.cron}")`, and `@ConditionalOnProperty` on a NEW switch. Follow `MemoryRetrievalRetentionJob`: gate on BOTH the companion switch and the job switch. Add `COMPANION_PROVENANCE_RETENTION_JOB_SWITCH = "mezo.techcore.cron.companion-provenance-retention-job.enabled"` to `FeaturesConfiguration` and default it `true` in `application.yml` beside its cron siblings. Javadoc must say what the llm-log job's says: irreversible by design, no row is ever deleted, the ask half is kept.

- [ ] **Step 5: Green** — `-Dtest=ProvenanceRetentionJobIT,ArchitectureTest`, plus one companion `*SwitchOffIT` to prove the new bean does not break a switched-off context.

- [ ] **Step 6: Commit** — `feat(companion): the provenance result half expires after 90 days (mezo-rj214.7)`

---

### Task 8: The cards

The chat already has the right disclosure in the right place: `ToolWorkStrip` sits above the answer bubble, collapsed as `Utánanézett · N forrás`, expanding to one row per source. This task turns those rows into provenance cards. No new strip, no sheet, no new visual language — the `RecalledMemoriesRow` "Emlékek · N" card idiom is the precedent the PO named.

**Files:**
- Modify: `frontend/src/shared/ui/ToolChip.tsx` (the `Tool` interface)
- Modify: `frontend/src/data/insights/chatApi.ts` (`toChatMessage`, ~:19-33)
- Modify: `frontend/src/features/insights/components/ToolWorkStrip.tsx`
- Modify: `frontend/src/test/msw/handlers.ts` (history fixture ~:1453-1466 and stream fixture ~:1588-1626)
- Test: `frontend/src/features/insights/pages/ChatPage.test.tsx` (extend) — or a focused `ToolWorkStrip.test.tsx` if the component is not reachable from the page test's fixtures

**Interfaces:**
- Consumes: `MessageTool.why | outcome | failed` from `api.gen.ts`.
- Produces: `Tool { type, name, args?, why?, outcome?, failed? }`.

- [ ] **Step 1: Failing tests.** Render a message whose tools carry `why` and `outcome`: expanding the strip shows, per row, the Hungarian tool label, the reason line, and the returned text. A row with `failed: true` renders a visible failure mark and still shows its text (never hidden, never silently dropped). A row with no `outcome` (retention-scrubbed) renders the ask without an empty content block. A live streaming turn (no outcomes yet) renders exactly as today.

- [ ] **Step 2: Run, watch fail** — `cd frontend && CI=true VITE_USE_MOCK=true pnpm test`.

- [ ] **Step 3: Types + pass-through.** Add the three optional fields to `Tool`; `toChatMessage` maps them straight across (keep its existing "empty becomes undefined" discipline — an empty-string `why` must not render an empty line).

- [ ] **Step 4: The rows.** Inside the existing `mzc-wpanel` row, below the existing `mzc-wnm` label and `mzc-wprm` params: render `why` as a muted reason line and `outcome` as the returned text, clamped by default with the row's existing tap-to-expand affordance if one is cheap (mirror `RecalledMemoriesRow`'s `openCard` unclamp; if that costs a new state machine, ship it unclamped and note it). The status glyph on the right becomes the honest failure mark when `failed` is true (reuse the existing `mzc-wst` slot and an existing icon; no new icon set). Follow the file's own class-naming (`mzc-w*`) and reuse existing CSS tokens — **no new stylesheet, no emojis** (clay/mozaik kit only, per CLAUDE.md).

- [ ] **Step 5: MSW.** Add `why`/`outcome`/`failed` to the conversation-history tool fixtures so mock mode shows real cards, and to the stream handler's persisted done row. Keep at least one fixture tool WITHOUT an outcome so the scrubbed case stays covered in mock mode.

- [ ] **Step 6: Green in BOTH modes** + `pnpm build`.

- [ ] **Step 7: Commit** — `feat(insights): the chat discloses what it looked up and what came back (mezo-rj214.7)`

---

### Task 9: Gates, docs, close-out

**Files:**
- Modify: `docs/features/companion.md` (the provenance section ~:2319-2359 — it currently says provenance is "audit trail only, not yet a consumer contract — S9.7"; that sentence must now describe the shipped contract), the persistence/entity section, and the config table
- Modify: `docs/features/insights.md` (§2.5 Chat — the disclosure surfaces)
- Modify: `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Backend full-package gate** — `./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**' -Dmezo.test.use-testcontainers=true` GREEN, plus `-Dtest=ArchitectureTest`.

- [ ] **Step 2: FE full gate** — `pnpm build && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test` (known local failures named in the report, never chased).

- [ ] **Step 3: Docs.** companion.md: the two-column split and WHY it is two columns (retention), the `why` lifecycle from planner to card, plan-truth vs ran-truth per row, the new config block, the scrub job and what survives it. **While there, fix the known staleness the recon found**: both companion.md §5.1 and insights.md §2.5 still say the chat renders tool chips "through the same `ToolChipRow`" — the mounted component has been `ToolWorkStrip` since mezo-vdf4. `node scripts/lint-docs.mjs` clean for both docs; `node scripts/gen-codemap.mjs` + `--check`.

- [ ] **Step 4: Commit** — `docs(companion): provenance cards — what we asked and what came back (mezo-rj214.7)`

*(Controller close-out, NOT the implementer's: bd notes on mezo-rj214.7; tracker backup refresh; PR → CI → premerge → `--no-ff` merge → branch delete → CODEMAP re-check.)*

---

## Done criteria

1. A pipeline answer's message row carries, per planned step, the tool, its compact args, the planner's `why`, the returned Hungarian text, and an honest failure flag — budget-dropped and timed-out steps included.
2. A legacy (fallback / pipeline-off) answer carries the same shape from ran-truth, minus `why` — never a mix of the two truths inside one row.
3. The chat's `Utánanézett · N forrás` strip expands to one card per retrieval showing the reason and what came back; failures are visible; a scrubbed row still shows what was asked.
4. After the nightly scrub, rows older than 90 days keep `tool_calls` (with `why`) and have `tool_outcomes` null; the job is switchable and gated on the companion switch.
5. Contract regenerated byte-exact (contract-drift green); both FE modes green; the companion package suite + ArchUnit green; CODEMAP regenerated.
6. The S9.6 stream invariants are untouched: eager 404/429 preflight before `Flux.defer`, `tryEmitComplete()` first in the trailing callable, the whole callable inside `runAsCaptured`.
