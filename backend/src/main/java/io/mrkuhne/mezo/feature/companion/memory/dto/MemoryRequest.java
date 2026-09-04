package io.mrkuhne.mezo.feature.companion.memory.dto;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Consumer-neutral input to the long-term memory platform. */
public record MemoryRequest(
        UUID userId,
        ConsumerPolicy consumerPolicy,
        String currentQuery,
        List<CompanionLlm.Turn> shortConversationHistory,
        LocalDate asOf,
        int maxTokenBudget,
        UUID conversationId,
        boolean deep) {
}
