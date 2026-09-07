package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminMemoryCandidate;
import io.mrkuhne.mezo.api.dto.AdminMemoryGraphResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryHealthResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryNeighbor;
import io.mrkuhne.mezo.api.dto.AdminMemoryNeighborsResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryPromptTraceItem;
import io.mrkuhne.mezo.api.dto.AdminMemoryReplayRequest;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunPageResponse;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunSummary;
import io.mrkuhne.mezo.api.dto.AdminMemoryVectorItem;
import io.mrkuhne.mezo.api.dto.AdminMemoryVectorsResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminMemoryProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminRowQuery;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphStructureQuery;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryHealthQuery;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryNeighborQuery;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryPromptTraceQuery;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunCountRow;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService.RetrievalOutcome;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryProjectionService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * The RAG explorer's read model (mezo-4qyt): one user's audited retrieval runs, one run's full
 * score decomposition, the side-effect-free dry-run replay, and (slice 2) the structured knowledge
 * graph, the PCA-projected vector map with its pgvector neighbours, and the store's health rollups.
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
    /** Mirrors the contract's `k` maximum; an oversized k is clamped, never rejected. */
    private static final int MAX_NEIGHBORS = 50;

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

    private final ObjectProvider<MemoryRetrievalRunRepository> runRepository;
    private final ObjectProvider<MemoryRetrievalResultRepository> resultRepository;
    private final ObjectProvider<MemoryPromptTraceQuery> promptTraceQuery;
    private final ObjectProvider<MemoryPlatformProperties> memoryPlatformProperties;
    private final ObjectProvider<AdminMemoryReplayService> replayService;
    private final ObjectProvider<GraphStructureQuery> graphStructureQuery;
    private final ObjectProvider<MemoryNeighborQuery> neighborQuery;
    private final ObjectProvider<MemoryHealthQuery> healthQuery;
    private final ObjectProvider<MemoryProjectionService> projectionService;
    private final ObjectProvider<MemoryItemRepository> itemRepository;
    private final CompanionProperties companionProperties;
    private final AdminMemoryRunMapper mapper;
    private final AdminMemoryGraphMapper graphMapper;
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
        AdminMemoryReplayService.ReplayOutcome replayed =
                require(replayService).replay(userId, request, consumerPolicy);
        RetrievalOutcome outcome = replayed.outcome();
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
        // The replay service already recorded whether placing the query in the map's PCA space
        // cost an extra embed call (projection_embed_extra_call) or could not be done at all
        // (pca_unavailable) — the notes are its findings, not a guess made here.
        notes.addAll(replayed.notes());
        return AdminMemoryRunDetailResponse.builder()
                .run(mapper.dryRunSummary(outcome, consumerPolicy.name(),
                        require(memoryPlatformProperties).servingEmbeddingVersion(), selectedCount))
                .candidates(candidates)
                .fusion(mapper.fusion(require(memoryPlatformProperties).fusion()))
                .promptTrace(null)
                .promptTraceReason(REASON_DRY_RUN)
                .dryRun(true)
                .queryProjection(replayed.queryProjection())
                .replayNotes(List.copyOf(notes))
                .build();
    }

    // ==== slice 2: structured graph, vector map, neighbours, health ====

    /**
     * The inspected user's knowledge graph as structured nodes and edges, including soft-deleted
     * rows on request. Needs the knowledge-graph switch; without it {@link #require} answers 404
     * {@code ADMIN_MEMORY_DISABLED} rather than failing on a missing bean.
     */
    @Transactional(readOnly = true)
    public AdminMemoryGraphResponse graph(UUID userId, Boolean includeArchived, Boolean includeDeleted) {
        rowQuery.applyStatementTimeout(properties.statementTimeoutSql());
        return translateTimeout(() -> {
            GraphStructureQuery query = require(graphStructureQuery);
            boolean archived = Boolean.TRUE.equals(includeArchived);
            boolean deleted = Boolean.TRUE.equals(includeDeleted);
            List<GraphStructureQuery.NodeRow> nodeRows = query.nodes(userId, archived, deleted);
            List<GraphStructureQuery.EdgeRow> edgeRows = query.edges(userId, archived, deleted);
            CompanionProperties.Graph graph = companionProperties.graph();
            return AdminMemoryGraphResponse.builder()
                    .nodes(graphMapper.nodes(nodeRows, edgeRows))
                    .edges(graphMapper.edges(edgeRows))
                    // Read live from the companion config: the client explains a weight the
                    // nightly pass will decay tomorrow with the SAME numbers the pass uses.
                    .decayFactor(graph.decayFactor())
                    .pruneBelow(graph.pruneFloor())
                    .build();
        });
    }

    /**
     * The memory map's payload: item metadata plus a base64 Float32 block of PCA coordinates.
     *
     * <p>Base64 rather than a JSON number array because ~3 000 x 50 floats are ~0.6 MB packed and
     * ~9 MB as decimal text. {@code dims} carries the ACTUAL width so the client can size its
     * {@code Float32Array} from the response instead of assuming the configured target.
     */
    @Transactional(readOnly = true)
    public AdminMemoryVectorsResponse vectors(UUID userId, String version) {
        rowQuery.applyStatementTimeout(properties.statementTimeoutSql());
        return translateTimeout(() -> {
            MemoryProjectionService projections = require(projectionService);
            String embeddingVersion = embeddingVersion(version);
            MemoryProjectionService.Projection projection =
                    projections.project(userId, projectionRequest(embeddingVersion));
            List<AdminMemoryVectorItem> items = projection.items().stream()
                    .map(point -> AdminMemoryVectorItem.builder()
                            .itemId(point.itemId())
                            .sourceKind(point.sourceKind())
                            .sourceId(point.sourceId())
                            .occurredOn(point.occurredOn())
                            .salience(point.salience() == null ? 0.0 : point.salience().doubleValue())
                            .state(point.state())
                            .snippet(point.snippet() == null ? "" : point.snippet())
                            .build())
                    .toList();
            return AdminMemoryVectorsResponse.builder()
                    .embeddingVersion(projection.embeddingVersion())
                    .dims(projection.dims())
                    // Surfaced, never silently applied: a map of 5 000 of 12 000 memories that
                    // claims to be complete is worse than no map at all.
                    .sampled(projection.sampled())
                    .total(projection.total())
                    .items(items)
                    .projection(encodeCoordinates(projection.coordinates(), projection.dims()))
                    .build();
        });
    }

    /**
     * Real pgvector cosine neighbours of one item. The two 404s are distinct facts: no such live
     * item for this user, versus an item that exists but carries no ready vector of the serving
     * generation (so the map cannot place it and no honest distance can be computed).
     */
    @Transactional(readOnly = true)
    public AdminMemoryNeighborsResponse neighbors(UUID userId, UUID itemId, Integer k) {
        rowQuery.applyStatementTimeout(properties.statementTimeoutSql());
        return translateTimeout(() -> {
            MemoryNeighborQuery query = require(neighborQuery);
            require(itemRepository).findByIdAndCreatedByAndDeletedFalse(itemId, userId)
                    .orElseThrow(() -> new SystemRuntimeErrorException(
                            SystemMessage.error("ADMIN_MEMORY_ITEM_NOT_FOUND").build(),
                            HttpStatus.NOT_FOUND));
            String embeddingVersion = embeddingVersion(null);
            if (!query.hasServingVector(userId, itemId, embeddingVersion)) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.error("ADMIN_MEMORY_NO_VECTOR").build(), HttpStatus.NOT_FOUND);
            }
            int limit = Math.clamp(k == null ? properties.neighborDefaultK() : k, 1, MAX_NEIGHBORS);
            List<AdminMemoryNeighbor> neighbors = query
                    .neighbors(userId, itemId, embeddingVersion, snippetChars(), limit)
                    .stream()
                    .map(row -> AdminMemoryNeighbor.builder()
                            .itemId(row.itemId())
                            .sourceKind(row.sourceKind())
                            .occurredOn(row.occurredOn())
                            .distance(row.distance())
                            // The app stores L2-normalised vectors, so 1 - cosine distance IS a
                            // cosine similarity here; it is not a dot product.
                            .similarity(1.0 - row.distance())
                            .salience(row.salience() == null ? 0.0 : row.salience().doubleValue())
                            .state(row.state())
                            .snippet(row.snippet() == null ? "" : row.snippet())
                            .build())
                    .toList();
            return AdminMemoryNeighborsResponse.builder()
                    .itemId(itemId)
                    .embeddingVersion(embeddingVersion)
                    .neighbors(neighbors)
                    .build();
        });
    }

    /**
     * Per-status, per-version, staleness and graph rollups.
     *
     * <p>Answers even with the knowledge graph switched OFF: the node/edge buckets come back empty
     * and the vector half is still populated, per the surface's "the other views keep working"
     * rule. The {@code jobs} timestamps are INFERRED from the newest row each nightly pass writes
     * — there is no job-run table, and every label says so.
     */
    @Transactional(readOnly = true)
    public AdminMemoryHealthResponse health(UUID userId) {
        rowQuery.applyStatementTimeout(properties.statementTimeoutSql());
        return translateTimeout(() -> {
            MemoryHealthQuery query = require(healthQuery);
            boolean graphAvailable = graphStructureQuery.getIfAvailable() != null;
            int buckets = properties.edgeWeightHistogramBuckets();
            return AdminMemoryHealthResponse.builder()
                    .servingEmbeddingVersion(embeddingVersion(null))
                    .vectorsByStatus(graphMapper.buckets(query.vectorsByStatus(userId)))
                    .vectorFailures(graphMapper.buckets(query.vectorFailures(userId)))
                    .vectorsByVersion(graphMapper.buckets(query.vectorsByVersion(userId)))
                    .staleVectorCount(query.staleVectorCount(userId))
                    .itemsByState(graphMapper.buckets(query.itemsByState(userId)))
                    .nodesByStatus(graphAvailable
                            ? graphMapper.buckets(query.nodesByStatus(userId)) : List.of())
                    .nodesByKind(graphAvailable
                            ? graphMapper.buckets(query.nodesByKind(userId)) : List.of())
                    .edgeWeightHistogram(graphAvailable
                            ? graphMapper.histogram(query.edgeWeightHistogram(userId, buckets), buckets)
                            : List.of())
                    .jobs(graphMapper.jobs(query.jobs(userId)))
                    .build();
        });
    }

    /** The map's projection request — the admin knobs the companion service is handed. */
    MemoryProjectionService.ProjectionRequest projectionRequest(String embeddingVersion) {
        return new MemoryProjectionService.ProjectionRequest(
                embeddingVersion, properties.pcaTargetDims(), properties.vectorSampleThreshold(),
                snippetChars());
    }

    /**
     * Snippet length is the COMPANION's {@code serving.item-max-chars} — the same "characters
     * retained from one projected item" bound the pipeline itself uses, rather than a second
     * admin-side knob that could drift from it.
     */
    private int snippetChars() {
        return require(memoryPlatformProperties).serving().itemMaxChars();
    }

    private String embeddingVersion(String requested) {
        return requested == null || requested.isBlank()
                ? require(memoryPlatformProperties).servingEmbeddingVersion()
                : requested;
    }

    /**
     * Little-endian Float32, row major, in the same order as {@code items} — the exact layout the
     * contract promises, so the client can wrap the decoded bytes in a {@code Float32Array}
     * directly.
     */
    private static String encodeCoordinates(float[][] coordinates, int dims) {
        ByteBuffer buffer = ByteBuffer
                .allocate(coordinates.length * dims * Float.BYTES)
                .order(ByteOrder.LITTLE_ENDIAN);
        for (float[] row : coordinates) {
            for (int k = 0; k < dims; k++) {
                buffer.putFloat(k < row.length ? row[k] : 0f);
            }
        }
        return Base64.getEncoder().encodeToString(buffer.array());
    }

    /**
     * A Postgres statement-timeout cancellation (SQLSTATE {@code 57014}) reaches us as Spring's
     * {@link QueryTimeoutException}; it becomes 504 {@code ADMIN_MEMORY_QUERY_TIMEOUT} rather than
     * a generic 500, exactly as part 1 does for {@code ADMIN_QUERY_TIMEOUT}.
     */
    private static <T> T translateTimeout(Supplier<T> work) {
        try {
            return work.get();
        } catch (QueryTimeoutException exception) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_MEMORY_QUERY_TIMEOUT").build(),
                    HttpStatus.GATEWAY_TIMEOUT);
        }
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
