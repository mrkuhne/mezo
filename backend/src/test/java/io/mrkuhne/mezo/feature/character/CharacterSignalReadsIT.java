package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.character.service.CharacterSignalReads;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the read-side widening of {@code CharacterSignalReads} (mezo-1gim.15): gym/sport/run/
 * sleep/meso slices land correctly, catch-up honesty holds the upper bound at {@code day} across
 * every new slice (incl. the 8-week trend window), and a fresh owner with no active meso reads out
 * as an honest empty/null shape rather than throwing.
 */
@ActiveProfiles("companion-fake")
class CharacterSignalReadsIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 26);

    @Autowired private CharacterSignalReads signalReads;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private RunningPopulator runningPopulator;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void gather_fillsTrainSleepAndMesoSlices() {
        UUID owner = owner();

        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Mell nap");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        WorkoutSessionEntity instance = trainPopulator.createWorkoutInstance(owner, template, DAY, "completed");
        trainPopulator.createLoggedSet(owner, exercise.getId(), instance.getId(), 0, "60", 8, 1);
        trainPopulator.createLoggedSet(owner, exercise.getId(), instance.getId(), 1, "60", 7, 1);

        trainPopulator.createSportSessionWithRpe(owner, DAY.minusDays(1), 8);

        RunningBlockEntity block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLog(owner, block.getId(), 1, "tue-sprint", DAY.minusDays(2),
                6, 7, 90, null, 30);

        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("6.5"), 5);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.gymDays()).anySatisfy(g -> {
            assertThat(g.date()).isEqualTo(DAY);
            assertThat(g.exercises()).singleElement().satisfies(e -> {
                assertThat(e.exerciseName()).isEqualTo("Fekvenyomás");
                assertThat(e.workingSets()).isEqualTo(2);
            });
        });
        assertThat(input.sportSessions()).singleElement().satisfies(s -> {
            assertThat(s.date()).isEqualTo(DAY.minusDays(1));
            assertThat(s.shoulderStrain()).isNull();
            assertThat(s.rpe()).isEqualByComparingTo("8");
        });
        assertThat(input.runLogs()).singleElement().satisfies(r -> {
            assertThat(r.date()).isEqualTo(DAY.minusDays(2));
            assertThat(r.rpeActual()).isEqualTo(7);
            assertThat(r.hrRecoverySec()).isEqualTo(90);
        });
        assertThat(input.sleepPoints()).singleElement().satisfies(s -> {
            assertThat(s.date()).isEqualTo(DAY);
            assertThat(s.quality()).isEqualTo(5);
        });
        assertThat(input.meso()).isNotNull();
        assertThat(input.meso().title()).isEqualTo(meso.getTitle());
        boolean expectedDeload = "Deload".equalsIgnoreCase(meso.getPhaseCurve().get(meso.getCurrentWeek() - 1));
        assertThat(input.meso().deloadWeek()).isEqualTo(expectedDeload);
        assertThat(input.trend().runsEightWeeks()).extracting(DetectorInput.RunPoint::date)
                .contains(DAY.minusDays(2));
    }

    @Test
    void gather_boundsAboveByDay_forCatchUp() {
        UUID owner = owner();

        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity template = trainPopulator.createTemplateDay(owner, meso.getId(), "Mell nap");
        trainPopulator.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        trainPopulator.createWorkoutInstance(owner, template, DAY.plusDays(1), "completed");

        trainPopulator.createSportSessionWithRpe(owner, DAY.plusDays(1), 8);

        RunningBlockEntity block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLog(owner, block.getId(), 1, "tue-sprint", DAY.plusDays(1),
                6, 7, 90, null, 30);

        sleepLogPopulator.createSleepLog(owner, DAY.plusDays(1), new BigDecimal("6.5"), 5);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.gymDays()).noneMatch(g -> g.date().equals(DAY.plusDays(1)));
        assertThat(input.trend().gymEightWeeks()).noneMatch(g -> g.date().equals(DAY.plusDays(1)));
        assertThat(input.sportSessions()).noneMatch(s -> s.date().equals(DAY.plusDays(1)));
        assertThat(input.runLogs()).noneMatch(r -> r.date().equals(DAY.plusDays(1)));
        assertThat(input.trend().runsEightWeeks()).noneMatch(r -> r.date().equals(DAY.plusDays(1)));
        assertThat(input.sleepPoints()).noneMatch(s -> s.date().equals(DAY.plusDays(1)));
    }

    @Test
    void gather_nullMeso_whenNoActive() {
        UUID owner = databasePopulator.populateUser("character-signal-reads-second@test.local");

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.meso()).isNull();
        assertThat(input.gymDays()).isEmpty();
        assertThat(input.sportSessions()).isEmpty();
        assertThat(input.runLogs()).isEmpty();
        assertThat(input.sleepPoints()).isEmpty();
        assertThat(input.trend().runsEightWeeks()).isEmpty();
        assertThat(input.trend().gymEightWeeks()).isEmpty();
    }
}
