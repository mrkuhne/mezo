package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternDetectionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * V3.1 detection over the checkin-stress↔sleep-quality catalog pair (lag 0): a strongly
 * anti-correlated 10-day seed must surface a proposed negative pattern; re-runs refresh (never
 * duplicate); below-min-n stays silent; user-judged rows are frozen.
 */
@ActiveProfiles("companion-fake")
class PatternDetectionServiceIT extends AbstractIntegrationTest {

    private static final String PAIR_KEY = "checkin-stress~sleep-quality";

    @Autowired private PatternDetectionService patternDetectionService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private MealPopulator mealPopulator;

    /** Stress i ↔ quality inversely — a clean negative correlation over 10 finished days. */
    private void seedAntiCorrelatedDays(UUID owner, int days) {
        for (int i = 0; i < days; i++) {
            LocalDate day = LocalDate.now().minusDays(1L + i);
            int stress = (i % 5) + 1;
            int quality = 6 - stress;
            checkInPopulator.createCheckIn(owner, day, "08:00", 3, stress, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), quality);
        }
    }

    private void seedImbalancedWeekendMeals(UUID owner) {
        int weekdays = 0;
        int weekends = 0;
        int index = 0;
        LocalDate day = LocalDate.now().minusDays(1);
        while (weekdays < 8 || weekends < 1) {
            boolean weekend = day.getDayOfWeek() == DayOfWeek.SATURDAY
                    || day.getDayOfWeek() == DayOfWeek.SUNDAY;
            boolean take = weekend ? weekends < 1 : weekdays < 8;
            if (take) {
                LocalTime time = LocalTime.of(10 + index, index * 7 % 60);
                Instant loggedAt = day.atTime(time).atZone(ZoneId.systemDefault()).toInstant();
                mealPopulator.createMealWithItems(owner, day, "dinner", loggedAt,
                        List.of(new MealPopulator.Line(
                                "Pattern fixture", "500", "30", "45", "18", (short) 2)));
                if (weekend) {
                    weekends++;
                } else {
                    weekdays++;
                }
                index++;
            }
            day = day.minusDays(1);
        }
    }

    @Test
    void testDetect_shouldPersistProposedNegativePattern_whenSeriesAntiCorrelate() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);

        int upserted = patternDetectionService.detect(owner);

        assertThat(upserted).isGreaterThanOrEqualTo(1);
        PatternEntity pattern = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(owner, PatternEntity.KIND_STATISTICAL, PAIR_KEY)
                .orElseThrow();
        assertThat(pattern.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(pattern.getR().doubleValue()).isLessThan(-0.9);
        assertThat(pattern.getN()).isEqualTo(10);
        assertThat(pattern.getConfidence()).isNull(); // honest small-n — never fabricated
        assertThat(pattern.getMechanism()).contains("negatív");
        assertThat(pattern.getEvidence().items()).anyMatch(e -> e.startsWith("n=10"));
    }

    @Test
    void testDetect_shouldPersistBedtimePattern_whenLateBedtimeTracksLowQuality() {
        UUID owner = userPopulator.createUser().getId();
        // bedtime 22:00→02:30 (törtóra 22..26.5) ↔ minőség 5..1 — erős negatív együttjárás
        for (int i = 0; i < 10; i++) {
            LocalDate day = LocalDate.now().minusDays(1L + i);
            int shift = i % 5;
            String bedtime = shift < 2 ? (22 + shift) + ":00" : (shift - 2) + ":30";
            sleepLogPopulator.createSleepLog(owner, day, bedtime, "06:30",
                    new BigDecimal("7.0"), 5 - shift, 0, null);
        }

        patternDetectionService.detect(owner);

        PatternEntity row = patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_STATISTICAL, "bedtime-hour~sleep-quality").orElseThrow();
        assertThat(row.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(row.getR().doubleValue()).isLessThan(0);
        assertThat(row.getN()).isEqualTo(10);
    }

    @Test
    void testDetect_shouldRefreshExistingRow_whenRunTwice() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);

        patternDetectionService.detect(owner);
        UUID firstId = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(owner, PatternEntity.KIND_STATISTICAL, PAIR_KEY)
                .orElseThrow().getId();
        patternDetectionService.detect(owner);

        List<PatternEntity> all = patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner)
                .stream().filter(p -> PAIR_KEY.equals(p.getPairKey())).toList();
        assertThat(all).hasSize(1);
        assertThat(all.getFirst().getId()).isEqualTo(firstId);
    }

    @Test
    void testDetect_shouldStaySilent_whenBelowMinN() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 3); // min-n is 8

        patternDetectionService.detect(owner);

        assertThat(patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(owner, PatternEntity.KIND_STATISTICAL, PAIR_KEY))
                .isEmpty();
    }

    @Test
    void testDetect_shouldNotCreatePattern_whenBinaryGroupsAreImbalanced() {
        UUID owner = userPopulator.createUser().getId();
        seedImbalancedWeekendMeals(owner);

        patternDetectionService.detect(owner);

        assertThat(patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                owner, PatternEntity.KIND_STATISTICAL, "weekend~late-meal-hour")).isEmpty();
    }

    @Test
    void testDetect_shouldNotRefreshProposedPattern_whenBinaryGroupsBecomeImbalanced() {
        UUID owner = userPopulator.createUser().getId();
        seedImbalancedWeekendMeals(owner);
        PatternEntity proposed = patternPopulator.statistical(
                owner, "weekend~late-meal-hour", PatternEntity.STATUS_PROPOSED);
        BigDecimal frozenR = proposed.getR();
        Integer frozenN = proposed.getN();
        BigDecimal frozenP = proposed.getP();
        Instant frozenDetectedAt = proposed.getLastDetectedAt();

        patternDetectionService.detect(owner);

        PatternEntity after = patternRepository.findById(proposed.getId()).orElseThrow();
        assertThat(after.getR()).isEqualByComparingTo(frozenR);
        assertThat(after.getN()).isEqualTo(frozenN);
        assertThat(after.getP()).isEqualByComparingTo(frozenP);
        assertThat(after.getLastDetectedAt()).isEqualTo(frozenDetectedAt);
        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, proposed.getId()))
                .isEmpty();
    }

    @Test
    void testDetect_shouldAppendSnapshotEvent_whenPairGoesLive() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);

        patternDetectionService.detect(owner);

        PatternEntity pattern = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(owner, PatternEntity.KIND_STATISTICAL, PAIR_KEY)
                .orElseThrow();
        List<PatternEventEntity> events = patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, pattern.getId());
        assertThat(events).hasSize(1);
        assertThat(events.getFirst().getKind()).isEqualTo(PatternEventEntity.KIND_SNAPSHOT);
        assertThat(events.getFirst().getPayload().r()).isLessThan(-0.9);
        assertThat(events.getFirst().getPayload().n()).isEqualTo(10);
        assertThat(events.getFirst().getPayload().p()).isNotNull();
    }

    @Test
    void testDetect_shouldAppendSnapshotButFreezeStats_whenRowConfirmed() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);
        PatternEntity judged = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        BigDecimal frozenR = judged.getR();

        patternDetectionService.detect(owner);

        PatternEntity after = patternRepository.findById(judged.getId()).orElseThrow();
        assertThat(after.getR()).isEqualByComparingTo(frozenR); // stats stay frozen (V3.1 contract)
        List<PatternEventEntity> events = patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, judged.getId());
        assertThat(events).extracting(PatternEventEntity::getKind)
                .contains(PatternEventEntity.KIND_SNAPSHOT); // history accrues past the freeze
    }

    @Test
    void testDetect_shouldStaySilent_whenRowRejected() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);
        PatternEntity judged = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_REJECTED);

        patternDetectionService.detect(owner);

        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, judged.getId()))
                .isEmpty();
    }

    @Autowired private io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator knowledgeFactPopulator;

    private KnowledgeFactEntity promotedFact(UUID owner) {
        return knowledgeFactPopulator.fact(owner, "Stressz rontja az alvást", "health", 0, true,
                KnowledgeFactEntity.SOURCE_PATTERN);
    }

    @Test
    void testDetect_shouldReinforcePromotedFact_whenConfirmedPatternRecursSameDirection() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);
        KnowledgeFactEntity fact = promotedFact(owner);
        PatternEntity confirmed = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        confirmed.setPromotedFactId(fact.getId()); // populator r is -0.55 — same sign as the seed
        patternRepository.saveAndFlush(confirmed);

        patternDetectionService.detect(owner);

        KnowledgeFactEntity after = knowledgeFactRepository.findById(fact.getId()).orElseThrow();
        assertThat(after.getReinforcementCount()).isEqualTo(1);
        assertThat(after.getLastReinforcedAt()).isNotNull();
        // the confirmed pattern's stats stay frozen
        assertThat(patternRepository.findById(confirmed.getId()).orElseThrow().getN()).isEqualTo(12);
        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, confirmed.getId()))
                .extracting(PatternEventEntity::getKind)
                .contains(PatternEventEntity.KIND_REINFORCED);
    }

    @Test
    void testDetect_shouldReinforceOnlyOncePerCooldown_whenRunNightly() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);
        KnowledgeFactEntity fact = promotedFact(owner);
        PatternEntity confirmed = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        confirmed.setPromotedFactId(fact.getId());
        patternRepository.saveAndFlush(confirmed);

        patternDetectionService.detect(owner);
        patternDetectionService.detect(owner); // "next night" inside the cooldown window

        // the sliding window re-counts the same evidence — one increment per cooldown, not per night
        assertThat(knowledgeFactRepository.findById(fact.getId()).orElseThrow().getReinforcementCount())
                .isEqualTo(1);
    }

    @Test
    void testDetect_shouldNotReinforce_whenDirectionFlipped() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10); // fresh r is NEGATIVE
        KnowledgeFactEntity fact = promotedFact(owner);
        PatternEntity confirmed = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        confirmed.setR(new java.math.BigDecimal("0.5500")); // stored as POSITIVE — direction flipped
        confirmed.setPromotedFactId(fact.getId());
        patternRepository.saveAndFlush(confirmed);

        patternDetectionService.detect(owner);

        assertThat(knowledgeFactRepository.findById(fact.getId()).orElseThrow().getReinforcementCount())
                .isZero();
    }

    @Test
    void testDetect_shouldNotReinforce_whenPatternOnlyMonitoring() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);
        KnowledgeFactEntity fact = promotedFact(owner);
        PatternEntity monitoring = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_MONITORING);
        monitoring.setPromotedFactId(fact.getId());
        patternRepository.saveAndFlush(monitoring);

        patternDetectionService.detect(owner);

        // monitoring rows refresh stats but never reinforce (silent monitoring stays silent)
        assertThat(knowledgeFactRepository.findById(fact.getId()).orElseThrow().getReinforcementCount())
                .isZero();
    }

    @Test
    void testDetect_shouldFreezeUserJudgedRow_whenConfirmed() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);
        PatternEntity confirmed = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        BigDecimal frozenR = confirmed.getR();
        // `after` is re-read from Postgres (timestamptz, microsecond precision) rather than
        // served from the first-level cache. Since mezo-mfmb the entity already truncates its
        // own default to micros — timestamptz ROUNDS a nanosecond value while this truncates,
        // and on linux (nanosecond-resolution Instant.now()) the two drifted by 1 us, so this
        // assertion failed on CI while passing on darwin. The truncate below is now a no-op
        // kept as a guard: if a future write path forgets to truncate, this comparison and not
        // some distant reader is where it should surface.
        Instant frozenDetectedAt = confirmed.getLastDetectedAt().truncatedTo(ChronoUnit.MICROS);

        patternDetectionService.detect(owner);

        PatternEntity after = patternRepository.findById(confirmed.getId()).orElseThrow();
        assertThat(after.getR()).isEqualByComparingTo(frozenR);
        assertThat(after.getLastDetectedAt()).isEqualTo(frozenDetectedAt);
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
    }
}
