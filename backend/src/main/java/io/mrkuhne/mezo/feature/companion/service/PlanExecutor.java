package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
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
 * <p>No {@code LlmActorContext} capture: the executor makes no LLM calls, and the tools take
 * their identity from the ToolContext's userId, not from the actor holder.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PlanExecutor {

    /** Honest missing-result texts (ADR 0010): shown to the model, never fabricated data. */
    public static final String STEP_TIMEOUT = "Nem érkezett meg időben az adat (időtúllépés).";
    public static final String STEP_FAILED = "Nem sikerült elindítani a lekérdezést (belső hiba).";

    private final CompanionToolRegistry toolRegistry;
    private final ObjectMapper objectMapper;
    private final CompanionProperties properties;
    @Qualifier("applicationTaskExecutor")
    private final AsyncTaskExecutor applicationTaskExecutor;

    public List<ToolCallAudit.ToolOutcome> execute(ValidatedPlan plan, UUID userId, ToolCallAudit audit) {
        List<ToolCallback> callbacks = toolRegistry.callbacks(audit);
        Map<String, ToolCallback> byName = callbacks.stream()
            .collect(java.util.stream.Collectors.toMap(cb -> cb.getToolDefinition().name(), Function.identity()));
        ToolContext toolContext = new ToolContext(toolRegistry.toolContext(userId, audit));
        long timeoutMs = properties.turn().executor().stepTimeoutMs();
        Semaphore permits = new Semaphore(properties.turn().executor().parallelism());

        List<Submitted> submitted = new ArrayList<>();
        for (TurnPlan.PlanStep step : plan.steps()) {
            String args = argsJson(step.args());
            ToolCallback callback = byName.get(step.tool());
            if (callback == null) {
                // The validator prevents this; if reality diverges, report instead of throwing.
                submitted.add(new Submitted(step, args, null));
                continue;
            }
            try {
                permits.acquire();
                Future<String> future = applicationTaskExecutor.submit(() -> {
                    try {
                        return callback.call(args, toolContext);
                    } finally {
                        permits.release();
                    }
                });
                submitted.add(new Submitted(step, args, future));
            } catch (Exception e) {
                permits.release();
                log.warn("Plan step submission failed for {}", step.tool(), e);
                submitted.add(new Submitted(step, args, null));
            }
        }

        List<ToolCallAudit.ToolOutcome> outcomes = new ArrayList<>(submitted.size());
        for (Submitted entry : submitted) {
            outcomes.add(new ToolCallAudit.ToolOutcome(entry.step().tool(), entry.args(), collect(entry, timeoutMs)));
        }
        return List.copyOf(outcomes);
    }

    private String collect(Submitted entry, long timeoutMs) {
        if (entry.future() == null) {
            return STEP_FAILED;
        }
        try {
            // RecordingToolCallback already converts tool exceptions to its TOOL_FAILED text,
            // so an ExecutionException here is infrastructure, not domain.
            return entry.future().get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            entry.future().cancel(true);
            log.warn("Plan step timed out after {} ms: {}", timeoutMs, entry.step().tool());
            return STEP_TIMEOUT;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
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
            return "{}";
        }
    }

    private record Submitted(TurnPlan.PlanStep step, String args, Future<String> future) {}
}
