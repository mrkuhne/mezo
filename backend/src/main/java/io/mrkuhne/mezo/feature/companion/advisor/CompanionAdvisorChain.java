package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
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

    /** Sync path: first attempt + review in one call. */
    public AdvisedAnswer complete(String systemPrompt, String userMessage,
            List<ToolCallback> tools, Map<String, Object> toolContext, ToolCallAudit audit) {
        String answer = companionLlm.complete(systemPrompt, userMessage, tools, toolContext);
        return review(systemPrompt, userMessage, answer, tools, toolContext, audit);
    }

    /** Streamed path: attempt-1 already delivered as deltas — review it, retry non-streamed if needed. */
    public AdvisedAnswer review(String systemPrompt, String userMessage, String answer,
            List<ToolCallback> tools, Map<String, Object> toolContext, ToolCallAudit audit) {
        long startedAt = System.currentTimeMillis();
        List<AdvisorViolation> violations = runChecks(systemPrompt, userMessage, answer, audit);
        int retries = 0;
        while (!violations.isEmpty() && retries < properties.advisors().maxRetries()) {
            retries++;
            answer = companionLlm.complete(
                    systemPrompt + AdvisorRetry.block(violations), userMessage, tools, toolContext);
            violations = runChecks(systemPrompt, userMessage, answer, audit);
        }
        boolean degraded = !violations.isEmpty();
        if (degraded) {
            log.warn("Advisor chain degraded an answer after {} retries: {}", retries, violations);
        }
        log.info("Advisor chain took {} ms (retries={}, degraded={})",
                System.currentTimeMillis() - startedAt, retries, degraded);
        return new AdvisedAnswer(answer, degraded);
    }

    /** Clinical first; a clinical hit skips the verdict LLM call this round (the retry re-checks all). */
    private List<AdvisorViolation> runChecks(
            String systemPrompt, String userMessage, String answer, ToolCallAudit audit) {
        Optional<AdvisorViolation> clinical = clinicalOutputCheck.check(answer);
        if (clinical.isPresent()) {
            return List.of(clinical.get());
        }
        return turnVerdictCheck.check(systemPrompt, userMessage, answer, audit.callNames());
    }
}
