package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.proactive.service.ChallengeJob;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * The midnight pre-generation (mezo-n8nas): today's planned meso day gets its challenges before the
 * user opens the workout, so the prep Küldetések glass never waits on the LLM. Rest days and users
 * outside the presence window stay untouched (no LLM spend).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.techcore.cron.challenge-job.enabled=true")
class ChallengePregenerateJobIT extends AbstractIntegrationTest {

    @Autowired private ChallengeJob job;
    @Autowired private ChallengeRepository challengeRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private TrainPopulator trainPopulator;

    private static LocalDate today() {
        return LocalDate.now(MedicationCycleService.MEDICATION_ZONE);
    }

    private UUID seenUser(String email, Instant lastSeenAt) {
        AppUserEntity user = userPopulator.createUser(email);
        user.setLastSeenAt(lastSeenAt);
        return userPopulator.save(user).getId();
    }

    /** A meso template day on {@code date}'s weekday label, one exercise with logged-set history. */
    private WorkoutSessionEntity plantDay(UUID user, LocalDate date) {
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Meso", "active");
        String label = WorkoutService.HU_DAY_LABELS.get(date.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(user, meso.getId(), label, "pull", 0, "planned");
        ExerciseEntity ex = trainPopulator.createExercise(user, day.getId(), "Chest Supported Row", 0);
        trainPopulator.createExerciseSet(user, ex.getId(), 0);
        trainPopulator.createExerciseSet(user, ex.getId(), 1);
        return day;
    }

    private int challengesFor(UUID user, WorkoutSessionEntity day) {
        return challengeRepository
                .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(user, day.getId(), today())
                .size();
    }

    @Test
    void testRunPregenerate_shouldProposeTodaysChallenges_whenPlannedDayAndRecentlySeen() {
        UUID user = seenUser("cj-pregen@test.local", Instant.now());
        WorkoutSessionEntity day = plantDay(user, today());

        job.runPregenerate();

        assertThat(challengesFor(user, day)).isPositive();
    }

    @Test
    void testRunPregenerate_shouldBeIdempotent_whenRunTwice() {
        UUID user = seenUser("cj-pregen-twice@test.local", Instant.now());
        WorkoutSessionEntity day = plantDay(user, today());

        job.runPregenerate();
        int first = challengesFor(user, day);
        job.runPregenerate();

        assertThat(challengesFor(user, day)).isEqualTo(first);
    }

    @Test
    void testRunPregenerate_shouldSkip_whenUserNotSeenInPresenceWindow() {
        UUID user = seenUser("cj-pregen-away@test.local", Instant.now().minus(30, ChronoUnit.DAYS));
        WorkoutSessionEntity day = plantDay(user, today());

        job.runPregenerate();

        assertThat(challengesFor(user, day)).isZero();
    }

    @Test
    void testRunPregenerate_shouldSkip_whenTodayIsRestDay() {
        UUID user = seenUser("cj-pregen-rest@test.local", Instant.now());
        WorkoutSessionEntity tomorrowDay = plantDay(user, today().plusDays(1));

        job.runPregenerate();

        assertThat(challengesFor(user, tomorrowDay)).isZero();
    }
}
