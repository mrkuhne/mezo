package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MedicationDosePopulator;
import io.mrkuhne.mezo.support.populator.MedicationPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-ned9 — the owner-zone proof for the three proactive gathers that derive their OWN "today"
 * for {@code ContextSnapshotAssembler.render(...)}: {@link ChallengeGenerator},
 * {@link ExperimentProposalGenerator} and {@link WeeklySuggestionGenerator}.
 *
 * <p>The bug this pins (the mezo-8h2s follow-up): those three passed a zero-arg
 * {@code LocalDate.now()} — the JVM default zone, i.e. UTC on CI and in containers — while every
 * other medication read derives its day in {@link MedicationCycleService#MEDICATION_ZONE}
 * (Europe/Budapest). Between the two midnights the rendered cycle day drifted by one against the
 * cycle day the Fuel screen and {@code MedicationCycleService#deriveToday} show.
 *
 * <p>Deterministic reproduction (the {@code LlmCallListMidnightIT} idiom, applied to the JVM
 * default zone instead of a configurable one — {@code MEDICATION_ZONE} is a constant, so it is the
 * DEFAULT that has to move): the default zone is swapped for a fixed offset zone whose current
 * wall-clock day is deliberately one day off the owner-local day, with two hours of headroom on
 * either side of its own midnight so a slow run cannot roll it back. Every run therefore exercises
 * the day-boundary split, not just runs that happen to start in the real window.
 *
 * <p>No class-level {@code @Transactional} — the {@code AppNotificationEmitter} deadlock precedent
 * of the sibling generator ITs. Isolation comes from {@code ResetDatabase}.
 *
 * <p><b>The {@code @AfterEach} zone restore is only safe because this suite runs SEQUENTIALLY in a
 * single Surefire fork.</b> {@link TimeZone#setDefault} is JVM-global: the moment this repo enables
 * JUnit parallel execution, the window between the flip and the restore becomes visible to every
 * concurrently running test and this class has to move to its own fork (or the shift has to stop
 * being global). Nothing here fails loudly if that happens — the neighbours do, confusingly.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.snapshot.checkin-note-max-chars=1000")
class ContextSnapshotOwnerZoneIT extends AbstractIntegrationTest {

    private static final ZoneId OWNER_ZONE = MedicationCycleService.MEDICATION_ZONE;

    /** The dose sits two days back, so the owner-local cycle day is always 3 of the 7-day cycle. */
    private static final int DOSE_DAYS_AGO = 2;
    private static final int EXPECTED_OWNER_CYCLE_DAY = DOSE_DAYS_AGO + 1;

    private TimeZone originalDefault;

    @Autowired private ChallengeGenerator challengeGenerator;
    @Autowired private OverloadChallengeGenerator overloadChallengeGenerator;
    @Autowired private ExperimentProposalGenerator experimentProposalGenerator;
    @Autowired private WeeklySuggestionGenerator weeklySuggestionGenerator;
    @Autowired private MedicationCycleService medicationCycleService;

    @Autowired private UserPopulator userPopulator;
    @Autowired private MedicationPopulator medicationPopulator;
    @Autowired private MedicationDosePopulator medicationDosePopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;

    @AfterEach
    void restoreDefaultZone() {
        if (originalDefault != null) {
            TimeZone.setDefault(originalDefault);
            originalDefault = null;
        }
    }

    /**
     * A fixed-offset zone whose CURRENT wall-clock date is one day away from the owner-local date.
     * Picks whichever of "22:00 yesterday" / "02:00 tomorrow" needs the smaller offset — one of the
     * two is always inside {@link ZoneOffset}'s ±18h range, and both keep two hours of clearance
     * from their own midnight.
     */
    private static ZoneOffset dayShiftedDefaultZone() {
        LocalDate ownerToday = LocalDate.now(OWNER_ZONE);
        LocalDateTime utcNow = LocalDateTime.now(ZoneOffset.UTC);
        long backwardSeconds =
                Duration.between(utcNow, ownerToday.minusDays(1).atTime(22, 0)).getSeconds();
        long forwardSeconds =
                Duration.between(utcNow, ownerToday.plusDays(1).atTime(2, 0)).getSeconds();
        long chosen = Math.abs(backwardSeconds) <= Math.abs(forwardSeconds)
                ? backwardSeconds : forwardSeconds;
        return ZoneOffset.ofTotalSeconds((int) chosen);
    }

    /** Flips the JVM default zone onto the day-shifted zone and pins that the two days differ. */
    private LocalDate shiftDefaultZoneOffOwnerDay() {
        originalDefault = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone(dayShiftedDefaultZone()));
        LocalDate ownerToday = LocalDate.now(OWNER_ZONE);
        assertThat(LocalDate.now())
                .as("the simulated default zone must sit on a different calendar day than %s", OWNER_ZONE)
                .isNotEqualTo(ownerToday);
        return ownerToday;
    }

    /** Active medication whose only dose is {@link #DOSE_DAYS_AGO} owner-local days back. */
    private void seedMedication(UUID user, LocalDate ownerToday) {
        MedicationEntity med = medicationPopulator.createMedication(user);
        medicationDosePopulator.createDose(
                user, med.getId(), ownerToday.minusDays(DOSE_DAYS_AGO), new BigDecimal("6"));
        assertThat(medicationCycleService.deriveToday(user, med).cycleDay())
                .isEqualTo(EXPECTED_OWNER_CYCLE_DAY);
    }

    private void assertOwnerLocalSnapshot(String payload, LocalDate ownerToday) {
        assertThat(payload)
                .as("the whole snapshot is rendered for the OWNER-local day, header included")
                .contains("pillanatkép — " + ownerToday + ")")
                .as("the medication block must agree with MedicationCycleService.deriveToday")
                .contains("ciklus " + EXPECTED_OWNER_CYCLE_DAY + ". nap");
    }

    @Test
    void testChallengeGather_shouldRenderOwnerLocalMedicationDay_whenDefaultZoneIsADayOff() {
        UUID user = userPopulator.createUser("ownerzone-challenge@test.local").getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Meso", "active");
        WorkoutSessionEntity session =
                trainPopulator.createWorkoutSession(user, meso.getId(), "Pull", "pull", 0, "planned");
        ExerciseEntity ex = trainPopulator.createExercise(user, session.getId(), "Chest Supported Row", 0);
        trainPopulator.createExerciseSet(user, ex.getId(), 0);

        LocalDate ownerToday = shiftDefaultZoneOffOwnerDay();
        seedMedication(user, ownerToday);

        ChallengeGenerator.Gather gather = challengeGenerator.gather(user, session.getId(), ownerToday);

        assertThat(gather).isNotNull();
        assertOwnerLocalSnapshot(gather.payload(), ownerToday);
    }

    /**
     * The other half of the ONE-derivation guarantee, and the reviewer's exact scenario: at UTC 22:30
     * (Budapest already tomorrow) the old default-zone gate ACCEPTED the default-zone day, persisted a
     * challenge stamped {@code workoutDate = D}, and fed the LLM a payload headed {@code D+1} whose
     * {@code Ma (terv)} described a different session entirely. Now the gate, the stamped
     * {@code workoutDate} and the snapshot day are one owner-local derivation.
     *
     * <p>A scripted {@code [fake-challenge:…]} sentinel rides the check-in note into the snapshot (the
     * {@code ChallengeGeneratorIT} idiom), so generation genuinely SUCCEEDS when the gate lets it
     * through — without it both calls would return empty on the unparseable answer and the assertion
     * would hold vacuously, proving nothing.
     */
    @Test
    void testChallengeGenerate_shouldStampOnlyTheOwnerLocalDay_whenDefaultZoneIsADayOff() {
        UUID user = userPopulator.createUser("ownerzone-challenge-gate@test.local").getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "Meso", "active");
        WorkoutSessionEntity session =
                trainPopulator.createWorkoutSession(user, meso.getId(), "Pull", "pull", 0, "planned");
        ExerciseEntity ex = trainPopulator.createExercise(user, session.getId(), "Chest Supported Row", 0);
        trainPopulator.createExerciseSet(user, ex.getId(), 0);

        LocalDate ownerToday = shiftDefaultZoneOffOwnerDay();
        seedMedication(user, ownerToday);
        checkInPopulator.createCheckIn(user, ownerToday, "20:00", 3, 2,
                "[fake-challenge:{\"challenges\":[{\"exerciseIndex\":0,\"type\":\"PR\","
                        + "\"targetWeightKg\":90.0,\"targetReps\":6,\"risk\":\"low\","
                        + "\"why\":\"Húzd meg a PR-t.\",\"glory\":\"Dicsőség.\","
                        + "\"refIndexes\":[0],\"patternIndex\":null}]}]");

        assertThat(challengeGenerator.generate(user, session.getId(), LocalDate.now()))
                .as("the default-zone day is NOT the owner-local day — nothing may be stamped with it")
                .isEmpty();
        assertThat(overloadChallengeGenerator.generate(user, session.getId(), LocalDate.now()))
                .as("the deterministic twin must accept exactly the same set of days")
                .isEmpty();

        List<ChallengeEntity> saved = challengeGenerator.generate(user, session.getId(), ownerToday);

        assertThat(saved).as("the owner-local day IS accepted — the gate is not simply broken").hasSize(1);
        assertThat(saved.getFirst().getWorkoutDate())
                .as("the stamped workoutDate is the same day the snapshot was rendered for")
                .isEqualTo(ownerToday);
        assertThat(saved.getFirst().getExerciseId()).isEqualTo(ex.getId());
    }

    @Test
    void testExperimentGather_shouldRenderOwnerLocalMedicationDay_whenDefaultZoneIsADayOff() {
        UUID user = userPopulator.createUser("ownerzone-experiment@test.local").getId();
        patternPopulator.statistical(user, "sleep~rpe", PatternEntity.STATUS_CONFIRMED);

        LocalDate ownerToday = shiftDefaultZoneOffOwnerDay();
        seedMedication(user, ownerToday);

        ExperimentProposalGenerator.Gather gather = experimentProposalGenerator.gather(user);

        assertThat(gather).isNotNull();
        assertOwnerLocalSnapshot(gather.payload(), ownerToday);
    }

    @Test
    void testWeeklySuggestionGather_shouldRenderOwnerLocalMedicationDay_whenDefaultZoneIsADayOff() {
        UUID user = userPopulator.createUser("ownerzone-weekly@test.local").getId();
        // the derivation WeeklySuggestionJob / ProactiveWeeklySuggestionService now use
        LocalDate weekStart =
                LocalDate.now(OWNER_ZONE).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        dailySummaryPopulator.summary(user, weekStart.minusDays(2), "Előző héten kemény edzés volt.");

        LocalDate ownerToday = shiftDefaultZoneOffOwnerDay();
        seedMedication(user, ownerToday);

        String payload = weeklySuggestionGenerator.gather(user, weekStart);

        assertThat(payload).isNotNull();
        assertOwnerLocalSnapshot(payload, ownerToday);
        // ONE derivation: weekStart and the snapshot day are both the ISO week of the owner-local
        // today, so the snapshot can never describe a day outside the week it is suggesting for.
        assertThat(ownerToday).isBetween(weekStart, weekStart.plusDays(6));
    }
}
