package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.companion.entity.DayReviewEntity;
import io.mrkuhne.mezo.feature.companion.repository.DayReviewRepository;
import io.mrkuhne.mezo.feature.companion.service.DayReviewLlm;
import io.mrkuhne.mezo.feature.companion.service.DayReviewWarmupJob;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * A napom S1 end to end (spec 2026-09-24 §1): the overnight job closes YESTERDAY's review so the
 * morning read is a cache hit, it never pays twice for an unchanged day, and a late log costs
 * exactly one more call.
 *
 * <p>The {@code companion-fake} profile's LLM echoes the prompt instead of answering JSON, so it
 * never produces a row. This class therefore puts a hand-written, call-counting {@link DayReviewLlm}
 * fake in front of the real adapter ({@code @Primary}, the {@code ReflectionDigestMorningIT}
 * precedent — a fake at the port, not a Mockito mock). Per-user failure isolation and the date
 * loop are pinned by {@code DayReviewWarmupJobTest}.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.day-review-warmup-job.enabled=true")
@Import(DayReviewWarmupJobIT.CountingLlmConfiguration.class)
class DayReviewWarmupJobIT extends AbstractIntegrationTest {

    /** A fixed, valid review envelope — enough for the service to parse and persist a row. */
    private static final String REVIEW_ANSWER = "{\"narrative\":[\"Egy nyugodt, teljes nap volt.\"]}";

    /** Counts every completion so a silently-lost cache cannot pass as "no extra call". */
    static class CountingDayReviewLlm implements DayReviewLlm {

        private final AtomicInteger calls = new AtomicInteger();

        int calls() {
            return calls.get();
        }

        void reset() {
            calls.set(0);
        }

        @Override
        public String complete(String systemPrompt, String userMessage) {
            calls.incrementAndGet();
            return REVIEW_ANSWER;
        }
    }

    @TestConfiguration
    static class CountingLlmConfiguration {

        @Bean
        @Primary
        CountingDayReviewLlm countingDayReviewLlm() {
            return new CountingDayReviewLlm();
        }
    }

    @Autowired private DayReviewWarmupJob job;
    @Autowired private CountingDayReviewLlm llm;
    @Autowired private DayReviewRepository dayReviewRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private FuelDayService fuelDayService;

    @BeforeEach
    void resetCounter() {
        llm.reset();
    }

    @Test
    void testRun_shouldWriteYesterdaysReviewOnce_andRewriteItOnlyAfterALateLog() {
        UUID user = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        seedDenseDay(user, yesterday);

        job.run();

        DayReviewEntity first = dayReviewRepository.findByCreatedByAndDate(user, yesterday).orElseThrow();
        assertThat(first.getEnvelope().narrative()).containsExactly("Egy nyugodt, teljes nap volt.");
        int afterFirstRun = llm.calls();
        assertThat(afterFirstRun).isEqualTo(1);

        // unchanged day -> the hash still matches -> a cache hit, no second call
        job.run();
        assertThat(llm.calls()).isEqualTo(afterFirstRun);

        // a late log changes the day's facts -> exactly ONE regeneration, same row
        seedMeal(user, yesterday);
        job.run();
        assertThat(llm.calls()).isEqualTo(afterFirstRun + 1);
        DayReviewEntity rewritten = dayReviewRepository.findByCreatedByAndDate(user, yesterday).orElseThrow();
        assertThat(rewritten.getId()).isEqualTo(first.getId());
        assertThat(rewritten.getInputsHash()).isNotEqualTo(first.getInputsHash());
    }

    /** {@code DayEvaluationApiIT.seedDenseDay} — sleep + an at-target meal + all four check-ins +
     *  a workout, so every dimension has something to score and the closed day is {@code scored}. */
    private void seedDenseDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("8.0"), 10);
        seedMeal(owner, date);
        checkInPopulator.createCheckIn(owner, date, "08:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "12:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "16:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "20:00", 10, 5, null);
        trainPopulator.createSportSession(owner, date);
    }

    /** A pantry-arm meal whose consumed kcal/protein land exactly on the day's targets. */
    private void seedMeal(UUID owner, LocalDate date) {
        MacroSet targets = fuelDayService.getDay(owner, date).getTargets();
        PantryItemEntity item =
            pantryItemPopulator.createFood(owner, "warmup-food-" + UUID.randomUUID(), null);

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        meal.setLoggedAt(date.atTime(LocalTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MINUTES))
            .toInstant(ZoneOffset.UTC));
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Warm-up fixture");

        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(0);
        line.setSource("pantry");
        line.setPantryItemId(item.getId());
        line.setAmount(BigDecimal.ONE);
        line.setUnit("g");
        line.setSnapshotName(item.getCatalog().getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(BigDecimal.valueOf(targets.getKcal().doubleValue()));
        line.setSnapshotProteinG(BigDecimal.valueOf(targets.getP().doubleValue()));
        line.setSnapshotCarbsG(BigDecimal.TEN);
        line.setSnapshotFatG(BigDecimal.ONE);
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        mealRepository.saveAndFlush(meal);
    }
}
