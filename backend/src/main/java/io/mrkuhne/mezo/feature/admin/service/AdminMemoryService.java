package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminMemoryCandidate;
import io.mrkuhne.mezo.api.dto.AdminMemoryPromptTraceItem;
import io.mrkuhne.mezo.api.dto.AdminMemoryReplayRequest;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunPageResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunSummary;
import io.mrkuhne.mezo.feature.admin.config.AdminMemoryProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminRowQuery;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryPromptTraceQuery;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunCountRow;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService.RetrievalOutcome;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * The RAG explorer's read model (mezo-4qyt): one user's audited retrieval runs, one run's full
 * score decomposition, and the side-effect-free dry-run replay.
 *
 * <p>Owner enforcement lives in the controller ({@code requireOwner()} as its literal first
 * statement, outside any transaction). Everything here is already inside the authorised call and
 * scopes every read by the inspected {@code userId}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADMIN_MEMORY_SWITCH, havingValue = "true")
public class AdminMemoryService {

    private static final int DEFAULT_PAGE_SIZE = 25;
    private static final int MAX_QUERY_CHARS = 500;

    private static final String REASON_SHADOW_RUN = "SHADOW_RUN";
    private static final String REASON_NO_PROMPT_IMPRINT = "NO_PROMPT_IMPRINT";
    private static final String REASON_DRY_RUN = "DRY_RUN";

    private static final String NOTE_RERANKER_SKIPPED = "reranker_skipped";
    private static final String NOTE_REWRITE_SKIPPED = "rewrite_skipped";
    /**
     * A replay carries no conversation history (inventing one would change what the rewriter sees),
     * and {@code MemoryQueryAnalyzer} only reports CONTEXT_DEPENDENT when there IS usable history —
     * so the rewrite toggle can never actually fire on a replay. Say so rather than offer a switch
     * that quietly does nothing.
     */
    private static final String NOTE_REWRITE_UNREACHABLE = "rewrite_unreachable_no_history";
    private static final String NOTE_PCA_UNAVAILABLE = "pca_unavailable";

    private final ObjectProvider<MemoryRetrievalRunRepository> runRepository;
    private final ObjectProvider<MemoryRetrievalResultRepository> resultRepository;
    private final ObjectProvider<MemoryPromptTraceQuery> promptTraceQuery;
    private final ObjectProvider<MemoryPlatformProperties> memoryPlatformProperties;
    private final ObjectProvider<AdminMemoryReplayService> replayService;
    private final AdminMemoryRunMapper mapper;
    private final AdminMemoryProperties properties;
    private final AdminRowQuery rowQuery;
    private final ObjectMapper objectMapper;

    /** One page of the inspected user's audited runs, newest first. */
    @Transactional(readOnly = true)
    public AdminMemoryRunPageResponse runs(UUID userId, Integer page, Integer size) {
        rowQuery.applyStatementTimeout(properties.statementTimeoutSql());
        int p = page == null ? 0 : Math.max(0, page);
        int s = Math.clamp(size == null ? DEFAULT_PAGE_SIZE : size, 1, properties.runsMaxPageSize());
        Page<MemoryRetrievalRunEntity> found = require(runRepository)
                .findByCreatedByOrderByCreatedAtDesc(userId, PageRequest.of(p, s));
        Map<UUID, MemoryRetrievalRunCountRow> counts = counts(userId, found);
        List<AdminMemoryRunSummary> items = found.getContent().stream()
                .map(run -> {
                    MemoryRetrievalRunCountRow count = counts.get(run.getId());
                    return mapper.summary(run,
                            count == null ? 0L : count.getCandidateCount(),
                            count == null ? 0L : count.getSelectedCount());
                })
                .toList();
        return AdminMemoryRunPageResponse.builder()
                .page(p)
                .size(s)
                .total(found.getTotalElements())
                .retentionDays(require(memoryPlatformProperties).audit().retentionDays())
                .items(items)
                .build();
    }

    /** One stored run with its ranked candidates, today's fusion config and its prompt imprint. */
    @Transactional(readOnly = true)
    public AdminMemoryRunDetailResponse run(UUID userId, UUID runId) {
        rowQuery.applyStatementTimeout(properties.statementTimeoutSql());
        MemoryRetrievalRunEntity run = require(runRepository).findByIdAndCreatedBy(runId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("ADMIN_MEMORY_RUN_NOT_FOUND").build(),
                        HttpStatus.NOT_FOUND));
        List<MemoryRetrievalResultEntity> rows = require(resultRepository)
                .findByRunIdAndCreatedByOrderByRank(runId, userId);
        long selectedCount = rows.stream().filter(MemoryRetrievalResultEntity::isSelected).count();
        PromptTrace promptTrace = promptTrace(userId, run);
        return AdminMemoryRunDetailResponse.builder()
                .run(mapper.summary(run, rows.size(), selectedCount))
                .candidates(mapper.candidates(rows))
                .fusion(mapper.fusion(require(memoryPlatformProperties).fusion()))
                .promptTrace(promptTrace.items())
                .promptTraceReason(promptTrace.reason())
                .dryRun(false)
                .queryProjection(null)
                .replayNotes(List.of())
                .build();
    }

    /**
     * The dry-run replay. NOT {@code @Transactional}: it makes network LLM calls and must not hold
     * a DB connection for their whole latency budget.
     */
    public AdminMemoryRunDetailResponse replay(UUID userId, AdminMemoryReplayRequest request) {
        String query = request.getQuery();
        if (query == null || query.isBlank() || query.length() > MAX_QUERY_CHARS) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_MEMORY_REPLAY_QUERY_INVALID").build(),
                    HttpStatus.BAD_REQUEST);
        }
        ConsumerPolicy consumerPolicy = consumerPolicy(
                request.getConsumerPolicy() == null ? null : request.getConsumerPolicy().getValue());
        RetrievalOutcome outcome = require(replayService).replay(userId, request, consumerPolicy);
        List<AdminMemoryCandidate> candidates = mapper.dryRunCandidates(
                outcome.ranked(), outcome.selected(), outcome.reranked());
        int selectedCount = (int) candidates.stream().filter(AdminMemoryCandidate::getSelected).count();
        List<String> notes = new ArrayList<>();
        if (!Boolean.TRUE.equals(request.getReranker())) {
            notes.add(NOTE_RERANKER_SKIPPED);
        }
        if (Boolean.TRUE.equals(request.getRewrite())) {
            notes.add(NOTE_REWRITE_UNREACHABLE);
        } else {
            notes.add(NOTE_REWRITE_SKIPPED);
        }
        // Slice 1 declares queryProjection but never fills it: the PCA basis arrives with the map
        // in slice 2. Saying so beats returning a silent null.
        notes.add(NOTE_PCA_UNAVAILABLE);
        return AdminMemoryRunDetailResponse.builder()
                .run(mapper.dryRunSummary(outcome, consumerPolicy.name(),
                        require(memoryPlatformProperties).servingEmbeddingVersion(), selectedCount))
                .candidates(candidates)
                .fusion(mapper.fusion(require(memoryPlatformProperties).fusion()))
                .promptTrace(null)
                .promptTraceReason(REASON_DRY_RUN)
                .dryRun(true)
                .queryProjection(null)
                .replayNotes(List.copyOf(notes))
                .build();
    }

    /**
     * Every companion dependency is optional at runtime: {@code mezo.feature.companion.enabled}
     * (and, for the graph endpoint in slice 2, {@code knowledge-graph}) gate the beans. A missing
     * bean is a product state ("that layer is off"), not a server fault — so it is a 404 with a
     * code the client recognises, never a NoSuchBeanDefinitionException 500.
     */
    private <T> T require(ObjectProvider<T> provider) {
        T bean = provider.getIfAvailable();
        if (bean == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_MEMORY_DISABLED").build(), HttpStatus.NOT_FOUND);
        }
        return bean;
    }

    /** One grouped count for the whole page — never a per-run candidate load (N+1 over 25 runs). */
    private Map<UUID, MemoryRetrievalRunCountRow> counts(
            UUID userId, Page<MemoryRetrievalRunEntity> found) {
        if (found.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = found.getContent().stream().map(MemoryRetrievalRunEntity::getId).toList();
        Map<UUID, MemoryRetrievalRunCountRow> byRun = new HashMap<>();
        require(resultRepository).countByRunIds(userId, ids)
                .forEach(row -> byRun.put(row.getRunId(), row));
        return byRun;
    }

    /**
     * What the model actually saw, or an explicit reason why nothing did. A SHADOW run never
     * reached the model by construction, so its null is a fact rather than a gap.
     */
    private PromptTrace promptTrace(UUID userId, MemoryRetrievalRunEntity run) {
        if (!"NEW".equals(run.getServingMode())) {
            return new PromptTrace(null, REASON_SHADOW_RUN);
        }
        return require(promptTraceQuery)
                .findEnvelopeJson(userId, run.getId(), run.getCreatedAt())
                .map(this::parseEnvelope)
                .map(items -> new PromptTrace(items, null))
                .orElseGet(() -> new PromptTrace(null, REASON_NO_PROMPT_IMPRINT));
    }

    private List<AdminMemoryPromptTraceItem> parseEnvelope(String json) {
        RecalledMemoriesEnvelope envelope;
        try {
            envelope = objectMapper.readValue(json, RecalledMemoriesEnvelope.class);
        } catch (JacksonException exception) {
            // A malformed imprint is a data curiosity, not a reason to fail the whole run detail.
            log.warn("ai_message.recalled_memories could not be parsed for the admin explorer", exception);
            return List.of();
        }
        if (envelope == null || envelope.items() == null) {
            return List.of();
        }
        return envelope.items().stream()
                .map(item -> AdminMemoryPromptTraceItem.builder()
                        .kind(item.kind())
                        .refId(item.refId())
                        .occurredOn(item.occurredOn())
                        .label(item.label())
                        .gist(item.gist())
                        .similarity(item.similarity())
                        .retrievalResultId(item.retrievalResultId())
                        .memoryItemId(item.memoryItemId())
                        .indicator(item.indicator())
                        .build())
                .toList();
    }

    /**
     * The client string is constrained by the contract's enum, but a future widening must not throw
     * a raw {@code IllegalArgumentException} from outside {@code techcore} (ArchUnit forbids it).
     */
    private static ConsumerPolicy consumerPolicy(String value) {
        if (value == null || value.isBlank()) {
            return ConsumerPolicy.CHAT_AMBIENT;
        }
        for (ConsumerPolicy policy : ConsumerPolicy.values()) {
            if (policy.name().equals(value)) {
                return policy;
            }
        }
        throw new SystemRuntimeErrorException(
                SystemMessage.error("ADMIN_MEMORY_REPLAY_QUERY_INVALID").build(),
                HttpStatus.BAD_REQUEST);
    }

    /** A prompt imprint, or the reason there is none — the two are never both absent. */
    private record PromptTrace(List<AdminMemoryPromptTraceItem> items, String reason) {
    }
}
