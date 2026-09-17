package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * fix round 1 finding I1: an exhausted LLM budget must refuse a streamed turn EAGERLY, on the
 * request thread, BEFORE {@link ChatStreamService#streamMessage} returns its {@code Flux} — the
 * same eager-failure contract {@code ChatStreamServiceIT}'s
 * {@code testStreamMessage_shouldThrow404BeforeStreaming_whenConversationForeign} already pins
 * for a foreign conversation. {@code LlmBudgetCapIT} pins {@link
 * io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder#runWith}'s refusal in isolation;
 * this pins that the SAME refusal actually reaches {@code streamMessage}'s own preflight call
 * (the fix — see the class javadoc/comment at its call site) rather than surfacing later, past
 * the 200 commit, as a terminal SSE 'error' frame.
 *
 * <p>Deliberately cheap: the ceiling is pinned to $1.00 (like {@code LlmBudgetCapIT}) and spend is
 * seeded directly via {@link LlmLogPopulator} — no real LLM call, no streaming round-trip needed
 * to reach STOPPED.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.memory-platform.serving-mode=OLD",
        "mezo.llm-log.budget.enabled=true",
        "mezo.llm-log.budget.hard-cap-usd=1.00",
        "mezo.llm-log.budget.cycle-days=30",
        "mezo.llm-log.budget.degrade-at-percent=70",
        "mezo.llm-log.budget.throttle-cron-at-percent=90",
        "mezo.llm-log.budget.stop-at-percent=100"
})
class ChatStreamBudgetIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testStreamMessage_shouldThrow429BeforeStreaming_whenBudgetIsExhausted() {
        UUID userId = databasePopulator.populateUser("stream-budget-exhausted@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        // EXACTLY the $1.00 ceiling = EXACTLY 100% — inclusive, per LlmBudgetCapIT: already STOPPED.
        llmLogPopulator.log(userId, CallKind.CHAT, "companion_chat", "gpt-5.6-terra", 1000, 100,
                null, new BigDecimal("1.00"));

        // streamMessage has no request-scoped JWT principal in this direct-call IT (unlike a real
        // HTTP request), so the actor is bound the same way LlmBudgetCapIT binds it: LlmActorContext
        // .runAs on the calling thread, which LlmActorContext#capture() falls back to when no JWT
        // principal is present — exactly the thread streamMessage's own eager preflight call runs on.
        LlmActorContext.runAs(userId, () -> assertThatThrownBy(() -> chatStreamService.streamMessage(
                userId, conversation.getId(),
                SendMessageRequest.builder().content("mi a terv ma?").build()))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .satisfies(e -> assertThat(((SystemRuntimeErrorException) e).getStatus())
                        .isEqualTo(HttpStatus.TOO_MANY_REQUESTS)));
    }
}
