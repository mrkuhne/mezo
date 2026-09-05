package io.mrkuhne.mezo.feature.companion.memory;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextRenderer;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextSelector;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryQueryPreparer;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetrievalAuditWriter;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetriever;
import io.mrkuhne.mezo.feature.companion.memory.service.LlmMemoryReranker;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** Coordinator IT intentionally has no test transaction: worker connections must see committed fixtures. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true"
})
class MemoryContextServiceIT extends AbstractIntegrationTest {

    private static final LocalDate AS_OF = LocalDate.of(2026, 9, 5);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryContextService service;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private KnowledgeFactRepository factRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private MemoryRetrievalResultRepository resultRepository;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private FakeEmbeddingAdapter fakeEmbedding;
    @Autowired private MemoryQueryPreparer queryPreparer;
    @Autowired private MemoryCandidateFusion fusion;
    @Autowired private MemoryContextSelector selector;
    @Autowired private MemoryContextRenderer renderer;
    @Autowired private LlmMemoryReranker reranker;
    @Autowired private MemoryRetrievalAuditWriter auditWriter;
    @Autowired private MemoryPlatformProperties properties;
    @Autowired @Qualifier("applicationTaskExecutor") private AsyncTaskExecutor taskExecutor;

    @Test
    void testRetrieve_shouldAuditNoCalls_whenQueryNeedsNoMemory() {
        UUID owner = databasePopulator.populateUser("memory-context-none@test.local");
        int llmCalls = fakeLlm.completeCallCount();
        int embeddingCalls = fakeEmbedding.queryCallCount();

        MemoryContext result = service.retrieve(request(owner, "köszönöm"));

        assertThat(result.items()).isEmpty();
        assertThat(result.promptBlock()).isEmpty();
        assertThat(result.traceId()).isNotNull();
        assertThat(fakeLlm.completeCallCount()).isEqualTo(llmCalls);
        assertThat(fakeEmbedding.queryCallCount()).isEqualTo(embeddingCalls);
        MemoryRetrievalRunEntity run = runRepository.findByTraceIdAndCreatedBy(result.traceId(), owner).orElseThrow();
        assertThat(result.retrievalRunId()).isEqualTo(run.getId());
        assertThat(run.getQueryMode()).isEqualTo("NONE");
        assertThat(run.getRetrieverTrace()).isEmpty();
    }

    @Test
    void testRetrieve_shouldRunPeersAndPersistSelectedScoreDetails_whenCandidatesExist() {
        UUID owner = databasePopulator.populateUser("memory-context-success@test.local");
        MemoryItemEntity item = item(owner, "Boglárka után jobban aludtam. [fake-embed:1]");
        var fact = factPopulator.fact(owner, "Boglárka a testvérem.", "life", 4);
        fact.setPinned(true);
        factRepository.saveAndFlush(fact);
        String rawQuery = "Mit tudunk Boglárkáról? [fake-embed:1]";

        MemoryContext result = service.retrieve(request(owner, rawQuery));

        assertThat(result.items()).isNotEmpty();
        assertThat(result.promptBlock()).startsWith("[Hosszú távú memória]");
        assertThat(result.refs()).isNotEmpty();
        assertThat(result.items()).allSatisfy(contextItem -> {
            assertThat(contextItem.retrievalResultId()).isNotNull();
            assertThat(contextItem.score().finalScore()).isPositive();
        });
        MemoryRetrievalRunEntity run = runRepository.findByTraceIdAndCreatedBy(result.traceId(), owner).orElseThrow();
        assertThat(run.getRawQuery()).isEqualTo(rawQuery);
        assertThat(run.getRewrittenQuery()).isNull();
        assertThat(run.getEmbeddingVersion()).isEqualTo(VERSION);
        assertThat(run.getServingMode()).isEqualTo("NEW");
        assertThat(run.getDurationMs()).isNotNegative();
        assertThat(run.getRetrieverTrace()).containsKeys("dense", "lexical", "facts", "graph");
        run.getRetrieverTrace().values().forEach(trace -> {
            Map<?, ?> details = (Map<?, ?>) trace;
            assertThat(details.get("durationMs")).isNotNull();
            assertThat(details.get("candidateCount")).isNotNull();
        });
        List<MemoryRetrievalResultEntity> rows =
                resultRepository.findByRunIdAndCreatedByOrderByRank(run.getId(), owner);
        assertThat(rows).isNotEmpty();
        assertThat(rows).filteredOn(MemoryRetrievalResultEntity::isSelected).isNotEmpty();
        assertThat(rows).anySatisfy(row -> {
            assertThat(row.getScoreBreakdown().retrieverRanks()).isNotEmpty();
            assertThat(row.getScoreBreakdown().finalScore()).isPositive();
        });
        assertThat(rows).anyMatch(row -> item.getId().equals(row.getMemoryItemId()));
    }

    @Test
    void testRetrieve_shouldKeepSuccessfulPeersAndAuditError_whenDenseRetrieverFails() {
        UUID owner = databasePopulator.populateUser("memory-context-partial@test.local");
        item(owner, "Boglárka segített a költözésben.");
        factPopulator.fact(owner, "Boglárka a testvérem.", "life", 3);

        MemoryContext result = service.retrieve(request(
                owner, "Boglárka " + FakeEmbeddingAdapter.FAIL_EMBED));

        assertThat(result.items()).isNotEmpty();
        MemoryRetrievalRunEntity run = runRepository.findByTraceIdAndCreatedBy(result.traceId(), owner).orElseThrow();
        @SuppressWarnings("unchecked")
        Map<String, Object> denseTrace = (Map<String, Object>) run.getRetrieverTrace().get("dense");
        assertThat(denseTrace.get("error")).isNotNull();
        assertThat(run.getRetrieverTrace()).containsKeys("lexical", "facts", "graph");
    }

    @Test
    void testRetrieve_shouldAuditRawAndRewrittenQueries_whenHistoryRewriteIsUsed() {
        UUID owner = databasePopulator.populateUser("memory-context-rewrite@test.local");
        String raw = "És előtte? [fake-memory-rewrite:A keddi futás előtti alvás]";
        MemoryRequest request = new MemoryRequest(owner, ConsumerPolicy.CHAT_AMBIENT, raw,
                List.of(new CompanionLlm.Turn(CompanionLlm.Role.USER, "Kedden futottam.")),
                AS_OF, 1200, UUID.randomUUID(), false);

        MemoryContext result = service.retrieve(request);

        MemoryRetrievalRunEntity run = runRepository.findByTraceIdAndCreatedBy(result.traceId(), owner).orElseThrow();
        assertThat(run.getQueryMode()).isEqualTo("REWRITE");
        assertThat(run.getRawQuery()).isEqualTo(raw);
        assertThat(run.getRewrittenQuery()).isEqualTo("A keddi futás előtti alvás");
    }

    @Test
    void testRetrieve_shouldReturnAuditedEmptyContext_whenAllRetrieversFail() {
        UUID owner = databasePopulator.populateUser("memory-context-all-fail@test.local");
        Map<String, MemoryRetriever> failingRetrievers = Map.of(
                "dense", failingRetriever("dense"),
                "lexical", failingRetriever("lexical"),
                "facts", failingRetriever("facts"),
                "graph", failingRetriever("graph"));
        MemoryContextService failingService = new MemoryContextService(
                queryPreparer, failingRetrievers, fusion, selector, renderer, reranker,
                auditWriter, properties, taskExecutor);

        MemoryContext result = failingService.retrieve(request(owner, "Mi történt Boglárkával?"));

        assertThat(result.items()).isEmpty();
        assertThat(result.promptBlock()).isEmpty();
        MemoryRetrievalRunEntity run = runRepository.findByTraceIdAndCreatedBy(result.traceId(), owner).orElseThrow();
        assertThat(run.getErrorCode()).isEqualTo("MEMORY_RETRIEVAL_ALL_FAILED");
        assertThat(run.getRetrieverTrace()).containsOnlyKeys("dense", "lexical", "facts", "graph");
        run.getRetrieverTrace().values().forEach(trace ->
                assertThat(((Map<?, ?>) trace).get("error")).isNotNull());
    }

    @Test
    void testRetrieveForServing_shouldSignalLegacyFallbackAndAuditIt_whenAllRetrieversFail() {
        UUID owner = databasePopulator.populateUser("memory-context-serving-fallback@test.local");
        Map<String, MemoryRetriever> failingRetrievers = Map.of(
                "dense", failingRetriever("dense"),
                "lexical", failingRetriever("lexical"),
                "facts", failingRetriever("facts"),
                "graph", failingRetriever("graph"));
        MemoryContextService failingService = new MemoryContextService(
                queryPreparer, failingRetrievers, fusion, selector, renderer, reranker,
                auditWriter, properties, taskExecutor);

        assertThatThrownBy(() -> failingService.retrieveForServing(
                request(owner, "Mi történt Boglárkával?")))
                .isInstanceOfSatisfying(SystemRuntimeErrorException.class, exception -> {
                    assertThat(exception.getStatus().value()).isEqualTo(500);
                    assertThat(exception.getMessages().getFirst().getExceptionTraceId()).isNotBlank();
                });

        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .singleElement().satisfies(run -> {
                    assertThat(run.getServingMode()).isEqualTo("NEW");
                    assertThat(run.getErrorCode()).isEqualTo(
                            "MEMORY_RETRIEVAL_ALL_FAILED_FALLBACK_OLD");
                });
    }

    @Test
    void testRetrieve_shouldInterruptRetrieverWork_whenIndependentDeadlineExpires() throws InterruptedException {
        UUID owner = databasePopulator.populateUser("memory-context-timeout@test.local");
        CountDownLatch interrupted = new CountDownLatch(1);
        Map<String, MemoryRetriever> retrieverSet = Map.of(
                "dense", blockingRetriever("dense", interrupted),
                "lexical", emptyRetriever("lexical"),
                "facts", emptyRetriever("facts"),
                "graph", emptyRetriever("graph"));
        MemoryContextService boundedService = new MemoryContextService(
                queryPreparer, retrieverSet, fusion, selector, renderer, reranker,
                auditWriter, properties, taskExecutor);

        MemoryContext result = boundedService.retrieve(request(owner, "Mi történt Boglárkával?"));

        MemoryRetrievalRunEntity run = runRepository.findByTraceIdAndCreatedBy(result.traceId(), owner).orElseThrow();
        assertThat(((Map<?, ?>) run.getRetrieverTrace().get("dense")).get("error")).isEqualTo("TIMEOUT");
        assertThat(interrupted.await(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void testRetrieve_shouldRejectRetrieverCompletion_whenFutureFinishedAfterItsDeadline() {
        UUID owner = databasePopulator.populateUser("memory-context-late-completion@test.local");
        AsyncTaskExecutor callerThreadExecutor = new TaskExecutorAdapter(new SyncTaskExecutor());
        MemoryContextService boundedService = new MemoryContextService(
                queryPreparer, Map.of("dense", delayedEmptyRetriever("dense", 250)),
                fusion, selector, renderer, reranker, auditWriter, properties, callerThreadExecutor);

        MemoryContext result = boundedService.retrieve(request(owner, "Mi történt Boglárkával?"));

        MemoryRetrievalRunEntity run = runRepository.findByTraceIdAndCreatedBy(result.traceId(), owner).orElseThrow();
        assertThat(((Map<?, ?>) run.getRetrieverTrace().get("dense")).get("error")).isEqualTo("TIMEOUT");
        assertThat(run.getErrorCode()).isEqualTo("MEMORY_RETRIEVAL_ALL_FAILED");
    }

    private MemoryItemEntity item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Boglárka napló", content, AS_OF.minusDays(4), new String[]{"Boglárka"}, new String[0],
                io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        return item;
    }

    private static MemoryRequest request(UUID owner, String query) {
        return new MemoryRequest(owner, ConsumerPolicy.CHAT_AMBIENT, query, List.of(),
                AS_OF, 1200, UUID.randomUUID(), false);
    }

    private static MemoryRetriever failingRetriever(String name) {
        return new MemoryRetriever() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public List<io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate> retrieve(
                    io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput input) {
                throw new IllegalStateException("forced " + name + " failure");
            }
        };
    }

    private static MemoryRetriever emptyRetriever(String name) {
        return new MemoryRetriever() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public List<io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate> retrieve(
                    io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput input) {
                return List.of();
            }
        };
    }

    private static MemoryRetriever blockingRetriever(String name, CountDownLatch interrupted) {
        return new MemoryRetriever() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public List<io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate> retrieve(
                    io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput input) {
                try {
                    Thread.sleep(2_000);
                } catch (InterruptedException exception) {
                    interrupted.countDown();
                    Thread.currentThread().interrupt();
                }
                return List.of();
            }
        };
    }

    private static MemoryRetriever delayedEmptyRetriever(String name, long delayMs) {
        return new MemoryRetriever() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public List<io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate> retrieve(
                    io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput input) {
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
                return List.of();
            }
        };
    }
}
