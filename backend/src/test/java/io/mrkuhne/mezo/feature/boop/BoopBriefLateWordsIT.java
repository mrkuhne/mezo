package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.feature.boop.service.BoopBriefService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.IntentionPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-r36n9.24: the model is slower than the brief may wait (production: never once inside 8 s). The
 * brief answers with the rule words in time, and the model's late answer is NOT thrown away — it is
 * stored on the day's row (only if the inputs did not move meanwhile), so the next open shows Boop's
 * own words. A failed model call is retried by a later open, at most every 10 minutes.
 * Not {@code @Transactional}: the late answer commits on another thread.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.boop.llm-timeout=200ms")
class BoopBriefLateWordsIT extends AbstractIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    private static final LocalDate DAY = LocalDate.parse("2026-11-10");
    private static final Instant NOW = LocalDateTime.of(DAY, LocalTime.of(8, 30)).atZone(BUDAPEST).toInstant();
    /** The fake model's canned tonight tip (FakeCompanionLlm.BOOP_CANNED_ANSWER); the rules never say it. */
    private static final String LLM_TIP = "Ma este fél tizenegy körül bújj ágyba.";

    @Autowired private BoopBriefService service;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogs;
    @Autowired private IntentionPopulator intentions;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void release() {
        fakeLlm.holdBoopBriefCalls(null);
    }

    @Test
    void testGet_shouldStoreTheLateModelWords_whenTheModelMissesTheWait() throws Exception {
        UUID user = databasePopulator.populateUser("brief-late@test.local");
        sleepLogs.createSleepLog(user, DAY, new BigDecimal("7.50"), 8);
        CyclicBarrier model = new CyclicBarrier(2); // the test thread is the second party: it releases the model
        fakeLlm.holdBoopBriefCalls(model);

        long started = System.nanoTime();
        BoopBrief first = service.get(user, DAY, NOW);
        assertThat(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started)).isLessThan(5_000);
        assertThat(first.getTonightTip()).isNotEqualTo(LLM_TIP); // answered in time, with the rule words
        assertThat(aiWords(user)).isFalse();

        model.await(5, TimeUnit.SECONDS); // the model answers late
        awaitAiWords(user);

        assertThat(payloadTip(user)).isEqualTo(LLM_TIP);
        int calls = fakeLlm.boopBriefCallCount();
        BoopBrief next = service.get(user, DAY, NOW.plusSeconds(60));
        assertThat(next.getTonightTip()).isEqualTo(LLM_TIP);
        assertThat(fakeLlm.boopBriefCallCount()).isEqualTo(calls); // served from the row, no new call
    }

    @Test
    void testGet_shouldRetryAFailedModelCall_onlyAfterTenMinutes() {
        UUID user = databasePopulator.populateUser("brief-retry@test.local");
        intentions.creed(user, "Nyugodt nap " + FakeCompanionLlm.FAIL_COMPLETE);

        // The fake model fails before it counts a call, so the row's generation time shows a retry.
        service.get(user, DAY, NOW);
        assertThat(aiWords(user)).isFalse();
        assertThat(generatedAt(user)).isEqualTo(NOW);

        service.get(user, DAY, NOW.plusSeconds(5 * 60));
        assertThat(generatedAt(user)).isEqualTo(NOW); // too soon: the stored rule brief

        service.get(user, DAY, NOW.plusSeconds(11 * 60));
        assertThat(generatedAt(user)).isEqualTo(NOW.plusSeconds(11 * 60)); // the rule-only row was regenerated
        assertThat(jdbc.queryForObject("select count(*) from boop_brief where created_by = ?", Integer.class, user))
            .isEqualTo(1);
    }

    private boolean aiWords(UUID user) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
            "select ai_words from boop_brief where created_by = ? and date = ?", Boolean.class, user, DAY));
    }

    private Instant generatedAt(UUID user) {
        return jdbc.queryForObject("select generated_at from boop_brief where created_by = ? and date = ?",
            java.sql.Timestamp.class, user, DAY).toInstant();
    }

    private String payloadTip(UUID user) {
        return jdbc.queryForObject("select payload->>'tonightTip' from boop_brief where created_by = ? and date = ?",
            String.class, user, DAY);
    }

    private void awaitAiWords(UUID user) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        while (!aiWords(user)) {
            assertThat(System.nanoTime()).as("late model words stored within 10 s").isLessThan(deadline);
            Thread.sleep(50);
        }
    }
}
