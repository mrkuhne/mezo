package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternDetectionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * V3.1 detection over the checkin-stress↔sleep-quality catalog pair (lag 0): a strongly
 * anti-correlated 10-day seed must surface a proposed negative pattern; re-runs refresh (never
 * duplicate); below-min-n stays silent; user-judged rows are frozen.
 */
@Transactional
@ActiveProfiles("companion-fake")
class PatternDetectionServiceIT extends AbstractIntegrationTest {

    private static final String PAIR_KEY = "checkin-stress~sleep-quality";

    @Autowired private PatternDetectionService patternDetectionService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

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
    void testDetect_shouldFreezeUserJudgedRow_whenConfirmed() {
        UUID owner = userPopulator.createUser().getId();
        seedAntiCorrelatedDays(owner, 10);
        PatternEntity confirmed = patternPopulator.statistical(owner, PAIR_KEY, PatternEntity.STATUS_CONFIRMED);
        BigDecimal frozenR = confirmed.getR();
        Instant frozenDetectedAt = confirmed.getLastDetectedAt();

        patternDetectionService.detect(owner);

        PatternEntity after = patternRepository.findById(confirmed.getId()).orElseThrow();
        assertThat(after.getR()).isEqualByComparingTo(frozenR);
        assertThat(after.getLastDetectedAt()).isEqualTo(frozenDetectedAt);
        assertThat(after.getStatus()).isEqualTo(PatternEntity.STATUS_CONFIRMED);
    }
}
