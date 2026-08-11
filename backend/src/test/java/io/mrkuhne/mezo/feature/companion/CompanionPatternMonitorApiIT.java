package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.PatternMetricCoverage;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.service.PatternDetectionService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Az élő kapu-diagnosztika HTTP-kontraktusa (mezo-viqs) — verdiktek, szűk keresztmetszet,
 * lefedettség, és a lényegi ígéret: amit a monitor „live"-nak mond, azt a job perzisztálja is.
 */
@ActiveProfiles("companion-fake")
class CompanionPatternMonitorApiIT extends ApiIntegrationTest {

    private static final String STRESS_SLEEP_PAIR = "checkin-stress~sleep-quality";

    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternDetectionService patternDetectionService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private PatternMonitorResponse monitor() {
        return getForBody("/api/companion/pattern/monitor", ownerAuthHeaders(),
                HttpStatus.OK, PatternMonitorResponse.class);
    }

    private static PatternMonitorPair pair(PatternMonitorResponse response, String key) {
        return response.getPairs().stream().filter(p -> key.equals(p.getKey())).findFirst().orElseThrow();
    }

    private static PatternMetricCoverage metric(PatternMonitorResponse response, String key) {
        return response.getMetrics().stream().filter(m -> key.equals(m.getKey())).findFirst().orElseThrow();
    }

    /** Aznapi stressz + alvásminőség N napra visszamenőleg (lag=0 pár), változó értékekkel. */
    private void seedStressAndSleep(UUID owner, int days) {
        LocalDate to = LocalDate.now().minusDays(1);
        for (int i = 0; i < days; i++) {
            LocalDate day = to.minusDays(i);
            // createCheckIn(owner, date, slotTime, energy, stress, note) — stress must vary here,
            // it's the correlated metric for STRESS_SLEEP_PAIR (energy is unused, stays constant).
            checkInPopulator.createCheckIn(owner, day, "08:00", 3, 1 + i % 5, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), 1 + (i * 2) % 5);
        }
    }

    @Test
    void testPatternMonitor_shouldEchoWindowAndConfig_whenNoDataAtAll() {
        PatternMonitorResponse response = monitor();

        assertThat(response.getLookbackDays()).isEqualTo(60);
        assertThat(response.getMinN()).isEqualTo(8);
        assertThat(response.getCron()).isNotBlank();
        assertThat(response.getWindowTo()).isEqualTo(LocalDate.now().minusDays(1));
        assertThat(response.getWindowFrom()).isEqualTo(response.getWindowTo().minusDays(59));
        assertThat(response.getLastRunAt()).isNull();
        assertThat(response.getPairs()).hasSize(8);
        assertThat(response.getMetrics()).hasSize(12);
        assertThat(response.getPairs()).allSatisfy(p -> assertThat(p.getVerdict()).isEqualTo("no_data"));
    }

    @Test
    void testPatternMonitor_shouldReturnFewDaysWithMissingCount_whenBelowMinN() {
        seedStressAndSleep(ownerId(), 5);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("few_days");
        assertThat(pair.getAlignedDays()).isEqualTo(5);
        assertThat(pair.getMissingDays()).isEqualTo(3);
        assertThat(pair.getBottleneckMetricKey()).isNotBlank();
        assertThat(pair.getR()).isNull();
    }

    @Test
    void testPatternMonitor_shouldReturnLiveWithStats_whenMinNReached() {
        seedStressAndSleep(ownerId(), 10);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("live");
        assertThat(pair.getAlignedDays()).isEqualTo(10);
        assertThat(pair.getN()).isEqualTo(10);
        assertThat(pair.getR()).isNotNull();
        assertThat(pair.getP()).isNotNull();
        assertThat(pair.getMissingDays()).isNull();
    }

    @Test
    void testPatternMonitor_shouldAgreeWithTheNightlyJob_whenVerdictIsLive() {
        seedStressAndSleep(ownerId(), 10);
        PatternMonitorResponse before = monitor();

        patternDetectionService.detect(ownerId());
        PatternMonitorResponse after = monitor();

        // amit a monitor live-nak mondott, arra a job írt sort (a frozen ág nem érinti)
        assertThat(pair(before, STRESS_SLEEP_PAIR).getVerdict()).isEqualTo("live");
        assertThat(pair(after, STRESS_SLEEP_PAIR).getVerdict()).isEqualTo("live");
        assertThat(after.getLastRunAt()).isNotNull();
        // amit few_days-nek, arra nem
        assertThat(pair(after, "reta-cycle-day~daily-kcal").getVerdict()).isEqualTo("no_data");
    }

    @Test
    void testPatternMonitor_shouldReturnFrozenWithJudgedStats_whenUserDecided() {
        patternPopulator.statistical(ownerId(), STRESS_SLEEP_PAIR, PatternEntity.STATUS_CONFIRMED);
        seedStressAndSleep(ownerId(), 10);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("frozen");
        assertThat(pair.getStatus()).isEqualTo("confirmed");
        assertThat(pair.getN()).isEqualTo(12); // a populátor befagyasztott n-je, NEM a 10 élő nap
        assertThat(pair.getR()).isCloseTo(-0.55, within(1e-6));
    }

    @Test
    void testPatternMonitor_shouldCountCoveragePerMetric_whenDaysLogged() {
        seedStressAndSleep(ownerId(), 6);

        PatternMonitorResponse response = monitor();

        PatternMetricCoverage stress = metric(response, "checkin-stress");
        assertThat(stress.getLabel()).isEqualTo("stressz-szint");
        assertThat(stress.getCoveredDays()).isEqualTo(6);
        assertThat(stress.getWindowDays()).isEqualTo(60);
        assertThat(stress.getLastDayWithData()).isEqualTo(LocalDate.now().minusDays(1));
        assertThat(stress.getPairCount()).isEqualTo(1);
        assertThat(metric(response, "daily-kcal").getCoveredDays()).isZero();
        assertThat(metric(response, "daily-kcal").getLastDayWithData()).isNull();
    }

    @Test
    void testPatternMonitor_shouldIgnoreForeignRows_whenAnotherUserHasPatterns() {
        // egy IDEGEN user befagyasztott sora ugyanarra a pár-kulcsra
        patternPopulator.statistical(userPopulator.createUser().getId(),
                STRESS_SLEEP_PAIR, PatternEntity.STATUS_CONFIRMED);
        seedStressAndSleep(ownerId(), 10);

        PatternMonitorResponse response = monitor();

        assertThat(pair(response, STRESS_SLEEP_PAIR).getVerdict()).isEqualTo("live"); // nem frozen
        assertThat(response.getLastRunAt()).isNull(); // az idegen sor nem szivárog be
    }
}
