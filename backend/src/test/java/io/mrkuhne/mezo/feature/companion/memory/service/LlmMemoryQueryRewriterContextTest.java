package io.mrkuhne.mezo.feature.companion.memory.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;

/**
 * mezo-4qyt: the rewrite call stays {@code companion_recall} for every caller EXCEPT the admin
 * explorer's dry-run replay, which it re-labels to itself.
 *
 * <p>The negative case is the important one: naively inheriting the ambient feature would have
 * moved EVERY chat turn's rewrite row out of {@code companion_recall} and corrupted the shipped
 * cost matrix, so a chat's ambient {@code companion_chat} must NOT win.
 */
class LlmMemoryQueryRewriterContextTest {

    private final LlmCallContextHolder holder = new LlmCallContextHolder();
    private final AtomicReference<LlmCallContext> seen = new AtomicReference<>();
    private final LlmMemoryQueryRewriter rewriter =
            new LlmMemoryQueryRewriter(new ContextCapturingLlm(seen, holder), holder);

    @Test
    void testRewrite_shouldStayCompanionRecall_whenNoAmbientContext() {
        rewriter.rewrite("arról mit tudsz?", List.of());

        assertThat(seen.get().feature()).isEqualTo("companion_recall");
        assertThat(seen.get().operation()).isEqualTo("query_rewrite");
    }

    @Test
    void testRewrite_shouldStayCompanionRecall_whenAmbientContextIsAChatTurn() {
        holder.runWith(new LlmCallContext("companion_chat", "turn", null, null),
                () -> rewriter.rewrite("arról mit tudsz?", List.of()));

        assertThat(seen.get().feature()).isEqualTo("companion_recall");
    }

    @Test
    void testRewrite_shouldReLabel_whenAmbientContextIsTheAdminReplay() {
        holder.runWith(
                new LlmCallContext(LlmCallContext.FEATURE_ADMIN_REPLAY, "memory_retrieval", null, null),
                () -> rewriter.rewrite("arról mit tudsz?", List.of()));

        assertThat(seen.get().feature()).isEqualTo(LlmCallContext.FEATURE_ADMIN_REPLAY);
        assertThat(seen.get().operation()).isEqualTo("query_rewrite");
    }

    /** Records the context the adapter WOULD have read, then answers deterministically. */
    private record ContextCapturingLlm(
            AtomicReference<LlmCallContext> seen, LlmCallContextHolder holder) implements CompanionLlm {

        @Override
        public String complete(String systemPrompt, List<Turn> history, String userMessage,
                List<org.springframework.ai.tool.ToolCallback> tools,
                Map<String, Object> toolContext) {
            seen.set(holder.get());
            return FakeCompanionLlm.PREFIX + " " + userMessage;
        }

        @Override
        public Flux<String> stream(String systemPrompt, List<Turn> history, String userMessage,
                List<org.springframework.ai.tool.ToolCallback> tools,
                Map<String, Object> toolContext) {
            throw new UnsupportedOperationException("not used by the rewriter");
        }

        @Override
        public String complete(String systemPrompt, String userMessage, List<InlineImage> images) {
            throw new UnsupportedOperationException("not used by the rewriter");
        }

        @Override
        public String complete(String systemPrompt, String userMessage, InlineAudio audio) {
            throw new UnsupportedOperationException("not used by the rewriter");
        }
    }
}
