package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.config.CharacterCouncilDebateProperties;
import io.mrkuhne.mezo.feature.companion.tools.PersonalRecordTools;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.companion.tools.ToolContexts;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.ai.tool.ToolCallback;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallQuota;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.definition.ToolDefinition;
import org.springframework.ai.tool.metadata.ToolMetadata;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Explicit read-only catalogue: no chat identity, planner or data-generating tool is exposed. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH}, havingValue = "true")
public class CharacterCouncilEvidenceTools {
    private final PersonalRecordTools records;
    private final CharacterCouncilPeriodTools periods;
    private final CharacterCouncilDebateProperties properties;

    /** Raw results stay in the transient session; persisted comments retain only tool names. */
    public record Session(List<ToolCallback> callbacks, Map<String, Object> context, ToolCallAudit audit) {
        public List<String> successfulToolNames(int fromCall) {
            return audit.toolOutcomes().stream().skip(fromCall).filter(outcome -> {
                if (outcome.result() == null) return false;
                try {
                    var result = new ObjectMapper().readTree(outcome.result());
                    return !result.has("error") && (result.has("records") || result.has("sources") || result.has("domains") || result.has("current") && result.has("baseline"));
                } catch (RuntimeException error) {
                    return false;
                }
            }).map(outcome -> outcome.name()).distinct().toList();
        }
    }

    public Session open(UUID owner) {
        var audit = new ToolCallAudit(properties.maxToolCalls(), properties.maxRefs());
        var callbacks = Arrays.stream(ToolCallbacks.from(records, periods))
                .map(callback -> bounded(callback, audit)).toList();
        return new Session(callbacks, Map.of(ToolContexts.USER_ID, owner, ToolContexts.AUDIT, audit), audit);
    }
    private ToolCallback bounded(ToolCallback delegate, ToolCallAudit audit) {
        var recording = new RecordingToolCallback(delegate, audit);
        var quota = LlmCallQuota.capture();
        return new ToolCallback() {
            @Override public ToolDefinition getToolDefinition() { return recording.getToolDefinition(); }
            @Override public ToolMetadata getToolMetadata() { return recording.getToolMetadata(); }
            @Override public String call(String input) { return call(input, null); }
            @Override public String call(String input, ToolContext context) {
                // One critical section covers check + execution/recording, including parallel tool batches.
                synchronized (audit) {
                    if (audit.budgetExhausted()) {
                        if (quota != null) quota.refuse();
                        throw new SystemRuntimeErrorException(SystemMessage.error("CHARACTER_COUNCIL_TOOL_BUDGET_EXHAUSTED").build());
                    }
                    if (quota != null) quota.charge(false);
                    return recording.call(input, context);
                }
            }
        };
    }

}
