# Companion V0.5 — Tool calling + tool-chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** history/aggregate questions get real, grounded answers — 8 read-only tools over existing services, per-turn call cap, audit into `ai_message.tool_calls`/`refs`, and the FE chips stop being theater.

**Architecture:** the `CompanionLlm` port grows a tools variant (Spring AI 2.0 `ToolCallback` list + `toolContext` map — spring-ai-core types, NOT provider types). A per-turn `ToolCallAudit` collector rides in the tool context; a `RecordingToolCallback` decorator wraps every tool so the call log can never be forgotten and the per-turn cap is enforced structurally. Tools live in `feature/companion/tools/` grouped by source domain, read the OTHER features' services/repos (one-way coupling), render compact deterministic Hungarian text (snapshot idiom: explicit `nincs adat`, never invented numbers), and register refs. `ChatService`/`ChatStreamService` persist the audit into the existing (so-far-null) jsonb envelopes; `CompanionMapper` puts `name(args)` on the wire. The FE already passes `tools[]`/`refs[]` through (`toChatMessage`) — only MSW fixtures + tests change.

**Tech Stack:** Spring Boot 4 / Spring AI 2.0.0 (`ChatClient.toolCallbacks/.toolContext`, `@Tool`/`@ToolParam`, `ToolContext`, `ToolCallbacks.from`), MapStruct, ArchUnit, Vitest/MSW.

**Driver:** bd `mezo-fnnq.5` · roadmap §V0.5 · spec §5–§6 · living doc `docs/features/companion.md`.

## Global Constraints

- Branch `feat/companion-v05`; conventional commits carrying `(mezo-fnnq.5)`.
- Backend gate: `cd backend && ./mvnw clean test` (ALWAYS `clean`; compose Postgres up).
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- Contract-first: `api/feature/companion/companion.yml` edited BEFORE code; merge via `cd api/generate && npm run generate:api`; FE regen `cd frontend && pnpm generate:api`.
- Every new companion bean is `@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")` — the port/tool beans are ABSENT when the switch is off.
- No LLM in tests — `companion-fake` profile; the fake executes REAL tool callbacks deterministically via content sentinels.
- Config under `mezo.companion.tools.*` on `CompanionProperties` — never `@Value`, no hardcoded tunables.
- Tools are read-only + ownership-scoped (`userId` from `ToolContext`, NEVER from model args); IDENT-2 enforced by a new ArchUnit rule.
- No Liquibase migration — `tool_calls`/`refs` jsonb columns exist since V0.2; no new tables → no `ResetDatabase`/populator changes.
- Coupling: companion → other features only; new repo finders land in the OWNING feature's repository (plain finders, no companion dependency) — the V0.3 precedent.
- AssertJ only; ITs extend `AbstractIntegrationTest`/`ApiIntegrationTest`; test naming `test{Method}_should{Result}_when{Condition}`.

## Decisions locked (V0.5)

1. **Port shape: two strings + tools, NO message-list.** V0.2 Decision #4 predicted a message-list variant; tool calling does NOT actually force it (Spring AI runs the tool-execution loop internally — our transcript-in-system-prompt shape is untouched). YAGNI: `complete(system, user, tools, toolContext)` + `stream(...)` with `default` two-arg overloads delegating with empty tools.
2. **`ToolCallback`/`ToolContext` in the port are acceptable.** ADR 0008's "no provider types" means Gemini types; spring-ai-core tool types are the provider-agnostic abstraction every 2.0 starter shares (Anthropic/OpenAI adapters would take the same list).
3. **Audit = decorator, refs = explicit.** `RecordingToolCallback` records `{name, args}` for EVERY call (tools cannot forget the audit) and enforces the cap (soft-fail text, no exception — the model answers from what it has). Refs are tool-specific → each tool adds them explicitly via the `ToolCallAudit` carried in the `ToolContext`.
4. **Envelope grows `args`; wire stays `{type,name}`.** `ToolCallsEnvelope.ToolCall` becomes `{type, name, args}` (args = compact display form, e.g. `days=7` — v0.5 args are flat scalars, full fidelity). The wire `MessageTool` is unchanged; `CompanionMapper` renders `name(args)` — exactly the mock-seed chip style (`get_recent_workouts(days=3)`). `type` is always `read` in v0.5 (`ToolCallAudit.TYPE_READ`).
5. **Tool results are compact deterministic Hungarian text** (snapshot idiom): `nincs adat` absences, `num()` plain-string numbers, windows clamped by config — token budgeting by construction, no truncation pass.
6. **Cap + failure are honest, in-band.** Cap hit → `A tool-hívási keret erre a körre elfogyott…` returned to the model (not recorded as a call); tool exception → logged + `Nem sikerült lekérdezni az adatot…` returned (one broken read must not kill the stream).
7. **IDENT-2 is an ArchUnit rule**: nothing in `..feature.companion.tools..` may depend on HTTP/mail client packages. Structural, not prompt-level.
8. **`get_sport_sessions` covers sport + run logs** (both are "sportalkalom" history; the roadmap's 8-tool list has no run tool and a 9th tool would violate the batch discipline for near-zero gain).
9. **`get_protocol_adherence` measures against the CURRENT active protocol** for the whole window (protocol-version time-travel is v1+ material; noted in the living doc).
10. **`get_goal_progress` is a pure read composition** (goal + `WeightTrendService.computeTrend` + current segment) — `GoalEngineService.evaluate` is a WRITE and must not be called from a tool. The `currentSegment` helper is extracted to `GoalPrescriptionJson` (static) and the snapshot assembler reuses it.
11. **Sync and streamed turns both get tools** — same registry, same audit persistence; the sync path keeps single-TX semantics (tool reads are cheap; V0.3 gotcha notes anything heavier belongs elsewhere).
12. **Existing-null compatibility:** `ToolCallAudit.toToolCallsEnvelope()`/`toRefsEnvelope()` return `null` when empty — a turn with no tool calls persists null envelopes exactly like V0.2–V0.4 (mapper: null → `[]` on the wire; no data migration).

---

### Task 1: Branch + contract touch-up + regen

**Files:**
- Modify: `api/feature/companion/companion.yml` (description strings only)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: unchanged schema shapes (`MessageTool {type, name}`, `MessageRef {kind, id}`) with V0.5-true descriptions. Backend generated types regen automatically in the next `./mvnw` run.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/companion-v05
```

- [ ] **Step 2: Update the three stale descriptions in `api/feature/companion/companion.yml`**

In `MessageResponse.properties.tools.description`:
`Tool calls behind this answer — always empty until V0.5.` → `Tool calls behind this answer (V0.5): read-tool invocations of this turn, name carries the args, e.g. "get_weight_trend(weeks=2)". Empty when the turn used no tools.`

In `MessageResponse.properties.refs.description`:
`Data references backing this answer — always empty until V0.5.` → `Data references backing this answer (V0.5): entity refs contributed by the executed tools (deduped, capped). Empty when the turn used no tools.`

In `MessageTool.properties.type.description`:
`'read' | 'compute' (mirrors the FE ToolType)` → `'read' | 'compute' (mirrors the FE ToolType) — V0.5 emits only 'read'.`

- [ ] **Step 3: Merge + regen FE types**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Expected: `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` change comments/descriptions only (no type shape diff).

- [ ] **Step 4: Commit**

```bash
git add api/ frontend/src/data/_client/api.gen.ts
git commit -m "docs(api): companion tools/refs descriptions go V0.5-true (mezo-fnnq.5)"
```

---

### Task 2: Config — `CompanionProperties.Tools` + yml

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.companion.tools` block)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java`

**Interfaces:**
- Produces: `properties.tools().maxCallsPerTurn()` (int, default 6), `.maxWindowDays()` (30), `.maxTrendWeeks()` (26), `.maxRefsPerTurn()` (10).

- [ ] **Step 1: Write the failing test** — add to `CompanionPropertiesIT`:

```java
@Test
void testTools_shouldBindToolTunables_whenDefaultsLoaded() {
    assertThat(properties.tools().maxCallsPerTurn()).isEqualTo(6);
    assertThat(properties.tools().maxWindowDays()).isEqualTo(30);
    assertThat(properties.tools().maxTrendWeeks()).isEqualTo(26);
    assertThat(properties.tools().maxRefsPerTurn()).isEqualTo(10);
}
```

- [ ] **Step 2: Run it** — `cd backend && ./mvnw clean test -Dtest=CompanionPropertiesIT` → FAIL (no `tools()` accessor).

- [ ] **Step 3: Implement** — extend the record (new component + nested record):

```java
public record CompanionProperties(
    @NotNull @Valid Llm llm,
    @NotNull @Valid Chat chat,
    @NotNull @Valid Snapshot snapshot,
    @NotNull @Valid Tools tools
) {
    // …existing Llm/Chat/Snapshot…

    /** V0.5 tool-calling tuning — per-turn budget + result-window clamps (token budget by construction). */
    public record Tools(
        /** Max recorded tool calls per chat turn; past it tools soft-fail with an honest in-band message. */
        @Min(1) @Max(20) int maxCallsPerTurn,
        /** Upper clamp for the day-window tool args (days=…). */
        @Min(1) @Max(60) int maxWindowDays,
        /** Upper clamp for get_weight_trend(weeks=…). */
        @Min(1) @Max(52) int maxTrendWeeks,
        /** Max refs persisted per turn (deduped, insertion-ordered). */
        @Min(1) @Max(30) int maxRefsPerTurn
    ) {}
}
```

`application.yml` under `mezo.companion` (after `snapshot:`):

```yaml
    tools:
      # V0.5 tool calling — per-turn call budget + result-window clamps (spec §5 discipline)
      max-calls-per-turn: 6
      max-window-days: 30
      max-trend-weeks: 26
      max-refs-per-turn: 10
```

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest=CompanionPropertiesIT` → PASS. (Full suite compiles because only this IT references `tools()` yet; `@NotNull` means every test context needs the yml block — it lives in the main `application.yml`, inherited by tests.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionPropertiesIT.java
git commit -m "feat(companion): tools config block — call budget + window clamps (mezo-fnnq.5)"
```

---

### Task 3: `ToolCallAudit` + `ToolContexts` + `RecordingToolCallback` (pure units)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAudit.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolContexts.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/RecordingToolCallback.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/ToolCallsEnvelope.java` (ToolCall gains `args`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/ToolCallAuditTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/RecordingToolCallbackTest.java`

**Interfaces:**
- Produces:
  - `new ToolCallAudit(int maxCalls, int maxRefs)`; `boolean budgetExhausted()`; `void recordCall(String name, String args)`; `void addRef(String kind, String id)`; `ToolCallsEnvelope toToolCallsEnvelope()` (null when empty); `RefsEnvelope toRefsEnvelope()` (null when empty); `int callCount()`.
  - `ToolContexts.USER_ID` / `ToolContexts.AUDIT` (String keys); `UUID ToolContexts.userId(ToolContext ctx)`; `ToolCallAudit ToolContexts.audit(ToolContext ctx)`.
  - `new RecordingToolCallback(ToolCallback delegate, ToolCallAudit audit)` implements `org.springframework.ai.tool.ToolCallback`; constants `BUDGET_EXHAUSTED`, `TOOL_FAILED`.
  - `ToolCallsEnvelope.ToolCall(String type, String name, String args)` — old 2-field jsonb rows deserialize with `args = null`.

- [ ] **Step 1: Failing tests**

`ToolCallAuditTest`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import org.junit.jupiter.api.Test;

class ToolCallAuditTest {

    @Test
    void testToEnvelopes_shouldReturnNull_whenNothingRecorded() {
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        assertThat(audit.toToolCallsEnvelope()).isNull();
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testRecordCall_shouldTypeRead_andExhaustBudgetAtCap() {
        ToolCallAudit audit = new ToolCallAudit(2, 10);
        audit.recordCall("get_sleep", "days=7");
        assertThat(audit.budgetExhausted()).isFalse();
        audit.recordCall("get_weight_trend", "weeks=2");
        assertThat(audit.budgetExhausted()).isTrue();
        ToolCallsEnvelope envelope = audit.toToolCallsEnvelope();
        assertThat(envelope.calls()).extracting(ToolCallsEnvelope.ToolCall::type)
                .containsOnly(ToolCallAudit.TYPE_READ);
        assertThat(envelope.calls()).extracting(ToolCallsEnvelope.ToolCall::name)
                .containsExactly("get_sleep", "get_weight_trend");
        assertThat(envelope.calls().getFirst().args()).isEqualTo("days=7");
    }

    @Test
    void testAddRef_shouldDedupeAndCap() {
        ToolCallAudit audit = new ToolCallAudit(6, 2);
        audit.addRef("Sleep", "2026-07-01");
        audit.addRef("Sleep", "2026-07-01"); // dupe
        audit.addRef("Sleep", "2026-07-02");
        audit.addRef("Sleep", "2026-07-03"); // over cap — dropped
        RefsEnvelope refs = audit.toRefsEnvelope();
        assertThat(refs.refs()).containsExactly(
                new RefsEnvelope.Ref("Sleep", "2026-07-01"),
                new RefsEnvelope.Ref("Sleep", "2026-07-02"));
    }
}
```

`RecordingToolCallbackTest` (hand-written stub delegate — no Mockito):

```java
package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;

import java.util.Map;

class RecordingToolCallbackTest {

    private static ToolCallback stub(String name, String result, boolean throwing) {
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() {
                return ToolDefinition.builder().name(name).description("stub").inputSchema("{}").build();
            }
            @Override public String call(String toolInput) { return call(toolInput, null); }
            @Override public String call(String toolInput, ToolContext toolContext) {
                if (throwing) throw new IllegalStateException("boom");
                return result;
            }
        };
    }

    @Test
    void testCall_shouldRecordCompactArgsAndDelegate_whenWithinBudget() {
        ToolCallAudit audit = new ToolCallAudit(2, 10);
        RecordingToolCallback cb = new RecordingToolCallback(stub("get_sleep", "OK", false), audit);
        String out = cb.call("{\"days\":7}", new ToolContext(Map.of()));
        assertThat(out).isEqualTo("OK");
        assertThat(audit.toToolCallsEnvelope().calls().getFirst().args()).isEqualTo("days=7");
    }

    @Test
    void testCall_shouldSoftFailWithoutRecording_whenBudgetExhausted() {
        ToolCallAudit audit = new ToolCallAudit(1, 10);
        RecordingToolCallback cb = new RecordingToolCallback(stub("get_sleep", "OK", false), audit);
        cb.call("{}", new ToolContext(Map.of()));
        String out = cb.call("{}", new ToolContext(Map.of()));
        assertThat(out).isEqualTo(RecordingToolCallback.BUDGET_EXHAUSTED);
        assertThat(audit.callCount()).isEqualTo(1);
    }

    @Test
    void testCall_shouldReturnHonestErrorText_whenDelegateThrows() {
        ToolCallAudit audit = new ToolCallAudit(6, 10);
        RecordingToolCallback cb = new RecordingToolCallback(stub("get_sleep", null, true), audit);
        String out = cb.call("{}", new ToolContext(Map.of()));
        assertThat(out).isEqualTo(RecordingToolCallback.TOOL_FAILED);
        assertThat(audit.callCount()).isEqualTo(1); // the attempt IS audited
    }

    @Test
    void testCompactArgs_shouldFlattenScalars_andHandleBlank() {
        assertThat(RecordingToolCallback.compactArgs("{\"days\":7}")).isEqualTo("days=7");
        assertThat(RecordingToolCallback.compactArgs("{\"weeks\":2,\"x\":\"a\"}")).isEqualTo("weeks=2, x=a");
        assertThat(RecordingToolCallback.compactArgs("")).isEmpty();
        assertThat(RecordingToolCallback.compactArgs(null)).isEmpty();
        assertThat(RecordingToolCallback.compactArgs("{}")).isEmpty();
    }
}
```

- [ ] **Step 2: Run** — `./mvnw clean test -Dtest='ToolCallAuditTest,RecordingToolCallbackTest'` → FAIL (classes missing).

- [ ] **Step 3: Implement**

`ToolCallsEnvelope.java` — extend the nested record (jsonb-compatible: old rows lack `args` → null):

```java
/**
 * Typed jsonb envelope for ai_message.tool_calls (ADR 0006 / ProvenanceEnvelope precedent).
 * V0.5 writes one entry per executed read tool. {@code args} is the compact display form
 * ("days=7") — v0.5 args are flat scalars, so this IS full fidelity; pre-V0.5 rows are null.
 * Field names {type,name} mirror the FE mock Tool contract.
 */
public record ToolCallsEnvelope(List<ToolCall> calls) {

    public record ToolCall(String type, String name, String args) {
    }
}
```

`ToolCallAudit.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Per-turn tool audit collector (V0.5). One instance per chat turn, carried to the tools inside
 * the Spring AI ToolContext ({@link ToolContexts#AUDIT}); the {@link RecordingToolCallback}
 * decorator records every call, the tools add their data refs. Spring AI executes a turn's tool
 * calls sequentially, so no synchronization is needed.
 */
public class ToolCallAudit {

    public static final String TYPE_READ = "read";

    private final int maxCalls;
    private final int maxRefs;
    private final List<ToolCallsEnvelope.ToolCall> calls = new ArrayList<>();
    private final LinkedHashSet<RefsEnvelope.Ref> refs = new LinkedHashSet<>();

    public ToolCallAudit(int maxCalls, int maxRefs) {
        this.maxCalls = maxCalls;
        this.maxRefs = maxRefs;
    }

    public boolean budgetExhausted() {
        return calls.size() >= maxCalls;
    }

    public void recordCall(String name, String args) {
        calls.add(new ToolCallsEnvelope.ToolCall(TYPE_READ, name, args));
    }

    /** Deduped (LinkedHashSet) and capped — first {@code maxRefs} distinct refs win. */
    public void addRef(String kind, String id) {
        if (refs.size() < maxRefs) {
            refs.add(new RefsEnvelope.Ref(kind, id));
        }
    }

    public int callCount() {
        return calls.size();
    }

    /** Null when no tool ran — a tool-less turn persists exactly like V0.2 (null envelope → [] on the wire). */
    public ToolCallsEnvelope toToolCallsEnvelope() {
        return calls.isEmpty() ? null : new ToolCallsEnvelope(List.copyOf(calls));
    }

    public RefsEnvelope toRefsEnvelope() {
        return refs.isEmpty() ? null : new RefsEnvelope(List.copyOf(refs));
    }
}
```

`ToolContexts.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import org.springframework.ai.chat.model.ToolContext;

import java.util.UUID;

/**
 * Keys + typed accessors for the per-turn Spring AI ToolContext. The user id ALWAYS comes from
 * here (JWT principal via ChatService), never from model-provided args — ownership scoping is
 * structural (spec §5).
 */
public final class ToolContexts {

    public static final String USER_ID = "userId";
    public static final String AUDIT = "audit";

    private ToolContexts() {
    }

    public static UUID userId(ToolContext ctx) {
        return (UUID) ctx.getContext().get(USER_ID);
    }

    public static ToolCallAudit audit(ToolContext ctx) {
        return (ToolCallAudit) ctx.getContext().get(AUDIT);
    }
}
```

`RecordingToolCallback.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.lang.Nullable;

/**
 * Audit + budget decorator around every companion tool (V0.5). Recording lives HERE so a tool
 * can never forget the audit; the per-turn cap soft-fails with honest in-band text (the model
 * answers from what it already has), and a tool exception becomes an honest error result —
 * one broken read must not kill a streamed turn.
 */
@Slf4j
@RequiredArgsConstructor
public class RecordingToolCallback implements ToolCallback {

    static final String BUDGET_EXHAUSTED =
            "A tool-hívási keret erre a körre elfogyott — válaszolj a már lekért adatokból.";
    static final String TOOL_FAILED = "Nem sikerült lekérdezni az adatot (belső hiba).";

    private final ToolCallback delegate;
    private final ToolCallAudit audit;

    @Override
    public ToolDefinition getToolDefinition() {
        return delegate.getToolDefinition();
    }

    @Override
    public String call(String toolInput) {
        return call(toolInput, null);
    }

    @Override
    public String call(String toolInput, @Nullable ToolContext toolContext) {
        if (audit.budgetExhausted()) {
            return BUDGET_EXHAUSTED;
        }
        audit.recordCall(getToolDefinition().name(), compactArgs(toolInput));
        try {
            return delegate.call(toolInput, toolContext);
        } catch (Exception e) {
            log.warn("Companion tool {} failed", getToolDefinition().name(), e);
            return TOOL_FAILED;
        }
    }

    /**
     * {"days":7} → "days=7". V0.5 tool args are flat scalar JSON objects, so a manual parse is
     * full-fidelity and avoids coupling the audit to a JSON library. Anything unparseable
     * renders as "" — never throws.
     */
    static String compactArgs(@Nullable String toolInput) {
        if (toolInput == null || toolInput.isBlank()) {
            return "";
        }
        String body = toolInput.trim();
        if (body.startsWith("{")) {
            body = body.substring(1, body.endsWith("}") ? body.length() - 1 : body.length());
        }
        if (body.isBlank()) {
            return "";
        }
        return body.replace("\"", "").replace(":", "=").replace(",", ", ").trim();
    }
}
```

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest='ToolCallAuditTest,RecordingToolCallbackTest,AiMessageJsonbRoundTripIT'` → PASS (round-trip IT proves the 3-field ToolCall still round-trips; if its fixture builds `ToolCall`s, update to the 3-arg constructor).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ backend/src/main/java/io/mrkuhne/mezo/feature/companion/entity/ToolCallsEnvelope.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/
git commit -m "feat(companion): per-turn tool audit + recording/budget decorator (mezo-fnnq.5)"
```

---

### Task 4: `BiometricsTools` — `get_weight_trend(weeks)` + `get_sleep(days)`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/BiometricsTools.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ToolText.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java` (since-date finder)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java` (born here, grows in Tasks 5–7)

**Interfaces:**
- Consumes: `ToolContexts`, `ToolCallAudit` (Task 3), `CompanionProperties.Tools` (Task 2), `WeightTrendService.computeTrend(UUID)`, new `SleepLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(UUID, LocalDate)`.
- Produces: `@Tool(name="get_weight_trend")` / `@Tool(name="get_sleep")` methods on a switch-gated `@Component`; `ToolText.num(BigDecimal)`; `ToolText.clamp(Integer, int, int, int)`.

- [ ] **Step 1: Failing IT** — `CompanionToolsRenderIT` (no fake profile needed — no LLM anywhere):

```java
package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** LLM-free render tests for the V0.5 tool batch — the ContextSnapshotAssemblerIT idiom. */
class CompanionToolsRenderIT extends AbstractIntegrationTest {

    @Autowired private BiometricsTools biometricsTools;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    private ToolCallAudit audit;

    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testGetWeightTrend_shouldRenderNincsAdat_whenNoWeighIns() {
        UUID owner = ownerId();
        String out = biometricsTools.getWeightTrend(4, ctx(owner));
        assertThat(out).contains("nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testGetWeightTrend_shouldRenderTrendAndWeeklyPoints_whenHistoryExists() {
        UUID owner = ownerId();
        for (int i = 0; i < 21; i++) {
            weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(20 - i),
                    BigDecimal.valueOf(88.0 - i * 0.1));
        }
        String out = biometricsTools.getWeightTrend(2, ctx(owner));
        assertThat(out).startsWith("Súlytrend (2 hét):").contains("trendsúly").contains("kg");
        assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).containsExactly("WeightTrend");
    }

    @Test
    void testGetSleep_shouldListWindowedRows_andClampDays() {
        UUID owner = ownerId();
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(1), new BigDecimal("7.5"), 4);
        sleepLogPopulator.createSleepLog(owner, LocalDate.now().minusDays(40), new BigDecimal("6.0"), 2);
        String out = biometricsTools.getSleep(90, ctx(owner)); // clamps to max-window-days=30
        assertThat(out).startsWith("Alvás (utolsó 30 nap):")
                .contains(LocalDate.now().minusDays(1) + ": 7.5 h, minőség 4/5")
                .doesNotContain(LocalDate.now().minusDays(40).toString());
        assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).containsExactly("Sleep");
    }

    @Test
    void testGetSleep_shouldRenderNincsAdat_whenEmpty() {
        String out = biometricsTools.getSleep(null, ctx(ownerId()));
        assertThat(out).isEqualTo("Alvás (utolsó 7 nap): nincs adat");
    }
}
```

*(`ownerId()` = however `AbstractIntegrationTest` exposes the seeded owner — reuse the exact idiom from `ContextSnapshotAssemblerIT`, e.g. a `UserPopulator`-created user or the demodata owner lookup. Read that IT first and mirror it.)*

- [ ] **Step 2: Run** — `./mvnw clean test -Dtest=CompanionToolsRenderIT` → FAIL (beans missing).

- [ ] **Step 3: Implement**

`SleepLogRepository` — add (mirrors the sport/run finder naming exactly):

```java
/** Last-N-days window for the companion get_sleep tool (V0.5) — plain finder, no companion dependency. */
List<SleepLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
        UUID createdBy, LocalDate from);
```

`ToolText.java` (shared render helpers for the toolsets):

```java
package io.mrkuhne.mezo.feature.companion.tools;

import java.math.BigDecimal;

/** Shared render helpers for the V0.5 toolsets — the snapshot's num() idiom + arg clamping. */
final class ToolText {

    static final String NO_DATA = "nincs adat";

    private ToolText() {
    }

    /** Locale-independent compact number: strip trailing zeros, plain (non-scientific) string. */
    static String num(BigDecimal v) {
        return v == null ? "?" : v.stripTrailingZeros().toPlainString();
    }

    /** Null-safe window clamp: model may omit the arg (fallback) or overshoot (min/max). */
    static int clamp(Integer value, int min, int max, int fallback) {
        return value == null ? fallback : Math.clamp(value, min, max);
    }
}
```

`BiometricsTools.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * V0.5 read tools over the biometrics feature (weight trend + sleep). Read-only, ownership-scoped
 * via ToolContext (never model args), honest "nincs adat" absences — spec §5/§6.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class BiometricsTools {

    private final WeightTrendService weightTrendService;
    private final SleepLogRepository sleepLogRepository;
    private final CompanionProperties properties;

    @Tool(name = "get_weight_trend", description = "Súlytrend az elmúlt hetekre: EWMA trendsúly, "
            + "heti ütem (kg és %), 4 hetes ütem, heti trendpontok. Kérdés súlyváltozásról, fogyásról, ütemről.")
    public String getWeightTrend(
            @ToolParam(required = false, description = "Hány hétre visszamenőleg (alapértelmezés 4).") Integer weeks,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int w = ToolText.clamp(weeks, 1, properties.tools().maxTrendWeeks(), 4);
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        if (trend.getLatestTrendKg() == null || trend.getEwmaSeries().isEmpty()
                || trend.getDataSufficiency() == WeightTrendResponse.DataSufficiencyEnum.NONE) {
            return "Súlytrend (" + w + " hét): " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Súlytrend (").append(w).append(" hét): trendsúly ")
                .append(ToolText.num(trend.getLatestTrendKg())).append(" kg");
        if (trend.getWeeklyRateKgPerWeek() != null) {
            b.append(", heti ütem ").append(ToolText.num(trend.getWeeklyRateKgPerWeek())).append(" kg");
        }
        if (trend.getWeeklyRatePctPerWeek() != null) {
            b.append(" (").append(ToolText.num(trend.getWeeklyRatePctPerWeek())).append("%/hét)");
        }
        if (trend.getLast4wRateKgPerWeek() != null) {
            b.append(", 4 hetes ütem ").append(ToolText.num(trend.getLast4wRateKgPerWeek())).append(" kg/hét");
        }
        LocalDate from = LocalDate.now().minusWeeks(w);
        // one point per ISO week (the last EWMA point of each week) — token budget by construction
        Map<Integer, String> weekly = new LinkedHashMap<>();
        trend.getEwmaSeries().stream()
                .filter(p -> !p.getDate().isBefore(from))
                .forEach(p -> weekly.put(
                        p.getDate().get(WeekFields.ISO.weekBasedYear()) * 100
                                + p.getDate().get(WeekFields.ISO.weekOfWeekBasedYear()),
                        p.getDate() + ": " + ToolText.num(p.getTrendKg()) + " kg"));
        if (!weekly.isEmpty()) {
            b.append("\nHeti trendpontok: ").append(String.join("; ", weekly.values()));
        }
        ToolContexts.audit(toolContext).addRef("WeightTrend", w + "h");
        return b.toString();
    }

    @Tool(name = "get_sleep", description = "Alvásnapló az elmúlt napokra: dátum, óra, minőség (1-5), "
            + "ébredések. Kérdés alvásról, pihenésről, alvásminőségről.")
    public String getSleep(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate from = LocalDate.now().minusDays(d - 1L);
        List<SleepLogEntity> rows =
                sleepLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        String header = "Alvás (utolsó " + d + " nap):";
        if (rows.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (SleepLogEntity row : rows) {
            b.append('\n').append(row.getDate()).append(": ").append(ToolText.num(row.getDurationH())).append(" h");
            if (row.getQuality() != null) {
                b.append(", minőség ").append(row.getQuality()).append("/5");
            }
            if (row.getAwakenings() != null) {
                b.append(", ébredés: ").append(row.getAwakenings());
            }
        }
        rows.stream().limit(5).forEach(r ->
                ToolContexts.audit(toolContext).addRef("Sleep", r.getDate().toString()));
        return b.toString();
    }
}
```

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest=CompanionToolsRenderIT` → PASS. Adjust assertion strings to the exact implemented render if needed (assertions are the spec — prefer fixing the impl).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/repository/SleepLogRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java
git commit -m "feat(companion): biometrics read tools — weight trend + sleep window (mezo-fnnq.5)"
```

---

### Task 5: `TrainTools` — `get_recent_workouts(days)` + `get_sport_sessions(days)`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/TrainTools.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java` (instances-between finder)
- Test: extend `CompanionToolsRenderIT`

**Interfaces:**
- Consumes: Task 3 helpers; `ExerciseSetRepository.findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc`, `SportSessionRepository`/`RunSessionLogRepository` since-date finders (exist).
- Produces: `@Tool get_recent_workouts` / `@Tool get_sport_sessions`; `WorkoutSessionRepository.findDoneInstancesBetween(UUID, LocalDate, LocalDate)`.

- [ ] **Step 1: Failing IT** — add to `CompanionToolsRenderIT` (inject `TrainTools`, `TrainPopulator`, `RunningPopulator`):

```java
@Test
void testGetRecentWorkouts_shouldRenderInstanceLinesWithVolume_whenLoggedSetsExist() {
    UUID owner = ownerId();
    MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Blokk", "active");
    WorkoutSessionEntity template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Pull A", "pull", 0, "planned");
    WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(owner, template, LocalDate.now().minusDays(2), "completed");
    ExerciseEntity ex = trainPopulator.createExercise(owner, instance.getId(), "Húzódzkodás", 0);
    trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 0, "80", 8, 2, Instant.now());
    trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 1, "80", 6, 1, Instant.now());

    String out = trainTools.getRecentWorkouts(7, ctx(owner));
    assertThat(out).startsWith("Gym-edzések (utolsó 7 nap):")
            .contains(LocalDate.now().minusDays(2) + ": Pull A (pull) — 2 sorozat, volumen 1120 kg");
    assertThat(audit.toRefsEnvelope().refs()).contains(new RefsEnvelope.Ref("Workout", LocalDate.now().minusDays(2).toString()));
}

@Test
void testGetRecentWorkouts_shouldRenderNincsAdat_whenWindowEmpty() {
    assertThat(trainTools.getRecentWorkouts(null, ctx(ownerId())))
            .isEqualTo("Gym-edzések (utolsó 7 nap): " + ToolText.NO_DATA);
}

@Test
void testGetSportSessions_shouldRenderSportAndRunLines_whenBothExist() {
    UUID owner = ownerId();
    trainPopulator.createSportSession(owner, LocalDate.now().minusDays(1), "volleyball", 5, null, "6.5");
    RunningBlockEntity block = runningPopulator.createBlock(owner, "Futás blokk", "active");
    runningPopulator.createRunLog(owner, block.getId(), 2, "int1", LocalDate.now().minusDays(3), 6, 7, null, null, 35);

    String out = trainTools.getSportSessions(7, ctx(owner));
    assertThat(out).startsWith("Sportalkalmak (utolsó 7 nap):")
            .contains("volleyball")
            .contains("Futások:")
            .contains(LocalDate.now().minusDays(3) + ": 2. hét int1 — 6 kör, RPE 7, 35 perc");
    assertThat(audit.toRefsEnvelope().refs())
            .contains(new RefsEnvelope.Ref("Sport", LocalDate.now().minusDays(1).toString()),
                      new RefsEnvelope.Ref("Run", LocalDate.now().minusDays(3).toString()));
}
```

*(Populator signatures per `TrainPopulator`/`RunningPopulator` — verify exact arg lists when writing; e.g. `createSportSession(UUID, LocalDate, String sport, Integer setsPlayed, Integer rounds, String rpe)`.)*

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`WorkoutSessionRepository` — add (mirror `findDoneInstanceDates`' JPQL style — read it first; same "instance with ≥1 logged set" semantics, returning entities):

```java
/** Completed-work instances (≥1 logged set) in [from,to] for the companion get_recent_workouts tool (V0.5). */
@Query("""
        select w from WorkoutSessionEntity w
        where w.createdBy = :createdBy and w.templateSessionId is not null
          and w.date between :from and :to
          and exists (select 1 from ExerciseSetEntity s
                      where s.workoutSessionId = w.id and s.createdBy = :createdBy and s.reps is not null)
        order by w.date asc
        """)
List<WorkoutSessionEntity> findDoneInstancesBetween(UUID createdBy, LocalDate from, LocalDate to);
```

`TrainTools.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** V0.5 read tools over the train feature (gym instances + sport/run history). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class TrainTools {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final CompanionProperties properties;

    @Tool(name = "get_recent_workouts", description = "Gym-edzések az elmúlt napokra: dátum, edzésnap "
            + "(pl. Pull A), sorozatszám, összvolumen kg-ban. Kérdés edzésekről, edzésmennyiségről, volumenről.")
    public String getRecentWorkouts(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        List<WorkoutSessionEntity> instances =
                workoutSessionRepository.findDoneInstancesBetween(userId, today.minusDays(d - 1L), today);
        String header = "Gym-edzések (utolsó " + d + " nap):";
        if (instances.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (WorkoutSessionEntity w : instances) {
            List<ExerciseSetEntity> sets = exerciseSetRepository
                    .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(userId, w.getId())
                    .stream().filter(s -> !s.isSkipped() && s.getReps() != null).toList();
            BigDecimal volume = sets.stream()
                    .filter(s -> s.getWeightKg() != null)
                    .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            b.append('\n').append(w.getDate()).append(": ").append(w.getDayLabel());
            if (w.getType() != null) {
                b.append(" (").append(w.getType()).append(')');
            }
            b.append(" — ").append(sets.size()).append(" sorozat, volumen ")
                    .append(ToolText.num(volume)).append(" kg");
        }
        instances.reversed().stream().limit(5).forEach(w ->
                ToolContexts.audit(toolContext).addRef("Workout", w.getDate().toString()));
        return b.toString();
    }

    @Tool(name = "get_sport_sessions", description = "Sportalkalmak (röplabda/cross/TRX) és futások az "
            + "elmúlt napokra: dátum, időtartam, intenzitás, RPE, körök. Kérdés sportról, futásról, terhelésről.")
    public String getSportSessions(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate from = LocalDate.now().minusDays(d - 1L);
        List<SportSessionEntity> sport = sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        List<RunSessionLogEntity> runs = runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        String header = "Sportalkalmak (utolsó " + d + " nap):";
        if (sport.isEmpty() && runs.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        if (sport.isEmpty()) {
            b.append(' ').append(ToolText.NO_DATA);
        }
        for (SportSessionEntity s : sport) {
            b.append('\n').append(s.getDate()).append(": ").append(s.getSport());
            if (s.getDurationMin() != null) {
                b.append(' ').append(s.getDurationMin()).append(" perc");
            }
            if (s.getIntensity() != null) {
                b.append(", intenzitás ").append(s.getIntensity()).append("/10");
            }
            if (s.getRpe() != null) {
                b.append(", RPE ").append(ToolText.num(s.getRpe()));
            }
            if (s.getSetsPlayed() != null) {
                b.append(", ").append(s.getSetsPlayed()).append(" szett");
            }
        }
        if (!runs.isEmpty()) {
            b.append("\nFutások:");
            for (RunSessionLogEntity r : runs) {
                b.append('\n').append(r.getDate()).append(": ").append(r.getWeekNumber()).append(". hét ")
                        .append(r.getSessionKey());
                if (r.getCompletedRounds() != null) {
                    b.append(" — ").append(r.getCompletedRounds()).append(" kör");
                }
                if (r.getRpeActual() != null) {
                    b.append(", RPE ").append(r.getRpeActual());
                }
                if (r.getDurationMin() != null) {
                    b.append(", ").append(r.getDurationMin()).append(" perc");
                }
            }
        }
        sport.stream().limit(3).forEach(s ->
                ToolContexts.audit(toolContext).addRef("Sport", s.getDate().toString()));
        runs.stream().limit(3).forEach(r ->
                ToolContexts.audit(toolContext).addRef("Run", r.getDate().toString()));
        return b.toString();
    }
}
```

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest=CompanionToolsRenderIT` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/TrainTools.java backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/WorkoutSessionRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java
git commit -m "feat(companion): train read tools — recent workouts + sport/run sessions (mezo-fnnq.5)"
```

---

### Task 6: `FuelTools` — `get_recent_meals(days)` + `get_protocol_adherence(days)`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/FuelTools.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/repository/SupplementIntakeRepository.java` (since-date finder)
- Test: extend `CompanionToolsRenderIT`

**Interfaces:**
- Consumes: `FuelDayService.getDay(UUID, LocalDate)` (per-day rollup; looped), `ProtocolService.getView(UUID).getActive()` (`ProtocolResponse.getVersion()/.getSelectedPantryItemIds()`), new intake range finder.
- Produces: `@Tool get_recent_meals` / `@Tool get_protocol_adherence`.

- [ ] **Step 1: Failing IT** — add to `CompanionToolsRenderIT` (inject `FuelTools`, `MealPopulator`, `PantryItemPopulator`, `ProtocolPopulator`, `SupplementIntakePopulator`):

```java
@Test
void testGetRecentMeals_shouldRenderDayRollupsWithTitles() {
    UUID owner = ownerId();
    PantryItemEntity item = pantryItemPopulator.createPantryItem(owner); // reuse the existing factory idiom
    mealPopulator.createPantryMeal(owner, item, LocalDate.now().minusDays(1));

    String out = fuelTools.getRecentMeals(3, ctx(owner));
    assertThat(out).startsWith("Napi étkezés-összesítők (utolsó 3 nap):")
            .contains(LocalDate.now().minusDays(1).toString())
            .contains("kcal").contains("étkezés");
    assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).contains("FuelDay");
}

@Test
void testGetProtocolAdherence_shouldRenderPerDayCoverage_whenProtocolActive() {
    UUID owner = ownerId();
    PantryItemEntity a = pantryItemPopulator.createPantryItem(owner);
    PantryItemEntity b = pantryItemPopulator.createPantryItem(owner);
    protocolPopulator.createProtocol(owner, 3, "active", List.of(a.getId(), b.getId()));
    supplementIntakePopulator.createIntake(owner, a.getId(), Instant.now());

    String out = fuelTools.getProtocolAdherence(1, ctx(owner));
    assertThat(out).startsWith("Protokoll-követés (utolsó 1 nap): aktív protokoll v3, 2 elem")
            .contains(LocalDate.now() + ": 1/2")
            .contains("Összesen: 1/2 (50%)");
    assertThat(audit.toRefsEnvelope().refs()).containsExactly(new RefsEnvelope.Ref("Protocol", "v3"));
}

@Test
void testGetProtocolAdherence_shouldRenderNincsAktivProtokoll_whenNoneActive() {
    assertThat(fuelTools.getProtocolAdherence(7, ctx(ownerId())))
            .isEqualTo("Protokoll-követés: nincs aktív protokoll");
}
```

*(`createIntake` stores `takenDate` from `takenAt` — check the populator; if `takenDate` is a separate param, pass `LocalDate.now()`.)*

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`SupplementIntakeRepository` — add:

```java
/** Intakes since a date for the companion get_protocol_adherence tool (V0.5) — plain finder. */
List<SupplementIntakeEntity> findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(
        UUID createdBy, LocalDate from);
```

`FuelTools.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tools over the fuel/meal features (day rollups + supplement-protocol adherence). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FuelTools {

    private final FuelDayService fuelDayService;
    private final ProtocolService protocolService;
    private final SupplementIntakeRepository supplementIntakeRepository;
    private final CompanionProperties properties;

    @Tool(name = "get_recent_meals", description = "Napi étkezés-összesítők az elmúlt napokra: kcal és "
            + "makrók a célhoz képest, étkezésszám, ételek. Kérdés étkezésről, kalóriáról, fehérjebevitelről.")
    public String getRecentMeals(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        StringBuilder b = new StringBuilder("Napi étkezés-összesítők (utolsó ").append(d).append(" nap):");
        int daysWithMeals = 0;
        for (int i = d - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            FuelDayResponse day = fuelDayService.getDay(userId, date);
            MacroSet c = day.getConsumed();
            MacroSet t = day.getTargets();
            b.append('\n').append(date).append(": ")
                    .append(ToolText.num(c.getKcal())).append('/').append(ToolText.num(t.getKcal()))
                    .append(" kcal, F ").append(ToolText.num(c.getP())).append('/').append(ToolText.num(t.getP()))
                    .append(" g; ").append(day.getMeals().size()).append(" étkezés");
            if (!day.getMeals().isEmpty()) {
                b.append(" (").append(day.getMeals().stream()
                        .map(m -> m.getTitle()).limit(3).collect(Collectors.joining(", ")));
                if (day.getMeals().size() > 3) {
                    b.append(", …");
                }
                b.append(')');
                daysWithMeals++;
                if (daysWithMeals <= 5) {
                    ToolContexts.audit(toolContext).addRef("FuelDay", date.toString());
                }
            }
        }
        return b.toString();
    }

    @Tool(name = "get_protocol_adherence", description = "Étrendkiegészítő-protokoll követése az elmúlt "
            + "napokra: naponta hány elem lett bevéve az aktív protokollból. Kérdés kiegészítőkről, protokollról.")
    public String getProtocolAdherence(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        ProtocolResponse active = protocolService.getView(userId).getActive();
        if (active == null) {
            return "Protokoll-követés: nincs aktív protokoll";
        }
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(d - 1L);
        Set<UUID> protocolItems = new HashSet<>(active.getSelectedPantryItemIds());
        // v0.5 simplification: adherence vs the CURRENT active protocol across the whole window
        Map<LocalDate, Set<UUID>> takenByDay = supplementIntakeRepository
                .findByCreatedByAndDeletedFalseAndTakenDateGreaterThanEqualOrderByTakenDateAscTakenAtAsc(userId, from)
                .stream()
                .collect(Collectors.groupingBy(SupplementIntakeEntity::getTakenDate,
                        Collectors.mapping(SupplementIntakeEntity::getPantryItemId, Collectors.toSet())));
        StringBuilder b = new StringBuilder("Protokoll-követés (utolsó ").append(d).append(" nap): aktív protokoll v")
                .append(active.getVersion()).append(", ").append(protocolItems.size()).append(" elem");
        int takenTotal = 0;
        for (int i = d - 1; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            long taken = takenByDay.getOrDefault(date, Set.of()).stream().filter(protocolItems::contains).count();
            takenTotal += (int) taken;
            b.append('\n').append(date).append(": ").append(taken).append('/').append(protocolItems.size());
        }
        int expectedTotal = protocolItems.size() * d;
        if (expectedTotal > 0) {
            b.append("\nÖsszesen: ").append(takenTotal).append('/').append(expectedTotal)
                    .append(" (").append(Math.round(takenTotal * 100.0 / expectedTotal)).append("%)");
        }
        ToolContexts.audit(toolContext).addRef("Protocol", "v" + active.getVersion());
        return b.toString();
    }
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/FuelTools.java backend/src/main/java/io/mrkuhne/mezo/feature/fuel/repository/SupplementIntakeRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java
git commit -m "feat(companion): fuel read tools — meal day rollups + protocol adherence (mezo-fnnq.5)"
```

---

### Task 7: `GoalTools` + `MedicationTools` (+ `currentSegment` extraction)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/GoalTools.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/MedicationTools.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalPrescriptionJson.java` (static `currentSegment`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java` (reuse the extracted helper, delete its private copy)
- Test: extend `CompanionToolsRenderIT`

**Interfaces:**
- Consumes: `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(UUID,"active")`, `WeightTrendService.computeTrend`, `MedicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse`, `MedicationCycleService.derive(UUID, MedicationEntity, LocalDate)` → `MedicationCycle{retaDay, phaseKey, phaseLabel, lastDoseAt, week}`, `MedicationDoseRepository.findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc`.
- Produces: `@Tool get_goal_progress` / `@Tool get_reta_cycle`; `static GoalPrescriptionJson.Segment GoalPrescriptionJson.currentSegment(GoalPrescriptionJson prescription, long week)`.

- [ ] **Step 1: Failing IT** — add to `CompanionToolsRenderIT` (inject `GoalTools`, `MedicationTools`, `GoalPopulator`, `MedicationPopulator`, `MedicationDosePopulator`):

```java
@Test
void testGetGoalProgress_shouldComposeGoalTrendAndSegment_whenActiveGoalExists() {
    UUID owner = ownerId();
    goalPopulator.createGoalFull(owner, LocalDate.now().minusWeeks(2), LocalDate.now().plusWeeks(10),
            samplePrescription(), 4, "06:30", "22:30"); // reuse/mirror ContextSnapshotAssemblerIT's fixture
    weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(1), new BigDecimal("86.4"));
    weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(8), new BigDecimal("87.1"));

    String out = goalTools.getGoalProgress(ctx(owner));
    assertThat(out).startsWith("Cél: ").contains("3. hét").contains("kg");
    assertThat(audit.toRefsEnvelope().refs()).extracting(r -> r.kind()).containsExactly("Goal");
}

@Test
void testGetGoalProgress_shouldRenderNincsAktivCel_whenNone() {
    assertThat(goalTools.getGoalProgress(ctx(ownerId()))).isEqualTo("Cél: nincs aktív cél");
}

@Test
void testGetRetaCycle_shouldRenderCyclePhaseAndDoses_whenDoseAnchored() {
    UUID owner = ownerId();
    MedicationEntity med = medicationPopulator.createReta(owner);
    medicationDosePopulator.createDose(owner, med.getId(), LocalDate.now().minusDays(3), new BigDecimal("4"));

    String out = medicationTools.getRetaCycle(ctx(owner));
    assertThat(out).startsWith("Retatrutid ciklus: Retatrutide — 4. nap (Stabil)")
            .contains("utolsó dózis: " + LocalDate.now().minusDays(3) + " (4 mg)")
            .contains("következő esedékes: " + LocalDate.now().minusDays(3).plusDays(7));
    assertThat(audit.toRefsEnvelope().refs()).containsExactly(new RefsEnvelope.Ref("Medication", "Retatrutide"));
}

@Test
void testGetRetaCycle_shouldRenderHonestZero_whenNoDose() {
    UUID owner = ownerId();
    medicationPopulator.createReta(owner);
    assertThat(medicationTools.getRetaCycle(ctx(owner)))
            .isEqualTo("Retatrutid ciklus: Retatrutide — nincs rögzített dózis");
}
```

*(`samplePrescription()`: copy the prescription fixture already used in `ContextSnapshotAssemblerIT`/`GoalPopulator` — segment fromWeek=1..4, kcal=2100, proteinG=160. `createReta` builds the 7-day cycle with `Stabil` on days 3–5 — day 4 = minusDays(3)+1. `getDoseUnit()` supplies "mg".)*

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`GoalPrescriptionJson` — add the static helper (move the assembler's private `currentSegment` here verbatim):

```java
/** The segment whose fromWeek..toWeek (inclusive) contains {@code week}; null when none. */
public static Segment currentSegment(GoalPrescriptionJson prescription, long week) {
    if (prescription == null || prescription.segments() == null) {
        return null;
    }
    return prescription.segments().stream()
            .filter(s -> s.fromWeek() != null && s.toWeek() != null
                    && week >= s.fromWeek() && week <= s.toWeek())
            .findFirst().orElse(null);
}
```

In `ContextSnapshotAssembler`: delete the private static `currentSegment` and call `GoalPrescriptionJson.currentSegment(goal.getPrescription(), week)` instead.

`GoalTools.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * V0.5 read tool over the goal feature. Pure composition (goal + weight trend + current segment) —
 * GoalEngineService.evaluate is a WRITE and must never be called from a tool.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class GoalTools {

    private final GoalRepository goalRepository;
    private final WeightTrendService weightTrendService;

    @Tool(name = "get_goal_progress", description = "Az aktív cél állása: kezdő/cél/aktuális trendsúly, "
            + "hét sorszáma, terv szerinti és tényleges heti ütem, e heti recept. Kérdés a cél haladásáról.")
    public String getGoalProgress(ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
                .stream().findFirst().orElse(null);
        if (goal == null) {
            return "Cél: nincs aktív cél";
        }
        LocalDate today = LocalDate.now();
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), today) / 7 + 1;
        StringBuilder b = new StringBuilder("Cél: ").append(goal.getTitle())
                .append(" (").append(goal.getTrajectory()).append("), ").append(week).append(". hét; ")
                .append(ToolText.num(goal.getStartWeightKg())).append(" → ")
                .append(goal.getTargetWeightKg() != null ? ToolText.num(goal.getTargetWeightKg()) : "?")
                .append(" kg, ").append(goal.getStartDate()).append(" → ").append(goal.getTargetDate());
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        if (trend.getLatestTrendKg() != null && !trend.getEwmaSeries().isEmpty()
                && trend.getDataSufficiency() != WeightTrendResponse.DataSufficiencyEnum.NONE) {
            b.append("; trendsúly most ").append(ToolText.num(trend.getLatestTrendKg())).append(" kg");
            if (goal.getStartWeightKg() != null) {
                b.append(" (eddig ").append(ToolText.num(
                        trend.getLatestTrendKg().subtract(goal.getStartWeightKg()))).append(" kg)");
            }
            if (trend.getWeeklyRateKgPerWeek() != null) {
                b.append(", tényleges ütem ").append(ToolText.num(trend.getWeeklyRateKgPerWeek())).append(" kg/hét");
            }
        } else {
            b.append("; trendsúly: ").append(ToolText.NO_DATA);
        }
        if (goal.getRateTargetPctPerWeek() != null) {
            b.append(", terv-ütem ").append(ToolText.num(goal.getRateTargetPctPerWeek())).append("%/hét");
        }
        GoalPrescriptionJson.Segment seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        if (seg != null) {
            b.append("; e heti recept: ").append(seg.kcal()).append(" kcal, ")
                    .append(seg.proteinG()).append(" g fehérje");
        }
        ToolContexts.audit(toolContext).addRef("Goal", goal.getTitle());
        return b.toString();
    }
}
```

`MedicationTools.java`:

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tool over the medication feature (Reta cycle + dose ledger). NEVER advises dosing (spec §6). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MedicationTools {

    private final MedicationRepository medicationRepository;
    private final MedicationDoseRepository medicationDoseRepository;
    private final MedicationCycleService medicationCycleService;

    @Tool(name = "get_reta_cycle", description = "Az aktív gyógyszer (retatrutid) ciklusállása: hányadik "
            + "nap, fázis, utolsó dózis, következő esedékes nap, utolsó dózisok. Kérdés a Reta-ciklusról.")
    public String getRetaCycle(ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        MedicationEntity med =
                medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return "Retatrutid ciklus: " + ToolText.NO_DATA;
        }
        LocalDate today = LocalDate.now();
        MedicationCycle cycle = medicationCycleService.derive(userId, med, today);
        if (cycle.retaDay() == 0) {
            return "Retatrutid ciklus: " + med.getName() + " — nincs rögzített dózis";
        }
        List<MedicationDoseEntity> doses = medicationDoseRepository
                .findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc(userId, med.getId());
        MedicationDoseEntity last = doses.getFirst();
        StringBuilder b = new StringBuilder("Retatrutid ciklus: ").append(med.getName())
                .append(" — ").append(cycle.retaDay()).append(". nap (").append(cycle.phaseLabel()).append(")")
                .append("; utolsó dózis: ").append(last.getAdministeredDate())
                .append(" (").append(ToolText.num(last.getDose())).append(' ').append(med.getDoseUnit()).append(')');
        if (med.getCycle() != null) {
            b.append("; következő esedékes: ")
                    .append(last.getAdministeredDate().plusDays(med.getCycle().cycleLengthDays()));
        }
        if (doses.size() > 1) {
            b.append("\nUtolsó dózisok: ").append(doses.stream().limit(5)
                    .map(d1 -> d1.getAdministeredDate() + ": " + ToolText.num(d1.getDose()) + " " + med.getDoseUnit())
                    .collect(Collectors.joining("; ")));
        }
        ToolContexts.audit(toolContext).addRef("Medication", med.getName());
        return b.toString();
    }
}
```

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest='CompanionToolsRenderIT,ContextSnapshotAssemblerIT'` → PASS (the assembler refactor must not change its rendered output).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/ backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalPrescriptionJson.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ContextSnapshotAssembler.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolsRenderIT.java
git commit -m "feat(companion): goal-progress + reta-cycle read tools; currentSegment extracted (mezo-fnnq.5)"
```

---

### Task 8: `CompanionToolRegistry` + ArchUnit IDENT-2 rule

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistry.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistryIT.java`

**Interfaces:**
- Produces: `ToolCallAudit newTurnAudit()`; `List<ToolCallback> callbacks(ToolCallAudit audit)` (all 8, each wrapped in `RecordingToolCallback`); `Map<String,Object> toolContext(UUID userId, ToolCallAudit audit)`.

- [ ] **Step 1: Failing IT**

```java
package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

class CompanionToolRegistryIT extends AbstractIntegrationTest {

    @Autowired private CompanionToolRegistry registry;

    @Test
    void testCallbacks_shouldExposeExactlyTheV05Batch_allWrapped() {
        List<ToolCallback> callbacks = registry.callbacks(registry.newTurnAudit());
        assertThat(callbacks).allSatisfy(cb -> assertThat(cb).isInstanceOf(RecordingToolCallback.class));
        assertThat(callbacks).extracting(cb -> cb.getToolDefinition().name())
                .containsExactlyInAnyOrder(
                        "get_recent_workouts", "get_sport_sessions", "get_weight_trend", "get_recent_meals",
                        "get_sleep", "get_protocol_adherence", "get_goal_progress", "get_reta_cycle");
    }

    @Test
    void testToolContext_shouldCarryUserIdAndAudit() {
        ToolCallAudit audit = registry.newTurnAudit();
        var ctx = registry.toolContext(ownerId(), audit);
        assertThat(ctx).containsEntry(ToolContexts.USER_ID, ownerId())
                .containsEntry(ToolContexts.AUDIT, audit);
    }
}
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The V0.5 tool registry — the ONLY place companion tools are assembled (IDENT-2: everything in
 * here is a read over our own features; the ArchUnit rule companion_tools_are_internal_sphere_only
 * guards the boundary structurally). Every callback is wrapped in RecordingToolCallback so the
 * per-turn audit + budget can never be bypassed.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class CompanionToolRegistry {

    private final TrainTools trainTools;
    private final BiometricsTools biometricsTools;
    private final FuelTools fuelTools;
    private final GoalTools goalTools;
    private final MedicationTools medicationTools;
    private final CompanionProperties properties;

    public ToolCallAudit newTurnAudit() {
        return new ToolCallAudit(
                properties.tools().maxCallsPerTurn(), properties.tools().maxRefsPerTurn());
    }

    public List<ToolCallback> callbacks(ToolCallAudit audit) {
        return Arrays.stream(
                        ToolCallbacks.from(trainTools, biometricsTools, fuelTools, goalTools, medicationTools))
                .<ToolCallback>map(cb -> new RecordingToolCallback(cb, audit))
                .toList();
    }

    public Map<String, Object> toolContext(UUID userId, ToolCallAudit audit) {
        return Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit);
    }
}
```

ArchUnit rule in `ArchitectureTest`:

```java
/** IDENT-2 (spec §6): the tool registry NEVER contains an outward-acting tool — structural, not prompt-level. */
@ArchTest
static final ArchRule companion_tools_are_internal_sphere_only =
    noClasses().that().resideInAPackage("..feature.companion.tools..")
        .should().dependOnClassesThat().resideInAnyPackage(
            "org.springframework.web.client..",
            "org.springframework.web.reactive.function.client..",
            "java.net.http..",
            "jakarta.mail..",
            "org.apache.hc..",
            "okhttp3..")
        .because("IDENT-2: companion tools are internal-sphere reads only (no HTTP/mail/outward action)");
```

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest='CompanionToolRegistryIT,ArchitectureTest'` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistry.java backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/tools/CompanionToolRegistryIT.java
git commit -m "feat(companion): tool registry + IDENT-2 internal-sphere ArchUnit rule (mezo-fnnq.5)"
```

---

### Task 9: Port evolution — `CompanionLlm` tools variant, Gemini + Fake adapters

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/GeminiCompanionLlm.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/FakeCompanionLlm.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionLlmFakeIT.java`

**Interfaces:**
- Produces:
  ```java
  String complete(String systemPrompt, String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext);
  Flux<String> stream(String systemPrompt, String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext);
  default String complete(String s, String u) { return complete(s, u, List.of(), Map.of()); }
  default Flux<String> stream(String s, String u) { return stream(s, u, List.of(), Map.of()); }
  ```
- Fake sentinel: `[fake-tool:NAME]` or `[fake-tool:NAME {"days":7}]` in the user message → the fake finds the callback by name, invokes it with the args + a real `ToolContext`, and appends ` tool:NAME=[RESULT]` to its echo (a chunk per tool in `stream`). Unknown name → ` tool:NAME=[UNKNOWN]`.

- [ ] **Step 1: Failing IT** — add to `CompanionLlmFakeIT` (it already activates `companion-fake`):

```java
@Test
void testComplete_shouldExecuteScriptedToolAndEchoResult_whenSentinelPresent() {
    ToolCallAudit audit = new ToolCallAudit(6, 10);
    ToolCallback stub = new ToolCallback() {
        @Override public ToolDefinition getToolDefinition() {
            return ToolDefinition.builder().name("get_sleep").description("stub").inputSchema("{}").build();
        }
        @Override public String call(String toolInput) { return call(toolInput, null); }
        @Override public String call(String toolInput, ToolContext ctx) { return "ALVAS-OK days=" + toolInput; }
    };
    String out = companionLlm.complete("SYS", "kérdés [fake-tool:get_sleep {\"days\":3}]",
            List.of(stub), Map.of(ToolContexts.USER_ID, UUID.randomUUID(), ToolContexts.AUDIT, audit));
    assertThat(out).contains("system=[SYS]").contains("tool:get_sleep=[ALVAS-OK");
}

@Test
void testStream_shouldEmitToolResultChunk_whenSentinelPresent() {
    // same stub; collect the flux and assert one chunk contains "tool:get_sleep=["
}
```

- [ ] **Step 2: Run** → FAIL (compile: no 4-arg methods).

- [ ] **Step 3: Implement**

`CompanionLlm.java`:

```java
package io.mrkuhne.mezo.feature.companion;

import org.springframework.ai.tool.ToolCallback;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

/**
 * The single seam between the companion and any LLM (ADR 0008). Everything above this
 * interface is deterministic and provider-agnostic; everything below it is one adapter.
 *
 * <p>V0.5 shape — system prompt + user message + registered tools. ToolCallback/ToolContext are
 * spring-ai-core types (shared by every provider starter), NOT provider types; the tool-execution
 * loop runs inside the adapter (Spring AI), so callers only see the final text. The two-string
 * overloads remain for tool-less calls (hello smoke, future pipelines).
 */
public interface CompanionLlm {

    /** One-shot completion on the cheap chat tier, with the turn's tools registered. */
    String complete(String systemPrompt, String userMessage,
                    List<ToolCallback> tools, Map<String, Object> toolContext);

    /** Streamed completion (token/chunk deltas) on the cheap chat tier, with tools registered. */
    Flux<String> stream(String systemPrompt, String userMessage,
                        List<ToolCallback> tools, Map<String, Object> toolContext);

    default String complete(String systemPrompt, String userMessage) {
        return complete(systemPrompt, userMessage, List.of(), Map.of());
    }

    default Flux<String> stream(String systemPrompt, String userMessage) {
        return stream(systemPrompt, userMessage, List.of(), Map.of());
    }
}
```

`GeminiCompanionLlm.java` — the two methods become:

```java
@Override
public String complete(String systemPrompt, String userMessage,
                       List<ToolCallback> tools, Map<String, Object> toolContext) {
    return request(systemPrompt, userMessage, tools, toolContext).call().content();
}

@Override
public Flux<String> stream(String systemPrompt, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
    return request(systemPrompt, userMessage, tools, toolContext).stream().content();
}

private ChatClient.ChatClientRequestSpec request(String systemPrompt, String userMessage,
                                                 List<ToolCallback> tools, Map<String, Object> toolContext) {
    ChatClient.ChatClientRequestSpec spec = chatClient.prompt().system(systemPrompt).user(userMessage);
    if (!tools.isEmpty()) {
        spec = spec.toolCallbacks(tools).toolContext(toolContext);
    }
    return spec;
}
```

`FakeCompanionLlm.java` — add sentinel-driven tool execution (keep the existing echo + failure sentinels EXACTLY as-is so V0.2–V0.4 tests stay green):

```java
/** Scripted tool execution: "[fake-tool:get_sleep {\"days\":3}]" runs the REAL callback. */
public static final Pattern TOOL_SENTINEL = Pattern.compile("\\[fake-tool:([a-z_]+)(?: (\\{.*?\\}))?]");

@Override
public String complete(String systemPrompt, String userMessage,
                       List<ToolCallback> tools, Map<String, Object> toolContext) {
    if (userMessage.contains(FAIL_COMPLETE)) {
        throw new IllegalStateException("FAKE-LLM forced complete failure");
    }
    return PREFIX + " system=[" + systemPrompt + "] user=[" + userMessage + "]"
            + String.join("", toolEchoes(userMessage, tools, toolContext));
}

@Override
public Flux<String> stream(String systemPrompt, String userMessage,
                           List<ToolCallback> tools, Map<String, Object> toolContext) {
    if (userMessage.contains(FAIL_STREAM)) {
        return Flux.concat(
            Flux.just(PREFIX),
            Flux.error(new IllegalStateException("FAKE-LLM forced stream failure")));
    }
    List<String> chunks = new ArrayList<>(List.of(
        PREFIX,
        " system=[" + systemPrompt + "]",
        " user=[" + userMessage + "]"));
    chunks.addAll(toolEchoes(userMessage, tools, toolContext));
    return Flux.fromIterable(chunks);
}

/** Every sentinel in the user message executes the matching REAL callback (registry/decorator included). */
private List<String> toolEchoes(String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext) {
    List<String> echoes = new ArrayList<>();
    Matcher m = TOOL_SENTINEL.matcher(userMessage);
    while (m.find()) {
        String name = m.group(1);
        String args = m.group(2) != null ? m.group(2) : "{}";
        String result = tools.stream()
                .filter(cb -> cb.getToolDefinition().name().equals(name))
                .findFirst()
                .map(cb -> cb.call(args, new ToolContext(toolContext)))
                .orElse("UNKNOWN");
        echoes.add(" tool:" + name + "=[" + result + "]");
    }
    return echoes;
}
```

(The old 2-arg `complete`/`stream` implementations are REPLACED by the interface defaults — delete them from both adapters.)

- [ ] **Step 4: Run** — `./mvnw clean test -Dtest='CompanionLlmFakeIT,CompanionRealWiringIT,CompanionSwitchOffIT'` → PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/CompanionLlm.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/llm/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionLlmFakeIT.java
git commit -m "feat(companion): CompanionLlm port grows the tools variant; fake executes scripted tools (mezo-fnnq.5)"
```

---

### Task 10: Chat wiring — audit persistence on sync + streamed turns

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/mapper/CompanionMapper.java` (`name(args)` on the wire)
- Test: extend `ChatServiceIT`, `ChatStreamServiceIT`, `CompanionStreamApiIT`

**Interfaces:**
- Consumes: `CompanionToolRegistry` (Task 8), 4-arg port (Task 9).
- Produces: `ChatService.completeTurn(UUID userId, UUID conversationId, String answer, ToolCallAudit audit)` (signature change — update all callers); assistant rows persist `audit.toToolCallsEnvelope()/toRefsEnvelope()`; wire `MessageTool.name` = `get_sleep(days=3)`.

- [ ] **Step 1: Failing ITs**

`ChatServiceIT` additions:

```java
@Test
void testSendMessage_shouldPersistToolAuditAndMapChips_whenFakeExecutesScriptedTool() {
    UUID owner = ownerId();
    sleepLogPopulator.createSleepLog(owner, LocalDate.now(), new BigDecimal("7.0"), 3);
    var conversation = conversationService.create(owner);

    MessageResponse resp = chatService.sendMessage(owner, conversation.getId(),
            request("aludtam eleget? [fake-tool:get_sleep {\"days\":3}]"));

    assertThat(resp.getTools()).extracting(MessageTool::getName).containsExactly("get_sleep(days=3)");
    assertThat(resp.getTools()).extracting(MessageTool::getType).containsExactly("read");
    assertThat(resp.getRefs()).extracting(MessageRef::getKind).contains("Sleep");
    AiMessageEntity assistant = lastAssistantRow(conversation.getId(), owner);
    assertThat(assistant.getToolCalls().calls()).hasSize(1);
    assertThat(assistant.getToolCalls().calls().getFirst().args()).isEqualTo("days=3");
    assertThat(assistant.getRefs().refs()).isNotEmpty();
    assertThat(resp.getContent()).contains("Használj tool-t"); // prompt hint present in echoed system half
}

@Test
void testSendMessage_shouldPersistNullEnvelopes_whenNoToolRan() {
    UUID owner = ownerId();
    var conversation = conversationService.create(owner);
    chatService.sendMessage(owner, conversation.getId(), request("csak beszélgetünk"));
    AiMessageEntity assistant = lastAssistantRow(conversation.getId(), owner);
    assertThat(assistant.getToolCalls()).isNull();
    assertThat(assistant.getRefs()).isNull();
}

@Test
void testSendMessage_shouldStopRecordingAtCap_whenMoreSentinelsThanBudget() {
    UUID owner = ownerId();
    var conversation = conversationService.create(owner);
    String sevenCalls = "[fake-tool:get_goal_progress]".repeat(7);
    MessageResponse resp = chatService.sendMessage(owner, conversation.getId(), request(sevenCalls));
    assertThat(resp.getTools()).hasSize(6); // max-calls-per-turn
    assertThat(resp.getContent()).contains(RecordingToolCallback.BUDGET_EXHAUSTED);
}
```

*(`request(..)`/`lastAssistantRow(..)`: reuse the IT's existing helpers; the exact prompt-hint assertion string must match the SYSTEM_PROMPT line added below — adjust when writing.)*

`ChatStreamServiceIT` addition:

```java
@Test
void testStreamMessage_shouldCarryToolChipsOnDoneAndPersistEnvelope_whenScriptedToolRuns() {
    UUID owner = ownerId();
    sleepLogPopulator.createSleepLog(owner, LocalDate.now(), new BigDecimal("7.0"), 3);
    var conversation = conversationService.create(owner);

    List<ServerSentEvent<Object>> events = chatStreamService
            .streamMessage(owner, conversation.getId(), request("[fake-tool:get_sleep {\"days\":3}]"))
            .collectList().block();

    ServerSentEvent<Object> done = events.getLast();
    assertThat(done.event()).isEqualTo("done");
    MessageResponse resp = (MessageResponse) done.data();
    assertThat(resp.getTools()).extracting(MessageTool::getName).containsExactly("get_sleep(days=3)");
    AiMessageEntity assistant = lastAssistantRow(conversation.getId(), owner);
    assertThat(assistant.getToolCalls().calls()).hasSize(1);
}
```

`CompanionStreamApiIT` addition (HTTP-level, raw SSE body):

```java
@Test
void testStreamMessage_shouldRenderToolChipsInDoneEvent_overHttp() {
    // seed one sleep row; POST content '[fake-tool:get_sleep {"days":3}]'
    // assert the raw SSE body contains "event:done" and "\"name\":\"get_sleep(days=3)\"" and "\"type\":\"read\""
}
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**

`ChatService` changes:

1. New injected field: `private final CompanionToolRegistry toolRegistry;`
2. `SYSTEM_PROMPT` — append one line (keep the rest verbatim):

```java
static final String SYSTEM_PROMPT = """
        …existing seven lines unchanged…
        Múltbeli vagy összesítő kérdéshez (edzések, étkezés, súly, alvás, protokoll, gyógyszerciklus) \
        használd a kapott tool-okat — a pillanatkép csak a mai napot mutatja; tool nélkül ne találgass.""";
```

3. Sync turn:

```java
@Transactional
public MessageResponse sendMessage(UUID userId, UUID conversationId, SendMessageRequest request) {
    AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
    String systemPrompt = SYSTEM_PROMPT
            + contextSnapshotAssembler.render(userId, LocalDate.now())
            + renderHistory(loadWindow(userId, conversationId));
    persistMessage(conversation, userId, AiMessageEntity.ROLE_USER, request.getContent(), null, null);
    ToolCallAudit audit = toolRegistry.newTurnAudit();
    String answer = companionLlm.complete(systemPrompt, request.getContent(),
            toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit));
    AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
            answer, audit.toToolCallsEnvelope(), audit.toRefsEnvelope());
    touchConversation(conversation, request.getContent());
    return mapper.toMessageResponse(assistant);
}
```

4. `completeTurn` gains the audit param:

```java
/** Second half of a STREAMED turn (own transaction): persist the ASSISTANT row + tool audit + bump lastMessageAt. */
@Transactional
public MessageResponse completeTurn(UUID userId, UUID conversationId, String answer, ToolCallAudit audit) {
    AiConversationEntity conversation = conversationService.getOwned(userId, conversationId);
    AiMessageEntity assistant = persistMessage(conversation, userId, AiMessageEntity.ROLE_ASSISTANT,
            answer, audit.toToolCallsEnvelope(), audit.toRefsEnvelope());
    conversation.setLastMessageAt(Instant.now());
    conversationRepository.save(conversation);
    return mapper.toMessageResponse(assistant);
}
```

5. `persistMessage` gains the envelope params:

```java
private AiMessageEntity persistMessage(AiConversationEntity conversation, UUID userId, String role,
        String content, ToolCallsEnvelope toolCalls, RefsEnvelope refs) {
    AiMessageEntity message = new AiMessageEntity();
    message.setConversation(conversation);
    message.setCreatedBy(userId);
    message.setRole(role);
    message.setContent(content);
    message.setToolCalls(toolCalls);
    message.setRefs(refs);
    // saveAndFlush so the two rows of a turn get distinct created_at (history ordering key)
    return messageRepository.saveAndFlush(message);
}
```

(`prepareTurn`'s user-row call site passes `null, null`.)

`ChatStreamService.streamMessage` — thread the audit through:

```java
public Flux<ServerSentEvent<Object>> streamMessage(
        UUID userId, UUID conversationId, SendMessageRequest request) {
    // Eager (pre-Flux) so 404/validation problems are normal HTTP errors, not SSE frames.
    ChatService.PreparedTurn turn = chatService.prepareTurn(userId, conversationId, request);
    ToolCallAudit audit = toolRegistry.newTurnAudit();

    StringBuilder answer = new StringBuilder();
    return companionLlm.stream(turn.systemPrompt(), turn.userContent(),
                    toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit))
            .doOnNext(answer::append)
            .map(chunk -> ServerSentEvent.<Object>builder(
                    StreamDelta.builder().text(chunk).build()).event(EVENT_DELTA).build())
            .concatWith(Mono.fromCallable(() -> ServerSentEvent.<Object>builder(
                            chatService.completeTurn(userId, conversationId, answer.toString(), audit))
                    .event(EVENT_DONE).build()))
            .onErrorResume(e -> { /* unchanged */ });
}
```

(+ inject `CompanionToolRegistry`.)

`CompanionMapper.toTools` — args baked into the wire name (mock-seed chip style):

```java
/** Null envelope maps to []; the wire name carries the args — "get_sleep(days=3)" (FE chip style). */
default List<MessageTool> toTools(ToolCallsEnvelope envelope) {
    if (envelope == null || envelope.calls() == null) {
        return List.of();
    }
    return envelope.calls().stream()
            .map(call -> MessageTool.builder()
                    .type(call.type())
                    .name(call.args() == null || call.args().isBlank()
                            ? call.name() : call.name() + "(" + call.args() + ")")
                    .build())
            .toList();
}
```

- [ ] **Step 4: Run the full backend suite** — `./mvnw clean test` → PASS (V0.2–V0.4 ITs must stay green: tool-less turns persist null envelopes; prompt-assembly assertions gain the new SYSTEM_PROMPT line — update any full-prompt string assertions in `ChatServiceIT`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/ backend/src/test/java/io/mrkuhne/mezo/feature/companion/
git commit -m "feat(companion): chat turns register tools + persist call audit into envelopes (mezo-fnnq.5)"
```

---

### Task 11: FE — MSW fixture + chip tests (both modes green)

**Files:**
- Modify: `frontend/src/test/msw/handlers.ts` (stream `done` event carries tools/refs)
- Modify: `frontend/src/data/insights/chatHooks.test.tsx` (streamed turn carries chips into the cache)
- Modify: `frontend/src/features/insights/pages/ChatPage.test.tsx` (chips render after a streamed turn)

**Interfaces:**
- Consumes: wire shape `MessageTool {type:'read', name:'get_sleep(days=3)'}` / `MessageRef {kind:'Sleep', id:'2026-07-02'}` (Task 10). NO hook/page/mapper code changes — `toChatMessage` already passes tools/refs through.

- [ ] **Step 1: Failing tests**

`handlers.ts` — the stream handler's `done` payload (`tools: [], refs: []` today) becomes:

```ts
tools: [{ type: 'read', name: 'get_sleep(days=3)' }],
refs: [{ kind: 'Sleep', id: '2026-07-02' }],
```

`chatHooks.test.tsx` — extend the streamed-turn test:

```ts
// after the stream completes, the appended assistant message carries the real chips
expect(assistantMessage.tools).toEqual([{ type: 'read', name: 'get_sleep(days=3)' }])
expect(assistantMessage.refs).toEqual([{ kind: 'Sleep', id: '2026-07-02' }])
```

`ChatPage.test.tsx` — real-mode streamed-reply test asserts the chip is visible:

```ts
expect(await screen.findByText('get_sleep(days=3)')).toBeInTheDocument()
expect(screen.getByText(/Sleep/)).toBeInTheDocument() // RefTag renders "[Sleep] 2026-07-02"
```

- [ ] **Step 2: Run** — `cd frontend && pnpm test` → the two extended tests FAIL before the handler change, PASS after (make the fixture change and the assertions in the same edit; the failing state to verify is assertions-without-fixture).

- [ ] **Step 3: Full FE gates**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```
Expected: all green, both modes.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/test/msw/handlers.ts frontend/src/data/insights/chatHooks.test.tsx frontend/src/features/insights/pages/ChatPage.test.tsx
git commit -m "test(fe): streamed done event carries real tool chips — MSW + hook + page asserts (mezo-fnnq.5)"
```

---

### Task 12: Docs + gates + merge + close

**Files:**
- Modify: `docs/features/companion.md` (status, §1 V0.5 block, §3 flow, §4 config, §5.1/5.5, §7, §8, §9 decisions/gotchas, §10 key files)
- Modify: `docs/features/insights.md` (§2.5 ChatPage — chips are real now)
- Modify: `docs/milestones/roadmap.md` (milestone row)

- [ ] **Step 1: Living-doc updates** (overwrite in place — git is the history):
  - companion.md: status line → `backend ✅ V0.5 (tools + audit); FE ✅ V0.5 (chips real)`; "Tool-chips from real data" table row → ✅; new V0.5 summary block (8 tools, registry, decorator audit, cap, envelope→wire mapping); §4 config: `mezo.companion.tools.*` four keys; §5.5: tools seam now WIRED (list the new repo finders: `SleepLogRepository` since-date, `WorkoutSessionRepository.findDoneInstancesBetween`, `SupplementIntakeRepository` since-date — plain finders, V0.3 precedent); §7: V1.1 is next; §8: new test classes (`CompanionToolsRenderIT`, `CompanionToolRegistryIT`, `ToolCallAuditTest`, `RecordingToolCallbackTest` + extended ITs); §9: append Decisions 16–20 (= plan "Decisions locked" 1–12 distilled) + gotchas (fake `[fake-tool:…]` sentinel executes REAL callbacks; envelope `args` null on pre-V0.5 rows; adherence measures the CURRENT protocol; cap soft-fails in-band); §10: new files under `tools/`.
  - insights.md §2.5: chips/refs on streamed turns are real since V0.5 (mock mode keeps the seeded demo chips).
  - roadmap.md (milestones): add the V0.5 row.
- [ ] **Step 2: Lint** — `node scripts/lint-docs.mjs` → 0 errors (clears the key_files drift for companion.md).
- [ ] **Step 3: Full gates once more** — `cd backend && ./mvnw clean test` AND `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- [ ] **Step 4: Optional real-API smoke** (needs `GEMINI_API_KEY`; NOT a gate): `./mvnw spring-boot:run -Dspring-boot.run.profiles=demodata,companion-smoke` still streams; then a manual `curl` streamed turn asking `"mennyit aludtam a héten?"` and check the `done` event carries `get_sleep` chips — ADR 0008 flagged V0.5 as the tool-calling smoke.
- [ ] **Step 5: Merge + close** (memory: push directly, NO post-merge rebase — it flattens the --no-ff merge):

```bash
git add docs/ && git commit -m "docs(companion): V0.5 living docs — tools, audit, chips real (mezo-fnnq.5)"
git checkout main && git pull --rebase
git merge --no-ff feat/companion-v05 -m "Merge feat/companion-v05: tool calling + tool-chips (mezo-fnnq.5)"
git branch -d feat/companion-v05
bd close mezo-fnnq.5 && bd update mezo-fnnq.5 --notes "V0.5 shipped: 8 read tools, decorator audit, chips real. See docs/features/companion.md §9."
bd dolt push && git push
git status   # MUST show "up to date with origin"
```

---

## Self-review notes

- **Spec coverage:** all 8 roadmap tools ✓ (runs folded into `get_sport_sessions`, Decision 8); audit into `tool_calls` + `refs` ✓ (Tasks 3+10); FE chips from real data ✓ (already-wired mapper + Task 11 tests); IDENT-2 structural ✓ (Task 8 ArchUnit); per-turn cap ✓ (config + decorator); token budgeting ✓ (window clamps + weekly trend points); ownership scoping ✓ (`ToolContexts.userId`, never model args); switch-gating ✓ (every new bean conditional); LLM-free tests ✓ (render ITs + fake sentinels).
- **Type consistency check:** `ToolCallAudit(int,int)` everywhere; `completeTurn(UUID,UUID,String,ToolCallAudit)` — callers updated in Task 10; `ToolCall(type,name,args)` 3-arg constructor — Task 3 updates `AiMessageJsonbRoundTripIT` fixture if it constructs one.
- **Known verify-at-write points (implementer: read the named file first):** exact `AbstractIntegrationTest` owner idiom (`ownerId()` placeholder), populator arg lists (`TrainPopulator`, `MedicationPopulator.createReta` cycle labels, `PantryItemPopulator` factory name), `findDoneInstanceDates` JPQL style to mirror, whether Spring AI's `ToolDefinition.builder()` requires `inputSchema` non-null (tests), MSW handler's exact `done` payload location (`handlers.ts:473`).
- **Deliberately out:** compute/write tools (v3), `find_similar_past_days` (V2.3), `get_knowledge_facts` (v1), protocol-version time-travel in adherence, chips on the in-flight streamed bubble (chips land with `done` — the persisted truth).
