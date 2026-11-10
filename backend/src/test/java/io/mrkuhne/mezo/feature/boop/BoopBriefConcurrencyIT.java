package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.feature.boop.service.BoopBriefService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Boop S3 Task 6 fix round (review I1, mezo-r36n9.7): two first GETs of one owner and day racing.
 * NOT {@code @Transactional} — each request must run in its own committed transactions, as in
 * production; cleanup is the inherited {@code ResetDatabase}. The fake LLM holds both calls at a
 * barrier, so both requests have read "no row" before either writes.
 */
@ActiveProfiles("companion-fake")
class BoopBriefConcurrencyIT extends AbstractIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    private static final LocalDate DAY = LocalDate.parse("2026-11-10");
    private static final Instant NOW = LocalDateTime.of(DAY, LocalTime.of(20, 0)).atZone(BUDAPEST).toInstant();

    @Autowired private BoopBriefService service;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;

    @AfterEach
    void release() {
        fakeLlm.holdBoopBriefCalls(null);
    }

    @Test
    void testGet_shouldAnswerBothWithOneRow_whenTwoFirstRequestsRace() throws Exception {
        UUID user = databasePopulator.populateUser("brief-race@test.local");
        fakeLlm.holdBoopBriefCalls(new CyclicBarrier(2));
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            // Several days: each one is a fresh first-GET race (raises the odds of the insert/insert clash).
            for (int i = 0; i < 5; i++) {
                LocalDate date = DAY.minusDays(i);
                Future<BoopBrief> a = pool.submit(() -> service.get(user, date, NOW));
                Future<BoopBrief> b = pool.submit(() -> service.get(user, date, NOW));

                BoopBrief first = a.get(30, TimeUnit.SECONDS);
                BoopBrief second = b.get(30, TimeUnit.SECONDS);

                assertThat(second).usingRecursiveComparison().isEqualTo(first);
                assertThat(jdbc.queryForObject("select count(*) from boop_brief where created_by = ? and date = ?",
                    Integer.class, user, date)).isEqualTo(1);
            }
        } finally {
            pool.shutdownNow();
        }
    }
}
