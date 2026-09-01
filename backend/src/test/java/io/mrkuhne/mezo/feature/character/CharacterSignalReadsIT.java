package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.character.service.CharacterSignalReads;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.intention.entity.DailyIntentionEntity;
import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import io.mrkuhne.mezo.feature.intention.repository.DailyIntentionRepository;
import io.mrkuhne.mezo.feature.intention.repository.IntentionFocusRepository;
import io.mrkuhne.mezo.feature.journal.entity.DecisionContextEnvelope;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.journal.repository.GratitudeEntryRepository;
import io.mrkuhne.mezo.feature.needs.entity.NeedsDayEntity;
import io.mrkuhne.mezo.feature.needs.repository.NeedsDayRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
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
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
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
    @Autowired private IntentionFocusRepository intentionFocusRepository;
    @Autowired private DailyIntentionRepository dailyIntentionRepository;
    @Autowired private DecisionEntryRepository decisionEntryRepository;
    @Autowired private NeedsDayRepository needsDayRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private CheckInRepository checkInRepository;
    @Autowired private SleepLogRepository sleepLogRepository;
    @Autowired private GratitudeEntryRepository gratitudeEntryRepository;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;

    /** Owner shared by the round-3 read-layer tests below, which reference {@code owner} bare
     *  (no local shadow) — the other tests in this file keep their own {@code UUID owner = owner();}
     *  local convention, which simply shadows this field. */
    private UUID owner;

    @BeforeEach
    void setUpSharedOwner() {
        owner = owner();
    }

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private IntentionFocusEntity saveFocus(LocalDate date, String text) {
        IntentionFocusEntity e = new IntentionFocusEntity();
        e.setCreatedBy(owner);
        e.setFocusDate(date);
        e.setText(text);
        return intentionFocusRepository.saveAndFlush(e);
    }

    private DailyIntentionEntity saveReflection(LocalDate date, String reflection) {
        DailyIntentionEntity e = new DailyIntentionEntity();
        e.setCreatedBy(owner);
        e.setIntentionDate(date);
        e.setReflection(reflection);
        return dailyIntentionRepository.saveAndFlush(e);
    }

    /** {@code @CreationTimestamp} stamps {@code created_at} at real wall-clock "now" on insert,
     *  which is AFTER every fixed {@code day} these tests use — so {@code writtenOn} is backdated
     *  to {@code decidedOn} afterwards via a plain JDBC update (the {@code LlmLogPopulator.logAt}
     *  precedent), avoiding the self-invocation trap a {@code @Transactional} helper on this
     *  non-transactional {@link ApiIntegrationTest} would hit. */
    private DecisionEntryEntity saveDecision(LocalDate decidedOn, LocalDate reviewDue, String text) {
        DecisionEntryEntity e = new DecisionEntryEntity();
        e.setCreatedBy(owner);
        e.setDecidedOn(decidedOn);
        e.setDecisionText(text);
        e.setContextSnapshot(new DecisionContextEnvelope(null, java.time.Instant.now()));
        e.setReviewDue(reviewDue);
        DecisionEntryEntity saved = decisionEntryRepository.saveAndFlush(e);
        jdbcTemplate.update("update decision_entry set created_at = ? where id = ?",
                Timestamp.from(decidedOn.atStartOfDay(ZoneId.systemDefault()).toInstant()), saved.getId());
        return decisionEntryRepository.findById(saved.getId()).orElseThrow();
    }

    private NeedsDayEntity saveNeedsDay(LocalDate date, int energia, int hidratacio, int pihenes,
            int mozgas, int lelek, int rend, int greenCount, boolean allGreen, int streakDays) {
        NeedsDayEntity e = new NeedsDayEntity();
        e.setCreatedBy(owner);
        e.setNeedsDate(date);
        e.setEnergia(energia);
        e.setHidratacio(hidratacio);
        e.setPihenes(pihenes);
        e.setMozgas(mozgas);
        e.setLelek(lelek);
        e.setRend(rend);
        e.setGreenCount(greenCount);
        e.setAllGreen(allGreen);
        e.setStreakDays(streakDays);
        return needsDayRepository.saveAndFlush(e);
    }

    private CheckInEntity saveCheckIn(LocalDate date, String slotTime, Integer energy, Integer stress,
            Integer body, Integer mental, String note) {
        return checkInPopulator.createCheckIn(owner, date, slotTime, energy, stress, body, mental, note);
    }

    /** {@code @CreationTimestamp} stamps {@code created_at} at real wall-clock "now" on insert,
     *  which is AFTER every fixed {@code day} these tests use — so {@code createdAt} is backdated
     *  to {@code date} afterwards via a plain JDBC update (the {@code saveDecision} precedent). */
    private SleepLogEntity saveSleep(LocalDate date, Integer quality, BigDecimal durationH,
            Integer awakenings) {
        SleepLogEntity e = new SleepLogEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setQuality(quality);
        e.setDurationH(durationH);
        e.setAwakenings(awakenings);
        SleepLogEntity saved = sleepLogRepository.saveAndFlush(e);
        jdbcTemplate.update("update sleep_log set created_at = ? where id = ?",
                Timestamp.from(date.atStartOfDay(ZoneId.systemDefault()).toInstant()), saved.getId());
        return sleepLogRepository.findById(saved.getId()).orElseThrow();
    }

    /** Same real-wall-clock-{@code createdAt} problem as {@link #saveSleep}; backdated identically. */
    private GratitudeEntryEntity saveGratitude(LocalDate date, String text, String lifeArea) {
        GratitudeEntryEntity e = new GratitudeEntryEntity();
        e.setCreatedBy(owner);
        e.setOccurredOn(date);
        e.setText(text);
        e.setLifeArea(lifeArea);
        GratitudeEntryEntity saved = gratitudeEntryRepository.saveAndFlush(e);
        jdbcTemplate.update("update gratitude_entry set created_at = ? where id = ?",
                Timestamp.from(date.atStartOfDay(ZoneId.systemDefault()).toInstant()), saved.getId());
        return gratitudeEntryRepository.findById(saved.getId()).orElseThrow();
    }

    /** {@code @CreationTimestamp} stamps {@code created_at} at real wall-clock "now" on insert, so
     *  it is backdated to {@code at} afterwards via a plain JDBC update — the {@code saveDecision}
     *  precedent above. */
    private void saveUserMessage(LocalDateTime at) {
        AiConversationEntity conversation = aiConversationPopulator.conversation(owner);
        AiMessageEntity message = aiMessagePopulator.message(conversation, "user", "teszt üzenet");
        jdbcTemplate.update("update ai_message set created_at = ? where id = ?",
                Timestamp.from(at.atZone(ZoneId.systemDefault()).toInstant()), message.getId());
    }

    private static LocalDate localDateOf(Instant at) {
        return at.atZone(ZoneId.systemDefault()).toLocalDate();
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

    @Test
    void gather_shouldPairFocusCountWithReflection_andKeepUnclosedDaysWithNullReflection() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveFocus(day.minusDays(1), "reggeli fókusz");
        saveFocus(day.minusDays(1), "második fókusz");
        saveReflection(day.minusDays(1), DailyIntentionEntity.REFLECTION_PARTIAL);
        saveFocus(day, "csak fókusz, lezárás nélkül");

        List<DetectorInput.IntentionDayPoint> days = signalReads.gather(owner, day).trend().intentionDays();

        assertThat(days).hasSize(2);
        assertThat(days.get(0).focusCount()).isEqualTo(2);
        assertThat(days.get(0).reflection()).isEqualTo(DailyIntentionEntity.REFLECTION_PARTIAL);
        assertThat(days.get(1).focusCount()).isEqualTo(1);
        assertThat(days.get(1).reflection()).isNull();
    }

    @Test
    void gather_shouldTreatAReviewAfterTheObservedDay_asStillUnreviewed() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        DecisionEntryEntity e = saveDecision(day.minusDays(10), day.minusDays(3), "döntés szövege");
        e.setReviewedAt(day.plusDays(2).atStartOfDay(ZoneId.systemDefault()).toInstant());
        e.setOutcomeRating((short) 5);
        decisionEntryRepository.save(e);

        DetectorInput.DecisionPoint p = signalReads.gather(owner, day).trend().decisions().getFirst();

        assertThat(p.reviewedOn()).isNull();
        assertThat(p.outcomeRating()).isNull();
    }

    @Test
    void gather_shouldReturnNullNeedsContext_whenNoDayWasEverClosed() {
        assertThat(signalReads.gather(owner, LocalDate.of(2026, 5, 20)).trend().needs()).isNull();
    }

    @Test
    void gather_shouldCarryTheConfiguredGreenThreshold_andThePerDayStreakSnapshot() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveNeedsDay(day.minusDays(1), 80, 80, 80, 80, 80, 80, 6, true, 4);
        saveNeedsDay(day, 80, 30, 80, 80, 80, 80, 5, false, 0);

        DetectorInput.NeedsContext ctx = signalReads.gather(owner, day).trend().needs();

        assertThat(ctx.greenThreshold()).isEqualTo(60);
        assertThat(ctx.days()).extracting(DetectorInput.NeedsDayPoint::streakDays)
                .containsExactly(4, 0);
    }

    @Test
    void gather_shouldTruncateDecisionEvidence_andNeverExceedTheEvidenceBudget() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveDecision(day.minusDays(2), day.plusDays(5), "x".repeat(400));

        String preview = signalReads.gather(owner, day).trend().decisions().getFirst().textPreview();

        assertThat(preview).hasSizeLessThanOrEqualTo(121).endsWith("…");
    }

    @Test
    void gather_shouldUseCreatedAtNotSavedAt_forTheCheckinWriteTime() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        CheckInEntity c = saveCheckIn(day, "07:00", 6, 4, 6, 6, null);
        c.setSavedAt(day.plusDays(3).atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant());
        checkInRepository.save(c);

        DetectorInput.CheckinSlotPoint p = signalReads.gather(owner, day).trend().checkinSlots().getFirst();

        assertThat(p.writtenAt().toLocalDate()).isEqualTo(localDateOf(c.getCreatedAt()));
        assertThat(p.slotTime()).isEqualTo("07:00");
    }

    @Test
    void gather_shouldTagLatenciesByGenre_andDropRecordsWrittenAfterTheObservedDay() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveSleep(day.minusDays(1), 7, new BigDecimal("7.5"), 1);
        saveGratitude(day.minusDays(1), "hála", "connection");
        // written genuinely AFTER `day` — must be dropped, unlike the two same-day rows above.
        GratitudeEntryEntity late = saveGratitude(day.minusDays(2), "később írt hála", "connection");
        jdbcTemplate.update("update gratitude_entry set created_at = ? where id = ?",
                Timestamp.from(day.plusDays(3).atStartOfDay(ZoneId.systemDefault()).toInstant()),
                late.getId());

        List<DetectorInput.LogLatencyPoint> pts = signalReads.gather(owner, day).trend().logLatencies();

        assertThat(pts).extracting(DetectorInput.LogLatencyPoint::genre)
                .containsOnly("esemeny", "reflexio");
        assertThat(pts).allSatisfy(p -> assertThat(p.writtenDate()).isBeforeOrEqualTo(day));
        // the late-written row's about-date must NOT surface — proves the writtenOn > day guard bites
        assertThat(pts).noneMatch(p -> p.aboutDate().equals(day.minusDays(2)));
    }

    @Test
    void gather_shouldBoundChatTimesAboveByTheObservedDay() {
        LocalDate day = LocalDate.of(2026, 5, 20);
        saveUserMessage(day.atTime(23, 30));
        saveUserMessage(day.plusDays(1).atTime(1, 0));

        assertThat(signalReads.gather(owner, day).trend().userChatTimes())
                .allSatisfy(t -> assertThat(t.toLocalDate()).isBeforeOrEqualTo(day));
    }
}
