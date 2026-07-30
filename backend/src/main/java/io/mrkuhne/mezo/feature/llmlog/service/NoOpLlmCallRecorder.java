package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * The shipped default (switch off / absent): audit logging is structurally absent, not merely
 * skipped — nothing is published, so no event, no writer work, no row (mezo-2zyu).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.LLM_LOG_SWITCH, havingValue = "false", matchIfMissing = true)
public class NoOpLlmCallRecorder implements LlmCallRecorder {

    @Override
    public void record(LlmCallRecord record) {
        // logging disabled by mezo.feature.llm-log.enabled
    }
}
