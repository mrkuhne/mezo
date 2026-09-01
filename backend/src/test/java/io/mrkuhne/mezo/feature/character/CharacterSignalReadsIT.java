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
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.ProtocolPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
    @Autowired private MealPopulator mealPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private PantryItemPopulator pantryPopulator;
    @Autowired private ProtocolPopulator fuelPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;

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

    @Test
    void gather_fillsMealAndWaterSeries_withRealTargetsAndNovaShare() {
        UUID owner = owner();

        mealPopulator.createMealWithItems(owner, DAY, "dinner",
                List.of(new MealPopulator.Line("Csirke", "600", "50", "10", "20", (short) 1),
                        new MealPopulator.Line("Chips", "400", "5", "40", "25", (short) 4)));
        waterLogPopulator.createWaterLog(owner, DAY, 2500);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().mealDays()).singleElement().satisfies(m -> {
            assertThat(m.date()).isEqualTo(DAY);
            assertThat(m.kcal()).isEqualByComparingTo("1000");
            assertThat(m.proteinG()).isEqualByComparingTo("55");
            // both lines carry a NOVA class -> full coverage; 400 of 1000 kcal are NOVA-4
            assertThat(m.novaCoveragePct()).isEqualByComparingTo("1.0000");
            assertThat(m.nova4KcalShare()).isEqualByComparingTo("0.4000");
            // no active goal -> config fallback (mezo.nutrition.kcal / .p)
            assertThat(m.kcalTarget()).isEqualByComparingTo("3100");
            assertThat(m.proteinTarget()).isEqualByComparingTo("220");
            assertThat(m.meals()).singleElement().satisfies(p ->
                    assertThat(p.slot()).isEqualTo("dinner"));
        });
        assertThat(input.trend().waterDays()).singleElement().satisfies(w -> {
            assertThat(w.date()).isEqualTo(DAY);
            assertThat(w.amountMl()).isEqualTo(2500);
            assertThat(w.targetMl()).isEqualTo(4000);
        });
        // the 14-day mealDates presence set is still derived correctly from the same read
        assertThat(input.mealDates()).contains(DAY);
    }

    @Test
    void gather_boundsMealAndWaterAboveByDay_forCatchUp() {
        UUID owner = owner();

        mealPopulator.createMealWithItems(owner, DAY.plusDays(1), "lunch",
                List.of(new MealPopulator.Line("Későbbi", "500", "30", "40", "15", (short) 2)));
        waterLogPopulator.createWaterLog(owner, DAY.plusDays(1), 3000);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().mealDays()).isEmpty();
        assertThat(input.trend().waterDays()).isEmpty();
        assertThat(input.mealDates()).isEmpty();
    }

    @Test
    void gather_fillsCheckinScales_andKeepsCheckinCountSemantics() {
        UUID owner = owner();
        checkInPopulator.createCheckIn(owner, DAY, "06:30", 8, 3, 7, 8, null);
        checkInPopulator.createCheckIn(owner, DAY, "18:00", 6, 5, 7, 6, null);

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().checkinDays()).singleElement().satisfies(c -> {
            assertThat(c.date()).isEqualTo(DAY);
            assertThat(c.count()).isEqualTo(2);
            assertThat(c.energy()).isEqualByComparingTo("7.00");
            assertThat(c.stress()).isEqualByComparingTo("4.00");
        });
        // unchanged legacy semantics: an entry for every day of the 14-day window, zeros included
        assertThat(input.checkinCounts()).hasSize(14);
        assertThat(input.checkinCounts().get(DAY)).isEqualTo(2);
        assertThat(input.checkinCounts().get(DAY.minusDays(1))).isZero();
    }

    @Test
    void gather_medCycle_marksStaleDays_andBoundsAboveByDay() {
        UUID owner = owner();
        var med = medicationPopulator.createMedication(owner);
        medicationDosePopulator.createDose(owner, med.getId(), DAY.minusDays(2), new BigDecimal("6"));
        medicationDosePopulator.createDose(owner, med.getId(), DAY.plusDays(1), new BigDecimal("6")); // must not leak

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().med()).isNotNull();
        assertThat(input.trend().med().days()).anySatisfy(d -> {
            assertThat(d.date()).isEqualTo(DAY);
            assertThat(d.cycleDay()).isEqualTo(3);      // dose 2 days ago -> day 3, 1-based
            assertThat(d.daysSinceDose()).isEqualTo(2);
            assertThat(d.stale()).isFalse();
        });
        assertThat(input.trend().med().days()).noneMatch(d -> d.date().isAfter(DAY));
        // days more than one cycle after the last dose are marked stale, not silently clamped
        DetectorInput later = signalReads.gather(owner, DAY.plusDays(20));
        assertThat(later.trend().med().days()).anySatisfy(d -> {
            assertThat(d.date()).isEqualTo(DAY.plusDays(20));
            assertThat(d.stale()).isTrue();
        });
    }

    @Test
    void gather_absentStackAndMedication_readAsNull_notZero() {
        UUID owner = owner();

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().stack()).isNull();
        assertThat(input.trend().med()).isNull();
        assertThat(input.trend().mealDays()).isEmpty();
        assertThat(input.trend().waterDays()).isEmpty();
    }

    @Test
    void gather_stack_readsProtocolItemsAndIntakes_boundedAboveByDay() {
        UUID owner = owner();
        var creatine = pantryPopulator.createSupplement(owner, "Kreatin");
        var protocol = fuelPopulator.createActiveProtocol(owner);
        fuelPopulator.createProtocolItem(owner, protocol.getId(), creatine.getId(), "wake", null);
        supplementIntakePopulator.createIntake(owner, creatine.getId(), DAY, "wake");
        supplementIntakePopulator.createIntake(owner, creatine.getId(), DAY.plusDays(1), "wake");

        DetectorInput input = signalReads.gather(owner, DAY);

        assertThat(input.trend().stack()).isNotNull();
        assertThat(input.trend().stack().items()).singleElement().satisfies(i -> {
            assertThat(i.name()).isEqualTo("Kreatin");
            assertThat(i.slotKey()).isEqualTo("wake");
            // startedOn is carried so the detector can refuse to score days that PREDATE the item
            assertThat(i.startedOn()).isEqualTo(java.time.LocalDate.now());
        });
        assertThat(input.trend().stack().days()).singleElement().satisfies(d -> {
            assertThat(d.date()).isEqualTo(DAY);
            assertThat(d.takenPantryItemIds()).containsExactly(creatine.getId());
        });
    }
}
