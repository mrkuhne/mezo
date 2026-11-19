package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * A stalled muscle gets one offer in the weekly proposal (mezo-r36n9.81, T3 Task 6): a technique, else a rep-range
 * change, else a one-week reduction given back the week after. Only a run with a style AND the techniques flag,
 * never in a deload week. Each run starts 3 weeks ago (now = week 4); every exercise logged one identical top set in
 * weeks 1–3 (a hold, and fewer sets than planned → the week's decision is HOLD).
 */
class WeekProposalStallIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
    private static final List<String> DELOAD_IN_WEEK_4 = List.of("MEV", "MAV", "MRV", "Deload", "MEV", "MAV");

    @Autowired WorkoutService workoutService;
    @Autowired WeekProposalService proposals;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseCatalogRepository catalogRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired TrainStyleProperties styleProps;
    @MockitoSpyBean TechniquePlanService planService;

    private UUID owner;
    private MesocycleEntity meso;
    private WorkoutSessionEntity day;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-proposal-stall@test.local");
    }

    private void run(List<String> curve, Map<String, String> priorities, boolean techniques) {
        meso = train.activeMesoStartedWeeksAgo(owner, 3, 6, curve);
        meso.setMusclePriorities(priorities);
        meso.setTrainingStyle("balanced");
        meso.setTechniquesEnabled(techniques);
        meso = mesocycleRepository.saveAndFlush(meso);
        day = train.createWorkoutSession(owner, meso.getId(), "Hét", "gym", 0, "active");
    }

    /** A free (no catalog) back compound, 3 sets, rep range 6–8. */
    private ExerciseEntity row(String name, int order) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, order, "back-mid", "compound", null);
        e.setWorkingSets(3);
        return train.save(e);
    }

    private ExerciseEntity catalogRow(String name, int order, String slug) {
        UUID catalogId = catalogRepository.findBySlug(slug).orElseThrow().getId();
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, order, "chest-mid", "isolation", catalogId);
        e.setWorkingSets(3);
        return train.save(e);
    }

    /** One completed instance per week 1–3, each exercise one identical top set. */
    private void holdThreeWeeks(ExerciseEntity... rows) {
        for (int w = 1; w <= 3; w++) {
            WorkoutSessionEntity inst = train.createWorkoutInstance(owner, day,
                meso.getStartDate().plusDays(7L * (w - 1) + 1), "completed");
            for (ExerciseEntity e : rows) {
                train.createLoggedSet(owner, e.getId(), inst.getId(), 0, "60", 8, 1);
            }
        }
    }

    @Test
    void techniqueOfferedFirst() {
        run(NO_DELOAD, Map.of("chest", "maintain"), true); // Tartás: the planner alone would place no technique
        ExerciseEntity pec = catalogRow("Pec Deck", 0, "pec-deck");
        ExerciseEntity fly = catalogRow("Cable Fly", 1, "cable-fly");
        holdThreeWeeks(pec, fly);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(4);
        assertThat(lines(p, WeekProposalLineJson.KIND_TECHNIQUE))
            .filteredOn(l -> !Boolean.TRUE.equals(l.challenge())).singleElement().satisfies(l -> {
                assertThat(l.exerciseId()).isEqualTo(fly.getId());
                assertThat(l.toTechnique()).isEqualTo("rest_drop");
                assertThat(l.from()).isEqualTo(3);
                assertThat(l.to()).isEqualTo(2);
                assertThat(l.reasons()).containsExactly("stalled");
                assertThat(l.decision()).isEqualTo("accepted");
            });
        assertThat(lines(p, WeekProposalLineJson.KIND_REP_RANGE)).isEmpty();
        assertThat(lines(p, WeekProposalLineJson.KIND_SETS)).isEmpty();
        assertThat(p.getRestore()).isNull();
        ExerciseEntity after = fresh(fly);
        assertThat(after.getTechnique()).isEqualTo("rest_drop");
        assertThat(after.getTechniqueSource()).isEqualTo("planner");
        assertThat(after.getWorkingSets()).isEqualTo(2);
        assertThat(p.getGroups()).filteredOn(g -> g.muscle().equals("chest")).singleElement()
            .satisfies(g -> assertThat(g.reasons()).contains("stalled"));
    }

    @Test
    void rangeChangeAppliedAndKeptByLaterStamps() {
        run(NO_DELOAD, Map.of("back", "grow"), true);
        ExerciseEntity rowing = row("Evezés", 0); // free: no technique
        holdThreeWeeks(rowing);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(4);
        assertThat(lines(p, WeekProposalLineJson.KIND_REP_RANGE)).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(rowing.getId());
            assertThat(l.fromRepMin()).isEqualTo(6);
            assertThat(l.fromRepMax()).isEqualTo(8);
            assertThat(l.toRepMin()).isEqualTo(10); // balanced → volume, compound row of the table
            assertThat(l.toRepMax()).isEqualTo(15);
            assertThat(l.reasons()).containsExactly("stalled");
            assertThat(l.decision()).isEqualTo("accepted");
        });
        assertThat(lines(p, WeekProposalLineJson.KIND_SETS)).isEmpty(); // one offer: no reduction too
        ExerciseEntity after = fresh(rowing);
        assertThat(after.getRepMin()).isEqualTo(10);
        assertThat(after.getRepMax()).isEqualTo(15);
        assertThat(after.getOverrides()).containsExactly("repRange");
        assertThat(after.getWorkingSets()).isEqualTo(3);

        // a later style stamp (plan save) keeps the new range because of the override
        GymExerciseJson restamped = StyleStamper.stamp(new GymExerciseJson(after.getId(), after.getName(),
            after.getMuscle(), 2, 3, after.getRepMin(), after.getRepMax(), 2, null, "compound", null, null, true,
            null, null, after.getOverrides(), null, null, false), TrainingStyle.BALANCED, false, styleProps);
        assertThat(restamped.repMin()).isEqualTo(10);
        assertThat(restamped.repMax()).isEqualTo(15);
    }

    @Test
    void reductionRestoredNextWeek() {
        run(NO_DELOAD, Map.of("back", "grow"), true);
        ExerciseEntity rowing = row("Evezés", 0);
        rowing.setOverrides(List.of("repRange")); // his own range: no range offer
        rowing = train.save(rowing);
        holdThreeWeeks(rowing);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity w4 = weekly(4);
        assertThat(lines(w4, WeekProposalLineJson.KIND_REP_RANGE)).isEmpty();
        assertThat(lines(w4, WeekProposalLineJson.KIND_SETS)).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(rowing().getId());
            assertThat(l.from()).isEqualTo(3);
            assertThat(l.to()).isEqualTo(2);
            assertThat(l.reasons()).containsExactly("stalled");
            assertThat(l.decision()).isEqualTo("accepted");
        });
        assertThat(w4.getRestore()).singleElement().satisfies(e -> {
            assertThat(e.exerciseId()).isEqualTo(rowing().getId());
            assertThat(e.sets()).isEqualTo(3);
            assertThat(e.deloadSets()).isEqualTo(2);
        });
        assertThat(w4.getGroups()).filteredOn(g -> g.muscle().equals("back")).singleElement().satisfies(g -> {
            assertThat(g.setsBefore()).isEqualTo(3);
            assertThat(g.setsAfter()).isEqualTo(2);
        });
        assertThat(fresh(rowing()).getWorkingSets()).isEqualTo(2);

        // week 5: the existing restore path gives the set back
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MesocycleEntity run = mesocycleRepository.findById(meso.getId()).orElseThrow();
            proposals.apply(proposals.build(owner, run, 5).proposal());
        });
        MesoWeekProposalEntity w5 = weekly(5);
        assertThat(lines(w5, WeekProposalLineJson.KIND_SETS)).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(rowing().getId());
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(3);
            assertThat(l.reasons()).containsExactly("deload_restore");
            assertThat(l.decision()).isEqualTo("accepted");
        });
        assertThat(fresh(rowing()).getWorkingSets()).isEqualTo(3);
    }

    @Test
    void reductionNotForMaintain() {
        run(NO_DELOAD, Map.of("back", "maintain"), true);
        ExerciseEntity rowing = row("Evezés", 0);
        rowing.setOverrides(List.of("repRange"));
        train.save(rowing);
        holdThreeWeeks(rowing);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(4);
        assertThat(p.getLines()).filteredOn(l -> l.reasons() != null && l.reasons().contains("stalled")).isEmpty();
        assertThat(p.getRestore()).isNull();
        assertThat(fresh(rowing).getWorkingSets()).isEqualTo(3);
    }

    @Test
    void deloadWeekNoOffer() {
        run(DELOAD_IN_WEEK_4, Map.of("back", "grow"), true);
        ExerciseEntity rowing = row("Evezés", 0);
        holdThreeWeeks(rowing);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(4);
        assertThat(lines(p, WeekProposalLineJson.KIND_REP_RANGE)).isEmpty();
        assertThat(lines(p, WeekProposalLineJson.KIND_TECHNIQUE)).isEmpty();
        assertThat(p.getLines()).filteredOn(l -> l.reasons() != null && l.reasons().contains("stalled")).isEmpty();
        assertThat(p.getRestore()).singleElement() // the deload's halving only
            .satisfies(e -> assertThat(e.deloadSets()).isEqualTo(2));
        assertThat(fresh(rowing).getRepMin()).isEqualTo(6);
    }

    @Test
    void unflaggedRunGetsNoOffer() {
        run(NO_DELOAD, Map.of("back", "grow"), false);
        ExerciseEntity rowing = row("Evezés", 0);
        holdThreeWeeks(rowing);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(4);
        assertThat(lines(p, WeekProposalLineJson.KIND_REP_RANGE)).isEmpty();
        assertThat(p.getLines()).filteredOn(l -> l.reasons() != null && l.reasons().contains("stalled")).isEmpty();
        assertThat(p.getGroups()).filteredOn(g -> g.muscle().equals("back")).singleElement()
            .satisfies(g -> assertThat(g.reasons()).contains("stalled")); // the audit reason stays (T1)
        ExerciseEntity after = fresh(rowing);
        assertThat(after.getRepMin()).isEqualTo(6);
        assertThat(after.getOverrides()).isNullOrEmpty();
    }

    @Test
    void plannerFailureMeansNoOfferAndTheWeekStands() {
        run(NO_DELOAD, Map.of("back", "grow"), true);
        ExerciseEntity rowing = row("Evezés", 0);
        rowing.setOverrides(List.of("repRange"));
        train.save(rowing);
        holdThreeWeeks(rowing);
        doThrow(new NullPointerException("planner bug")).when(planService).snapshotRun(any(), any(), anyInt(), any());

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(4);
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(p.getLines()).filteredOn(l -> l.reasons() != null && l.reasons().contains("stalled")).isEmpty();
        assertThat(p.getRestore()).isNull();
        assertThat(fresh(rowing).getWorkingSets()).isEqualTo(3);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    private ExerciseEntity rowing() {
        return exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(day.getId()))
            .get(0);
    }

    private static List<WeekProposalLineJson> lines(MesoWeekProposalEntity p, String kind) {
        return p.getLines().stream().filter(l -> kind.equals(l.kind())).toList();
    }

    private ExerciseEntity fresh(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow();
    }

    private MesoWeekProposalEntity weekly(int week) {
        return proposalRepository.findWeekly(owner, meso.getId(), week).orElseThrow();
    }
}
