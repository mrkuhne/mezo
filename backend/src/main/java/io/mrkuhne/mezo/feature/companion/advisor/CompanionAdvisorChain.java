package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
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
 * Post-response advisor chain (old docs §4.5 retry semantics on the CompanionLlm port): clinical
 * check first (deterministic, ~0 ms), then the fabricated-action-claim backstop (also
 * deterministic, ~0 ms) — see {@link #runChecks}. Violation -> corrective re-prompt (same user
 * message, same tools, SAME audit — chips honestly reflect the whole turn) up to
 * advisors.max-retries times; a final violating answer ships degraded=true. Timing + violations
 * are logged (the roadmap's "measure!"). S9.8 (mezo-rj214.7, mezo-rj214.5) dropped the third,
 * LLM-judged check from this chain — {@link TurnVerdictCheck} explains why.
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
    private final ActionClaimCheck actionClaimCheck;
    private final CompanionProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /** Sync path: first attempt + review in one call. */
    public AdvisedAnswer complete(String systemPrompt, String turnContext, List<Turn> history,
            String userMessage, List<ToolCallback> tools, Map<String, Object> toolContext) {
        String answer = companionLlm.complete(systemPrompt, turnContext, history, userMessage, tools, toolContext);
        return review(systemPrompt, turnContext, history, userMessage, answer, tools, toolContext);
    }

    /**
     * CHAT gear, sync path: the tool-free smart round plus the review below.
     *
     * <p>Mirrors {@link #complete} so the CHAT branch cannot drift from the others.
     */
    public AdvisedAnswer completeChat(String systemPrompt, String turnContext, List<Turn> history,
            String userMessage) {
        String answer = companionLlm.completeSmart(systemPrompt, turnContext, history, userMessage);
        return review(systemPrompt, turnContext, history, userMessage, answer, null, null);
    }

    /**
     * Post-response review, every live path's only gate since S9.8 (mezo-rj214.7, mezo-rj214.5):
     * the deterministic clinical + action-claim checks below, with a corrective re-prompt (same
     * user message, same tools, SAME audit — chips honestly reflect the whole turn) up to
     * advisors.max-retries times; a final violating answer ships degraded=true. Used to be two
     * methods — {@code review} for the tool-carrying turn and {@code reviewChat} for the tool-free
     * one, split only because the now-removed LLM verdict was skippable on a CHAT turn but not on
     * a tool-carrying one. With the verdict gone from BOTH, the split had nothing left to justify
     * it (see {@link TurnVerdictCheck}'s javadoc for where that check went).
     *
     * <p>{@code tools} is {@code null} for a tool-free turn (CHAT gear, and any turn a
     * pipeline/conversation-first round already answered without this chain's own tool loop) — the
     * corrective retry then runs the tool-free smart completion instead of the tool-carrying one,
     * so a retry never hands out tools the original round never had.
     */
    public AdvisedAnswer review(String systemPrompt, String turnContext, List<Turn> history, String userMessage,
            String answer, List<ToolCallback> tools, Map<String, Object> toolContext) {
        long startedAt = System.currentTimeMillis();
        List<AdvisorViolation> violations = runChecks(answer);
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
                    () -> tools == null
                            ? companionLlm.completeSmart(systemPrompt, retryContext, history, userMessage)
                            : companionLlm.complete(systemPrompt, retryContext, history, userMessage, tools, toolContext));
            violations = runChecks(answer);
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
     * Clinical first (safety-critical: a wrong dose-change suggestion is the worse harm), then the
     * fabricated-action-claim backstop (mezo-q0p5a) — both deterministic and ~0 ms. The LLM verdict
     * that used to run third here left the live path in S9.8; see {@link TurnVerdictCheck}.
     */
    private List<AdvisorViolation> runChecks(String answer) {
        Optional<AdvisorViolation> clinical = clinicalOutputCheck.check(answer);
        if (clinical.isPresent()) {
            return List.of(clinical.get());
        }
        return actionClaimCheck.check(answer).map(List::of).orElseGet(List::of);
    }
}
