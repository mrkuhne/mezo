package io.mrkuhne.mezo.feature.companion.memory.eval;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.llm.GeminiEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalQuery;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.EvalSource;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalCorpus.ReviewMetadata;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalGate.EvalBudget;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalGate.EvalCost;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalGate.GateResult;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalMetrics;
import io.mrkuhne.mezo.feature.companion.memory.eval.MemoryEvalMetrics.EvalOutcome;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryQueryAnalyzer;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.io.BufferedReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.ObjectMapper;

/**
 * Manual semantic release gate over the approved Hungarian holdout and the real Gemini embedder.
 * The runner only measures and writes a report; it never mutates the configured serving mode.
 */
@Slf4j
@Tag("eval")
@EnabledIfEnvironmentVariable(named = "GEMINI_API_KEY", matches = ".+")
@EnabledIfSystemProperty(named = "mezo.memory.eval.real", matches = "true")
@Timeout(value = 30, unit = TimeUnit.MINUTES)
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.llm-log.enabled=true",
    "mezo.companion.memory-platform.serving-embedding-version=gemini-embedding-001-memory-v1",
    "mezo.companion.memory-platform.reranker.enabled=false"
})
class MemoryRetrievalGeminiEvalIT extends AbstractIntegrationTest {

    private static final LocalDate AS_OF = LocalDate.of(2026, 9, 5);
    private static final String EMBEDDING_VERSION = "gemini-embedding-001-memory-v1";
    private static final Path REPORT_PATH = Path.of("target", "memory-eval", "memory-v1-report.json");
    private static final int DOCUMENT_BATCH_SIZE = 50;
    private static final String QUALITY = "quality";
    private static final String LATENCY = "latency";

    @Autowired private EmbeddingPort embeddingPort;
    @Autowired private MemoryContextService memoryContextService;
    @Autowired private MemoryQueryAnalyzer queryAnalyzer;
    @Autowired private PromptMemoryAssembler legacyAssembler;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryEmbeddingPopulator legacyPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository retrievalRunRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryPlatformProperties memoryProperties;
    @Autowired private CompanionProperties companionProperties;
    @Autowired private LlmCallContextHolder contextHolder;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;
    @Autowired @Qualifier("llmLogExecutor") private ThreadPoolTaskExecutor llmLogExecutor;

    @Test
    void testRetrieval_shouldMeetReleaseGate_whenMeasuredWithRealGemini() throws Exception {
        assertThat(embeddingPort).isInstanceOf(GeminiEmbeddingAdapter.class);
        assertThat(memoryProperties.servingEmbeddingVersion()).isEqualTo(EMBEDDING_VERSION);
        assertThat(memoryProperties.reranker().enabled()).isFalse();
        assertThat(memoryProperties.embeddingProvider()).isEqualTo("google");
        assertThat(memoryProperties.embeddingModel()).isEqualTo(companionProperties.embedding().model());

        EvalBudget budget = new EvalBudget(
                requiredBudget("mezo.memory.eval.max-embedding-usd"),
                requiredBudget("mezo.memory.eval.max-reranking-usd"));
        MemoryEvalCorpus corpus = SyntheticMemoryCorpusGenerator.load("holdout");
        ReviewMetadata review = SyntheticMemoryCorpusGenerator.loadApprovedReview(corpus);
        assertThat(jdbcTemplate.queryForObject("select count(*) from llm_log_history", Integer.class))
                .as("the evaluation owns an isolated, empty audit table")
                .isZero();
        UUID evalRunId = UUID.randomUUID();
        Fixture fixture = seed(corpus, evalRunId);

        warmProvider(corpus, evalRunId);
        LatencyComparison latency = compareNoRewriteLatency(corpus, fixture, evalRunId);
        QualityComparison quality = compareQuality(corpus, fixture, evalRunId);

        int expectedEmbeddingCalls = expectedEmbeddingCalls(corpus);
        int expectedRewriteCalls = expectedRewriteCalls(corpus);
        int expectedAuditRows = expectedEmbeddingCalls + expectedRewriteCalls;
        List<UUID> auditEntityIds = auditEntityIds(evalRunId, corpus);
        boolean auditRowsSettled = awaitTerminalAuditRows(auditEntityIds, expectedAuditRows);
        UsageSnapshot usage = loadUsage(auditEntityIds);

        Set<String> failedQueryIds = new LinkedHashSet<>(quality.executionFailures());
        failedQueryIds.addAll(latency.executionFailures());
        failedQueryIds.addAll(auditedFailureIds(evalRunId, corpus, auditEntityIds));
        List<String> sortedFailures = failedQueryIds.stream().sorted().toList();
        boolean usageAuditComplete = auditRowsSettled
                && usage.totalCalls() == expectedAuditRows
                && usage.errorCalls() == 0
                && usage.embeddingCalls() == expectedEmbeddingCalls
                && usage.embeddingCharacters() > 0
                && usage.embeddingUnpricedCalls() == 0
                && usage.embeddingCostUsd() != null
                && usage.rewriteCalls() == expectedRewriteCalls
                && usage.rewriteUnpricedCalls() == 0
                && (expectedRewriteCalls == 0 || usage.rewriteCostUsd() != null)
                && usage.rerankerCalls() == 0
                && companionProperties.embedding().model().equals(usage.embeddingModel())
                && (expectedRewriteCalls == 0
                        || companionProperties.llm().chatModel().equals(usage.rewriteModel()));

        EvalMetrics baseline = MemoryEvalMetrics.evaluate(corpus.queries(), quality.baselineOutcomes());
        EvalMetrics candidate = MemoryEvalMetrics.evaluate(corpus.queries(), quality.candidateOutcomes());
        MemoryEvalReport.LatencyStats baselineLatency = MemoryEvalReport.latencyStats(latency.baseline());
        MemoryEvalReport.LatencyStats candidateLatency = MemoryEvalReport.latencyStats(latency.candidate());
        GateResult gate = MemoryEvalGate.evaluate(
                candidate,
                baseline,
                Duration.ofMillis(candidateLatency.p95Ms()),
                new EvalCost(zeroIfNull(usage.embeddingCostUsd()), zeroIfNull(usage.rerankerCostUsd())),
                budget);
        MemoryEvalReport.HardGates hardGates = MemoryEvalReport.HardGates.from(
                gate, sortedFailures.isEmpty(), usageAuditComplete);

        MemoryEvalReport report = new MemoryEvalReport(
                corpus.corpusVersion(),
                review.holdoutSha256(),
                Instant.now(),
                gitCommit(),
                new MemoryEvalReport.ProviderInfo(
                        memoryProperties.embeddingProvider(), usage.embeddingModel(), EMBEDDING_VERSION),
                MemoryEvalReport.compare(baseline, candidate),
                breakdown(corpus.queries(), quality, EvalQuery::personaId),
                breakdown(corpus.queries(), quality, EvalQuery::family),
                new MemoryEvalReport.LatencyComparison(baselineLatency, candidateLatency),
                new MemoryEvalReport.Usage(
                        new MemoryEvalReport.EmbeddingUsage(
                                usage.embeddingCalls(), usage.embeddingCharacters(),
                                usage.embeddingUnpricedCalls(), usage.embeddingCostUsd()),
                        new MemoryEvalReport.RewriteUsage(
                                usage.rewriteModel(), usage.rewriteCalls(), usage.rewriteTokens(),
                                usage.rewriteUnpricedCalls(), usage.rewriteCostUsd()),
                        new MemoryEvalReport.RerankerUsage(
                                usage.rerankerCalls(), usage.rerankerTokens(), usage.rerankerCostUsd())),
                budget,
                sortedFailures,
                hardGates,
                hardGates.passed());
        writeReport(report);
        logReport(report, expectedAuditRows);

        assertThat(report.passed())
                .as("memory release gates; failed=%s queryFailures=%s report=%s",
                        report.hardGates().failedGates(), report.failedQueryIds(), REPORT_PATH)
                .isTrue();
    }

    private Fixture seed(MemoryEvalCorpus corpus, UUID evalRunId) {
        Map<String, UUID> owners = new LinkedHashMap<>();
        SyntheticMemoryCorpusGenerator.PERSONAS.forEach(persona -> owners.put(
                persona.id(), databasePopulator.populateUser("memory-gemini-eval-" + persona.id() + "@test.local")));

        List<float[]> vectors = new ArrayList<>(corpus.sources().size());
        for (int start = 0; start < corpus.sources().size(); start += DOCUMENT_BATCH_SIZE) {
            int end = Math.min(start + DOCUMENT_BATCH_SIZE, corpus.sources().size());
            List<String> contents = corpus.sources().subList(start, end).stream().map(EvalSource::content).toList();
            vectors.addAll(contextHolder.runWith(
                    new LlmCallContext("memory_eval", "seed_documents", "memory_eval", evalRunId),
                    () -> embeddingPort.embedDocuments(contents)));
        }
        assertThat(vectors).hasSameSizeAs(corpus.sources());

        Map<UUID, String> sourceKeyBySourceId = new LinkedHashMap<>();
        Map<String, EvalSource> sourceByKey = new LinkedHashMap<>();
        for (int index = 0; index < corpus.sources().size(); index++) {
            EvalSource source = corpus.sources().get(index);
            UUID owner = owners.get(source.personaId());
            UUID sourceId = stableUuid(source.key());
            float[] vector = vectors.get(index);
            legacyPopulator.embedding(
                    owner, source.sourceKind(), sourceId, source.content(), source.occurredOn(), vector);
            MemoryItemEntity item = memoryPopulator.item(
                    owner, source.sourceKind(), sourceId, source.content(), source.occurredOn());
            item.setSalience(BigDecimal.valueOf(source.salience()));
            item.setState(source.state());
            itemRepository.saveAndFlush(item);
            memoryPopulator.vector(item, EMBEDDING_VERSION, vector);
            sourceKeyBySourceId.put(sourceId, source.key());
            sourceByKey.put(source.key(), source);
        }
        return new Fixture(owners, sourceKeyBySourceId, sourceByKey);
    }

    private void warmProvider(MemoryEvalCorpus corpus, UUID evalRunId) {
        String query = corpus.queries().stream().filter(candidate -> !candidate.expectsEmpty())
                .findFirst().orElseThrow().query();
        contextHolder.runWith(
                new LlmCallContext("memory_eval", "warm_query", "memory_eval", evalRunId),
                () -> embeddingPort.embedQuery(query));
    }

    private QualityComparison compareQuality(MemoryEvalCorpus corpus, Fixture fixture, UUID evalRunId) {
        List<EvalOutcome> baseline = new ArrayList<>();
        List<EvalOutcome> candidate = new ArrayList<>();
        Set<String> failures = new LinkedHashSet<>();
        for (int index = 0; index < corpus.queries().size(); index++) {
            EvalQuery query = corpus.queries().get(index);
            if (index % 2 == 0) {
                baseline.add(runBaseline(query, fixture, evalRunId, QUALITY, null, failures));
                candidate.add(runCandidate(query, fixture, evalRunId, QUALITY, query.history(), null, failures));
            } else {
                candidate.add(runCandidate(query, fixture, evalRunId, QUALITY, query.history(), null, failures));
                baseline.add(runBaseline(query, fixture, evalRunId, QUALITY, null, failures));
            }
        }
        return new QualityComparison(baseline, candidate, failures);
    }

    private LatencyComparison compareNoRewriteLatency(MemoryEvalCorpus corpus, Fixture fixture, UUID evalRunId) {
        List<Duration> baseline = new ArrayList<>();
        List<Duration> candidate = new ArrayList<>();
        Set<String> failures = new LinkedHashSet<>();
        for (int index = 0; index < corpus.queries().size(); index++) {
            EvalQuery query = corpus.queries().get(index);
            if (index % 2 == 0) {
                runBaseline(query, fixture, evalRunId, LATENCY, baseline, failures);
                runCandidate(query, fixture, evalRunId, LATENCY, List.of(), candidate, failures);
            } else {
                runCandidate(query, fixture, evalRunId, LATENCY, List.of(), candidate, failures);
                runBaseline(query, fixture, evalRunId, LATENCY, baseline, failures);
            }
        }
        return new LatencyComparison(baseline, candidate, failures);
    }

    private EvalOutcome runBaseline(
            EvalQuery query,
            Fixture fixture,
            UUID evalRunId,
            String phase,
            List<Duration> latencies,
            Set<String> executionFailures) {
        long started = System.nanoTime();
        String failureId = phase + ":old:" + query.id();
        try {
            UUID owner = fixture.owners().get(query.personaId());
            PromptMemoryAssembler.AmbientRecall recall = legacyAssembler.recallStrict(
                    owner, conversationId(evalRunId, phase, "old", query.id()), query.query(), AS_OF);
            List<String> selected = recall.items().stream()
                    .map(item -> fixture.sourceKeyBySourceId().get(item.refId()))
                    .filter(java.util.Objects::nonNull)
                    .toList();
            return outcome(query, selected, selected, fixture);
        } catch (RuntimeException exception) {
            executionFailures.add(failureId);
            log.warn("OLD memory eval query {} failed", failureId, exception);
            return new EvalOutcome(query.id(), List.of(), List.of(), 0);
        } finally {
            if (latencies != null) {
                latencies.add(elapsed(started));
            }
        }
    }

    private EvalOutcome runCandidate(
            EvalQuery query,
            Fixture fixture,
            UUID evalRunId,
            String phase,
            List<CompanionLlm.Turn> history,
            List<Duration> latencies,
            Set<String> executionFailures) {
        long started = System.nanoTime();
        String failureId = phase + ":new:" + query.id();
        UUID conversationId = conversationId(evalRunId, phase, "new", query.id());
        try {
            UUID owner = fixture.owners().get(query.personaId());
            MemoryContext context = contextHolder.runWith(
                    new LlmCallContext("memory_eval", phase + "_new", "conversation", conversationId),
                    () -> memoryContextService.retrieve(new MemoryRequest(
                            owner, ConsumerPolicy.CHAT_AMBIENT, query.query(), history, AS_OF,
                            1200, conversationId, false)));
            MemoryRetrievalRunEntity run = retrievalRunRepository.findById(context.retrievalRunId()).orElseThrow();
            if (traceHasFailure(run.getRetrieverTrace())) {
                executionFailures.add(failureId);
            }
            List<String> selected = context.items().stream()
                    .map(item -> fixture.sourceKeyBySourceId().get(item.sourceId()))
                    .filter(java.util.Objects::nonNull)
                    .toList();
            return outcome(query, selected, selected, fixture);
        } catch (RuntimeException exception) {
            executionFailures.add(failureId);
            log.warn("NEW memory eval query {} failed", failureId, exception);
            return new EvalOutcome(query.id(), List.of(), List.of(), 0);
        } finally {
            if (latencies != null) {
                latencies.add(elapsed(started));
            }
        }
    }

    private static EvalOutcome outcome(
            EvalQuery query, List<String> ranked, List<String> selected, Fixture fixture) {
        int ownershipLeaks = (int) ranked.stream()
                .map(fixture.sourceByKey()::get)
                .filter(source -> source != null && !query.personaId().equals(source.personaId()))
                .count();
        return new EvalOutcome(query.id(), ranked, selected, ownershipLeaks);
    }

    private static Map<String, MemoryEvalReport.MetricComparison> breakdown(
            List<EvalQuery> queries, QualityComparison comparison, Function<EvalQuery, String> classifier) {
        Map<String, List<EvalQuery>> groups = queries.stream().collect(Collectors.groupingBy(
                classifier, TreeMap::new, Collectors.toList()));
        Map<String, MemoryEvalReport.MetricComparison> result = new LinkedHashMap<>();
        groups.forEach((name, subset) -> result.put(name, MemoryEvalReport.compare(
                MemoryEvalMetrics.evaluate(subset, comparison.baselineOutcomes()),
                MemoryEvalMetrics.evaluate(subset, comparison.candidateOutcomes()))));
        return result;
    }

    private int expectedEmbeddingCalls(MemoryEvalCorpus corpus) {
        int documentBatches = Math.ceilDiv(corpus.sources().size(), DOCUMENT_BATCH_SIZE);
        int candidateQueries = (int) corpus.queries().stream().filter(query -> !query.expectsEmpty()).count();
        return documentBatches + 1 + (2 * corpus.queries().size()) + (2 * candidateQueries);
    }

    private int expectedRewriteCalls(MemoryEvalCorpus corpus) {
        return (int) corpus.queries().stream()
                .filter(query -> queryAnalyzer.analyze(query.query(), query.history()).mode() == QueryMode.CONTEXT_DEPENDENT)
                .count();
    }

    private boolean awaitTerminalAuditRows(List<UUID> entityIds, int expectedRows) throws InterruptedException {
        String sql = "select count(*) from llm_log_history where entity_id in ("
                + placeholders(entityIds.size()) + ')';
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(90);
        while (llmLogExecutor.getActiveCount() > 0
                || !llmLogExecutor.getThreadPoolExecutor().getQueue().isEmpty()) {
            if (System.nanoTime() > deadline) {
                log.warn("LLM usage audit executor did not drain within 90 seconds; active={}, queued={}",
                        llmLogExecutor.getActiveCount(),
                        llmLogExecutor.getThreadPoolExecutor().getQueue().size());
                return false;
            }
            Thread.sleep(25);
        }
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, entityIds.toArray());
        if (count == null || count != expectedRows) {
            log.warn("LLM usage audit expected exactly {} correlated terminal rows after drain; got {}",
                    expectedRows, count);
            return false;
        }
        return true;
    }

    private UsageSnapshot loadUsage(List<UUID> entityIds) {
        String sql = """
                select
                  count(*) as total_calls,
                  count(*) filter (where status = 'ERROR') as error_calls,
                  count(*) filter (where call_kind in ('EMBED_DOC', 'EMBED_QUERY')) as embedding_calls,
                  coalesce(sum(embed_billable_chars) filter (
                    where call_kind in ('EMBED_DOC', 'EMBED_QUERY')), 0) as embedding_chars,
                  count(*) filter (where call_kind in ('EMBED_DOC', 'EMBED_QUERY') and status = 'SUCCESS'
                    and (embed_billable_chars is null or cost_usd is null)) as embedding_unpriced_calls,
                  sum(cost_usd) filter (
                    where call_kind in ('EMBED_DOC', 'EMBED_QUERY') and status = 'SUCCESS') as embedding_cost,
                  min(served_model) filter (where call_kind in ('EMBED_DOC', 'EMBED_QUERY')) as embedding_model_min,
                  max(served_model) filter (where call_kind in ('EMBED_DOC', 'EMBED_QUERY')) as embedding_model_max,
                  count(*) filter (where call_kind = 'CHAT' and feature = 'memory_eval'
                    and operation = 'quality_new') as rewrite_calls,
                  coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(candidates_tokens, 0)
                    + coalesce(thoughts_tokens, 0)) filter (where call_kind = 'CHAT'
                    and feature = 'memory_eval' and operation = 'quality_new'), 0) as rewrite_tokens,
                  count(*) filter (where call_kind = 'CHAT' and feature = 'memory_eval'
                    and operation = 'quality_new' and status = 'SUCCESS'
                    and (cost_usd is null or prompt_tokens is null or candidates_tokens is null)) as rewrite_unpriced_calls,
                  sum(cost_usd) filter (where call_kind = 'CHAT' and feature = 'memory_eval'
                    and operation = 'quality_new' and status = 'SUCCESS') as rewrite_cost,
                  min(served_model) filter (where call_kind = 'CHAT' and feature = 'memory_eval'
                    and operation = 'quality_new') as rewrite_model_min,
                  max(served_model) filter (where call_kind = 'CHAT' and feature = 'memory_eval'
                    and operation = 'quality_new') as rewrite_model_max,
                  count(*) filter (where call_kind = 'SMART') as reranker_calls,
                  coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(candidates_tokens, 0)
                    + coalesce(thoughts_tokens, 0)) filter (where call_kind = 'SMART'), 0) as reranker_tokens,
                  sum(cost_usd) filter (where call_kind = 'SMART') as reranker_cost
                from llm_log_history
                where entity_id in (%s)
                """.formatted(placeholders(entityIds.size()));
        return jdbcTemplate.queryForObject(sql, (resultSet, rowNumber) -> {
            String modelMin = resultSet.getString("embedding_model_min");
            String modelMax = resultSet.getString("embedding_model_max");
            String model = modelMin != null && modelMin.equals(modelMax) ? modelMin : null;
            String rewriteModelMin = resultSet.getString("rewrite_model_min");
            String rewriteModelMax = resultSet.getString("rewrite_model_max");
            String rewriteModel = rewriteModelMin != null && rewriteModelMin.equals(rewriteModelMax)
                    ? rewriteModelMin : null;
            return new UsageSnapshot(
                    resultSet.getInt("total_calls"), resultSet.getInt("error_calls"),
                    resultSet.getInt("embedding_calls"), resultSet.getLong("embedding_chars"),
                    resultSet.getInt("embedding_unpriced_calls"), resultSet.getBigDecimal("embedding_cost"), model,
                    resultSet.getInt("rewrite_calls"), resultSet.getLong("rewrite_tokens"),
                    resultSet.getInt("rewrite_unpriced_calls"), resultSet.getBigDecimal("rewrite_cost"), rewriteModel,
                    resultSet.getInt("reranker_calls"), resultSet.getLong("reranker_tokens"),
                    zeroIfNull(resultSet.getBigDecimal("reranker_cost")));
        }, entityIds.toArray());
    }

    private Set<String> auditedFailureIds(
            UUID evalRunId, MemoryEvalCorpus corpus, List<UUID> entityIds) {
        Map<UUID, String> labels = new LinkedHashMap<>();
        labels.put(evalRunId, "setup:provider");
        for (EvalQuery query : corpus.queries()) {
            for (String phase : List.of(QUALITY, LATENCY)) {
                for (String path : List.of("old", "new")) {
                    labels.put(conversationId(evalRunId, phase, path, query.id()), phase + ':' + path + ':' + query.id());
                }
            }
        }
        String sql = """
                select entity_id
                from llm_log_history
                where entity_id in (%s) and status = 'ERROR'
                """.formatted(placeholders(entityIds.size()));
        List<UUID> failedEntities = jdbcTemplate.queryForList(sql, UUID.class, entityIds.toArray());
        Set<String> failed = new LinkedHashSet<>();
        failedEntities.stream().map(labels::get).filter(java.util.Objects::nonNull).forEach(failed::add);
        return failed;
    }

    private static List<UUID> auditEntityIds(UUID evalRunId, MemoryEvalCorpus corpus) {
        Set<UUID> ids = new LinkedHashSet<>();
        ids.add(evalRunId);
        for (EvalQuery query : corpus.queries()) {
            for (String phase : List.of(QUALITY, LATENCY)) {
                for (String path : List.of("old", "new")) {
                    ids.add(conversationId(evalRunId, phase, path, query.id()));
                }
            }
        }
        return List.copyOf(ids);
    }

    private static String placeholders(int count) {
        if (count < 1) {
            throw new IllegalArgumentException("At least one audit entity id is required");
        }
        return String.join(", ", Collections.nCopies(count, "?"));
    }

    private static boolean traceHasFailure(Map<String, Object> trace) {
        return trace.values().stream()
                .anyMatch(details -> details instanceof Map<?, ?> map && map.containsKey("error"));
    }

    private void writeReport(MemoryEvalReport report) throws IOException {
        Files.createDirectories(REPORT_PATH.getParent());
        String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(report) + '\n';
        Files.writeString(REPORT_PATH, json, StandardCharsets.UTF_8);
    }

    private static void logReport(MemoryEvalReport report, int expectedAuditRows) {
        log.info("Memory Gemini eval: {}", report.passed() ? "PASS" : "FAIL");
        log.info("Corpus SHA-256: {}", report.corpusSha256());
        log.info("Quality baseline metrics: {}", report.overall().baseline());
        log.info("Quality candidate metrics: {}", report.overall().candidate());
        log.info("Quality metric deltas: {}", report.overall().delta());
        log.info("No-rewrite/no-rerank candidate latency p50/p95/p99: {}/{}/{} ms",
                report.noRewriteNoRerankLatency().candidate().p50Ms(),
                report.noRewriteNoRerankLatency().candidate().p95Ms(),
                report.noRewriteNoRerankLatency().candidate().p99Ms());
        log.info("Embedding usage: calls={}, chars={}, unpriced={}, cost=${} / budget=${}",
                report.usage().embedding().calls(), report.usage().embedding().billableCharacters(),
                report.usage().embedding().unpricedCalls(), report.usage().embedding().costUsd(),
                report.budget().maxEmbeddingUsd());
        log.info("Conditional rewrite usage: model={}, calls={}, tokens={}, unpriced={}, cost=${}",
                report.usage().rewrite().model(), report.usage().rewrite().calls(), report.usage().rewrite().tokens(),
                report.usage().rewrite().unpricedCalls(), report.usage().rewrite().costUsd());
        log.info("Reranker usage: calls={}, tokens={}, cost=${} / budget=${}",
                report.usage().reranker().calls(), report.usage().reranker().tokens(),
                report.usage().reranker().costUsd(), report.budget().maxRerankingUsd());
        log.info("Expected terminal audit rows: {}", expectedAuditRows);
        MemoryEvalReport.HardGates gates = report.hardGates();
        logGate("Recall@5 >= 0.85", gates.recallAt5());
        logGate("nDCG@5 > baseline", gates.ndcgAt5());
        logGate("MRR > baseline", gates.mrr());
        logGate("context precision >= baseline + 0.10", gates.contextPrecision());
        logGate("ownership leaks = 0", gates.ownershipIsolation());
        logGate("empty-query false-positive rate <= 0.05", gates.emptyFalsePositiveRate());
        logGate("no-rewrite/no-rerank candidate p95 <= 250 ms", gates.latencyP95());
        logGate("embedding cost within budget", gates.embeddingBudget());
        logGate("reranking cost within budget", gates.rerankingBudget());
        logGate("all quality and latency executions completed", gates.queryExecution());
        logGate("terminal usage and cost audit complete", gates.usageAudit());
        log.info("Failed query IDs ({}): {}", report.failedQueryIds().size(), report.failedQueryIds());
        log.info("JSON report: {}", REPORT_PATH.toAbsolutePath());
    }

    private static void logGate(String name, boolean passed) {
        log.info("Gate {}: {}", name, passed ? "PASS" : "FAIL");
    }

    private static BigDecimal requiredBudget(String property) {
        String value = System.getProperty(property, "").strip();
        if (value.isBlank()) {
            throw new IllegalStateException("Missing required system property -D" + property);
        }
        return new BigDecimal(value);
    }

    private static BigDecimal zeroIfNull(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static String gitCommit() {
        String explicit = System.getProperty("mezo.memory.eval.git-commit", "").strip();
        if (!explicit.isBlank()) {
            return explicit;
        }
        String ci = System.getenv("GITHUB_SHA");
        if (ci != null && !ci.isBlank()) {
            return ci.strip();
        }
        try {
            Process process = new ProcessBuilder("git", "rev-parse", "HEAD").redirectErrorStream(true).start();
            String line;
            try (BufferedReader reader = process.inputReader(StandardCharsets.UTF_8)) {
                line = reader.readLine();
            }
            return process.waitFor() == 0 && line != null ? line.strip() : "unknown";
        } catch (IOException exception) {
            return "unknown";
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return "unknown";
        }
    }

    private static Duration elapsed(long startedNanos) {
        return Duration.ofNanos(System.nanoTime() - startedNanos);
    }

    private static UUID conversationId(UUID evalRunId, String phase, String path, String queryId) {
        return stableUuid(evalRunId + ":" + phase + ':' + path + ':' + queryId);
    }

    private static UUID stableUuid(String value) {
        return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8));
    }

    private record Fixture(
            Map<String, UUID> owners,
            Map<UUID, String> sourceKeyBySourceId,
            Map<String, EvalSource> sourceByKey) {
    }

    private record QualityComparison(
            List<EvalOutcome> baselineOutcomes,
            List<EvalOutcome> candidateOutcomes,
            Set<String> executionFailures) {
    }

    private record LatencyComparison(
            List<Duration> baseline,
            List<Duration> candidate,
            Set<String> executionFailures) {
    }

    private record UsageSnapshot(
            int totalCalls,
            int errorCalls,
            int embeddingCalls,
            long embeddingCharacters,
            int embeddingUnpricedCalls,
            BigDecimal embeddingCostUsd,
            String embeddingModel,
            int rewriteCalls,
            long rewriteTokens,
            int rewriteUnpricedCalls,
            BigDecimal rewriteCostUsd,
            String rewriteModel,
            int rerankerCalls,
            long rerankerTokens,
            BigDecimal rerankerCostUsd) {
    }
}
