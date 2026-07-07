package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.proactive.service.ChallengeJob;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ChallengePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** The daily outcome backstop resolves a due accepted challenge the lazy GET never re-opened. */
@ActiveProfiles("companion-fake")
class ChallengeJobIT extends AbstractIntegrationTest {

    @Autowired
    private ChallengeJob job;

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private ChallengePopulator challengePopulator;

    @Autowired
    private TrainPopulator trainPopulator;

    @Test
    void testRunOutcome_shouldResolveDueAcceptedChallenge_whenPastDayHasNoInstance() {
        UUID user = userPopulator.createUser("cj-out@test.local").getId();
        LocalDate past = LocalDate.now().minusDays(1);
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(user, meso.getId(), "Pull", "pull", 0, "planned");
        ExerciseEntity ex = trainPopulator.createExercise(user, template.getId(), "Chest Supported Row", 0);
        // Accepted, its workout day passed, and the user never logged an instance → honest inconclusive.
        ChallengeEntity c = challengePopulator.challengePr(
                user, template.getId(), past, ex.getId(), ChallengeEntity.STATUS_ACCEPTED, "80.00", 8);

        job.runOutcome();

        ChallengeEntity resolved = challengeRepository.findById(c.getId()).orElseThrow();
        assertThat(resolved.getStatus()).isEqualTo(ChallengeEntity.STATUS_INCONCLUSIVE);
        assertThat(resolved.getOutcomeGood()).isNull();
    }
}
