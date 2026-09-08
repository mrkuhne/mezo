# Actor propagation into the memory-platform executors — Implementation Plan (mezo-ozri.7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An LLM call made on `applicationTaskExecutor` on behalf of an authenticated request books its `llm_log_history.created_by` against that user, so mezo-ozri.6's per-user USD cap can see memory-platform traffic.

**Architecture:** `LlmActorContext` gains one capture/re-bind pair (`capture()` + `runAsCaptured(...)`) that resolves the effective actor on the *submitting* thread (override → JWT subject → thread-bound actor) and re-binds it inside the submitted task. `LlmActorResolver.currentActor()` delegates to `capture()` so the precedence rules stay a single source of truth. The three executor hops in the memory platform (`MemoryShadowRunner.submit`, `MemoryContextService.retrieveCandidates`, `LlmMemoryReranker.rerank`) switch from capturing only the admin-replay *override* to capturing the full actor.

**Tech Stack:** Java 21, Spring Boot 3 / Spring Security (`JwtAuthenticationToken`), JUnit 5 + AssertJ, Testcontainers-backed `AbstractIntegrationTest`, profile `companion-fake`.

## Global Constraints

- **No `@Value`.** ArchUnit rule `no_spring_value_annotation`; nothing in this slice is configurable anyway.
- **No new cross-feature import.** `feature.companion..` must not start importing `feature.llmlog.service.LlmActorResolver` — `feature_slices_are_cycle_free` is a frozen ArchUnit rule. The capture helper therefore lives in `techcore/security/LlmActorContext.java`, which `feature.companion..` may depend on.
- **The audit path must never break the LLM call.** Every helper added here is total: a null capture is a plain call, and nothing added throws.
- **Behaviour for the admin dry-run replay stays byte-identical** (`mezo-4qyt`): the replay's override must still outrank a request principal.
- **No prompt text is touched** — `FakeCompanionLlm`'s prefix dispatch (`CompanionMessageGenerator:75,100,114,139`) must stay intact.
- **Commit subjects** are conventional and carry the bd id: `fix(llmlog): … (mezo-ozri.7)`.
- **Local test discipline:** run only focused tests (`./mvnw -pl backend test -Dtest=...` / `-Dit.test=...` with `-Dmezo.test.use-testcontainers=true` for ITs). The full suite is CI's job.

---

## File Structure

| File | Responsibility after this slice |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java` | The two ThreadLocal tiers **plus** the cross-thread capture/re-bind pair. Single source of truth for actor precedence. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolver.java` | Thin Spring component; `currentActor()` delegates to `LlmActorContext.capture()`. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunner.java` | Hop 1 — captures the actor before `submit`, re-binds inside `run`. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryContextService.java` | Hop 2 — captures the actor (not just the override) for every retriever task. |
| `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryReranker.java` | Hop 3 — captures the actor for the smart-tier rerank call; its private `withActorOverride` helper is deleted in favour of the shared one. |
| `backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextCaptureTest.java` | Unit-level proof of the precedence and restore semantics of `capture()` / `runAsCaptured`. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunnerActorTest.java` | Unit-level proof of hop 1. |
| `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmActorPropagationIT.java` | The acceptance IT: hop 3 (rerank, at the `CompanionLlm` port) and hop 2 (retriever task). |

---

### Task 1: The capture/re-bind pair in `LlmActorContext`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolver.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextCaptureTest.java` (create)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `public static UUID LlmActorContext.capture()` — the effective actor of the calling thread, or `null`.
  - `public static <T> T LlmActorContext.runAsCaptured(UUID captured, Supplier<T> body)`
  - `public static void LlmActorContext.runAsCaptured(UUID captured, Runnable body)`
  - `LlmActorResolver.currentActor()` keeps its exact signature and semantics.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextCaptureTest.java`:

```java
package io.mrkuhne.mezo.techcore.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * mezo-ozri.7: a pooled task has neither a security context nor the caller's ThreadLocals, so the
 * actor must be resolved on the SUBMITTING thread and re-bound inside the task. These are the
 * precedence and restore guarantees the three memory-platform hops rely on.
 */
class LlmActorContextCaptureTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private static void authenticateAs(UUID principalId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(principalId.toString())
            .issuedAt(Instant.now().minusSeconds(60))
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
        SecurityContextHolder.getContext()
            .setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }

    @Test
    void testCapture_shouldReturnNull_whenTheThreadHasNoActorAtAll() {
        assertThat(LlmActorContext.capture()).isNull();
    }

    @Test
    void testCapture_shouldReturnTheJwtSubject_whenARequestPrincipalIsPresent() {
        UUID principal = UUID.randomUUID();
        authenticateAs(principal);

        assertThat(LlmActorContext.capture()).isEqualTo(principal);
    }

    @Test
    void testCapture_shouldPreferTheOverride_whenBothAnOverrideAndAPrincipalArePresent() {
        UUID principal = UUID.randomUUID();
        UUID inspected = UUID.randomUUID();
        authenticateAs(principal);

        UUID captured = LlmActorContext.runAsOverride(inspected, LlmActorContext::capture);

        assertThat(captured).isEqualTo(inspected);
    }

    @Test
    void testCapture_shouldFallBackToTheThreadBoundActor_whenThereIsNoPrincipal() {
        UUID cronUser = UUID.randomUUID();
        AtomicReference<UUID> seen = new AtomicReference<>();

        LlmActorContext.runAs(cronUser, () -> seen.set(LlmActorContext.capture()));

        assertThat(seen.get()).isEqualTo(cronUser);
    }

    @Test
    void testRunAsCaptured_shouldMakeTheCapturedActorVisibleToCapture_whenReBoundOnAnotherThread()
            throws Exception {
        UUID principal = UUID.randomUUID();
        authenticateAs(principal);
        UUID captured = LlmActorContext.capture();
        AtomicReference<UUID> seenOnWorker = new AtomicReference<>();

        Thread worker = new Thread(() ->
            LlmActorContext.runAsCaptured(captured, () -> seenOnWorker.set(LlmActorContext.capture())));
        worker.start();
        worker.join();

        assertThat(seenOnWorker.get()).isEqualTo(principal);
    }

    @Test
    void testRunAsCaptured_shouldRunTheBodyUnbound_whenTheCaptureIsNull() {
        UUID result = LlmActorContext.runAsCaptured(null, LlmActorContext::capture);

        assertThat(result).isNull();
    }

    @Test
    void testRunAsCaptured_shouldRestoreThePreviousBinding_whenTheBodyThrows() {
        UUID outer = UUID.randomUUID();

        UUID observed = LlmActorContext.runAsCaptured(outer, () -> {
            try {
                LlmActorContext.runAsCaptured(UUID.randomUUID(), () -> {
                    throw new IllegalStateException("boom");
                });
            } catch (IllegalStateException expected) {
                // the finally in runAsCaptured must have restored the outer binding
            }
            return LlmActorContext.capture();
        });

        assertThat(observed).isEqualTo(outer);
    }
}
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
./mvnw -q -pl backend test -Dtest=LlmActorContextCaptureTest
```

Expected: compilation failure — `cannot find symbol: method capture()` / `runAsCaptured(...)`.

- [ ] **Step 3: Implement `capture()` and `runAsCaptured(...)`**

In `LlmActorContext.java`, add these imports next to the existing ones:

```java
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
```

Add the methods (keep `runAs`, `runAsOverride`, `current`, `override` exactly as they are):

```java
    /**
     * The effective actor of THIS thread, for re-binding on a pool thread (mezo-ozri.7).
     *
     * <p>Same precedence as the audit recorder's own resolution — {@link #override()}, then the JWT
     * principal, then {@link #current()} — because it IS that resolution: {@code LlmActorResolver}
     * delegates here so the two can never drift apart. Returns null when the thread has no actor,
     * which is a legitimate state (an unauthenticated background thread) and never an error.
     *
     * <p>Why this exists: {@code applicationTaskExecutor} propagates neither the security context
     * nor these ThreadLocals, so an LLM call submitted to it resolves a null actor and its
     * {@code llm_log_history} row books against nobody. Capture on the submitting thread, re-bind
     * with {@link #runAsCaptured} inside the task.
     */
    public static UUID capture() {
        UUID override = OVERRIDE.get();
        if (override != null) {
            return override;
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
            || !authentication.isAuthenticated()
            || !(authentication.getPrincipal() instanceof Jwt jwt)
            || jwt.getSubject() == null) {
            return CURRENT.get();
        }
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException ex) {
            return CURRENT.get(); // a non-UUID subject is not ours to reject here — the caller is already running
        }
    }

    /**
     * Re-binds a {@link #capture()}d actor for {@code body} on another thread, then restores.
     *
     * <p>Binds the OVERRIDE tier on purpose: a captured actor is a decision already made on the
     * submitting thread, so it must outrank anything the pool thread happens to carry (today:
     * nothing). A null capture is a plain call — the unauthenticated path stays allocation-free and
     * byte-identical to before.
     */
    public static <T> T runAsCaptured(UUID captured, Supplier<T> body) {
        return captured == null ? body.get() : runAsOverride(captured, body);
    }

    /** {@link #runAsCaptured(UUID, Supplier)} for a body with no return value. */
    public static void runAsCaptured(UUID captured, Runnable body) {
        runAsCaptured(captured, () -> {
            body.run();
            return null;
        });
    }
```

Also widen the `override()` javadoc, whose "ONLY intended caller" clause is now false. Replace its last paragraph with:

```java
     * <p>Two callers bind this tier, and only two: the admin explorer's dry-run replay (above) and
     * {@link #runAsCaptured}, which re-binds an actor already resolved on a submitting thread. A
     * third one is a design smell, not a reuse opportunity.
```

And correct the class javadoc's now-stale sentence — replace:

```java
 * <p>Plain ThreadLocal, on purpose: the recorder resolves the actor on the CALLING thread before
 * the async audit hop, so no propagation into executors is needed. Nesting restores the previous
 * value; a throwing body still restores. Never leaks across threads.
```

with:

```java
 * <p>Plain ThreadLocal, on purpose: the recorder resolves the actor on the thread that reaches the
 * adapter. Where that thread is a POOL thread — the memory platform's three
 * {@code applicationTaskExecutor} hops — the submitter captures the actor with {@link #capture()}
 * and the task re-binds it with {@link #runAsCaptured} (mezo-ozri.7); nothing propagates
 * implicitly. Nesting restores the previous value; a throwing body still restores.
```

- [ ] **Step 4: Delegate the resolver so precedence has one home**

In `LlmActorResolver.java`, replace the whole body of `currentActor()` with the delegation, and drop the now-unused `Authentication`, `SecurityContextHolder` and `Jwt` imports:

```java
    /** The authenticated user's id, or null on an unauthenticated/anonymous (cron) thread. */
    public UUID currentActor() {
        // mezo-ozri.7: the precedence rules moved to LlmActorContext so the cross-thread capture
        // used by the memory platform's pool hops cannot drift from what the recorder resolves.
        return LlmActorContext.capture();
    }
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
./mvnw -q -pl backend test -Dtest='LlmActorContextCaptureTest,LlmActorContextTest,LlmActorContextOverrideTest,LlmActorResolverTest'
```

Expected: all four green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/techcore/security/LlmActorContext.java backend/src/main/java/io/mrkuhne/mezo/feature/llmlog/service/LlmActorResolver.java backend/src/test/java/io/mrkuhne/mezo/techcore/security/LlmActorContextCaptureTest.java
git commit -m "feat(llmlog): capture and re-bind the LLM actor across executor hops (mezo-ozri.7)"
```

---

### Task 2: Hop 1 — `MemoryShadowRunner`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunner.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunnerActorTest.java` (create)

**Interfaces:**
- Consumes: `LlmActorContext.capture()`, `LlmActorContext.runAsCaptured(UUID, Runnable)` from Task 1.
- Produces: nothing new; `MemoryShadowRunner.submit(MemoryRequest)` keeps its signature.

This hop matters first: everything the shadow run does downstream (hops 2 and 3) already runs on a pool thread, so if the actor is not captured here the later captures find nothing to capture.

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunnerActorTest.java`:

```java
package io.mrkuhne.mezo.feature.companion.memory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;

/**
 * mezo-ozri.7: the shadow run is the FIRST executor hop, so the actor it fails to carry can never
 * be recovered by the hops it triggers downstream. A SyncTaskExecutor stands in for the pool: the
 * assertion is about the binding around the task, not about which thread runs it.
 */
class MemoryShadowRunnerActorTest {

    @Test
    void testSubmit_shouldRunTheShadowRetrievalAsTheSubmittingActor_whenAnActorIsBound() {
        UUID user = UUID.randomUUID();
        AtomicReference<UUID> seenInsideTask = new AtomicReference<>();
        MemoryContextService memoryContextService = mock(MemoryContextService.class);
        when(memoryContextService.retrieve(any(), any())).thenAnswer(invocation -> {
            seenInsideTask.set(LlmActorContext.capture());
            return null;
        });
        AsyncTaskExecutor callerThreadExecutor = new TaskExecutorAdapter(new SyncTaskExecutor());
        MemoryShadowRunner runner = new MemoryShadowRunner(memoryContextService, callerThreadExecutor);

        LlmActorContext.runAs(user, () -> runner.submit(request(user)));

        assertThat(seenInsideTask.get()).isEqualTo(user);
    }

    @Test
    void testSubmit_shouldStillRunTheShadowRetrieval_whenThereIsNoActorToCapture() {
        AtomicReference<Boolean> ran = new AtomicReference<>(false);
        MemoryContextService memoryContextService = mock(MemoryContextService.class);
        when(memoryContextService.retrieve(any(), any())).thenAnswer(invocation -> {
            ran.set(true);
            return null;
        });
        AsyncTaskExecutor callerThreadExecutor = new TaskExecutorAdapter(new SyncTaskExecutor());
        MemoryShadowRunner runner = new MemoryShadowRunner(memoryContextService, callerThreadExecutor);

        runner.submit(request(UUID.randomUUID()));

        assertThat(ran.get()).isTrue();
    }

    private static MemoryRequest request(UUID user) {
        return new MemoryRequest(user, ConsumerPolicy.CHAT_AMBIENT, "Mi történt Boglárkával?",
                List.of(), LocalDate.of(2026, 9, 8), 1200, UUID.randomUUID(), false);
    }
}
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
./mvnw -q -pl backend test -Dtest=MemoryShadowRunnerActorTest
```

Expected: `testSubmit_shouldRunTheShadowRetrievalAsTheSubmittingActor…` FAILS with `expecting … to be equal to <uuid> but was null`. The second test passes already — it is the regression guard for the null path.

- [ ] **Step 3: Capture and re-bind**

In `MemoryShadowRunner.java`, add the import `io.mrkuhne.mezo.techcore.security.LlmActorContext;` and rewrite `submit`:

```java
    public void submit(MemoryRequest request) {
        // mezo-ozri.7: applicationTaskExecutor carries neither the security context nor the actor
        // ThreadLocals, and this is the FIRST hop — an actor lost here cannot be recovered by the
        // retriever and rerank hops the shadow run triggers downstream, so their llm_log rows would
        // book against nobody and S6's per-user cap would not see this traffic.
        UUID actor = LlmActorContext.capture();
        try {
            applicationTaskExecutor.submit(() -> LlmActorContext.runAsCaptured(actor, () -> run(request)));
        } catch (RuntimeException exception) {
            log.warn("Shadow memory retrieval could not be submitted for conversation {}",
                    request.conversationId(), exception);
        }
    }
```

Add `import java.util.UUID;` if it is not already imported.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
./mvnw -q -pl backend test -Dtest=MemoryShadowRunnerActorTest
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunner.java backend/src/test/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryShadowRunnerActorTest.java
git commit -m "fix(companion): carry the LLM actor into the shadow retrieval task (mezo-ozri.7)"
```

---

### Task 3: Hops 2 and 3 — retriever tasks and the rerank call

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryContextService.java:200-290`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryReranker.java:96-165`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmActorPropagationIT.java` (create)

**Interfaces:**
- Consumes: `LlmActorContext.capture()`, `LlmActorContext.runAsCaptured(UUID, Supplier)` from Task 1.
- Produces: nothing new. `MemoryContextService`'s constructor signature is unchanged — `(queryPreparer, retrievers, fusion, selector, renderer, reranker, auditWriter, properties, llmCallContextHolder, taskExecutor)` — and so is `LlmMemoryReranker.rerank(List<FusedCandidate>)`.

This is the acceptance criterion of mezo-ozri.7. The assertion is made at the `CompanionLlm` port, on the same thread and instant `EventPublishingLlmCallRecorder` resolves the actor — an end-to-end `llm_log_history` row assertion is impossible under `companion-fake`, because `FakeCompanionLlm` never reaches the recorder (the same argument the sibling `LlmCallContextTaggingIT` documents; the record → row mapping is `LlmLogWriterIT`'s job).

- [ ] **Step 1: Write the failing test**

Create `backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmActorPropagationIT.java`:

```java
package io.mrkuhne.mezo.feature.llmlog.context;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.feature.companion.memory.dto.ScoreBreakdown;
import io.mrkuhne.mezo.feature.companion.memory.service.LlmMemoryReranker;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetriever;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.ActiveProfiles;
import reactor.core.publisher.Flux;

/**
 * mezo-ozri.7: the memory platform submits its LLM work to {@code applicationTaskExecutor}, which
 * propagates no security context — so before this slice the audit rows of a rerank made FOR an
 * authenticated user booked against nobody, and the per-user USD cap (mezo-ozri.6) could not see
 * that traffic.
 *
 * <p>The assertion is made where {@code EventPublishingLlmCallRecorder} makes it: by calling
 * {@link LlmActorResolver#currentActor()} on the very thread that reaches the port, at call time.
 * An end-to-end "one llm_log_history row" assertion is impossible under {@code companion-fake} —
 * the fake adapter never reaches the recorder; that mapping is {@code LlmLogWriterIT}'s job. Same
 * reasoning as the sibling {@link LlmCallContextTaggingIT}.
 */
@ActiveProfiles("companion-fake")
@Import(LlmActorPropagationIT.ActorCapturingConfiguration.class)
class LlmActorPropagationIT extends AbstractIntegrationTest {

    /** Reads the actor DURING the call, exactly where the live recorder reads it. */
    static class ActorCapturingCompanionLlm implements CompanionLlm {

        private final LlmActorResolver actorResolver;
        private UUID capturedActor;
        private String answer = "[]";

        ActorCapturingCompanionLlm(LlmActorResolver actorResolver) {
            this.actorResolver = actorResolver;
        }

        UUID capturedActor() {
            return capturedActor;
        }

        void answerWith(String answer) {
            this.answer = answer;
        }

        void reset() {
            this.capturedActor = null;
        }

        @Override
        public String complete(String systemPrompt, List<CompanionLlm.Turn> history, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext) {
            capturedActor = actorResolver.currentActor();
            return answer;
        }

        @Override
        public Flux<String> stream(String systemPrompt, List<CompanionLlm.Turn> history, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext) {
            capturedActor = actorResolver.currentActor();
            return Flux.just(answer);
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            capturedActor = actorResolver.currentActor();
            return answer;
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            capturedActor = actorResolver.currentActor();
            return answer;
        }
    }

    @TestConfiguration
    static class ActorCapturingConfiguration {

        @Bean
        @Primary
        ActorCapturingCompanionLlm actorCapturingCompanionLlm(LlmActorResolver actorResolver) {
            return new ActorCapturingCompanionLlm(actorResolver);
        }
    }

    @Autowired private ActorCapturingCompanionLlm actorCapturingCompanionLlm;
    @Autowired private LlmMemoryReranker llmMemoryReranker;
    @Autowired private LlmActorResolver llmActorResolver;
    @Autowired @Qualifier("applicationTaskExecutor") private AsyncTaskExecutor applicationTaskExecutor;

    @BeforeEach
    void resetCapture() {
        actorCapturingCompanionLlm.reset();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private static void authenticateAs(UUID principalId) {
        Jwt jwt = Jwt.withTokenValue("test-token")
            .header("alg", "none")
            .subject(principalId.toString())
            .issuedAt(Instant.now().minusSeconds(60))
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
        SecurityContextHolder.getContext()
            .setAuthentication(new JwtAuthenticationToken(jwt, List.of()));
    }

    @Test
    void testRerank_shouldBookTheCallAgainstTheRequestUser_whenTheRerankRunsOnAPooledThread() {
        UUID user = UUID.randomUUID();
        authenticateAs(user);
        FusedCandidate first = fusedCandidate(UUID.randomUUID());
        FusedCandidate second = fusedCandidate(UUID.randomUUID());
        actorCapturingCompanionLlm.answerWith(
            "[\"%s\",\"%s\"]".formatted(second.candidate().stableId(), first.candidate().stableId()));

        llmMemoryReranker.rerank(List.of(first, second));

        assertThat(actorCapturingCompanionLlm.capturedActor()).isEqualTo(user);
    }

    @Test
    void testRetrieverTask_shouldSeeTheRequestUserAsActor_whenSubmittedFromAnAuthenticatedThread() {
        // Hop 2 in isolation: the same capture/re-bind pair MemoryContextService wraps every
        // retriever task in, asserted through the resolver the embedding adapter would use.
        UUID user = UUID.randomUUID();
        authenticateAs(user);
        AtomicReference<UUID> seenInTask = new AtomicReference<>();
        UUID captured = LlmActorContext.capture();

        try {
            applicationTaskExecutor.submit(() ->
                LlmActorContext.runAsCaptured(captured, () -> seenInTask.set(llmActorResolver.currentActor())))
                .get();
        } catch (Exception exception) {
            throw new AssertionError("the retriever task must not fail", exception);
        }

        assertThat(seenInTask.get()).isEqualTo(user);
    }

    private static FusedCandidate fusedCandidate(UUID stableId) {
        MemoryCandidate candidate = new MemoryCandidate("dense", "memory_item", stableId, stableId, stableId,
                "journal_entry", "Napló", "tartalom", LocalDate.of(2026, 9, 1), 0.9,
                false, false, 0.5, null, null);
        return new FusedCandidate(candidate, new ScoreBreakdown(0.5, 0, 0, 0, 0, 0, 0.5), Map.of("dense", 1));
    }
}
```

Note: the unused imports `RetrievalInput` and `MemoryRetriever` are not needed — delete those two import lines when creating the file.

- [ ] **Step 2: Run the IT and confirm the first test fails**

```bash
./mvnw -q -pl backend verify -Dmezo.test.use-testcontainers=true -Dit.test=LlmActorPropagationIT -DfailIfNoTests=false -DskipUTs=true
```

If that profile flag combination is not what this repo uses, fall back to the invocation the sibling IT is run with:

```bash
./mvnw -q -pl backend test -Dmezo.test.use-testcontainers=true -Dtest=LlmActorPropagationIT
```

Expected: `testRerank_shouldBookTheCallAgainstTheRequestUser…` FAILS (`expected <user> but was null`) — the reranker's task runs actor-less. The second test PASSES already: it exercises the helper directly, which Task 1 shipped.

- [ ] **Step 3: Widen the reranker's capture from override to actor**

In `LlmMemoryReranker.java`, replace the `UUID actorOverride = LlmActorContext.override();` capture and its comment block with:

```java
            // Same reason, second ThreadLocal: LlmActorContext does not propagate into the pool
            // either. mezo-ozri.7 widens this from the admin replay's override to the FULL actor
            // (override → JWT principal → cron actor): a chat turn's rerank is a real smart-tier
            // call made FOR a user, and leaving it unattributed both blanks its llm_log created_by
            // and hides it from the per-user USD cap (mezo-ozri.6).
            UUID actor = LlmActorContext.capture();
```

and the submit line with:

```java
            call = applicationTaskExecutor.submit(() -> LlmActorContext.runAsCaptured(actor,
                    () -> llmCallContextHolder.runWith(
                            context, () -> llm.completeSmart(SYSTEM_PROMPT, render(exposed)))));
```

Then delete the now-unused private helper and its javadoc:

```java
    /** Binds {@code override} for the body when there is one; a null override is a plain call. */
    private static <T> T withActorOverride(UUID override, java.util.function.Supplier<T> body) {
        return override == null ? body.get() : LlmActorContext.runAsOverride(override, body);
    }
```

- [ ] **Step 4: Widen the retriever capture the same way**

In `MemoryContextService.java`, in `retrieveCandidates`, replace the capture comment and `UUID actorOverride = LlmActorContext.override();` with:

```java
        // mezo-4qyt: both LLM breadcrumb ThreadLocals are plain, so a retriever's embed call on a
        // pool thread sees neither the actor nor the feature — capture them HERE, on the calling
        // thread, and re-bind them inside the task. The two are deliberately NOT symmetric:
        // mezo-ozri.7 widens the ACTOR to every caller (an embed made for a user must book against
        // that user, or the per-user cap cannot see it), while the CONTEXT label stays replay-only,
        // because widening the label would retroactively re-file all existing embed traffic under a
        // different feature and corrupt the shipped cost matrix.
        UUID actor = LlmActorContext.capture();
```

Rename the parameter through the two call sites so the widened meaning is visible in the signature — the `submit` lambda:

```java
                        Future<RetrieverOutcome> future = applicationTaskExecutor.submit(
                                () -> executeInScope(retriever, input, actor, propagated));
```

and `executeInScope`:

```java
    /** Re-binds the captured breadcrumbs (if any) around one retriever's work on the pool thread. */
    private RetrieverOutcome executeInScope(MemoryRetriever retriever, RetrievalInput input,
            UUID actor, LlmCallContext context) {
        Supplier<RetrieverOutcome> work = () -> execute(retriever, input);
        Supplier<RetrieverOutcome> labelled = context == null
                ? work
                : () -> llmCallContextHolder.runWith(context, work);
        return LlmActorContext.runAsCaptured(actor, labelled);
    }
```

- [ ] **Step 5: Run the IT and confirm it passes**

```bash
./mvnw -q -pl backend test -Dmezo.test.use-testcontainers=true -Dtest=LlmActorPropagationIT
```

Expected: both tests PASS.

- [ ] **Step 6: Run the neighbouring suites that could regress**

```bash
./mvnw -q -pl backend test -Dmezo.test.use-testcontainers=true -Dtest='LlmCallContextTaggingIT,MemoryContextServiceIT,AdminMemoryReplayIT,UserFanOutIT,LlmLogWriterIT,LlmLogRecorderWiringIT'
```

Expected: all green. `AdminMemoryReplayIT` is the one that proves the dry-run replay's override still outranks the owner's principal after the capture was widened — if it goes red, the precedence in `capture()` is wrong, not the test.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/LlmMemoryReranker.java backend/src/main/java/io/mrkuhne/mezo/feature/companion/memory/service/MemoryContextService.java backend/src/test/java/io/mrkuhne/mezo/feature/llmlog/context/LlmActorPropagationIT.java
git commit -m "fix(companion): book memory-platform LLM calls against the request user (mezo-ozri.7)"
```

---

### Task 4: Docs and gates

**Files:**
- Modify: `docs/features/_platform-auth-security.md:195, :428`
- Modify: `docs/CODEMAP.md` (only if the generator reports drift)

**Interfaces:**
- Consumes: the finished behaviour from Tasks 1–3.
- Produces: nothing code-facing.

- [ ] **Step 1: Correct the stale claim in the auth/security feature doc**

`_platform-auth-security.md:195` currently ends with "The LLM-call audit recorder reads `LlmActorContext.current()` when the JWT principal is absent." Append to that bullet:

```markdown
 Since `mezo-ozri.7` the class also owns the cross-thread pair `capture()` / `runAsCaptured(...)`: `capture()` resolves the thread's effective actor with the audit precedence (`override()` → JWT subject → `current()`) and `LlmActorResolver.currentActor()` simply delegates to it, so the two can never drift. The memory platform's three `applicationTaskExecutor` hops — `MemoryShadowRunner.submit`, `MemoryContextService.retrieveCandidates` and `LlmMemoryReranker.rerank` — capture on the submitting thread and re-bind inside the task, because `applicationTaskExecutor` propagates neither the security context nor these ThreadLocals; without it a rerank or embed made for a signed-in user wrote `llm_log_history.created_by = null` and the per-user USD cap (`mezo-ozri.6`) could not see that traffic. `runAsCaptured` binds the OVERRIDE tier on purpose (a decision already made on the submitting thread outranks whatever the pool thread carries), and a null capture is a plain call.
```

Then update line 428's index entry:

```markdown
- `security/LlmActorContext.java` (S3/S6, cross-thread capture `mezo-ozri.7`) — `ThreadLocal<UUID>` acting-account for cron LLM calls; `runAs`, `runAsOverride`, `capture`, `runAsCaptured`.
```

- [ ] **Step 2: Check the codemap gate**

No main-source file was created or renamed in this slice, so `docs/CODEMAP.md` should be unchanged. Prove it rather than assume it:

```bash
node scripts/generate-codemap.mjs && git diff --stat docs/CODEMAP.md
```

If the script name differs, find it with `ls scripts | grep -i codemap`. Expected: empty diff. If it is not empty, commit the regenerated file in this same change.

- [ ] **Step 3: Commit**

```bash
git add docs/features/_platform-auth-security.md docs/CODEMAP.md
git commit -m "docs(auth): record the cross-thread LLM actor capture (mezo-ozri.7)"
```

- [ ] **Step 4: Push, open the self-PR, and wait for CI**

```bash
git push -u origin feat/llm-actor-propagation
gh pr create --fill --title "fix(companion): carry the LLM actor across the memory-platform executor hops (mezo-ozri.7)"
```

The full backend IT suite only runs there — CI is the authoritative gate, local runs were focused by design.

- [ ] **Step 5: Re-check the merge result against the current main, then merge**

```bash
gh workflow run premerge.yml -f pr=<number>
```

When it is green: `git pull --rebase` on main, merge the branch with `--no-ff`, push main, delete the branch.

- [ ] **Step 6: Close the issue and unblock S6**

```bash
bd close mezo-ozri.7
bd ready | grep mezo-ozri
```

Expected: `mezo-ozri.6` now appears — it was the only dependency left.

---

## Self-Review

**Spec coverage.** mezo-ozri.7's acceptance criterion is "a memory rerank triggered by an authenticated request writes an `llm_log_history` row whose `created_by` is that user, proven by an IT". Task 3's `testRerank_shouldBookTheCallAgainstTheRequestUser…` proves it at the exact seam the live recorder reads (`LlmActorResolver.currentActor()`, on the adapter's thread, at call time); the row-writing half of that sentence is already covered by `LlmLogWriterIT` and cannot be re-proven under `companion-fake`, which is why the IT's javadoc states the substitution explicitly. The issue text also names `MemoryContextService`/`MemoryShadowRunner` as affected sites — Tasks 2 and 3 cover both.

**Placeholders.** No TBDs; every code step carries the literal code. The two commands whose exact form depends on repo scripts (`generate-codemap.mjs`, the IT invocation) each carry an explicit fallback.

**Type consistency.** `capture()`/`runAsCaptured` names are identical in Tasks 1–3 and in the docs of Task 4. `MemoryContextService.executeInScope`'s third parameter is renamed `actorOverride` → `actor` in both its declaration and its single call site. `LlmMemoryReranker.withActorOverride` is deleted in the same step that removes its last caller.
