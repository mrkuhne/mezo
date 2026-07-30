package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.Duration;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

/**
 * The feature switch is the whole safety story of the audit log (mezo-2zyu): with
 * {@code mezo.feature.llm-log.enabled=false} (the shipped default) the injected
 * {@link LlmCallRecorder} is the no-op, so no call site can ever publish an audit event — the
 * switch removes the behavior structurally, not by an if-check at the call site.
 *
 * <p>The enabled half additionally rides out the real async hop, which is the only way to prove
 * that {@code @Async("llmLogExecutor")} resolves its pool (an unresolvable qualifier throws inside
 * the AOP interceptor, i.e. BEFORE the writer's own catch-all — it would surface in the user call).
 */
class LlmLogRecorderWiringIT {

    private static LlmCallRecord anyRecord() {
        return LlmCallRecord.builder()
            .callKind(CallKind.CHAT)
            .requestedModel("gemini-2.5-flash").servedModel("gemini-2.5-flash")
            .status(CallStatus.SUCCESS).latencyMs(42)
            .tokens(new TokenUsage(100, 10, null, null, 110))
            .userMessage("hi")
            .context(new LlmCallContext("companion_chat", null, null, null))
            .build();
    }

    @Nested
    @SpringBootTest(properties = "mezo.feature.llm-log.enabled=true")
    class Enabled extends AbstractIntegrationTest {

        @Autowired private LlmCallRecorder llmCallRecorder;
        @Autowired private LlmLogRepository llmLogRepository;
        @Autowired private ApplicationContext applicationContext;

        @Test
        void testRecorder_shouldBeEventPublishing_whenSwitchOn() {
            assertThat(llmCallRecorder).isInstanceOf(EventPublishingLlmCallRecorder.class);
        }

        @Test
        void testRecord_shouldWriteRowOffTheCallingThread_whenSwitchOn() {
            llmCallRecorder.record(anyRecord());

            await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
                assertThat(llmLogRepository.findAll()).hasSize(1);
                LlmLogEntity row = llmLogRepository.findAll().getFirst();
                assertThat(row.getFeature()).isEqualTo("companion_chat");
                assertThat(row.getCostUsd()).isEqualByComparingTo("0.000055"); // 100 in + 10 out @flash
                assertThat(row.getCreatedBy()).isNull();                       // no principal on this thread
            });
        }

        /**
         * Regression guard for a silent, app-wide trap: Boot's auto-configured
         * {@code applicationTaskExecutor} backs off as soon as ANY {@code Executor} bean exists, and
         * every plain {@code @Async} in the app (companion fact extraction, turn embedding) would
         * then quietly move onto the audit log's 1-thread pool. {@code LlmLogAsyncConfig} declares
         * its executor {@code defaultCandidate = false} to prevent exactly that.
         */
        @Test
        void testApplicationTaskExecutor_shouldSurvive_whenLlmLogExecutorIsDeclared() {
            assertThat(applicationContext.containsBean("applicationTaskExecutor")).isTrue();
            assertThat(applicationContext.containsBean("llmLogExecutor")).isTrue();
        }
    }

    @Nested
    @SpringBootTest(properties = "mezo.feature.llm-log.enabled=false")
    class Disabled extends AbstractIntegrationTest {

        @Autowired private LlmCallRecorder llmCallRecorder;
        @Autowired private LlmLogRepository llmLogRepository;

        @Test
        void testRecorder_shouldBeNoOp_whenSwitchOff() {
            assertThat(llmCallRecorder).isInstanceOf(NoOpLlmCallRecorder.class);
        }

        @Test
        void testRecord_shouldWriteNothing_whenSwitchOff() {
            llmCallRecorder.record(anyRecord());

            assertThat(llmLogRepository.count()).isZero();
        }
    }
}
