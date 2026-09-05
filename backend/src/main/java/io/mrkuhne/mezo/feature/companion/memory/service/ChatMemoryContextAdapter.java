package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContextItem;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** One rollout-aware boundary between chat orchestration and long-term memory retrieval. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatMemoryContextAdapter {

    private final KnowledgeFactService knowledgeFactService;
    private final PromptMemoryAssembler promptMemoryAssembler;
    private final ObjectProvider<GraphPromptAssembler> graphPromptAssembler;
    private final MemoryContextService memoryContextService;
    private final MemoryShadowRunner shadowRunner;
    private final MemoryPlatformProperties properties;

    public ChatMemoryPayload resolve(
            UUID userId,
            UUID conversationId,
            String query,
            List<CompanionLlm.Turn> history,
            LocalDate today) {
        MemoryRequest request = new MemoryRequest(
                userId, ConsumerPolicy.CHAT_AMBIENT, query, List.copyOf(history), today,
                properties.serving().chatMaxTokens(), conversationId, false);
        return switch (properties.servingMode()) {
            case OLD -> legacy(userId, conversationId, query, today);
            case SHADOW -> {
                ChatMemoryPayload served = legacy(userId, conversationId, query, today);
                shadowRunner.submit(request);
                yield served;
            }
            case NEW -> unifiedOrLegacy(request, userId, conversationId, query, today);
        };
    }

    private ChatMemoryPayload unifiedOrLegacy(
            MemoryRequest request, UUID userId, UUID conversationId, String query, LocalDate today) {
        try {
            MemoryContext context = memoryContextService.retrieveForServing(request);
            List<RecalledMemoriesEnvelope.Item> items = context.items().stream()
                    .map(item -> disclosed(context.retrievalRunId(), item))
                    .toList();
            return new ChatMemoryPayload("", context.promptBlock(), "", context.refs(),
                    RecalledMemoriesEnvelope.ofOrNull(items));
        } catch (RuntimeException exception) {
            log.warn("Unified memory retrieval failed for conversation {}; falling back to legacy context",
                    conversationId, exception);
            return legacy(userId, conversationId, query, today);
        }
    }

    private ChatMemoryPayload legacy(UUID userId, UUID conversationId, String query, LocalDate today) {
        PromptMemoryAssembler.AmbientRecall recalled =
                promptMemoryAssembler.recall(userId, conversationId, query, today);
        GraphPromptAssembler.GraphContext graph = graphContext(userId, query);
        return new ChatMemoryPayload(
                knowledgeFactService.renderPromptBlock(userId), recalled.block(), graph.block(),
                ambientRefs(recalled, graph), RecalledMemoriesEnvelope.ofOrNull(recalled.items()));
    }

    private GraphPromptAssembler.GraphContext graphContext(UUID userId, String query) {
        GraphPromptAssembler assembler = graphPromptAssembler.getIfAvailable();
        return assembler == null ? GraphPromptAssembler.GraphContext.EMPTY : assembler.assemble(userId, query);
    }

    private static List<RefsEnvelope.Ref> ambientRefs(
            PromptMemoryAssembler.AmbientRecall recalled, GraphPromptAssembler.GraphContext graph) {
        if (graph.refs().isEmpty()) {
            return recalled.refs();
        }
        List<RefsEnvelope.Ref> refs = new ArrayList<>(recalled.refs());
        refs.addAll(graph.refs());
        return List.copyOf(refs);
    }

    private static RecalledMemoriesEnvelope.Item disclosed(UUID retrievalRunId, MemoryContextItem item) {
        return new RecalledMemoriesEnvelope.Item(
                item.sourceKind(), item.sourceId(), item.occurredOn(), item.label(), item.content(),
                Math.clamp(item.score().finalScore(), 0.0, 1.0), retrievalRunId,
                item.retrievalResultId(), item.memoryItemId(), item.indicator());
    }

    public record ChatMemoryPayload(
            String factsBlock,
            String memoriesBlock,
            String graphBlock,
            List<RefsEnvelope.Ref> refs,
            RecalledMemoriesEnvelope recalled) {
    }
}
