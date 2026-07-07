package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.service.ChallengeGenerator;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * The {@code [fake-challenge:{…}]} sentinel rides a check-in note — the gather renders the V0.3
 * snapshot, so the check-in channel IS in the payload the fake matches on. The snapshot's verbatim
 * check-in-note window is widened here so multi-proposal scripts survive un-truncated into the fake.
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.snapshot.checkin-note-max-chars=1000")
class ChallengeGeneratorIT extends AbstractIntegrationTest {

    @Autowired
    private ChallengeGenerator generator;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private TrainPopulator trainPopulator;

    @Autowired
    private CheckInPopulator checkInPopulator;

    /** Template session + one exercise with logged-set history (the grounding gate passes). */
    private ExerciseEntity seedTemplateWithHistory(UUID user, WorkoutSessionEntity session) {
        ExerciseEntity ex = trainPopulator.createExercise(user, session.getId(), "Chest Supported Row", 0);
        trainPopulator.createExerciseSet(user, ex.getId(), 0);   // weight 82.50, reps 8
        trainPopulator.createExerciseSet(user, ex.getId(), 1);
        return ex;
    }

    private WorkoutSessionEntity templateSession(UUID user) {
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Meso", "active");
        return trainPopulator.createWorkoutSession(user, meso.getId(), "Pull", "pull", 0, "planned");
    }

    @Test
    void testGenerate_shouldReturnEmpty_whenDateIsNotToday() {
        UUID user = userPopulator.createUser("chg-past@test.local").getId();
        assertThat(generator.generate(user, UUID.randomUUID(), LocalDate.now().minusDays(1))).isEmpty();
    }

    @Test
    void testGenerate_shouldReturnEmpty_whenExerciseHasNoLoggedHistory() {
        UUID user = userPopulator.createUser("chg-nohist@test.local").getId();
        WorkoutSessionEntity session = templateSession(user);
        trainPopulator.createExercise(user, session.getId(), "Lat Pulldown", 0);   // no sets
        assertThat(generator.generate(user, session.getId(), LocalDate.now())).isEmpty();
    }

    @Test
    void testGenerate_shouldPersistScriptedPrChallenge_whenSentinelPlanted() {
        UUID user = userPopulator.createUser("chg-gen@test.local").getId();
        WorkoutSessionEntity session = templateSession(user);
        ExerciseEntity ex = seedTemplateWithHistory(user, session);
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-challenge:{\"challenges\":[{\"exerciseIndex\":0,\"type\":\"PR\","
                        + "\"targetWeightKg\":90.0,\"targetReps\":6,\"risk\":\"low\","
                        + "\"why\":\"Húzd meg a PR-t.\",\"glory\":\"Dicsőség.\","
                        + "\"refIndexes\":[0],\"patternIndex\":null}]}]");

        List<ChallengeEntity> saved = generator.generate(user, session.getId(), LocalDate.now());

        assertThat(saved).hasSize(1);
        ChallengeEntity c = saved.getFirst();
        assertThat(c.getType()).isEqualTo(ChallengeEntity.TYPE_PR);
        assertThat(c.getStatus()).isEqualTo(ChallengeEntity.STATUS_PROPOSED);
        assertThat(c.getExerciseId()).isEqualTo(ex.getId());
        assertThat(c.getExerciseName()).isEqualTo("Chest Supported Row");
        assertThat(c.getTargetWeightKg()).isEqualByComparingTo("90.0");
        assertThat(c.getTargetReps()).isEqualTo(6);
        assertThat(c.getWhy()).isEqualTo("Húzd meg a PR-t.");
        assertThat(c.getRefs().refs()).hasSize(1);
        assertThat(c.getConfidence()).isNull();   // patternIndex null — never fabricated
    }

    @Test
    void testGenerate_shouldDropProposal_whenRequiredTargetFieldMissing() {
        UUID user = userPopulator.createUser("chg-drop@test.local").getId();
        WorkoutSessionEntity session = templateSession(user);
        seedTemplateWithHistory(user, session);
        // Depth requires targetRir — omitted here ⇒ unevaluatable ⇒ dropped
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-challenge:{\"challenges\":[{\"exerciseIndex\":0,\"type\":\"Depth\","
                        + "\"targetRir\":null,\"risk\":\"low\",\"why\":\"Menj mélyre.\","
                        + "\"glory\":\"Dicsőség.\",\"refIndexes\":[],\"patternIndex\":null}]}]");

        assertThat(generator.generate(user, session.getId(), LocalDate.now())).isEmpty();
    }

    @Test
    void testGenerate_shouldCapAtMaxPerWorkout_whenModelProposesMore() {
        UUID user = userPopulator.createUser("chg-cap@test.local").getId();
        WorkoutSessionEntity session = templateSession(user);
        seedTemplateWithHistory(user, session);
        StringBuilder proposals = new StringBuilder();
        for (int i = 0; i < 5; i++) {
            if (i > 0) {
                proposals.append(",");
            }
            // kept minimal: check_in.note is varchar(500)
            proposals.append("{\"exerciseIndex\":0,\"type\":\"PR\",\"targetWeightKg\":90,")
                    .append("\"targetReps\":6,\"why\":\"i").append(i).append("\",\"glory\":\"g\"}");
        }
        checkInPopulator.createCheckIn(user, LocalDate.now(), "20:00", 3, 2,
                "[fake-challenge:{\"challenges\":[" + proposals + "]}]");

        assertThat(generator.generate(user, session.getId(), LocalDate.now())).hasSize(3);
    }
}
