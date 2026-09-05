package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.PatternMetricCoverage;
import io.mrkuhne.mezo.api.dto.PatternMonitorPair;
import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.PatternDetectionService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
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
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternDetectionService patternDetectionService;
    @Autowired private PatternRepository patternRepository;
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
        seedStressAndSleep(owner, days, LocalDate.now());
    }

    /**
     * Same seeding, anchored on a day the CALLER has already read. A test that later asserts against
     * "yesterday" must use this overload: the seeded window and the assertion are BOTH test-owned,
     * so they have to come from ONE reading of the clock — two reads disagree across a midnight.
     */
    private void seedStressAndSleep(UUID owner, int days, LocalDate today) {
        LocalDate to = today.minusDays(1);
        for (int i = 0; i < days; i++) {
            LocalDate day = to.minusDays(i);
            // createCheckIn(owner, date, slotTime, energy, stress, note) — stress must vary here,
            // it's the correlated metric for STRESS_SLEEP_PAIR (energy is unused, stays constant).
            checkInPopulator.createCheckIn(owner, day, "08:00", 3, 1 + i % 5, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), 1 + (i * 2) % 5);
        }
    }

    /**
     * Nine finished days with the production incident's exact 8 weekday : 1 weekend balance,
     * anchored on a day the caller has already read (see {@link #seedStressAndSleep}).
     */
    private void seedImbalancedWeekendMeals(UUID owner, LocalDate today) {
        int weekdays = 0;
        int weekends = 0;
        int index = 0;
        LocalDate day = today.minusDays(1);
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
    void testPatternMonitor_shouldEchoWindowAndConfig_whenNoDataAtAll() {
        // windowTo is the SERVER's own yesterday: capture the day AROUND the call and accept either
        // side, so a midnight between the two reads cannot flip the assert
        LocalDate dayBefore = LocalDate.now();
        PatternMonitorResponse response = monitor();
        LocalDate dayAfter = LocalDate.now();

        assertThat(response.getLookbackDays()).isEqualTo(60);
        assertThat(response.getMinN()).isEqualTo(8);
        assertThat(response.getCron()).isNotBlank();
        assertThat(response.getWindowTo()).isIn(dayBefore.minusDays(1), dayAfter.minusDays(1));
        assertThat(response.getWindowFrom()).isEqualTo(response.getWindowTo().minusDays(59));
        assertThat(response.getLastRunAt()).isNull();
        assertThat(response.getPairs()).hasSize(29); // V3.4 katalógus (8 eredeti + 21 új)
        assertThat(response.getMetrics()).hasSize(MetricKey.values().length); // a teljes V3.4 katalógus
        assertThat(response.getPairs()).allSatisfy(p -> assertThat(p.getVerdict()).isEqualTo("no_data"));
    }

    @Test
    void testPatternMonitor_shouldReturnFewDaysWithMissingCount_whenBelowMinN() {
        seedStressAndSleep(ownerId(), 5);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("few_days");
        assertThat(pair.getAlignedDays()).isEqualTo(5);
        assertThat(pair.getMissingDays()).isEqualTo(3);
        // checkin-stress és sleep-quality is 5-5 napot fed le — döntetlennél A nyer (thinnerMetric)
        assertThat(pair.getBottleneckMetricKey()).isEqualTo("checkin-stress");
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
    void testPatternMonitor_shouldReturnImbalancedGroups_whenWeekendHasOnlyOneDay() {
        seedImbalancedWeekendMeals(ownerId(), LocalDate.now());

        PatternMonitorPair pair = pair(monitor(), "weekend~late-meal-hour");

        assertThat(pair.getVerdict()).isEqualTo("imbalanced_groups");
        assertThat(pair.getAlignedDays()).isEqualTo(9);
        assertThat(pair.getGroupZeroDays()).isEqualTo(8);
        assertThat(pair.getGroupOneDays()).isEqualTo(1);
        assertThat(pair.getRequiredPerGroup()).isEqualTo(3);
        assertThat(pair.getR()).isNull();
        assertThat(pair.getP()).isNull();
        assertThat(pair.getMetricAValueKind()).isEqualTo("binary");
        assertThat(pair.getMetricBValueKind()).isEqualTo("clock_hour");
    }

    /**
     * A kérés-szintű cache szélesebb ablakot tölt be ({@code windowTo + maxLag}), mint amit a job
     * ténylegesen néz ({@code windowTo} = tegnap) — a {@code window(...)} vágás nélkül a mai napra
     * eső adat is bekerülhetne a szériákba. Ha valaki ma is naplózott, az alignedDays-nek attól
     * még pontosan annyinak kell maradnia, amennyit a job (a [from,to] ablakon) is látna.
     */
    @Test
    void testPatternMonitor_shouldExcludeTodaysLogging_whenComputingAlignedDays() {
        UUID owner = ownerId();
        // ONE read of the clock: the seeded 10-day window and the extra "today" row below must be
        // consecutive, which two separate LocalDate.now() calls cannot guarantee
        LocalDate today = LocalDate.now();
        seedStressAndSleep(owner, 10, today);

        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 5, null);
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("7.0"), 5);

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("live");
        assertThat(pair.getAlignedDays()).isEqualTo(10); // a mai nap NEM számít bele
        assertThat(pair.getN()).isEqualTo(10);
    }

    @Test
    void testPatternMonitor_shouldReturnDegenerateWithBottleneck_whenSeriesIsConstant() {
        UUID owner = ownerId();
        LocalDate to = LocalDate.now().minusDays(1); // read ONCE — the whole loop shares it
        for (int i = 0; i < 10; i++) {
            LocalDate day = to.minusDays(i);
            // stressz KONSTANS (4) — a sleep-quality változó marad, hogy a DEGENERATE a
            // stressz oldalról (Side.A) jöjjön, ne a párból adódó véletlen egybeesésből.
            checkInPopulator.createCheckIn(owner, day, "08:00", 3, 4, null);
            sleepLogPopulator.createSleepLog(owner, day, new BigDecimal("7.0"), 1 + (i * 2) % 5);
        }

        PatternMonitorPair pair = pair(monitor(), STRESS_SLEEP_PAIR);

        assertThat(pair.getVerdict()).isEqualTo("degenerate");
        assertThat(pair.getAlignedDays()).isEqualTo(10); // eléri a min-n-t, tehát valóban a Pearson lép DEGENERATE-re
        assertThat(pair.getBottleneckMetricKey()).isEqualTo("checkin-stress");
        assertThat(pair.getR()).isNull();
        assertThat(pair.getN()).isNull();
    }

    @Test
    void testPatternMonitor_shouldAgreeWithTheNightlyJob_whenVerdictIsLive() {
        seedStressAndSleep(ownerId(), 10);
        PatternMonitorPair liveBefore = pair(monitor(), STRESS_SLEEP_PAIR);
        assertThat(liveBefore.getVerdict()).isEqualTo("live");

        int upserted = patternDetectionService.detect(ownerId());
        PatternMonitorResponse after = monitor();

        // csak a STRESS_SLEEP_PAIR éri el a min-n-t ebben a fixture-ben — a job pontosan egy sort ír
        assertThat(upserted).isEqualTo(1);
        assertThat(pair(after, STRESS_SLEEP_PAIR).getVerdict()).isEqualTo("live");
        assertThat(after.getLastRunAt()).isNotNull();

        // a lényegi ígéret: amit a monitor live-nak r/n-nel mondott, PONT azt perzisztálta a job
        PatternEntity persisted = patternRepository
                .findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                        ownerId(), PatternEntity.KIND_STATISTICAL, STRESS_SLEEP_PAIR)
                .orElseThrow();
        assertThat(persisted.getN()).isEqualTo(liveBefore.getN());
        assertThat(persisted.getR().doubleValue()).isCloseTo(liveBefore.getR(), within(1e-4));

        // egy pár, amire nincs elég adat (nincs seedelve semmi rá): a monitor a job lefutása UTÁN
        // is no_data-t mond — a job nem hozott létre sort, amit a monitor "frozen"-ként olvashatna
        assertThat(pair(after, "medication-cycle-day~daily-kcal").getVerdict()).isEqualTo("no_data");
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
    void testPatternMonitor_shouldCarrySourceDomainAndMechanism_whenRequested() {
        PatternMonitorResponse response = monitor();

        assertThat(response.getPairs()).allSatisfy(p -> {
            assertThat(p.getMechanismHu()).isNotBlank();
            assertThat(p.getMetricADomain()).isNotBlank();
            assertThat(p.getMetricBDomain()).isNotBlank();
            // mezo-fj1g: emberi nyelvű kártya-szövegek — mind a 29 páron kötelezőek
            assertThat(p.getQuestionHu()).isNotBlank();
            assertThat(p.getExpectedDirection()).isIn("positive", "negative");
            assertThat(p.getWhenPositiveHu()).contains("{erősség}");
            assertThat(p.getWhenNegativeHu()).contains("{erősség}");
        });
        assertThat(pair(response, STRESS_SLEEP_PAIR).getMetricBDomain()).isEqualTo("sleep");
        assertThat(metric(response, "checkin-stress").getSourceHu()).isEqualTo("Check-in sheet");
        assertThat(metric(response, "checkin-stress").getDomain()).isEqualTo("mind");
    }

    @Test
    void testPatternMonitor_shouldCountCoveragePerMetric_whenDaysLogged() {
        // lastDayWithData is the max SEEDED day, not a server stamp: both sides of the assert are
        // test-owned, so the clock is read ONCE and the same `today` anchors the fixture AND the
        // expectation. (A before/after capture taken after the seeding would not close this: a
        // midnight between the helper's read and the capture still shifts the two apart.)
        LocalDate today = LocalDate.now();
        seedStressAndSleep(ownerId(), 6, today);

        PatternMonitorResponse response = monitor();

        PatternMetricCoverage stress = metric(response, "checkin-stress");
        assertThat(stress.getLabel()).isEqualTo("stressz-szint");
        assertThat(stress.getCoveredDays()).isEqualTo(6);
        assertThat(stress.getWindowDays()).isEqualTo(60);
        assertThat(stress.getLastDayWithData()).isEqualTo(today.minusDays(1));
        assertThat(stress.getPairCount()).isEqualTo(2); // V3.4: + checkin-stress~late-meal-hour
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
