package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminMemoryCandidate;
import io.mrkuhne.mezo.api.dto.AdminMemoryReplayRequest;
import io.mrkuhne.mezo.api.dto.AdminMemoryRetrieverTrace;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunDetailResponse;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.service.LlmActorResolver;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The dry-run replay (mezo-4qyt.1). Two things are load-bearing and both are asserted here:
 * D1 — no {@code memory_retrieval_*} row is written — and the {@code admin_replay} re-label with
 * the inspected user as the actor.
 *
 * <p>Why the recording proxies instead of reading {@code llm_log_history}: the audit row is
 * written by the PROVIDER adapters ({@code GeminiCompanionLlm} / {@code GeminiEmbeddingAdapter}),
 * and the {@code companion-fake} beans this suite runs on deliberately do not touch the network or
 * the recorder — so no row would ever appear. The two {@code @Primary} proxies observe the exact
 * two values the recorder would have persisted ({@code LlmActorResolver#currentActor} and the
 * ambient {@link LlmCallContext}) at the moment the call reaches the adapter seam, which is the
 * fact under test rather than the persistence hop.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true",
    "mezo.feature.admin-memory.enabled=true",
    "mezo.companion.memory-platform.reranker.enabled=true",
    "mezo.companion.memory-platform.execution.retriever-timeout-ms=5000"
})
class AdminMemoryReplayIT extends ApiIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    /** Same sentinel in the item text and the query ⇒ identical fake vectors ⇒ a dense hit. */
    private static final String EMBED_SENTINEL = "[fake-embed:1]";

    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private LlmCallLog llmCallLog;
    @Autowired private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetCallLog() {
        llmCallLog.clear();
    }

    // ==== D1: nothing is written ====

    @Test
    void testReplay_shouldWriteNoAuditRow_whenDryRun() {
        RegisteredUser anna = registerUser("Anna");
        seedItem(anna.id(), "Futás után jobban aludtam. " + EMBED_SENTINEL);
        long runsBefore = count("memory_retrieval_run");
        long resultsBefore = count("memory_retrieval_result");

        replay(anna.id(), request("Hogyan aludtam futás után? " + EMBED_SENTINEL, false, false));

        assertThat(count("memory_retrieval_run")).isEqualTo(runsBefore);
        assertThat(count("memory_retrieval_result")).isEqualTo(resultsBefore);
    }

    @Test
    void testReplay_shouldNotTouchTheUsersMemory_whenRun() {
        RegisteredUser anna = registerUser("Anna");
        seedItem(anna.id(), "Futás után jobban aludtam. " + EMBED_SENTINEL);
        long items = count("memory_item");
        long vectors = count("memory_vector");
        long edges = count("knowledge_edge");
        String itemsTouched = maxUpdatedAt("memory_item");

        replay(anna.id(), request("Hogyan aludtam futás után? " + EMBED_SENTINEL, false, false));

        assertThat(count("memory_item")).isEqualTo(items);
        assertThat(count("memory_vector")).isEqualTo(vectors);
        assertThat(count("knowledge_edge")).isEqualTo(edges);
        assertThat(maxUpdatedAt("memory_item")).isEqualTo(itemsTouched);
    }

    // ==== shape + caveats ====

    @Test
    void testReplay_shouldReturnDryRunShapeAndModeCaveat_whenOwner() {
        RegisteredUser anna = registerUser("Anna");
        seedItem(anna.id(), "Futás után jobban aludtam. " + EMBED_SENTINEL);

        AdminMemoryRunDetailResponse detail =
                replay(anna.id(), request("Hogyan aludtam futás után? " + EMBED_SENTINEL, false, false));

        assertThat(detail.getDryRun()).isTrue();
        // NEW is passed explicitly: production serves SHADOW, so a replay is NOT what the
        // companion actually served — the surface must say so.
        assertThat(detail.getRun().getServingMode()).isEqualTo("NEW");
        assertThat(detail.getRun().getId()).isNull();
        assertThat(detail.getRun().getTraceId()).isNotNull();
        assertThat(detail.getRun().getEmbeddingVersion()).isEqualTo(VERSION);
        assertThat(detail.getCandidates()).isNotEmpty();
        assertThat(detail.getCandidates()).extracting(AdminMemoryCandidate::getResultId)
                .containsOnlyNulls();
        assertThat(detail.getPromptTrace()).isNull();
        assertThat(detail.getPromptTraceReason()).isEqualTo("DRY_RUN");
        assertThat(detail.getQueryProjection()).isNull();
        assertThat(detail.getReplayNotes()).contains("pca_unavailable");
    }

    @Test
    void testReplay_shouldMakeNoLlmCallsForRewriteOrRerank_whenBothToggledOff() {
        RegisteredUser anna = registerUser("Anna");
        seedItem(anna.id(), "Futás után jobban aludtam. " + EMBED_SENTINEL);
        seedItem(anna.id(), "Eső után is futottam. " + EMBED_SENTINEL);

        AdminMemoryRunDetailResponse detail =
                replay(anna.id(), request("Hogyan aludtam futás után? " + EMBED_SENTINEL, false, false));

        assertThat(llmCallLog.operations()).doesNotContain("query_rewrite", "rerank");
        assertThat(detail.getReplayNotes())
                .contains("reranker_skipped", "rewrite_skipped")
                .doesNotContain("rewrite_unreachable_no_history");
    }

    /**
     * The load-bearing Task 1.6 assertion: the reranker's call is re-labelled to
     * {@code admin_replay} and billed to the INSPECTED user, not to the owner who triggered it.
     * WEEKLY_MEMOIR is used because that policy reranks by policy rather than by uncertainty.
     */
    @Test
    void testReplay_shouldBillTheInspectedUserUnderAdminReplay_whenRerankAllowed() {
        RegisteredUser anna = registerUser("Anna");
        seedItem(anna.id(), "Futás után jobban aludtam. " + EMBED_SENTINEL);
        seedItem(anna.id(), "Eső után is futottam. " + EMBED_SENTINEL);
        AdminMemoryReplayRequest request =
                request("Hogyan aludtam futás után? " + EMBED_SENTINEL, true, true);
        request.setConsumerPolicy(AdminMemoryReplayRequest.ConsumerPolicyEnum.WEEKLY_MEMOIR);

        replay(anna.id(), request);

        List<LlmCallLog.Entry> rerankCalls = llmCallLog.byOperation("rerank");
        assertThat(rerankCalls).isNotEmpty();
        assertThat(rerankCalls).allSatisfy(entry -> {
            assertThat(entry.feature()).isEqualTo(LlmCallContext.FEATURE_ADMIN_REPLAY);
            assertThat(entry.actor()).isEqualTo(anna.id());
        });
        // The dense retriever's embed runs on applicationTaskExecutor; both ThreadLocals are
        // captured on the calling thread and re-bound there, so it is attributed too.
        List<LlmCallLog.Entry> embedCalls = llmCallLog.byMethod("embedQuery");
        assertThat(embedCalls).isNotEmpty();
        assertThat(embedCalls).allSatisfy(entry -> {
            assertThat(entry.feature()).isEqualTo(LlmCallContext.FEATURE_ADMIN_REPLAY);
            assertThat(entry.actor()).isEqualTo(anna.id());
        });
    }

    /**
     * A replay carries no conversation history (by design — inventing one would change what the
     * rewriter sees), and {@code MemoryQueryAnalyzer} only reports CONTEXT_DEPENDENT when there IS
     * usable history. So the rewrite toggle can never fire on a replay; the surface says so through
     * a note rather than silently offering a dead switch.
     */
    @Test
    void testReplay_shouldFlagTheRewriteToggleAsUnreachable_whenRewriteAllowed() {
        RegisteredUser anna = registerUser("Anna");
        seedItem(anna.id(), "Futás után jobban aludtam. " + EMBED_SENTINEL);

        AdminMemoryRunDetailResponse detail =
                replay(anna.id(), request("Arról mit tudsz? " + EMBED_SENTINEL, false, true));

        assertThat(llmCallLog.operations()).doesNotContain("query_rewrite");
        assertThat(detail.getReplayNotes()).contains("rewrite_unreachable_no_history");
        assertThat(detail.getRun().getQueryMode()).isEqualTo("RAW");
        assertThat(detail.getRun().getRewrittenQuery()).isNull();
    }

    @Test
    void testReplay_shouldSurfaceRetrieverFailureInTrace_whenTheEmbedHopIsDown() {
        RegisteredUser anna = registerUser("Anna");
        seedItem(anna.id(), "Futás után jobban aludtam. " + EMBED_SENTINEL);

        AdminMemoryRunDetailResponse detail = replay(anna.id(),
                request("Hogyan aludtam futás után? " + FakeEmbeddingAdapter.FAIL_EMBED, false, false));

        AdminMemoryRetrieverTrace dense = detail.getRun().getRetrieverTrace().stream()
                .filter(entry -> "dense".equals(entry.getRetriever()))
                .findFirst()
                .orElseThrow();
        assertThat(dense.getError()).isNotNull();
        // A single retriever failing is a degraded run, not a failed one: the peers still answered.
        assertThat(detail.getRun().getErrorCode()).isNull();
    }

    @Test
    void testReplay_shouldReturn400_whenQueryIsBlank() {
        RegisteredUser anna = registerUser("Anna");

        String body = postForBody(replayUri(anna.id()), request("   ", false, false),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "ADMIN_MEMORY_REPLAY_QUERY_INVALID");
    }

    // ==== helpers ====

    private AdminMemoryRunDetailResponse replay(UUID userId, AdminMemoryReplayRequest request) {
        return postForBody(replayUri(userId), request, ownerAuthHeaders(), HttpStatus.OK,
                AdminMemoryRunDetailResponse.class);
    }

    private static String replayUri(UUID userId) {
        return "/api/admin/users/" + userId + "/memory/replay";
    }

    private static AdminMemoryReplayRequest request(String query, boolean reranker, boolean rewrite) {
        AdminMemoryReplayRequest request = new AdminMemoryReplayRequest();
        request.setQuery(query);
        request.setReranker(reranker);
        request.setRewrite(rewrite);
        return request;
    }

    private void seedItem(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                content, LocalDate.now().minusDays(2));
        memoryPopulator.vector(item, VERSION, MemoryEmbeddingPopulator.axisVector(0));
    }

    private long count(String table) {
        Long value = jdbcTemplate.queryForObject("select count(*) from " + table, Long.class);
        return value == null ? 0L : value;
    }

    private String maxUpdatedAt(String table) {
        return jdbcTemplate.queryForObject(
                "select coalesce(max(updated_at)::text, '') from " + table, String.class);
    }

    /**
     * The two values {@code LlmCallRecorder} would have persisted, captured at the adapter seam.
     * A {@link Proxy} rather than a hand-written decorator: {@link CompanionLlm} is a wide
     * interface and only the ambient context matters here, not any single overload.
     */
    @TestConfiguration
    static class RecordingLlmConfiguration {

        @Bean
        LlmCallLog llmCallLog() {
            return new LlmCallLog();
        }

        @Bean
        @Primary
        CompanionLlm recordingCompanionLlm(FakeCompanionLlm delegate, LlmActorResolver actorResolver,
                LlmCallContextHolder holder, LlmCallLog log) {
            return (CompanionLlm) Proxy.newProxyInstance(
                    CompanionLlm.class.getClassLoader(),
                    new Class<?>[] {CompanionLlm.class},
                    recorder(delegate, actorResolver, holder, log));
        }

        @Bean
        @Primary
        EmbeddingPort recordingEmbeddingPort(FakeEmbeddingAdapter delegate,
                LlmActorResolver actorResolver, LlmCallContextHolder holder, LlmCallLog log) {
            return (EmbeddingPort) Proxy.newProxyInstance(
                    EmbeddingPort.class.getClassLoader(),
                    new Class<?>[] {EmbeddingPort.class},
                    recorder(delegate, actorResolver, holder, log));
        }

        private static InvocationHandler recorder(Object delegate, LlmActorResolver actorResolver,
                LlmCallContextHolder holder, LlmCallLog log) {
            return (proxy, method, args) -> {
                LlmCallContext context = holder.get();
                log.add(new LlmCallLog.Entry(method.getName(), actorResolver.currentActor(),
                        context.feature(), context.operation()));
                try {
                    return method.invoke(delegate, args);
                } catch (InvocationTargetException exception) {
                    throw exception.getCause();
                }
            };
        }
    }

    /** Thread-safe: retrievers call the ports from {@code applicationTaskExecutor}. */
    static class LlmCallLog {

        private final List<Entry> entries = new CopyOnWriteArrayList<>();

        void add(Entry entry) {
            entries.add(entry);
        }

        void clear() {
            entries.clear();
        }

        List<String> operations() {
            return entries.stream().map(Entry::operation).filter(java.util.Objects::nonNull).toList();
        }

        List<Entry> byOperation(String operation) {
            return entries.stream().filter(entry -> operation.equals(entry.operation())).toList();
        }

        List<Entry> byMethod(String method) {
            return entries.stream().filter(entry -> method.equals(entry.method())).toList();
        }

        record Entry(String method, UUID actor, String feature, String operation) {
        }
    }
}
