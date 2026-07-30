package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.task.TaskRejectedException;

/**
 * The recorder's central promise (mezo-2zyu): recording an LLM call can never break the LLM call.
 *
 * <p>{@code publishEvent} runs SYNCHRONOUSLY on the caller's thread and the multicaster has no
 * {@code ErrorHandler}, so a saturated or shut-down {@code llmLogExecutor} (or any listener-side
 * failure before the async hop) would otherwise propagate straight back into the adapter. A plain
 * unit test is the right level here — the failure being proven is a THROW, which no wired context
 * can produce on demand.
 */
class EventPublishingLlmCallRecorderTest {

    @Test
    void testRecord_shouldSwallow_whenPublishThrows() {
        ApplicationEventPublisher throwingPublisher = event -> {
            throw new TaskRejectedException("llmLogExecutor queue is full");
        };
        EventPublishingLlmCallRecorder recorder =
            new EventPublishingLlmCallRecorder(throwingPublisher, new LlmActorResolver());

        assertThatCode(() -> recorder.record(anyRecord())).doesNotThrowAnyException();
    }

    private static LlmCallRecord anyRecord() {
        return LlmCallRecord.builder()
            .callKind(CallKind.CHAT)
            .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(42)
            .context(LlmCallContext.UNKNOWN)
            .build();
    }
}
