# Companion phase events (S9.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chat narrates its own work live — `átgondolom → megnézem az adataidat → fogalmazok` — because the SSE stream now OPENS IMMEDIATELY and the pipeline runs behind the subscription instead of before it.

**Architecture:** A new `phase` SSE event (contract-first). The real work is structural: `ChatStreamService` moves the pipeline lap + delta production + trailing Mono inside a `Flux.defer(...).subscribeOn(boundedElastic())` so the HTTP response starts before the ~5–20s lap, with the request-thread contexts (LlmCallContext + LlmActorContext) captured and re-bound inside (MemoryShadowRunner pattern). Phases are emitted through the existing `toolSink`; `retrieving`/`answering` come from a nullable `Consumer<TurnPhase>` seam threaded through `ChatService.planAndExecuteVolatile`/`pipelineAnswer`. FE: `onPhase` callback → `ChatTurn.phase` → Hungarian label beside the thinking dots; mock-mode parity.

**Tech Stack:** OpenAPI contract-first (api/generate merge → `api.gen.ts`), Java 21 + Reactor (MVC ReactiveTypeHandler SSE), React 19 FE (insights feature), MSW-tested hooks.

**Spec:** `docs/superpowers/specs/2026-09-16-companion-plan-execute-answer-design.md` §12 S9.6 (V1 pattern: mezo-prb9 absorbed here). **Driving issue:** `mezo-rj214.7`. Branch: `feat/companion-phase-events`.

## Global Constraints

- **Contract-first**: edit `api/feature/companion/companion.yml` FIRST; `cd api/generate && npm run generate:api` (commit `api/openapi.yml`); `cd frontend && pnpm generate:api` (commit `src/data/_client/api.gen.ts`); backend Java types regenerate in the build. The CI `contract-drift` job fails on any byte diff.
- `prepareTurn` stays EAGER (pre-Flux): 404/validation before any SSE frame — `ChatStreamServiceIT:177-183` pins it and must stay green untouched.
- A stream still ends with exactly one terminal `done`/`error`; phase frames are progress-only and can never terminate a turn (`COMPANION_STREAM_INCOMPLETE` on the FE otherwise).
- ThreadLocal discipline for the deferred lap: capture `LlmActorContext.capture()` + the stream `LlmCallContext` on the REQUEST thread, re-bind inside the defer via `LlmActorContext.runAsCaptured(actor, () -> llmCallContextHolder.runWith(ctx, ...))` — otherwise llm_log books against nobody (the S9.4 regression class).
- **One sanctioned pre-existing-test edit**: `ChatStreamServiceIT`'s all-deltas-before-last assertion (its fixture is a pipeline-attempted→legacy-fallback turn which now legitimately carries a leading `planning` frame). Nothing else pre-existing may change.
- FE gates: `pnpm build && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test` — modes pinned explicitly. KNOWN pre-existing local-only failures, do NOT chase: `chatApi.test.ts` transcribe-multipart (MSW formData 500 — mezo-5trr/c4ib/mf40/rcou) and `TutorialProvider.test.tsx` StrictMode seenAt (mezo-c4ib). Both are green on CI.
- Backend: AssertJ, naming convention, English javadoc, `-Dmezo.test.use-testcontainers=true`, ArchUnit re-run on new classes, CODEMAP regen in the same change. NEVER bare `git stash`.
- UI: Titanium rules — clay icons, no emojis, reduced-motion respected (`.np-pulse` already is); reuse the existing `ThinkingDots` surface, no new look.

## Scope decisions made here, not left open

1. **Phases only on non-CHAT turns with the pipeline enabled.** CHAT turns are one fast call; narration would be noise. `planning` is emitted when the pipeline ATTEMPT starts — honestly, even if the planner later falls back to legacy (the wait was real). Fallback turns therefore show `planning` and then legacy deltas with no further phases.
2. **ANALYSIS keeps `SYNC_ANSWER` (single delta).** `docs/features/companion.md:2238-2241` overpromised a "native streaming answerer" for S9.6 — that would resurrect the replan-vs-streaming gate problem. With phases narrating the wait, the single delta is acceptable; the doc gets corrected in Task 6, and a native ANALYSIS streamer (stream lap-1, gate on the marker) stays future work.
3. **Wire vocabulary is English** (`planning`/`retrieving`/`answering`, matching the event-name register); the HUNGARIAN copy lives only in the FE: `átgondolom…` / `megnézem az adataidat…` / `fogalmazok…` (the product owner's own phrasing).
4. **mezo-prb9 is absorbed and closed by this slice** (controller does the tracker move): its `thinking/drafting` phases map onto `planning/answering`; its `reviewing`/`corrected` events and "javítva" chip die with their premise (the LLM verdict-retry loop — clinical-only on pipeline turns since S9.5, judge removed entirely in S9.8). Residual legacy-corner affordance = new low-prio issue if telemetry ever shows it matters.

---

### Task 1: Contract — the `phase` SSE event

**Files:**
- Modify: `api/feature/companion/companion.yml` (summary prose :537-546; response `oneOf` :558-567; schemas block :940-960)
- Regenerate + commit: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Produces: `StreamPhase { phase: string }` schema; the stream contract now reads: 0..n `phase` (progress narration: 'planning' | 'retrieving' | 'answering' — emitted on pipeline turns; may repeat on a replan lap) interleaved with the existing deltas/tools, terminal semantics unchanged. Tasks 3–4 consume the generated types.

- [ ] **Step 1: Edit the contract.** In the summary prose, extend the event list sentence: after the `tool` clause add `— and 0..n 'phase' (data = StreamPhase JSON) narrating the turn's stage on pipeline turns ('planning' | 'retrieving' | 'answering'; a replan lap repeats retrieving/answering); phase frames are progress only and never terminal`. Add to the 200 `oneOf`: `- $ref: '#/components/schemas/StreamPhase'`. Add the schema beside StreamError:

```yaml
    StreamPhase:
      type: object
      required: [phase]
      description: >-
        One turn-stage marker, streamed as the pipeline crosses it (S9.6, mezo-rj214.7) so the
        UI can narrate the pre-answer work instead of showing dead air. Values: 'planning'
        (the model is deciding what to fetch), 'retrieving' (tools executing), 'answering'
        (the answer is being written). Pipeline turns only; a replan lap repeats
        retrieving/answering. Progress only — never terminal.
      properties:
        phase: { type: string, description: "'planning' | 'retrieving' | 'answering'" }
```

- [ ] **Step 2: Regenerate**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/api/generate && npm run generate:api
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/frontend && pnpm generate:api
```
Verify `api.gen.ts` now carries `StreamPhase` and `git status` shows exactly the three intended files.

- [ ] **Step 3: Backend types smoke** — `cd backend && ./mvnw clean test-compile` (generated DTOs build).

- [ ] **Step 4: Commit**

```bash
git add api/feature/companion/companion.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): StreamPhase SSE event on the companion stream (mezo-rj214.7)"
```

---

### Task 2: Backend — `TurnPhase` + the phase seam through ChatService

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/TurnPhase.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatService.java` (`planAndExecuteVolatile` ~:543-558, `pipelineAnswer` ~:488-526, and their call sites)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/TurnPhaseSeamTest.java`

**Interfaces:**
- Produces: `public enum TurnPhase { PLANNING("planning"), RETRIEVING("retrieving"), ANSWERING("answering"); public String wire() }`. `planAndExecuteVolatile(..., Consumer<TurnPhase> onPhase)` and `pipelineAnswer(..., Consumer<TurnPhase> onPhase)` — nullable-tolerant via a `notify(onPhase, phase)` null-guard helper; the SYNC path (`sendMessage`) passes `null`. Emission points: `RETRIEVING` after a usable plan exists and before `planExecutor.execute` (lap 1 AND the replan lap); `ANSWERING` before each `turnAnswerer.answer`/lap-2 answer. `PLANNING` is NOT emitted here — it belongs to the caller at attempt start (Task 3), because a planner that fails must still have narrated the wait.

- [ ] **Step 1: Write the failing test** — a plain unit test with the ScriptedLlm pattern (copy the double from `TurnPlannerTest`) wired into a real `TurnPlanner`/`PlanValidator`/`PlanExecutor`?? NO — too heavy for a unit test: instead test at the `pipelineAnswer` level via the existing IT harness style. Concretely: a NON-`@Transactional` IT (`companion-fake` profile) that calls `chatService.pipelineAnswer(...)` directly (it is package-private; the test lives in the same package) with a scripted `[fake-plan:…]` + `[fake-datagap:…]` ANALYSIS message and a recording `Consumer<TurnPhase>`:

```java
package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** Pins the phase-seam emission order, incl. the replan repeat. NOT @Transactional (executor pool threads). */
@ActiveProfiles("companion-fake")
class TurnPhaseSeamTest extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private CompanionToolRegistry toolRegistry;
    @Autowired private DatabasePopulator databasePopulator;

    private static final String PLAN_PANTRY =
        " [fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_pantry\",\"args\":{},\"why\":\"kamra\"}]}]";

    @Test
    void testPipelineAnswer_shouldEmitRetrievingAndAnswering_whenPlanExecutes() {
        UUID userId = databasePopulator.populateUser("phase-seam@test.local");
        List<TurnPhase> phases = new ArrayList<>();

        String answer = chatService.pipelineAnswer(userId, UUID.randomUUID(), TurnGear.LOOKUP,
            "HANG", "\n\nMa: " + LocalDate.now() + "\n", List.of(),
            "Mi van a kamrában?" + PLAN_PANTRY, LocalDate.now(),
            toolRegistry.newTurnAudit(), phases::add);

        assertThat(answer).isNotNull();
        assertThat(phases).containsExactly(TurnPhase.RETRIEVING, TurnPhase.ANSWERING);
    }

    @Test
    void testPipelineAnswer_shouldRepeatPhases_whenAnalysisReplans() {
        UUID userId = databasePopulator.populateUser("phase-replan@test.local");
        List<TurnPhase> phases = new ArrayList<>();

        chatService.pipelineAnswer(userId, UUID.randomUUID(), TurnGear.ANALYSIS,
            "HANG", "\n\nMa: " + LocalDate.now() + "\n", List.of(),
            "Miért üres a kamrám mostanában? [fake-datagap:vásárlások]" + PLAN_PANTRY,
            LocalDate.now(), toolRegistry.newTurnAudit(), phases::add);

        assertThat(phases).containsExactly(TurnPhase.RETRIEVING, TurnPhase.ANSWERING,
            TurnPhase.RETRIEVING, TurnPhase.ANSWERING);
    }

    @Test
    void testPipelineAnswer_shouldTolerateNullConsumer_whenSyncPathCalls() {
        UUID userId = databasePopulator.populateUser("phase-null@test.local");

        String answer = chatService.pipelineAnswer(userId, UUID.randomUUID(), TurnGear.LOOKUP,
            "HANG", "\n\nMa: " + LocalDate.now() + "\n", List.of(),
            "Mi van a kamrában?" + PLAN_PANTRY, LocalDate.now(),
            toolRegistry.newTurnAudit(), null);

        assertThat(answer).isNotNull();
    }
}
```

(Adapt `pipelineAnswer`'s exact current parameter list from the file — append `Consumer<TurnPhase> onPhase` LAST. The replan-lap plan comes from the same `[fake-plan]` sentinel persisting in the hint message — the S9.5 replan IT proves that works.)

- [ ] **Step 2: RED** (no such enum/params). **Step 3: Implement** — the enum; thread `onPhase` through `pipelineAnswer` → `planAndExecuteVolatile` (both laps) with the null-safe `notify` helper; `sendMessage`'s call passes `null`; `ChatStreamService`'s existing calls pass `null` FOR NOW (Task 3 wires the real emitter) so this task compiles standalone.

- [ ] **Step 4: GREEN** — `-Dtest=TurnPhaseSeamTest,ChatServicePipelineIT,ChatServiceIT,ArchitectureTest -Dmezo.test.use-testcontainers=true`.

- [ ] **Step 5: Commit** — `feat(companion): turn-phase seam through the pipeline lap (mezo-rj214.7)`

---

### Task 3: Stream restructure — live phases (THE structural task)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamService.java` (the whole `streamMessage` body after `prepareTurn`)
- Modify (sanctioned): `backend/src/test/java/io/mrkuhne/mezo/feature/companion/ChatStreamServiceIT.java` (:107-111 only)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/service/ChatStreamPipelineIT.java` (extend)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/CompanionStreamApiIT.java` (one additive raw-wire assert)

**Interfaces:**
- Consumes: `TurnPhase` + the `onPhase` seam (Task 2); the generated `StreamPhase` DTO (Task 1).
- Produces: `EVENT_PHASE = "phase"` constant + `phaseEvent(TurnPhase)` helper (twin of `toolEvent`); the restructured stream: eager `prepareTurn` + sink + listener as today, then EVERYTHING ELSE (pipeline lap, rawDeltas construction, delta mapping, the trailing done-Mono) inside `Flux.defer(...)` `.subscribeOn(Schedulers.boundedElastic())`, merged with `toolSink.asFlux()`. Request-thread capture: `UUID actor = LlmActorContext.capture();` + the `streamContext` — re-bound INSIDE the defer around the lap and the legacy/answer stream construction. Phase emissions: `PLANNING` into the sink at pipeline-attempt start (non-CHAT && enabled); `RETRIEVING`/`ANSWERING` via the seam consumer `p -> toolSink.tryEmitNext(phaseEvent(p))`; for `STREAM_ANSWER` mode emit `ANSWERING` just before returning the answer stream (the seam only covers the sync answer calls).

- [ ] **Step 1: Write the failing tests.** Extend `ChatStreamPipelineIT` with:

```java
    @Test
    void testStreamMessage_shouldNarratePhases_whenLookupPipelineRuns() {
        // fixture: the existing LOOKUP scripted-plan message
        List<ServerSentEvent<Object>> events = stream(/* LOOKUP + PLAN_SLEEP fixture */);

        List<String> names = events.stream().map(ServerSentEvent::event).toList();
        int planning = names.indexOf("phase");           // first phase frame
        int firstTool = names.indexOf("tool");
        int firstDelta = names.indexOf("delta");
        assertThat(planning).isNotNegative().isLessThan(firstTool);
        assertThat(firstTool).isLessThan(firstDelta);
        // wire payloads in order: planning, retrieving, answering
        List<String> phases = events.stream().filter(e -> "phase".equals(e.event()))
            .map(e -> ((io.mrkuhne.mezo.api.dto.StreamPhase) e.data()).getPhase()).toList();
        assertThat(phases).containsExactly("planning", "retrieving", "answering");
    }

    @Test
    void testStreamMessage_shouldRepeatPhases_whenAnalysisReplans() {
        List<ServerSentEvent<Object>> events = stream(/* the ANALYSIS [fake-datagap] fixture */);

        List<String> phases = events.stream().filter(e -> "phase".equals(e.event()))
            .map(e -> ((io.mrkuhne.mezo.api.dto.StreamPhase) e.data()).getPhase()).toList();
        assertThat(phases).containsExactly("planning", "retrieving", "answering",
            "retrieving", "answering");
    }

    @Test
    void testStreamMessage_shouldEmitOnlyPlanning_whenPlannerFallsBackToLegacy() {
        List<ServerSentEvent<Object>> events = stream("Mennyit aludtam kedden?"); // unscripted

        List<String> phases = events.stream().filter(e -> "phase".equals(e.event()))
            .map(e -> ((io.mrkuhne.mezo.api.dto.StreamPhase) e.data()).getPhase()).toList();
        assertThat(phases).containsExactly("planning");
        assertThat(events.getLast().event()).isEqualTo("done");
    }
```

(Use the file's existing `stream(...)`/fixture helpers and exact fixture constants; the `StreamPhase` DTO accessor name comes from the generated class — check it.) `CompanionStreamApiIT`: one additive assert on the raw body of a scripted-pipeline turn: `.contains("event:phase")`. Adjust `ChatStreamServiceIT:107-111` (sanctioned): the fixture turn now legitimately opens with `planning`, so assert instead that events AFTER the first delta and before the last are all deltas, or filter: `events.subList(0, size-1).stream().filter(e -> !"phase".equals(e.event()))` all-delta — keep the test's intent (no stray tool events on a tool-less turn) with a comment citing this plan.

- [ ] **Step 2: RED.** **Step 3: Implement** per the Interfaces block. Key mechanics:
  - Capture on the request thread: `LlmCallContext streamCtx = ...existing...; UUID actor = LlmActorContext.capture();`
  - `Flux<ServerSentEvent<Object>> work = Flux.defer(() -> LlmActorContext.runAsCaptured(actor, () -> llmCallContextHolder.runWith(streamCtx, () -> { ...pipeline attempt + rawDeltas switch + delta mapping...; return deltasMapped.concatWith(trailingDoneMono); }))).subscribeOn(Schedulers.boundedElastic());` — note `runAsCaptured`/`runWith` wrap the ASSEMBLY (the lap runs there synchronously); the returned Flux's own async signals don't need the context (the answer stream's recording adapter captured what it needs at request(...) time — verify against SpringAiCompanionLlm.stream's "read HERE on the caller's thread" comments; the caller's thread is now the boundedElastic one, which carries the re-bound contexts during assembly — exactly what those comments require).
  - `return Flux.merge(toolSink.asFlux(), work)` + the existing `onErrorResume` (which now also catches lap exceptions surfacing as onError — keep the existing try/catch→legacy INSIDE the lap for pipeline failures, so `error` frames remain reserved for real stream failures).
  - `doFinally` completing the sink moves with the delta mapping (inside the defer).
  - The eager-404 contract: nothing before `Flux.defer` may touch the LLM; `prepareTurn` + sink setup stay outside.

- [ ] **Step 4: GREEN + regression belt**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/backend && ./mvnw clean test -Dtest=ChatStreamPipelineIT,ChatStreamPipelineSwitchOffIT,ChatStreamServiceIT,ChatStreamServiceGearIT,ChatStreamAdvisorIT,CompanionStreamApiIT,TurnPhaseSeamTest,ArchitectureTest -Dmezo.test.use-testcontainers=true
```
ALL green (the one sanctioned edit aside, zero pre-existing changes).

- [ ] **Step 5: Commit** — `feat(companion): stream opens immediately — live phase narration (mezo-rj214.7)`

---

### Task 4: FE data layer — `onPhase` through chatApi + chatHooks

**Files:**
- Modify: `frontend/src/data/insights/chatApi.ts` (dispatch chain :87-100, callback signature :80-85, type re-exports :11-13)
- Modify: `frontend/src/data/insights/chatHooks.ts` (`ChatTurn` :25, `sendReal` :275-308, `sendMock` :245-273)
- Modify: `frontend/src/test/msw/handlers.ts` (default stream handler :1588-1621 — add phase frames)
- Test: `frontend/src/data/insights/chatHooks.test.tsx` (extend)

**Interfaces:**
- Produces: `chatApi.streamMessage(conversationId, content, onDelta, onTool?, onPhase?: (phase: string) => void)`; `ChatTurn` gains `phase?: 'planning' | 'retrieving' | 'answering'`; a delta or tool clears… NO: a tool does NOT clear the phase (chips + phase coexist); the FIRST delta clears it (`phase: undefined` once draft starts — the draft replaces the narration). `sendMock` choreographs `planning` → (delay) → `retrieving` → (delay) → tool → `answering` → deltas for mock parity.

- [ ] **Step 1: Write the failing test** (gated-stream pattern from :105-139):

```ts
it('exposes the streamed phase on the in-flight turn and clears it on the first delta', async () => {
  // gated MSW handler: phase(planning) -> phase(retrieving) -> tool -> phase(answering) -> [gate] -> delta -> done
  // assert: after the answering frame, turn.phase === 'answering' and turn.thinking is still truthy-compatible with the dots
  // open the gate; after the first delta, turn.phase is undefined and draft is non-empty
})
```

Write it concretely against the real helper shapes in the file (copy the gate mechanics of the tools test verbatim, add phase frames). Also extend the default MSW stream handler with `phase` frames (planning/retrieving before tool, answering before deltas) — the existing `'streams a turn into the chat cache'` test must stay green with them present (it filters by outcome, verify).

- [ ] **Step 2: RED.** **Step 3: Implement** — chatApi: `else if (ev.event === 'phase') { onPhase?.((JSON.parse(ev.data) as StreamPhase).phase) }` + re-export the generated `StreamPhase`; chatHooks: pass `(phase) => setTurn((t) => (t ? { ...t, phase } : t))` and clear in the delta updater (`phase: undefined`); `sendMock`: insert the choreography with the existing delay helper.

- [ ] **Step 4: GREEN both modes**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/food-logging-gaps-456e26/frontend && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test
```
(Modulo the two KNOWN local-only failures named in Global Constraints — verify the failure list matches exactly those and nothing new.)

- [ ] **Step 5: Commit** — `feat(insights): chat stream phase events reach the turn state (mezo-rj214.7)`

---

### Task 5: FE UI — the phase label on the thinking bubble

**Files:**
- Modify: `frontend/src/features/insights/pages/ChatPage.tsx` (`ThinkingDots` :25-52 + render site :296-301)
- Test: none new required (no pinned ChatPage rendering tests exist; the state logic is covered in Task 4) — but add a tiny component-level check ONLY if a cheap one fits the existing test conventions; otherwise document the manual-verification path.

**Interfaces:**
- Consumes: `turn.phase` (Task 4).
- Produces: the thinking bubble shows the Hungarian phase copy under/beside the dots: `planning → "átgondolom…"`, `retrieving → "megnézem az adataidat…"`, `answering → "fogalmazok…"` — a small muted label (`.mzc-eb`-adjacent styling, existing tokens, no new CSS beyond a class reuse), rendered only while `turn.phase` is set and `!turn.draft`. Copy map lives as a const in ChatPage (`PHASE_COPY: Record<string, string>`); unknown phase values render nothing (forward-compatible).

- [ ] **Step 1: Implement** (small enough that TDD is the Task-4 hook test; this is presentation): pass `phase={turn.phase}` into `ThinkingDots` (or render a sibling `<span>` in the :296-301 block beside the dots), muted color token, no animation beyond the existing pulse, reduced-motion untouched.
- [ ] **Step 2: Verify** — `pnpm build` + both-modes test run green; then a quick manual smoke via the mock dev server if the session's `verify` skill flow is available (controller decides; not a blocker).
- [ ] **Step 3: Commit** — `feat(insights): thinking bubble narrates the turn phase (mezo-rj214.7)`

---

### Task 6: Gates, docs, close-out

**Files:**
- Modify: `docs/features/companion.md` (§3: phases live + the stream-restructure description + CORRECT the ANALYSIS-native-streaming overreach at :2238-2241; the SSE contract paragraph), `docs/features/insights.md` (the chat streaming state, if it documents ChatTurn)
- Modify: `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Backend full-package gate** — `./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.companion.**' -Dmezo.test.use-testcontainers=true` GREEN; plus `-Dtest=ArchitectureTest`.
- [ ] **Step 2: FE full gate** — `pnpm build && CI=true VITE_USE_MOCK=true pnpm test && CI=true VITE_USE_MOCK=false pnpm test` (known local failures excepted, named in the report).
- [ ] **Step 3: Docs** — companion.md: the streamed-turn section describes the defer/subscribeOn shape, the eager-404 guarantee, phase semantics (incl. fallback turns showing only `planning`, CHAT phase-free), and FIXES the "S9.6 gives ANALYSIS native streaming" sentence to "a native ANALYSIS streamer remains future work; phases narrate the sync wait". insights.md: ChatTurn.phase + the copy map if the doc tracks that surface. `node scripts/lint-docs.mjs` (both docs clean), `node scripts/gen-codemap.mjs` + `--check`.
- [ ] **Step 4: Commit** — `docs(companion): live phase narration + stream restructure (mezo-rj214.7)`

*(Controller close-out: bd — mezo-rj214.7 notes; CLOSE mezo-prb9 as absorbed [decision 4] with a pointer here; tracker backup; PR/CI/premerge/merge.)*

---

## Done criteria

1. A scripted LOOKUP streamed turn emits `phase:planning` → `phase:retrieving` → tool chips → `phase:answering` → deltas → done; ANALYSIS replan repeats retrieving/answering; fallback turns emit only `planning`; CHAT turns emit none.
2. The SSE response OPENS before the pipeline lap (phases arrive during the wait, not after) — the whole point.
3. Contract regenerated byte-exact (contract-drift green); FE shows the Hungarian narration in mock AND real mode.
4. Zero pre-existing test edits beyond the one sanctioned ChatStreamServiceIT assertion.
5. Branch → PR → CI → premerge → `--no-ff` merge, CODEMAP checked post-merge; mezo-prb9 closed as absorbed.
