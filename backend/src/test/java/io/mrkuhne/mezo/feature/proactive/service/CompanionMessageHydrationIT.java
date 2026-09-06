package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FeedMessageResponse;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S2 (bd mezo-d58h.7.2, spec §12) — the two hydration channels: the FACT block the
 * midday/evening window payload carries, and the ~15:00 checkpoint row. Lives in the
 * {@code ...proactive.service} package so it can assert the package-private block builder and the
 * clock-explicit checkpoint overload directly (the {@code CompanionMessageMissedWorkoutsIT}
 * precedent), instead of guessing at prompt text through a scripted answer.
 *
 * <p>Anchor arithmetic (06:45 wake / 23:15 bed, 4000 ml target): at 15:00 the waking day is
 * exactly half elapsed ⇒ a 2000 ml pro-rated target and a 1200 ml firing line.
 */
class CompanionMessageHydrationIT extends AbstractIntegrationTest {

    private static final LocalTime AT_15 = LocalTime.of(15, 0);

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private ProactiveFeedService proactiveFeedService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private TrainPopulator trainPopulator;

    private UUID trainingUser(LocalDate day) {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        trainPopulator.createGymSlot(owner, day.getDayOfWeek().getValue() - 1, "18:00");
        return owner;
    }

    @Test
    void testHydrationBlock_shouldCarryTheRealNumbers_whenTheShortfallHolds() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        String block = companionMessageGenerator.hydrationBlock(owner, day, AT_15);

        assertThat(block).contains("HIDRATÁCIÓ").contains("400").contains("2000").contains("4000");
    }

    @Test
    void testHydrationBlock_shouldBeEmpty_whenThereIsNoShortfall() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 3000);

        assertThat(companionMessageGenerator.hydrationBlock(owner, day, AT_15)).isEmpty();
    }

    /** Rest day: the block never appears, however little water was logged. */
    @Test
    void testHydrationBlock_shouldBeEmpty_whenItIsNotATrainingDay() {
        LocalDate day = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        waterLogPopulator.createWaterLog(owner, day, 100);

        assertThat(companionMessageGenerator.hydrationBlock(owner, day, AT_15)).isEmpty();
    }

    @Test
    void testHydrationCheckpoint_shouldWriteOneDeterministicRow_whenTheShortfallHolds() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        CompanionMessageEntity message =
            companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_HYDRATION);
        assertThat(message.getContent().eyebrow()).isEqualTo("Hidratáció");
        assertThat(message.getContent().body()).hasSize(1);
        assertThat(message.getContent().body().getFirst())
            .contains("400").contains("2000").contains("4000");
    }

    @Test
    void testHydrationCheckpoint_shouldWriteNothing_whenThereIsNoShortfall() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 3000);

        assertThat(companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15)).isNull();
    }

    /** One checkpoint per user per day: the second call returns the SAME row, never a second one
     *  (the partial unique index would reject it anyway — this is the graceful path). */
    @Test
    void testHydrationCheckpoint_shouldBeIdempotent_whenCalledTwice() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        CompanionMessageEntity first =
            companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);
        CompanionMessageEntity second =
            companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);

        assertThat(second.getId()).isEqualTo(first.getId());
    }

    /** The generated {@code FeedMessageResponse.KindEnum} mirror: without 'hydration' in the
     *  OpenAPI enum, this read throws for the WHOLE day, not just for this row. */
    @Test
    void testHydrationCheckpoint_shouldSurviveTheFeedReadPath_whenItExists() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);
        companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);

        assertThat(proactiveFeedService.getFeed(owner, day))
            .extracting(FeedMessageResponse::getKind)
            .contains(FeedMessageResponse.KindEnum.HYDRATION);
    }
}
