package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.ScoreBreakdown;
import io.mrkuhne.mezo.feature.companion.memory.service.LlmMemoryReranker;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import tools.jackson.databind.ObjectMapper;

class LlmMemoryRerankerTest {

    private final FakeCompanionLlm llm = new FakeCompanionLlm();
    private final ThreadPoolTaskExecutor taskExecutor = taskExecutor();
    private final LlmMemoryReranker reranker = new LlmMemoryReranker(
            llm, new ObjectMapper(), MemoryCandidateFusionTest.properties(), taskExecutor);

    @AfterEach
    void shutdownExecutor() {
        taskExecutor.shutdown();
    }

    @Test
    void testRerank_shouldApplyKnownUniqueIdsAndAppendOmissions_whenAnswerContainsUnknownAndDuplicateIds() {
        FusedCandidate first = fused("első", false, 0.020);
        FusedCandidate second = fused("második", false, 0.019);
        FusedCandidate third = fused("harmadik", false, 0.018);
        String script = "[fake-memory-rerank:[\"" + second.candidate().stableId() + "\",\""
                + UUID.randomUUID() + "\",\"" + second.candidate().stableId() + "\"]]";
        second = withContent(second, script);

        List<FusedCandidate> result = reranker.rerank(List.of(first, second, third));

        assertThat(result).extracting(item -> item.candidate().stableId())
                .containsExactly(second.candidate().stableId(), first.candidate().stableId(), third.candidate().stableId());
    }

    @Test
    void testRerank_shouldUseFusedOrder_whenAnswerIsMalformedOrProviderFails() {
        FusedCandidate first = fused("[fake-memory-rerank-broken]", false, 0.020);
        FusedCandidate second = fused("második", false, 0.019);
        assertThat(reranker.rerank(List.of(first, second))).containsExactly(first, second);

        FusedCandidate failure = withContent(first, FakeCompanionLlm.FAIL_COMPLETE);
        assertThat(reranker.rerank(List.of(failure, second))).containsExactly(failure, second);
    }

    @Test
    void testRerank_shouldRejectKnownButUnexposedId_whenCandidateLimitIsReached() {
        List<FusedCandidate> candidates = new ArrayList<>();
        for (int index = 0; index < 21; index++) {
            candidates.add(fused("jelölt-" + index, false, 1.0 / (index + 1)));
        }
        UUID unexposedId = candidates.get(20).candidate().stableId();
        candidates.set(0, withContent(candidates.getFirst(),
                "[fake-memory-rerank:[\"" + unexposedId + "\"]]"));

        List<FusedCandidate> result = reranker.rerank(candidates);

        assertThat(result).containsExactlyElementsOf(candidates);
    }

    @Test
    void testRerank_shouldUseFusedOrderAndInterruptProvider_whenDeadlineExpires() throws InterruptedException {
        CountDownLatch interrupted = new CountDownLatch(1);
        FakeCompanionLlm blockingLlm = new FakeCompanionLlm() {
            @Override
            public String completeSmart(String systemPrompt, String userMessage) {
                try {
                    Thread.sleep(2_000);
                    return "[]";
                } catch (InterruptedException exception) {
                    interrupted.countDown();
                    Thread.currentThread().interrupt();
                    return "[]";
                }
            }
        };
        LlmMemoryReranker bounded = new LlmMemoryReranker(
                blockingLlm, new ObjectMapper(), enabledProperties(25), taskExecutor);
        List<FusedCandidate> order = List.of(fused("első", false, 0.020), fused("második", false, 0.019));

        long started = System.nanoTime();
        List<FusedCandidate> result = bounded.rerank(order);

        assertThat(result).containsExactlyElementsOf(order);
        assertThat(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)).isLessThan(1_000);
        assertThat(interrupted.await(1, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void testShouldRerank_shouldRequireEnabledAndUncertaintyForAmbientChat() {
        FusedCandidate first = fused("első", false, 0.020);
        FusedCandidate close = fused("második", false, 0.019);
        MemoryRequest request = request(ConsumerPolicy.CHAT_AMBIENT, false);

        assertThat(reranker.shouldRerank(request,
                Map.of("dense", List.of(first.candidate()), "lexical", List.of(first.candidate())),
                List.of(first, close))).isFalse();

        LlmMemoryReranker enabled = new LlmMemoryReranker(
                llm, new ObjectMapper(), enabledProperties(), taskExecutor);
        assertThat(enabled.shouldRerank(request,
                Map.of("dense", List.of(first.candidate()), "lexical", List.of(first.candidate())),
                List.of(first, close))).isTrue();
        assertThat(enabled.shouldRerank(request,
                Map.of("dense", List.of(first.candidate()), "lexical", List.of(close.candidate())),
                List.of(first))).isTrue();
        assertThat(enabled.shouldRerank(request,
                Map.of("dense", List.of(first.candidate()), "lexical", List.of(first.candidate())),
                List.of(withConflict(first)))).isTrue();
        assertThat(enabled.shouldRerank(request(ConsumerPolicy.WEEKLY_MEMOIR, false), Map.of(), List.of(first))).isTrue();
        assertThat(enabled.shouldRerank(request(ConsumerPolicy.CHAT_AMBIENT, true), Map.of(), List.of(first))).isTrue();
    }

    private static FusedCandidate fused(String content, boolean conflicting, double score) {
        UUID id = UUID.randomUUID();
        MemoryCandidate candidate = new MemoryCandidate("dense", "memory_item", id, id, id,
                "journal_entry", "Napló", content, LocalDate.of(2026, 9, 1), 0.9,
                false, conflicting, 0.5, null, null);
        return new FusedCandidate(candidate, new ScoreBreakdown(score, 0, 0, 0, 0, 0, score), Map.of("dense", 1));
    }

    private static FusedCandidate withContent(FusedCandidate original, String content) {
        MemoryCandidate c = original.candidate();
        return new FusedCandidate(new MemoryCandidate(c.retriever(), c.candidateKind(), c.stableId(),
                c.memoryItemId(), c.sourceId(), c.sourceKind(), c.label(), content, c.occurredOn(),
                c.localScore(), c.pinned(), c.conflicting(), c.salience(),
                c.diversityGroupId(), c.conflictingWithId()), original.score(), original.retrieverRanks());
    }

    private static FusedCandidate withConflict(FusedCandidate original) {
        MemoryCandidate c = original.candidate();
        return new FusedCandidate(new MemoryCandidate(c.retriever(), c.candidateKind(), c.stableId(),
                c.memoryItemId(), c.sourceId(), c.sourceKind(), c.label(), c.content(), c.occurredOn(),
                c.localScore(), c.pinned(), true, c.salience(),
                c.diversityGroupId(), c.conflictingWithId()), original.score(), original.retrieverRanks());
    }

    private static MemoryRequest request(ConsumerPolicy policy, boolean deep) {
        return new MemoryRequest(UUID.randomUUID(), policy, "kérdés", List.of(), LocalDate.of(2026, 9, 5),
                1200, null, deep);
    }

    private static io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties enabledProperties() {
        return enabledProperties(200);
    }

    private static io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties enabledProperties(
            int timeoutMs) {
        var base = MemoryCandidateFusionTest.properties();
        return new io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties(
                base.servingEmbeddingVersion(), base.embeddingProvider(), base.embeddingModel(), base.schemaVersion(),
                base.servingMode(), base.serving(), base.reembedding(), base.audit(), base.fusion(), base.execution(),
                new io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties.Reranker(
                        true, 0.002, 20, 600, timeoutMs), base.indicators());
    }

    private static ThreadPoolTaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.initialize();
        return executor;
    }
}
