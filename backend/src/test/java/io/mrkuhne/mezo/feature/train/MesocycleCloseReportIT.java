package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.MesoRecordHighlight;
import io.mrkuhne.mezo.api.dto.MesoStrengthDelta;
import io.mrkuhne.mezo.api.dto.MesocycleReportResponse;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.MesocycleReportService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The close-time FROZEN run report (mezo-meyc.2, spec §2): closing an active run archives it,
 * stamps {@code closedAt}, captures the owner's self-eval and computes + persists the
 * deterministic report (adherence / volume arc / strength deltas / records). Re-closing is a
 * no-op, and an archived run with no report is backfilled through the regenerate path.
 *
 * <p>Service-level (not HTTP): the numbers ARE the contract here, and the report row is always
 * created through the LIVE close/regenerate path — never hand-inserted — so the assertions prove
 * the computation, not a fixture.
 *
 * <p>The main fixture is a 2-week run started 7 days ago (so "now" sits in week 2):
 * <ul>
 *   <li>3 template days — Push (2 exercises), Pull (1 exercise), Legs (EMPTY, must not count)</li>
 *   <li>3 completed meso instances — 2 in week 1, 1 in week 2</li>
 *   <li>Fekvenyomás 60 kg × 8 in W1 → 70 kg × 8 in W2 (the worked strength-delta example)</li>
 * </ul>
 */
class MesocycleCloseReportIT extends AbstractIntegrationTest {

    private static final String BENCH = "Fekvenyomás";
    private static final String ROW = "Evezés";
    private static final String PULLUP = "Húzódzkodás";

    @Autowired private TrainService trainService;
    @Autowired private MesocycleReportService reportService;
    @Autowired private TrainPopulator train;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private ExerciseSetRepository exerciseSetRepository;
    @Autowired private DatabasePopulator databasePopulator;

    // ── close → frozen report ────────────────────────────────────────────────────

    @Test
    void testCloseMesocycle_shouldFreezeReport_whenActiveRunCloses() {
        UUID owner = databasePopulator.populateUser("meso-close-a@test.local");
        MesocycleEntity run = twoWeekRunWithThreeCompletedInstances(owner);

        MesocycleResponse closed = trainService.closeMesocycle(owner, run.getId(), "Jó blokk volt.");

        assertThat(closed.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ARCHIVED);
        assertThat(closed.getClosedAt()).isNotNull();
        assertThat(closed.getHasReport()).isTrue();
        assertThat(mesocycleRepository.findById(run.getId()).orElseThrow().getClosedAt()).isNotNull();

        MesocycleReportResponse report = reportService.getReport(owner, run.getId());

        // identity + close-time fields
        assertThat(report.getMesocycleId()).isEqualTo(run.getId());
        assertThat(report.getTitle()).isEqualTo(run.getTitle());
        assertThat(report.getStartDate()).isEqualTo(run.getStartDate());
        assertThat(report.getWeeks()).isEqualTo(2);
        assertThat(report.getClosedAt()).isNotNull();
        assertThat(report.getSelfEval()).isEqualTo("Jó blokk volt.");
        assertThat(report.getAiEval()).isNull();
        assertThat(report.getAiEvalStatus()).isEqualTo(MesocycleReportResponse.AiEvalStatusEnum.PENDING);
        // S2 hardcodes the AI switch OFF — the FE hides the AI section instead of polling forever.
        assertThat(report.getAiEvalEnabled()).isFalse();
        assertThat(report.getContext()).isNull();

        // adherence: 2 NON-EMPTY template days × 2 elapsed weeks = 4 planned; 3 completed; 2 weeks touched
        assertThat(report.getAdherence().getPlannedWeeks()).isEqualTo(2);
        assertThat(report.getAdherence().getCompletedWeeks()).isEqualTo(2);
        assertThat(report.getAdherence().getPlannedSessions()).isEqualTo(4);
        assertThat(report.getAdherence().getCompletedSessions()).isEqualTo(3);
        assertThat(report.getAdherence().getCompletionPct()).isEqualTo(75);

        // volume: VolumeArcService's output frozen verbatim (chest is the only landmarked muscle)
        assertThat(report.getVolume()).isNotNull();
        assertThat(report.getVolume().getMesocycleId()).isEqualTo(run.getId());
        assertThat(report.getVolume().getWeeks()).isEqualTo(2);
        assertThat(report.getVolume().getMuscles()).singleElement().satisfies(m -> {
            assertThat(m.getMuscle()).isEqualTo("chest");
            assertThat(m.getWeeks()).hasSize(2);
            assertThat(m.getWeeks().get(0).getActual()).isEqualTo(1); // W1 bench working set
            assertThat(m.getWeeks().get(1).getActual()).isEqualTo(1); // W2 bench working set
        });

        // strength: only identities trained in ≥2 distinct meso weeks, best gain first
        assertThat(report.getStrength()).extracting(MesoStrengthDelta::getExerciseName)
            .containsExactly(BENCH, ROW);
        MesoStrengthDelta bench = report.getStrength().get(0);
        assertThat(bench.getFirstWeek()).isEqualTo(1);
        assertThat(bench.getLastWeek()).isEqualTo(2);
        assertThat(bench.getFirstTopKg()).isEqualByComparingTo("60");
        assertThat(bench.getFirstTopReps()).isEqualTo(8);
        assertThat(bench.getLastTopKg()).isEqualByComparingTo("70");
        assertThat(bench.getLastTopReps()).isEqualTo(8);
        assertThat(bench.getDeltaKg()).isEqualByComparingTo("10");
        // Epley e1RM: 60×(1+8/30)=76.00 → 70×(1+8/30)=88.67; percent gain 16.7%
        assertThat(bench.getFirstE1rm()).isEqualByComparingTo("76.00");
        assertThat(bench.getLastE1rm()).isEqualByComparingTo("88.67");
        assertThat(bench.getDeltaPct()).isEqualByComparingTo("16.7");
        assertThat(report.getStrength().get(1).getDeltaKg()).isEqualByComparingTo("2.5");

        // records: derived by the live medal evaluator over the run's completed instances
        assertThat(report.getRecords().getMedalCount()).isEqualTo(6);
        assertThat(report.getRecords().getTop()).hasSize(5);
        assertThat(report.getRecords().getTop()).extracting(MesoRecordHighlight::getExerciseName)
            .contains(BENCH);
        assertThat(report.getRecords().getTop()).allSatisfy(h ->
            assertThat(h.getDate()).isBetween(run.getStartDate(), LocalDate.now()));
    }

    @Test
    void testCloseMesocycle_shouldBeIdempotent_whenAlreadyArchived() {
        UUID owner = databasePopulator.populateUser("meso-close-b@test.local");
        MesocycleEntity run = twoWeekRunWithThreeCompletedInstances(owner);

        trainService.closeMesocycle(owner, run.getId(), "első");
        Instant firstClosedAt = mesocycleRepository.findById(run.getId()).orElseThrow().getClosedAt();

        // Mutating the run's data AFTER the close must not leak into the frozen report.
        ExerciseSetEntity lastBenchSet = exerciseSetRepository.findAll().stream()
            .filter(s -> owner.equals(s.getCreatedBy()))
            .filter(s -> s.getWeightKg() != null && s.getWeightKg().compareTo(new BigDecimal("70")) == 0)
            .findFirst().orElseThrow();
        lastBenchSet.setWeightKg(new BigDecimal("100"));
        exerciseSetRepository.saveAndFlush(lastBenchSet);

        MesocycleResponse reclosed = trainService.closeMesocycle(owner, run.getId(), "második");

        assertThat(reclosed.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ARCHIVED);
        assertThat(mesocycleRepository.findById(run.getId()).orElseThrow().getClosedAt())
            .isEqualTo(firstClosedAt);

        MesocycleReportResponse report = reportService.getReport(owner, run.getId());
        assertThat(report.getSelfEval()).isEqualTo("első");
        assertThat(report.getStrength().get(0).getLastTopKg()).isEqualByComparingTo("70");
        assertThat(report.getStrength().get(0).getDeltaKg()).isEqualByComparingTo("10");
    }

    // ── report read ─────────────────────────────────────────────────────────────

    @Test
    void testGetReport_shouldReturn404_whenNoneExists() {
        UUID owner = databasePopulator.populateUser("meso-close-c@test.local");
        MesocycleEntity run = train.createMesocycle(owner, "Riport nélkül", "active");

        assertThatThrownBy(() -> reportService.getReport(owner, run.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("TRAIN_MESO_REPORT_NOT_FOUND");
    }

    // ── regenerate ──────────────────────────────────────────────────────────────

    @Test
    void testRegenerate_shouldBackfillLegacyArchivedRun_whenNoReport() {
        UUID owner = databasePopulator.populateUser("meso-close-d@test.local");
        // Archived with NO closedAt and an endDate still AHEAD of today: the window must fall back
        // to endDate (⇒ 6 elapsed weeks), not to "now" (which would give only 2).
        MesocycleEntity run = train.legacyArchivedMesoStartedWeeksAgo(
            owner, 1, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        WorkoutSessionEntity day = train.createWorkoutSession(
            owner, run.getId(), "Hét", "Push", 0, "planned");
        ExerciseEntity bench = train.createExercise(owner, day.getId(), BENCH, "chest", "compound");
        WorkoutSessionEntity instance =
            train.createWorkoutInstance(owner, day, run.getStartDate(), "completed");
        train.createLoggedSet(owner, bench.getId(), instance.getId(), 0, "60", 8, 1,
            at(run.getStartDate()));

        reportService.regenerate(owner, run.getId());

        MesocycleReportResponse report = reportService.getReport(owner, run.getId());
        assertThat(report.getClosedAt()).isNull();
        assertThat(report.getAiEvalStatus()).isEqualTo(MesocycleReportResponse.AiEvalStatusEnum.PENDING);
        assertThat(report.getAdherence().getPlannedWeeks()).isEqualTo(6);
        assertThat(report.getAdherence().getPlannedSessions()).isEqualTo(6); // 1 day × 6 elapsed weeks
        assertThat(report.getAdherence().getCompletedSessions()).isEqualTo(1);
        assertThat(report.getAdherence().getCompletedWeeks()).isEqualTo(1);
        assertThat(report.getAdherence().getCompletionPct()).isEqualTo(17);
        // One week trained only ⇒ no strength delta is emitted at all.
        assertThat(report.getStrength()).isEmpty();
    }

    @Test
    void testRegenerate_shouldReturn409_whenRunActive() {
        UUID owner = databasePopulator.populateUser("meso-close-e@test.local");
        MesocycleEntity run = train.createMesocycle(owner, "Még fut", "active");

        assertThatThrownBy(() -> reportService.regenerate(owner, run.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("TRAIN_MESO_NOT_CLOSED");
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    /**
     * The worked scenario: a 2-week ACTIVE run started 7 days ago (so today sits in week 2) with
     * three template days — two carrying exercises, one deliberately EMPTY — and three completed
     * meso instances (2 in W1, 1 in W2).
     */
    private MesocycleEntity twoWeekRunWithThreeCompletedInstances(UUID owner) {
        MesocycleEntity run =
            train.activeMesoStartedWeeksAgo(owner, 1, 2, 2, List.of("MEV", "MAV"));
        train.createVolumeLog(owner, run.getId(), "chest", 12);

        WorkoutSessionEntity push =
            train.createWorkoutSession(owner, run.getId(), "Hét", "Push", 0, "planned");
        ExerciseEntity bench = train.createExercise(owner, push.getId(), BENCH, "chest", "compound");
        ExerciseEntity row = train.createExercise(owner, push.getId(), ROW, "back", "compound");
        WorkoutSessionEntity pull =
            train.createWorkoutSession(owner, run.getId(), "Csüt", "Pull", 1, "planned");
        ExerciseEntity pullup = train.createExercise(owner, pull.getId(), PULLUP, "back", "compound");
        // Empty day — a template day with no exercises is not a planned session.
        train.createWorkoutSession(owner, run.getId(), "Szo", "Legs", 2, "planned");

        LocalDate start = run.getStartDate();
        WorkoutSessionEntity w1a = train.createWorkoutInstance(owner, push, start, "completed");
        train.createLoggedSet(owner, bench.getId(), w1a.getId(), 0, "60", 8, 1, at(start));
        train.createLoggedSet(owner, row.getId(), w1a.getId(), 1, "50", 8, 1, at(start));

        WorkoutSessionEntity w1b =
            train.createWorkoutInstance(owner, pull, start.plusDays(2), "completed");
        train.createLoggedSet(owner, pullup.getId(), w1b.getId(), 0, "80", 5, 1, at(start.plusDays(2)));

        WorkoutSessionEntity w2 =
            train.createWorkoutInstance(owner, push, start.plusDays(7), "completed");
        train.createLoggedSet(owner, bench.getId(), w2.getId(), 0, "70", 8, 1, at(start.plusDays(7)));
        train.createLoggedSet(owner, row.getId(), w2.getId(), 1, "52.5", 8, 1, at(start.plusDays(7)));
        return run;
    }

    /** Deterministic {@code doneAt} for a logged set — 18:00 local on the instance's date. */
    private Instant at(LocalDate date) {
        return date.atTime(18, 0).atZone(ZoneId.systemDefault()).toInstant();
    }
}
