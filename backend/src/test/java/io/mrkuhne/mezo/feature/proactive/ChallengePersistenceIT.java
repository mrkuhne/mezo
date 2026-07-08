package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ChallengePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ChallengePersistenceIT extends AbstractIntegrationTest {

    private static final LocalDate WORKOUT_DATE = LocalDate.parse("2026-07-07");

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private ChallengePopulator populator;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private TrainPopulator trainPopulator;

    /** Plants a template workout_session + exercise owned by {@code user}; returns [sessionId, exerciseId]. */
    private UUID[] plantSessionAndExercise(UUID user) {
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Teszt meso", "active");
        WorkoutSessionEntity session = trainPopulator.createWorkoutSession(
            user, meso.getId(), "H", "gym", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(
            user, session.getId(), "Chest Supported Row", 0);
        return new UUID[] {session.getId(), exercise.getId()};
    }

    @Test
    void testSave_shouldRoundTripProposedRow_whenPersisted() {
        UUID user = userPopulator.createUser("chl-rt@test.local").getId();
        UUID[] fk = plantSessionAndExercise(user);
        populator.challenge(user, fk[0], WORKOUT_DATE, fk[1],
            ChallengeEntity.TYPE_PR, ChallengeEntity.STATUS_PROPOSED);

        ChallengeEntity found = challengeRepository
            .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(user, fk[0], WORKOUT_DATE)
            .getFirst();

        assertThat(found.getStatus()).isEqualTo(ChallengeEntity.STATUS_PROPOSED);
        assertThat(found.getRisk()).isEqualTo(ChallengeEntity.RISK_LOW);
        assertThat(found.getTargetWeightKg()).isNull();
        assertThat(found.getTargetReps()).isNull();
        assertThat(found.getTargetSets()).isNull();
        assertThat(found.getTargetRir()).isNull();
        assertThat(found.getConfidence()).isNull();
        assertThat(found.getOutcome()).isNull();
        assertThat(found.getOutcomeGood()).isNull();
        assertThat(found.getRefs()).isNotNull();
        assertThat(found.getRefs().refs()).isEmpty();
    }

    @Test
    void testSave_shouldRejectRow_whenStatusOutsideVocabulary() {
        UUID user = userPopulator.createUser("chl-ck@test.local").getId();
        UUID[] fk = plantSessionAndExercise(user);

        ChallengeEntity bad = new ChallengeEntity();
        bad.setCreatedBy(user);
        bad.setTemplateSessionId(fk[0]);
        bad.setWorkoutDate(WORKOUT_DATE);
        bad.setExerciseId(fk[1]);
        bad.setExerciseName("Chest Supported Row");
        bad.setType(ChallengeEntity.TYPE_PR);
        bad.setStatus("nope");
        bad.setTitle("t");
        bad.setWhy("w");
        bad.setGlory("g");
        bad.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));

        // No entity @Pattern here — the DB status CHECK is the guard.
        assertThatThrownBy(() -> challengeRepository.saveAndFlush(bad))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testFind_shouldScopeToOwner_whenAnotherUserSharesSessionAndDate() {
        UUID user = userPopulator.createUser("chl-own@test.local").getId();
        UUID other = userPopulator.createUser("chl-other@test.local").getId();
        UUID[] fk = plantSessionAndExercise(user);

        populator.challenge(user, fk[0], WORKOUT_DATE, fk[1],
            ChallengeEntity.TYPE_PR, ChallengeEntity.STATUS_PROPOSED);
        // Same session/date, but owned by the other user — must NOT surface for `user`.
        populator.challenge(other, fk[0], WORKOUT_DATE, fk[1],
            ChallengeEntity.TYPE_VOLUME, ChallengeEntity.STATUS_PROPOSED);

        List<ChallengeEntity> mine = challengeRepository
            .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(user, fk[0], WORKOUT_DATE);

        assertThat(mine).hasSize(1);
        assertThat(mine.getFirst().getCreatedBy()).isEqualTo(user);
    }
}
