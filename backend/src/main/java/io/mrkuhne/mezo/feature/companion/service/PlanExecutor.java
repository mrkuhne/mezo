package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * Executes a validated plan with PURE JAVA — no model in the loop, so nothing can misread or
 * skip a step (spec §6.4 / X1). Independent reads fan out in parallel through the SAME
 * {@link io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback} wrappers the Spring AI
 * loop uses, so audit, refs, budget and the internal-sphere ArchUnit guarantee all hold
 * unchanged. Outcomes return in PLAN ORDER regardless of completion order.
 *
 * <p>The executor itself makes no LLM calls, but some of the tools it fans out to do — e.g.
 * {@code find_similar_past_days} calls {@code MemoryRecallService.recallSimilarDays}, which makes
 * a provider embedding call. That call runs on an {@code applicationTaskExecutor} pool thread,
 * where {@link LlmActorContext#capture()} resolves null: the actor is captured ONCE on the
 * submitting thread before the submit loop and re-bound inside each task with
 * {@link LlmActorContext#runAsCaptured}, mirroring {@code MemoryShadowRunner} /
 * {@code MemoryQueryEmbedder}, so the downstream {@code llm_log} row books against the right user
 * instead of silently against nobody.
 *
 * <p>Total wall time for {@link #execute} stays bounded near the SLOWEST step, not the sum of
 * every step's timeout: a single absolute deadline is computed once before the collection loop
 * and shared across all entries.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PlanExecutor {

    /** Honest missing-result texts (ADR 0010): shown to the model, never fabricated data. */
    public static final String STEP_TIMEOUT = "Nem érkezett meg időben az adat (időtúllépés).";
    public static final String STEP_FAILED = "Nem sikerült elindítani a lekérdezést (belső hiba).";

    private final CompanionToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;
    private final CompanionProperties properties;
    private final AsyncTaskExecutor applicationTaskExecutor;

    // mezo-rj214.7 fix round 1, finding 7: Lombok does NOT copy @Qualifier from a field onto the
    // generated constructor parameter without a project lombok.config (none exists in this repo),
    // so @RequiredArgsConstructor + a field-level @Qualifier is inert here. It happened to compile
    // and inject the right bean only because the other AsyncTaskExecutor candidate
    // (LlmLogAsyncConfig's "llmLogExecutor") is declared with defaultCandidate = false, leaving
    // applicationTaskExecutor as the sole by-type candidate. An explicit constructor makes the
    // qualifier real instead of relying on that side effect.
    public PlanExecutor(CompanionToolRegistry toolRegistry, ObjectMapper objectMapper,
            CompanionProperties properties,
            @Qualifier("applicationTaskExecutor") AsyncTaskExecutor applicationTaskExecutor) {
        this.toolRegistry = toolRegistry;
        this.objectMapper = objectMapper;
        this.properties = properties;
        this.applicationTaskExecutor = applicationTaskExecutor;
    }

    public List<ToolCallAudit.ToolOutcome> execute(ValidatedPlan plan, UUID userId, ToolCallAudit audit) {
        List<ToolCallback> callbacks = toolRegistry.callbacks(audit);
        return execute(plan, callbacks, toolRegistry.toolContext(userId, audit));
    }

    public List<ToolCallAudit.ToolOutcome> execute(ValidatedPlan plan, List<ToolCallback> callbacks,
            Map<String, Object> context) {
        Map<String, ToolCallback> byName = callbacks.stream()
            .collect(Collectors.toMap(cb -> cb.getToolDefinition().name(), Function.identity(), (a, b) -> {
                log.warn("Duplicate tool callback name {} from the registry; keeping the first", a.getToolDefinition().name());
                return a;
            }));
        ToolContext toolContext = new ToolContext(context);
        long timeoutMs = properties.turn().executor().stepTimeoutMs();
        Semaphore permits = new Semaphore(properties.turn().executor().parallelism());

        // Captured ONCE on the submitting thread — see the class javadoc. Every submitted task
        // re-binds this same actor, regardless of which tool it runs, because the executor cannot
        // know in advance which steps will make an LLM call underneath.
        UUID actor = LlmActorContext.capture();

        List<Submitted> submitted = new ArrayList<>();
        for (TurnPlan.PlanStep step : plan.steps()) {
            String args = argsJson(step.args());
            ToolCallback callback = byName.get(step.tool());
            if (callback == null) {
                // The validator prevents this; if reality diverges, report instead of throwing.
                submitted.add(new Submitted(step, args, null));
                continue;
            }
            boolean acquired;
            try {
                acquired = permits.tryAcquire(timeoutMs, TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while waiting for a permit for {}", step.tool(), e);
                submitted.add(new Submitted(step, args, null));
                continue;
            }
            if (!acquired) {
                // No permit within the budget: nothing was submitted, so nothing to release.
                log.warn("No executor permit available within {} ms for {}", timeoutMs, step.tool());
                submitted.add(new Submitted(step, args, null, true));
                continue;
            }
            try {
                Future<String> future = applicationTaskExecutor.submit(() -> {
                    try {
                        return LlmActorContext.runAsCaptured(actor, () -> callback.call(args, toolContext));
                    } finally {
                        permits.release();
                    }
                });
                submitted.add(new Submitted(step, args, future));
            } catch (Exception e) {
                // The permit WAS acquired but the task never started (rejected execution etc.) —
                // this is the only submission-failure path where a release is correct.
                permits.release();
                log.warn("Plan step submission failed for {}", step.tool(), e);
                submitted.add(new Submitted(step, args, null));
            }
        }

        // ONE absolute deadline shared by every entry so the collection loop's total cost stays
        // near the slowest step (finding 4) instead of compounding to steps × timeoutMs.
        long deadlineNanos = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);

        List<ToolCallAudit.ToolOutcome> outcomes = new ArrayList<>(submitted.size());
        for (Submitted entry : submitted) {
            outcomes.add(new ToolCallAudit.ToolOutcome(entry.step().tool(), entry.args(), collect(entry, deadlineNanos)));
        }
        return List.copyOf(outcomes);
    }

    private String collect(Submitted entry, long deadlineNanos) {
        if (entry.timedOutAtPermit()) {
            return STEP_TIMEOUT;
        }
        if (entry.future() == null) {
            return STEP_FAILED;
        }
        long remainingNanos = deadlineNanos - System.nanoTime();
        try {
            if (remainingNanos <= 0) {
                if (!entry.future().isDone()) {
                    entry.future().cancel(true);
                    log.warn("Plan step already past the shared deadline: {}", entry.step().tool());
                    return STEP_TIMEOUT;
                }
                remainingNanos = 0;
            }
            // RecordingToolCallback already converts tool exceptions to its TOOL_FAILED text,
            // so an ExecutionException here is infrastructure, not domain.
            return entry.future().get(remainingNanos, TimeUnit.NANOSECONDS);
        } catch (TimeoutException e) {
            entry.future().cancel(true);
            log.warn("Plan step timed out: {}", entry.step().tool());
            return STEP_TIMEOUT;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            entry.future().cancel(true);
            return STEP_FAILED;
        } catch (Exception e) {
            log.warn("Plan step failed: {}", entry.step().tool(), e);
            return STEP_FAILED;
        }
    }

    private String argsJson(Map<String, Object> args) {
        try {
            return objectMapper.writeValueAsString(args);
        } catch (Exception e) {
            log.warn("Failed to serialize tool arguments; substituting an empty object", e);
            return "{}";
        }
    }

    private record Submitted(TurnPlan.PlanStep step, String args, Future<String> future, boolean timedOutAtPermit) {
        Submitted(TurnPlan.PlanStep step, String args, Future<String> future) {
            this(step, args, future, false);
        }
    }
}
