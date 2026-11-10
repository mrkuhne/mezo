package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.BoopBrief;
import io.mrkuhne.mezo.api.dto.BoopMetric;
import io.mrkuhne.mezo.feature.boop.entity.BoopBriefEntity;
import io.mrkuhne.mezo.feature.boop.repository.BoopBriefRepository;
import io.mrkuhne.mezo.feature.boop.service.BoopBriefService;
import io.mrkuhne.mezo.feature.boop.service.RuleVerdicts;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** Boop S3 Task 6 (mezo-r36n9.7): the cached morning brief — one row per owner and day, input-hash
 *  reuse without an LLM call, regeneration on new input, the manual regeneration cap. */
@Transactional
@ActiveProfiles("companion-fake")
class BoopBriefServiceIT extends AbstractIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    private static final LocalDate DAY = LocalDate.parse("2026-11-10");
    /** 08:30 Budapest on DAY. */
    private static final Instant NOW = LocalDateTime.of(DAY, java.time.LocalTime.of(8, 30)).atZone(BUDAPEST).toInstant();

    @Autowired private BoopBriefService service;
    @Autowired private BoopBriefRepository briefs;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogs;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void testGet_shouldCreateOneRowWithTheFullBrief_whenFirstCall() {
        UUID user = databasePopulator.populateUser("brief-first@test.local");
        sleepLogs.createSleepLog(user, DAY, new BigDecimal("7.50"), 8);

        BoopBrief b = service.get(user, DAY, NOW);

        assertThat(rows(user)).isEqualTo(1);
        BoopBriefEntity row = briefs.findByCreatedByAndDate(user, DAY).orElseThrow();
        assertThat(row.getRegenCount()).isZero();
        assertThat(row.getInputHash()).hasSize(64);
        assertThat(b.getDate()).isEqualTo("2026-11-10");
        assertThat(b.getGeneratedAt()).isNotNull();
        assertThat(b.getState()).isEqualTo(BoopBrief.StateEnum.LEARNING); // 1 night < 14
        assertThat(b.getNightsKnown()).isEqualTo(1);
        assertThat(b.getMetrics()).extracting(BoopMetric::getKey).containsExactly(
            BoopMetric.KeyEnum.FORMA, BoopMetric.KeyEnum.ALVAS, BoopMetric.KeyEnum.MOZGAS,
            BoopMetric.KeyEnum.FUEL, BoopMetric.KeyEnum.PULZUS);
        assertThat(b.getMetrics()).allSatisfy(m -> {
            assertThat(m.getDisplay()).isNotBlank();
            assertThat(m.getHeadline()).isNotBlank();
            assertThat(m.getSentence()).isNotBlank();
        });
        BoopMetric forma = b.getMetrics().getFirst();
        assertThat(forma.getScore()).isNull();
        assertThat(forma.getHeadline()).isEqualTo(RuleVerdicts.LEARNING_HEADLINE);
        assertThat(forma.getCaption()).isEqualTo("1/14 éjszaka");
        assertThat(b.getMetrics().get(1).getScore()).isNotNull(); // alvás from the night
        assertThat(b.getEnergy().getHourly()).hasSize(19).allSatisfy(v -> assertThat(v).isBetween(0.0, 1.0));
        assertThat(b.getBrief()).isNotEmpty();
        assertThat(b.getTonightTip()).isNotBlank();
        assertThat(b.getDay().getSleep()).isNotNull();
        assertThat(b.getDay().getSleep().getTotalMin()).isEqualTo(450);
        assertThat(b.getDay().getSleep().getDeepMin()).isNull(); // manual row: no stages
        assertThat(b.getDay().getStepsGoal()).isEqualTo(9000);
        assertThat(b.getDay().getSteps()).isZero();
        assertThat(b.getMetrics().get(2).getDisplay()).isEqualTo("–");
        assertThat(b.getMetrics().get(2).getScore()).isNull(); // no wearable day: no fake 0 level
        assertThat(b.getDay().getDeepSleepWeek()).hasSize(7);
        assertThat(b.getDay().getCalendar().getBusySlots()).hasSize(72);
    }

    @Test
    void testGet_shouldReuseTheStoredBriefWithoutAnLlmCall_whenInputsUnchanged() {
        UUID user = databasePopulator.populateUser("brief-cache@test.local");
        sleepLogs.createSleepLog(user, DAY, new BigDecimal("7.00"), 7);
        int before = fakeLlm.boopBriefCallCount();

        BoopBrief first = service.get(user, DAY, NOW);
        BoopBrief second = service.get(user, DAY, NOW.plusSeconds(3600));

        assertThat(fakeLlm.boopBriefCallCount()).isEqualTo(before + 1);
        assertThat(rows(user)).isEqualTo(1);
        assertThat(second.getGeneratedAt().toInstant()).isEqualTo(first.getGeneratedAt().toInstant());
        assertThat(second.getMetrics()).isEqualTo(first.getMetrics());
        assertThat(second.getEnergy()).isEqualTo(first.getEnergy());
    }

    @Test
    void testGet_shouldRegenerate_whenANewNightArrives() {
        UUID user = databasePopulator.populateUser("brief-night@test.local");
        int before = fakeLlm.boopBriefCallCount();
        BoopBrief first = service.get(user, DAY, NOW);
        String firstHash = briefs.findByCreatedByAndDate(user, DAY).orElseThrow().getInputHash();
        assertThat(first.getDay().getSleep()).isNull();

        sleepLogs.createSleepLog(user, DAY, new BigDecimal("8.00"), 9);
        BoopBrief second = service.get(user, DAY, NOW);

        assertThat(fakeLlm.boopBriefCallCount()).isEqualTo(before + 2);
        assertThat(rows(user)).isEqualTo(1);
        BoopBriefEntity row = briefs.findByCreatedByAndDate(user, DAY).orElseThrow();
        assertThat(row.getInputHash()).isNotEqualTo(firstHash);
        assertThat(row.getRegenCount()).isZero(); // automatic regeneration is not a manual one
        assertThat(second.getDay().getSleep()).isNotNull();
        assertThat(second.getDay().getSleep().getTotalMin()).isEqualTo(480);
    }

    @Test
    void testRegenerate_shouldRefuseWith409_whenTheDailyLimitIsUsedUp() {
        UUID user = databasePopulator.populateUser("brief-regen@test.local");
        service.get(user, DAY, NOW);
        int before = fakeLlm.boopBriefCallCount();

        for (int i = 0; i < 3; i++) {
            assertThat(service.regenerate(user, DAY, NOW)).isNotNull();
        }
        assertThat(fakeLlm.boopBriefCallCount()).isEqualTo(before + 3); // a manual regeneration always calls
        assertThat(briefs.findByCreatedByAndDate(user, DAY).orElseThrow().getRegenCount()).isEqualTo(3);

        assertThatThrownBy(() -> service.regenerate(user, DAY, NOW))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("BOOP_REGENERATE_LIMIT_REACHED")
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus()).isEqualTo(HttpStatus.CONFLICT));
        assertThat(fakeLlm.boopBriefCallCount()).isEqualTo(before + 3); // refused before the LLM
        assertThat(briefs.findByCreatedByAndDate(user, DAY).orElseThrow().getRegenCount()).isEqualTo(3);
    }

    @Test
    void testRegenerate_shouldCreateTheRow_whenNoBriefExistsYet() {
        UUID user = databasePopulator.populateUser("brief-regen-first@test.local");

        service.regenerate(user, DAY, NOW);

        assertThat(briefs.findByCreatedByAndDate(user, DAY).orElseThrow().getRegenCount()).isEqualTo(1);
    }

    @Test
    void testGet_shouldKeepBriefsPerOwner_whenTwoUsersAskForTheSameDay() {
        UUID a = databasePopulator.populateUser("brief-a@test.local");
        UUID b = databasePopulator.populateUser("brief-b@test.local");
        sleepLogs.createSleepLog(a, DAY, new BigDecimal("7.50"), 8);

        BoopBrief briefA = service.get(a, DAY, NOW);
        BoopBrief briefB = service.get(b, DAY, NOW);
        service.regenerate(b, DAY, NOW);

        assertThat(briefA.getDay().getSleep()).isNotNull();
        assertThat(briefB.getDay().getSleep()).isNull();
        assertThat(rows(a)).isEqualTo(1);
        assertThat(rows(b)).isEqualTo(1);
        assertThat(briefs.findByCreatedByAndDate(a, DAY).orElseThrow().getRegenCount()).isZero();
    }

    @Test
    void testGet_shouldJudgeAPastDayAsOfItsEnd_whenTheDateIsBeforeToday() {
        UUID user = databasePopulator.populateUser("brief-past@test.local");
        Instant earlyToday = LocalDateTime.of(DAY, java.time.LocalTime.of(5, 0)).atZone(BUDAPEST).toInstant();

        BoopBrief today = service.get(user, DAY, earlyToday);
        BoopBrief yesterday = service.get(user, DAY.minusDays(1), earlyToday);

        // 05:00 today: too early for a fuel score; yesterday is judged at its end: 0 kcal of the target.
        assertThat(today.getMetrics().get(3).getScore()).isNull();
        assertThat(yesterday.getMetrics().get(3).getScore()).isZero();
    }

    @Test
    void testGet_shouldRefuseWith400_whenTheDateIsAfterTodayInTheOwnerZone() {
        UUID user = databasePopulator.populateUser("brief-future@test.local");

        assertThatThrownBy(() -> service.get(user, DAY.plusDays(1), NOW))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThatThrownBy(() -> service.regenerate(user, DAY.plusDays(1), NOW))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
        assertThat(rows(user)).isZero();
    }

    @Test
    void testRegenerate_shouldCountAtomically_whenAConcurrentRegenerateAlreadyUsedTheLastOne() {
        UUID user = databasePopulator.populateUser("brief-regen-race@test.local");
        service.get(user, DAY, NOW);
        service.regenerate(user, DAY, NOW);
        service.regenerate(user, DAY, NOW); // this session's entity now says 2
        // A concurrent request commits the third regeneration behind this persistence context's back.
        jdbc.update("update boop_brief set regen_count = 3 where created_by = ?", user);

        assertThatThrownBy(() -> service.regenerate(user, DAY, NOW))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessage("BOOP_REGENERATE_LIMIT_REACHED");
        assertThat(jdbc.queryForObject("select regen_count from boop_brief where created_by = ?", Integer.class, user))
            .isEqualTo(3);
    }

    @Test
    void testGet_shouldNeverWriteBackAnOlderRegenCount_whenTheHashChangesAfterAConcurrentRegenerate() {
        UUID user = databasePopulator.populateUser("brief-regen-keep@test.local");
        service.get(user, DAY, NOW); // this session's entity says 0
        jdbc.update("update boop_brief set regen_count = 2 where created_by = ?", user);

        sleepLogs.createSleepLog(user, DAY, new BigDecimal("7.00"), 7); // new hash → the GET rewrites the row
        service.get(user, DAY, NOW);

        assertThat(jdbc.queryForObject("select regen_count from boop_brief where created_by = ?", Integer.class, user))
            .isEqualTo(2);
    }

    private int rows(UUID user) {
        return jdbc.queryForObject("select count(*) from boop_brief where created_by = ?", Integer.class, user);
    }
}
