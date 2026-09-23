package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.service.ChatMemoryContextAdapter;
import io.mrkuhne.mezo.feature.companion.memory.service.ChatMemoryContextAdapter.ChatMemoryPayload;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PersonalMemorySearchService {
    private final ChatMemoryContextAdapter memory;
    private final LlmCallContextHolder callContext;

    public ChatMemoryPayload search(UUID userId, UUID conversationId, String query,
            List<CompanionLlm.Turn> history, LocalDate asOf, String feature, String operation) {
        return callContext.runWith(new LlmCallContext(feature, operation,
                conversationId == null ? null : "conversation", conversationId),
                () -> memory.resolve(userId, conversationId, query, history, asOf));
    }
}
