package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.VolumeArcWeek;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.RestoreEntryJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The weekly proposal in {@code manual} mode (volume engine v2, spec §6.4 "Applying"): the week's proposal
 * waits ({@code pending}, nothing written), expires at the next week boundary, and the post-deload restore
 * follows what was actually decided — only accepted halvings are given back, and the restore stays on offer
 * until a proposal carrying its lines is applied. Decisions are made through the service's lifecycle seam
 * ({@code applySetLine} + {@code close}) the decisions endpoint builds on.
 */
@TestPropertySource(properties = "mezo.volume.weekly-review.mode=manual")
class WeekProposalManualIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
    private static final List<String> DELOAD_IN_WEEK_3 = List.of("MEV", "MAV", "Deload", "MEV", "MAV", "MRV");

    @Autowired WorkoutService workoutService;
    @Autowired WeekProposalService proposals;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired VolumeArcService volumeArcService;
    @Autowired VolumeLedger volumeLedger;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-proposal-manual@test.local");
    }

    private record Back(MesocycleEntity meso, ExerciseEntity mon4, ExerciseEntity mon2,
                        ExerciseEntity thu3, ExerciseEntity thu2) {}

    /** Back at 11 (Mon 4 + 2, Thu 3 + 2), emphasized, every planned set logged in week 1; the run is in week 2. */
    private Back back() {
        MesocycleEntity meso = run(2, NO_DELOAD, Map.of("back", "emphasize"));
        WorkoutSessionEntity mon = day(meso, "Hétfő", 0);
        WorkoutSessionEntity thu = day(meso, "Csütörtök", 3);
        Back b = new Back(meso,
            exercise(mon, "Evezés", "back-mid", 4), exercise(mon, "Lehúzás", "back-wide", 2),
            exercise(thu, "Kábeles evezés", "back-mid", 3), exercise(thu, "Húzódzkodás", "back-wide", 2));
        logWeek(meso, 1, mon, 0, b.mon4(), b.mon2());
        logWeek(meso, 1, thu, 3, b.thu3(), b.thu2());
        return b;
    }

    @Test
    void theWeeksProposalWaitsAndNothingIsWritten() {
        Back b = back();

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(b.meso(), 2);
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_PENDING);
        assertThat(p.getDecidedAt()).isNull();
        assertThat(p.getPlanAfter()).isNull();
        assertThat(setLines(p)).extracting(WeekProposalLineJson::exerciseId)
            .containsExactly(b.thu2().getId(), b.mon2().getId());
        assertThat(setLines(p)).allSatisfy(l -> {
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(3);
            assertThat(l.decision()).isNull();
        });
        assertThat(p.getLines()).allSatisfy(l -> assertThat(l.decision()).isNull());
        assertThat(List.of(sets(b.mon4()), sets(b.mon2()), sets(b.thu3()), sets(b.thu2())))
            .containsExactly(4, 2, 3, 2);
        // nothing changed, so the ledger was not touched (the fixture run never had ledger rows)
        assertThat(volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(b.meso().getId())))
            .isEmpty();

        MesocycleEntity after = reload(b.meso());
        assertThat(after.getCurrentWeek()).isEqualTo(2);
        VolumeRecomputeJson audit = after.getVolumeRecompute();
        assertThat(audit.lastRun()).isEqualTo("W2");
        assertThat(audit.changes()).singleElement().satisfies(c -> {
            assertThat(c.muscle()).isEqualTo("back");
            assertThat(c.change()).isEqualTo("javaslat: +2 (11 → 13)");
        });
    }

    @Test
    void anUndecidedProposalExpiresAtTheNextWeekBoundary() {
        Back b = back();
        workoutService.getToday(owner, null);
        MesoWeekProposalEntity tier = new MesoWeekProposalEntity();
        tier.setCreatedBy(owner);
        tier.setMesocycleId(b.meso().getId());
        tier.setWeek(2);
        tier.setKind(MesoWeekProposalEntity.KIND_TIER_CHANGE);
        tier.setStatus(MesoWeekProposalEntity.STATUS_PENDING);
        tier.setLines(List.of());
        tier = proposalRepository.saveAndFlush(tier);

        nextWeek(b.meso());
        workoutService.getToday(owner, null);

        MesoWeekProposalEntity week2 = weekly(b.meso(), 2);
        assertThat(week2.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);
        assertThat(week2.getDecidedAt()).isNotNull();
        assertThat(week2.getPlanAfter()).hasSize(4)
            .containsEntry(b.mon4().getId().toString(), 4).containsEntry(b.mon2().getId().toString(), 2)
            .containsEntry(b.thu3().getId().toString(), 3).containsEntry(b.thu2().getId().toString(), 2);
        assertThat(setLines(week2)).allSatisfy(l -> assertThat(l.decision()).isNull());
        assertThat(proposalRepository.findById(tier.getId()).orElseThrow().getStatus())
            .isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);

        assertThat(weekly(b.meso(), 3).getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_PENDING);
        assertThat(List.of(sets(b.mon4()), sets(b.mon2()), sets(b.thu3()), sets(b.thu2())))
            .containsExactly(4, 2, 3, 2);
        assertThat(reload(b.meso()).getCurrentWeek()).isEqualTo(3);
    }

    /** Deload week: he accepts the squat's halving only; the leg press's line expires. Only the squat comes back. */
    @Test
    void onlyAcceptedHalvingsAreRestored() {
        MesocycleEntity meso = run(3, DELOAD_IN_WEEK_3, Map.of("quad", "maintain"));
        ExerciseEntity squat = exercise(day(meso, "Hétfő", 0), "Guggolás", "quad", 4);
        ExerciseEntity press = exercise(day(meso, "Csütörtök", 3), "Lábtolás", "quad", 4);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity deload = weekly(meso, 3);
        assertThat(deload.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_PENDING);
        assertThat(setLines(deload)).extracting(WeekProposalLineJson::exerciseId, WeekProposalLineJson::from,
                WeekProposalLineJson::to)
            .containsExactlyInAnyOrder(
                tuple(squat.getId(), 4, 2),
                tuple(press.getId(), 4, 2));
        assertThat(deload.getRestore()).hasSize(2);
        assertThat(List.of(sets(squat), sets(press))).containsExactly(4, 4);

        acceptLinesOf(meso, 3, squat.getId(), null);
        assertThat(List.of(sets(squat), sets(press))).containsExactly(2, 4);

        nextWeek(meso);
        workoutService.getToday(owner, null);

        MesoWeekProposalEntity closed = weekly(meso, 3);
        assertThat(closed.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);
        assertThat(closed.getRestore()).containsExactly(
            new RestoreEntryJson(squat.getId(), null, "Guggolás", 0, 4, 2));
        MesoWeekProposalEntity week4 = weekly(meso, 4);
        assertThat(setLines(week4)).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(squat.getId());
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(4);
            assertThat(l.reasons()).containsExactly("deload_restore");
            assertThat(l.decision()).isNull();
        });
        assertThat(List.of(sets(squat), sets(press))).containsExactly(2, 4);
    }

    /** The restore is offered again after its proposal expires, and consumed once one carrying it is applied. */
    @Test
    void theRestoreIsOfferedAgainUntilApplied() {
        MesocycleEntity meso = run(3, DELOAD_IN_WEEK_3, Map.of("quad", "maintain"));
        ExerciseEntity squat = exercise(day(meso, "Hétfő", 0), "Guggolás", "quad", 4);
        workoutService.getToday(owner, null);
        acceptLinesOf(meso, 3, squat.getId(), MesoWeekProposalEntity.STATUS_APPLIED);
        assertThat(sets(squat)).isEqualTo(2);
        assertThat(weekly(meso, 3).getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_APPLIED);
        assertThat(weekly(meso, 3).getRestore()).hasSize(1);

        nextWeek(meso); // week 4: the restore is proposed, he does not decide
        workoutService.getToday(owner, null);
        assertThat(setLines(weekly(meso, 4))).singleElement().satisfies(l -> {
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(4);
            assertThat(l.reasons()).containsExactly("deload_restore");
        });

        nextWeek(meso); // week 5: week 4 expired, the restore comes again
        workoutService.getToday(owner, null);
        assertThat(weekly(meso, 4).getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);
        assertThat(weekly(meso, 3).getRestore()).hasSize(1);
        assertThat(sets(squat)).isEqualTo(2);
        assertThat(setLines(weekly(meso, 5))).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(squat.getId());
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(4);
            assertThat(l.reasons()).containsExactly("deload_restore");
        });

        acceptLinesOf(meso, 5, squat.getId(), MesoWeekProposalEntity.STATUS_APPLIED);
        assertThat(sets(squat)).isEqualTo(4);
        assertThat(weekly(meso, 3).getRestore()).isEmpty();
        assertThat(weekly(meso, 5).getPlanAfter()).containsEntry(squat.getId().toString(), 4);

        nextWeek(meso); // week 6: nothing left to restore
        workoutService.getToday(owner, null);
        assertThat(setLines(weekly(meso, 6))).isEmpty();
        assertThat(sets(squat)).isEqualTo(4);
    }

    /**
     * An expired week gives back what he accepted in it: the squat's restore line accepted in week 4 (the
     * press's left undecided) — week 5 offers only the press, with no "your own number stood" note for a
     * restore the system wrote itself; the press accepted in week 5 and that week expiring too consumes it.
     */
    @Test
    void anExpiredWeekConsumesTheRestoreItGaveBack() {
        MesocycleEntity meso = run(3, DELOAD_IN_WEEK_3, Map.of("quad", "maintain"));
        ExerciseEntity squat = exercise(day(meso, "Hétfő", 0), "Guggolás", "quad", 4);
        ExerciseEntity press = exercise(day(meso, "Csütörtök", 3), "Lábtolás", "quad", 4);
        workoutService.getToday(owner, null);
        acceptAll(meso, 3);
        assertThat(List.of(sets(squat), sets(press))).containsExactly(2, 2);

        nextWeek(meso); // week 4: both restore lines; only the squat's accepted, the week expires
        workoutService.getToday(owner, null);
        assertThat(setLines(weekly(meso, 4))).extracting(WeekProposalLineJson::exerciseId)
            .containsExactlyInAnyOrder(squat.getId(), press.getId());
        acceptLinesOf(meso, 4, squat.getId(), null);
        assertThat(List.of(sets(squat), sets(press))).containsExactly(4, 2);

        nextWeek(meso); // week 5
        workoutService.getToday(owner, null);
        assertThat(weekly(meso, 4).getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);
        assertThat(weekly(meso, 3).getRestore()).containsExactly(
            new RestoreEntryJson(press.getId(), null, "Lábtolás", 3, 4, 2));
        assertThat(setLines(weekly(meso, 5))).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(press.getId());
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(4);
            assertThat(l.reasons()).containsExactly("deload_restore");
        });
        assertThat(reload(meso).getVolumeRecompute().changes()).singleElement().satisfies(c -> {
            assertThat(c.muscle()).isEqualTo("quad");
            assertThat(c.reason()).doesNotContain("saját számod");
        });

        acceptLinesOf(meso, 5, press.getId(), null); // every restore line accepted, the week still expires
        nextWeek(meso); // week 6
        workoutService.getToday(owner, null);
        assertThat(weekly(meso, 5).getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);
        assertThat(weekly(meso, 3).getRestore()).isEmpty();
        assertThat(setLines(weekly(meso, 6))).isEmpty();
        assertThat(reload(meso).getVolumeRecompute().changes()).allSatisfy(c ->
            assertThat(c.reason()).doesNotContain("saját számod"));
        assertThat(List.of(sets(squat), sets(press))).containsExactly(4, 4);
    }

    /** The arc's past weeks read expired weeks too: what each week ended with, accepted writes included. */
    @Test
    void theArcReadsExpiredWeeks() {
        MesocycleEntity meso = run(2, DELOAD_IN_WEEK_3, Map.of("quad", "maintain"));
        ExerciseEntity squat = exercise(day(meso, "Hétfő", 0), "Guggolás", "quad", 4);
        ExerciseEntity press = exercise(day(meso, "Csütörtök", 3), "Lábtolás", "quad", 4);
        workoutService.getToday(owner, null); // week 2: left untouched, expires

        nextWeek(meso); // week 3 (deload): only the squat's halving accepted, expires
        workoutService.getToday(owner, null);
        acceptLinesOf(meso, 3, squat.getId(), null);

        nextWeek(meso); // week 4: the squat's restore accepted and the week applied
        workoutService.getToday(owner, null);
        acceptLinesOf(meso, 4, squat.getId(), MesoWeekProposalEntity.STATUS_APPLIED);
        assertThat(weekly(meso, 2).getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);
        assertThat(weekly(meso, 3).getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_EXPIRED);
        assertThat(List.of(sets(squat), sets(press))).containsExactly(4, 4);

        volumeLedger.sync(owner, meso.getId()); // the decisions endpoint syncs after a write; the seam does not
        // week 1: 8, week 2 (expired untouched): 8, week 3 (expired, squat halved): 2 + 4 = 6
        List<Integer> planned = volumeArcService.arc(owner, meso.getId()).getMuscles().stream()
            .filter(m -> m.getMuscle().equals("quad")).findFirst().orElseThrow()
            .getWeeks().stream().map(VolumeArcWeek::getPlanned).toList();
        assertThat(planned.subList(0, 3)).containsExactly(8, 8, 6);
    }

    /** Accepts every line of the week's proposal and closes it applied. */
    private void acceptAll(MesocycleEntity meso, int week) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MesoWeekProposalEntity p = weekly(meso, week);
            p.setLines(p.getLines().stream().map(l -> proposals.applySetLine(p, l)).toList());
            proposals.close(p, MesoWeekProposalEntity.STATUS_APPLIED);
        });
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    /**
     * Applies (accepts) the set line of {@code exerciseId} in the week's proposal through the lifecycle seam;
     * every other line is kept when {@code closeAs} is given (then the proposal is closed so), else left undecided.
     */
    private void acceptLinesOf(MesocycleEntity meso, int week, UUID exerciseId, String closeAs) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MesoWeekProposalEntity p = weekly(meso, week);
            List<WeekProposalLineJson> decided = p.getLines().stream()
                .map(l -> exerciseId.equals(l.exerciseId()) && WeekProposalLineJson.KIND_SETS.equals(l.kind())
                    ? proposals.applySetLine(p, l)
                    : closeAs == null ? l : l.withDecision(WeekProposalLineJson.DECISION_KEPT))
                .toList();
            p.setLines(decided);
            if (closeAs == null) {
                proposalRepository.save(p);
            } else {
                proposals.close(p, closeAs);
            }
        });
    }

    private MesocycleEntity run(int week, List<String> curve, Map<String, String> priorities) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, week - 1, 6, curve);
        meso.setMusclePriorities(priorities);
        return mesocycleRepository.saveAndFlush(meso);
    }

    private WorkoutSessionEntity day(MesocycleEntity meso, String label, int orderIndex) {
        return train.createWorkoutSession(owner, meso.getId(), label, "gym", orderIndex, "active");
    }

    private ExerciseEntity exercise(WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    private void logWeek(MesocycleEntity meso, int week, WorkoutSessionEntity day, int dayOffset,
                         ExerciseEntity... exercises) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day,
            meso.getStartDate().plusDays(7L * (week - 1) + dayOffset), "completed");
        int i = 0;
        for (ExerciseEntity e : exercises) {
            for (int s = 0; s < e.getWorkingSets(); s++) {
                train.createLoggedSet(owner, e.getId(), instance.getId(), i++, "60", 8, 0);
            }
        }
    }

    private void nextWeek(MesocycleEntity meso) {
        MesocycleEntity later = reload(meso);
        later.setStartDate(later.getStartDate().minusWeeks(1));
        later.setEndDate(later.getEndDate().minusWeeks(1));
        mesocycleRepository.saveAndFlush(later);
    }

    private static List<WeekProposalLineJson> setLines(MesoWeekProposalEntity p) {
        return p.getLines().stream().filter(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind())).toList();
    }

    private int sets(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow().getWorkingSets();
    }

    private MesoWeekProposalEntity weekly(MesocycleEntity meso, int week) {
        return proposalRepository.findWeekly(owner, meso.getId(), week).orElseThrow();
    }

    private MesocycleEntity reload(MesocycleEntity meso) {
        return mesocycleRepository.findById(meso.getId()).orElseThrow();
    }
}
