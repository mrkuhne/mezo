package io.mrkuhne.mezo.feature.companion.memory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.dto.ScoreBreakdown;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecorder;
import io.mrkuhne.mezo.feature.llmlog.service.TokenUsage;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import reactor.core.publisher.Flux;

/**
 * Memória mindenhol S10 part 2 (bd mezo-eq85.10, task-10-codebase-notes.md §5) — RESOLVED
 * CONTRADICTION B: the plan's step wrapping {@code LlmMemoryQueryRewriter}/{@code
 * LlmMemoryReranker} in a NEW {@code "companion_memory"} label is already delivered under a
 * DIFFERENT, deliberately unrenamed name: {@code companion_recall}. Renaming it would split every
 * existing cost series in {@code /me/ai-usage} for no benefit (each class's own javadoc explains
 * why). So: NO production change here — this test only proves the delivered label is what
 * actually lands in {@code llm_log_history}.
 *
 * <p>{@code companion-fake}'s {@code FakeCompanionLlm}/{@code FakeEmbeddingAdapter} never reach
 * the recorder (the {@code LlmCallContextTaggingIT}/{@code LlmActorPropagationIT} precedent), so
 * an end-to-end row assertion needs its OWN recording doubles — @Primary beans that read the
 * ambient {@link LlmCallContext} exactly where the real Gemini adapters do and hand a minimal
 * {@link LlmCallRecord} to the real {@link LlmCallRecorder}, riding the real {@code @Async}
 * {@code llmLogExecutor} hop ({@code LlmLogRecorderWiringIT}'s idiom).
 *
 * <p>The embed assertion is the one that matters most: it is the regression test for mezo-1qfzu
 * (deployed but never exercised in production before this).
 */
@ActiveProfiles("companion-fake")
@Import(LlmMemoryCallContextIT.RecordingLlmConfiguration.class)
class LlmMemoryCallContextIT extends AbstractIntegrationTest {

    /** Records every call it sees via the REAL {@link LlmCallRecorder}, reading the ambient
     *  {@link LlmCallContext} on the calling thread — exactly where {@code GeminiCompanionLlm}'s
     *  own recorder call reads it. */
    static class RecordingCompanionLlm implements CompanionLlm {

        private final LlmCallContextHolder contextHolder;
        private final LlmCallRecorder recorder;

        RecordingCompanionLlm(LlmCallContextHolder contextHolder, LlmCallRecorder recorder) {
            this.contextHolder = contextHolder;
            this.recorder = recorder;
        }

        private void record(String userMessage) {
            recorder.record(LlmCallRecord.builder()
                    .callKind(CallKind.CHAT)
                    .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
                    .status(CallStatus.SUCCESS).latencyMs(10)
                    .tokens(new TokenUsage(50, 10, null, null, 60))
                    .userMessage(userMessage)
                    .context(contextHolder.get())
                    .build());
        }

        @Override
        public String complete(String systemPrompt, List<Turn> history, String userMessage,
                List<ToolCallback> tools, Map<String, Object> toolContext) {
            record(userMessage);
            return "mikor edzettél legutóbb?";
        }

        @Override
        public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                List<ToolCallback> tools, Map<String, Object> toolContext) {
            record(userMessage);
            return Flux.just("ok");
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            record(userMessage);
            return "ok";
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            record(userMessage);
            return "ok";
        }

        @Override
        public String completeSmart(String systemPrompt, String userMessage) {
            record(userMessage);
            // LlmMemoryReranker parses a JSON array of UUIDs — an empty array is a valid, harmless
            // answer (falls back to fused order), which is all this test needs.
            return "[]";
        }
    }

    /** Same idiom, for the embedding port ({@code GeminiEmbeddingAdapter}'s call site). */
    static class RecordingEmbeddingPort implements EmbeddingPort {

        private final LlmCallContextHolder contextHolder;
        private final LlmCallRecorder recorder;

        RecordingEmbeddingPort(LlmCallContextHolder contextHolder, LlmCallRecorder recorder) {
            this.contextHolder = contextHolder;
            this.recorder = recorder;
        }

        private void record(String text) {
            recorder.record(LlmCallRecord.builder()
                    .callKind(CallKind.EMBED_QUERY)
                    .requestedModel("gemini-embedding-001").servedModel("gemini-embedding-001")
                    .status(CallStatus.SUCCESS).latencyMs(5)
                    .tokens(new TokenUsage(20, 0, null, null, 20))
                    .userMessage(text)
                    .context(contextHolder.get())
                    .build());
        }

        @Override
        public List<float[]> embedDocuments(List<String> texts) {
            texts.forEach(this::record);
            return texts.stream().map(t -> unitVector()).toList();
        }

        @Override
        public float[] embedQuery(String text) {
            record(text);
            return unitVector();
        }

        private static float[] unitVector() {
            float[] vector = new float[EmbeddingPort.DIMENSIONS];
            vector[0] = 1f;
            return vector;
        }
    }

    @TestConfiguration
    static class RecordingLlmConfiguration {

        @Bean
        @Primary
        RecordingCompanionLlm recordingCompanionLlm(LlmCallContextHolder contextHolder, LlmCallRecorder recorder) {
            return new RecordingCompanionLlm(contextHolder, recorder);
        }

        @Bean
        @Primary
        RecordingEmbeddingPort recordingEmbeddingPort(LlmCallContextHolder contextHolder, LlmCallRecorder recorder) {
            return new RecordingEmbeddingPort(contextHolder, recorder);
        }
    }

    @Autowired private MemoryQueryRewriter memoryQueryRewriter;
    @Autowired private LlmMemoryReranker llmMemoryReranker;
    @Autowired private MemoryQueryEmbedder memoryQueryEmbedder;
    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private DatabasePopulator databasePopulator;

    private static FusedCandidate fusedCandidate(UUID stableId) {
        MemoryCandidate candidate = new MemoryCandidate("dense", "memory_item", stableId, stableId, stableId,
                "journal_entry", "Napló", "tartalom", LocalDate.of(2026, 9, 1), 0.9,
                false, false, 0.5, null, null);
        return new FusedCandidate(candidate, new ScoreBreakdown(0.5, 0, 0, 0, 0, 0, 0.5), Map.of("dense", 1));
    }

    /**
     * Drives the SAME three call sites a NEW-mode chat turn's retrieval does — query rewrite,
     * embed, rerank — directly, rather than through a full HTTP chat turn: {@code
     * MemoryContextService.retrieve} makes no promise about WHEN each fires (rewrite only for a
     * context-dependent query, rerank only on {@code shouldRerank}'s heuristics), so calling the
     * three seams directly is what makes this deterministic rather than a coin flip on ambient
     * conversation shape. Each is the exact production call {@code ChatMemoryContextAdapter}'s
     * retrieval would make on that seam.
     */
    @Test
    void testMemoryLlmCalls_shouldLandUnderCompanionRecall_neverUnknown() {
        UUID user = databasePopulator.populateUser("llm-memory-call-context@test.local");

        memoryQueryRewriter.rewrite("és azelőtt?", List.of(
                new CompanionLlm.Turn(CompanionLlm.Role.USER, "Mikor edzettem legutóbb?"),
                new CompanionLlm.Turn(CompanionLlm.Role.ASSISTANT, "Kedden.")));
        llmMemoryReranker.rerank(List.of(fusedCandidate(UUID.randomUUID()), fusedCandidate(UUID.randomUUID())));
        memoryQueryEmbedder.embed("Mennyit aludtam a héten?");

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            List<LlmLogEntity> rows = llmLogRepository.findAll();
            assertThat(rows).extracting(LlmLogEntity::getFeature)
                    .as("every memory-platform LLM call must land under companion_recall, never unknown")
                    .doesNotContain(LlmCallContext.UNKNOWN.feature())
                    .contains("companion_recall");
            assertThat(rows).extracting(LlmLogEntity::getOperation)
                    .contains("query_rewrite", "rerank", "recall_embed");
        });
    }
}
