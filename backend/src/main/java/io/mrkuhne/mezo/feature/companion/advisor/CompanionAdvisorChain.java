package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * V1.3 post-response advisor chain (old docs §4.5 retry semantics on the CompanionLlm port):
 * clinical check first (deterministic, ~0 ms; a hit skips the LLM verdict for that round), then
 * the combined LLM verdict. Violation -> corrective re-prompt (same user message, same tools,
 * SAME audit — chips honestly reflect the whole turn) up to advisors.max-retries times; a final
 * violating answer ships degraded=true. Timing + verdicts are logged (the roadmap's "measure!").
 */
@Slf4j
@Component
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.COMPANION_ADVISORS_SWITCH},
        havingValue = "true")
@RequiredArgsConstructor
public class CompanionAdvisorChain {

    private final CompanionLlm companionLlm;
    private final ClinicalOutputCheck clinicalOutputCheck;
    private final TurnVerdictCheck turnVerdictCheck;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /** Sync path: first attempt + review in one call. */
    public AdvisedAnswer complete(String systemPrompt, String turnContext, List<Turn> history,
            String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext,
            ToolCallAudit audit) {
        String answer = companionLlm.complete(systemPrompt, turnContext, history, userMessage, tools, toolContext);
        return review(systemPrompt, turnContext, history, userMessage, answer, tools, toolContext, audit);
    }

    /** Streamed path: attempt-1 already delivered as deltas — review it, retry non-streamed if needed. */
    public AdvisedAnswer review(String systemPrompt, String turnContext, List<Turn> history, String userMessage,
            String answer, List<ToolCallback> tools, Map<String, Object> toolContext, ToolCallAudit audit) {
        long startedAt = System.currentTimeMillis();
        // The checks judge the answer against EVERYTHING it was grounded in, so they see the two
        // halves joined — the split (mezo-ozri.5) is a transport detail of the outgoing request.
        String instructions = CompanionLlm.joinInstructions(systemPrompt, turnContext);
        List<AdvisorViolation> violations = runChecks(instructions, history, userMessage, answer, audit);
        int retries = 0;
        while (!violations.isEmpty() && retries < properties.advisors().maxRetries()) {
            retries++;
            // mezo-2zyu: the corrective round is the ADVISOR's cost, not the turn's — and in the
            // streamed path it runs deferred, where the caller's context is already gone.
            // mezo-ozri.5: the corrective block joins the VOLATILE half. Appending it to the stable
            // prompt would push a per-retry string in front of the tool definitions and throw the
            // cached prefix away for the retry round — the round we least want to pay twice for.
            String retryContext = (turnContext == null ? "" : turnContext) + AdvisorRetry.block(violations);
            answer = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_advisor", "retry", null, null),
                    // a korrekciós kör ugyanazt a beszélgetést látja, mint az eredeti
                    () -> companionLlm.complete(systemPrompt, retryContext, history, userMessage, tools, toolContext));
            violations = runChecks(instructions, history, userMessage, answer, audit);
        }
        boolean degraded = !violations.isEmpty();
        if (degraded) {
            log.warn("Advisor chain degraded an answer after {} retries: {}", retries, violations);
        }
        log.info("Advisor chain took {} ms (retries={}, degraded={})",
                System.currentTimeMillis() - startedAt, retries, degraded);
        return new AdvisedAnswer(answer, degraded);
    }

    /**
     * CHAT gear, sync path: the tool-free smart round plus the clinical review below.
     *
     * <p>Mirrors {@link #complete} so the CHAT branch cannot drift from the others.
     */
    public AdvisedAnswer completeChat(String systemPrompt, String turnContext, List<Turn> history,
            String userMessage) {
        String answer = companionLlm.completeSmart(systemPrompt, turnContext, history, userMessage);
        return reviewChat(systemPrompt, turnContext, history, userMessage, answer);
    }

    /**
     * CHAT gear, review only: the deterministic clinical check with the SAME retry-once/degraded
     * semantics every other answer gets (spec 2026-09-16 §6.5, mezo-rj214.7).
     *
     * <p>A CHAT turn skips the LLM verdict on purpose — that check judges an answer against the
     * context and tool outcomes it was grounded in, and a CHAT turn deliberately has neither, so
     * it would be paying a model call to grade nothing. {@link ClinicalOutputCheck} is a different
     * animal: a regex over the answer text, no LLM, no context, ~0 ms. The prohibition it enforces
     * — never suggest changing a prescription dose — is the one rule that must not have a branch
     * where it does not apply, and "the user asked a general question" is exactly the shape in
     * which a model is most tempted to volunteer dosing advice.
     *
     * <p>The corrective round stays tool-free and smart-tier, like the answer it is correcting.
     */
    public AdvisedAnswer reviewChat(String systemPrompt, String turnContext, List<Turn> history,
            String userMessage, String answer) {
        long startedAt = System.currentTimeMillis();
        Optional<AdvisorViolation> violation = clinicalOutputCheck.check(answer);
        int retries = 0;
        while (violation.isPresent() && retries < properties.advisors().maxRetries()) {
            retries++;
            String retryContext =
                    (turnContext == null ? "" : turnContext) + AdvisorRetry.block(List.of(violation.get()));
            answer = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_advisor", "retry", null, null),
                    () -> companionLlm.completeSmart(systemPrompt, retryContext, history, userMessage));
            violation = clinicalOutputCheck.check(answer);
        }
        boolean degraded = violation.isPresent();
        if (degraded) {
            log.warn("Advisor chain degraded a CHAT answer after {} retries: {}", retries, violation.get());
        }
        log.info("Advisor CHAT review took {} ms (retries={}, degraded={})",
                System.currentTimeMillis() - startedAt, retries, degraded);
        return new AdvisedAnswer(answer, degraded);
    }

    /** Clinical first; a clinical hit skips the verdict LLM call this round (the retry re-checks all). */
    private List<AdvisorViolation> runChecks(
            String systemPrompt, List<Turn> history, String userMessage, String answer, ToolCallAudit audit) {
        Optional<AdvisorViolation> clinical = clinicalOutputCheck.check(answer);
        if (clinical.isPresent()) {
            return List.of(clinical.get());
        }
        return turnVerdictCheck.check(systemPrompt, history, userMessage, answer, audit.toolOutcomes());
    }
}
