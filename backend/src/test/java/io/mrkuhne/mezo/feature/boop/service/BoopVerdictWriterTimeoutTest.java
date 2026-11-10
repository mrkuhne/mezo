package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.boop.config.BoopProperties;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdicts;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.time.Duration;
import java.time.LocalTime;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.task.SimpleAsyncTaskExecutor;
import tools.jackson.databind.json.JsonMapper;

/** Final review M4 (mezo-r36n9.7): a slow model never holds the brief past {@code mezo.boop.llm-timeout}. */
class BoopVerdictWriterTimeoutTest {

    private static final String VALID = """
        {"forma":{"headline":"LLM forma","sentence":"LLM."},"alvas":{"headline":"LLM alvás","sentence":"LLM."},
         "mozgas":{"headline":"LLM mozgás","sentence":"LLM."},"fuel":{"headline":"LLM fuel","sentence":"LLM."},
         "pulzus":{"headline":"LLM pulzus","sentence":"LLM."},"brief":[{"text":"LLM mondat.","link":null}],
         "tonightTip":"LLM tipp.","nextMealTip":null}""";

    @Test
    @SuppressWarnings("unchecked")
    void aBlockingLlmFallsBackToTheRuleVerdictsWithinTheTimeout() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        CompanionLlm llm = mock(CompanionLlm.class);
        when(llm.complete(anyString(), anyString())).thenAnswer(inv -> {
            release.await(5, TimeUnit.SECONDS); // a model that hangs
            return VALID;
        });
        ObjectProvider<CompanionLlm> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(llm);
        BoopProperties props = new BoopProperties(9000, 3, 14, Duration.ofMillis(300));
        BoopVerdictWriter writer = new BoopVerdictWriter(provider, new LlmCallContextHolder(), JsonMapper.builder().build(),
            props, new SimpleAsyncTaskExecutor("boop-test-"));
        BoopDay d = BoopBriefFixtures.day(BoopBriefFixtures.night("23:00", "06:30"), 4000, List.of());
        Scores s = new BoopScores(props).compute(d, LocalTime.of(8, 0));

        long started = System.nanoTime();
        Verdicts v = writer.write(d, s, LocalTime.of(8, 0));
        long tookMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
        release.countDown();

        assertThat(tookMs).isLessThan(2_000);
        assertThat(v).isEqualTo(new RuleVerdicts(9000, 14).write(d, s, LocalTime.of(8, 0)));
    }
}
