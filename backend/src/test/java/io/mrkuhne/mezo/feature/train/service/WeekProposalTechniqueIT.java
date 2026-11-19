package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalDecisionRequest;
import io.mrkuhne.mezo.api.dto.WeekProposalLine;
import io.mrkuhne.mezo.api.dto.WeekProposalLineDecision;
import io.mrkuhne.mezo.api.dto.WeekProposalReason;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
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
 * The weekly proposal's technique lines (mezo-r36n9.81, T3 Task 5): a styled run with the techniques flag gets the
 * planner's technique / challenge moves as {@code technique} lines after its set lines, applied by
 * {@link WeekProposalService#applySetLine} (sets − 1 with a new technique, the challenge flag, source planner) —
 * only while the row still holds the line's numbers. Unflagged runs and deload weeks get none; a failing planner
 * never fails the week. Entered through {@code getToday} as in production; "the clock" = a run started N weeks ago.
 */
class WeekProposalTechniqueIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
    private static final List<String> DELOAD_IN_WEEK_3 = List.of("MEV", "MAV", "Deload", "MEV", "MAV", "MRV");

    @Autowired WorkoutService workoutService;
    @Autowired WeekProposalService proposals;
    @Autowired WeekProposalDecisionService decisions;
    @Autowired WeekProposalQueryService queryService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseCatalogRepository catalogRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoSpyBean TechniquePlanService planService;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-proposal-technique@test.local");
    }

    /** A chest day on a run in {@code week}: Pec Deck (machine) then Cable Fly (cable), 3 sets each, nothing logged. */
    private record Chest(MesocycleEntity meso, ExerciseEntity pecDeck, ExerciseEntity cableFly) {}

    private Chest chest(int week, List<String> curve, boolean techniques) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, week - 1, 6, curve);
        meso.setMusclePriorities(Map.of("chest", "emphasize"));
        meso.setTrainingStyle("balanced");
        meso.setTechniquesEnabled(techniques);
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity day = train.createWorkoutSession(owner, meso.getId(), "Hét", "gym", 0, "active");
        return new Chest(meso,
            exercise(day, "Pec Deck", 0, "pec-deck"),
            exercise(day, "Cable Fly", 1, "cable-fly"));
    }

    @Test
    void weekThreeAddsTechniqueAndTakesASet() {
        Chest c = chest(3, NO_DELOAD, true);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(c.meso(), 3);
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(p.getLines()).filteredOn(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind())).isEmpty();
        List<WeekProposalLineJson> lines = techniqueLines(p);
        assertThat(lines).hasSize(2);
        assertThat(lines.get(0)).satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(c.pecDeck().getId());
            assertThat(l.challenge()).isTrue();
            assertThat(l.fromTechnique()).isEqualTo("none");
            assertThat(l.toTechnique()).isEqualTo("partials");
            assertThat(l.from()).isEqualTo(3);
            assertThat(l.to()).isEqualTo(3);
            assertThat(l.reasons()).containsExactly("challenge");
            assertThat(l.decision()).isEqualTo("accepted");
        });
        assertThat(lines.get(1)).satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(c.cableFly().getId());
            assertThat(l.challenge()).isFalse();
            assertThat(l.fromTechnique()).isEqualTo("none");
            assertThat(l.toTechnique()).isEqualTo("rest_drop");
            assertThat(l.from()).isEqualTo(3);
            assertThat(l.to()).isEqualTo(2);
            assertThat(l.reasons()).containsExactly("emphasis");
            assertThat(l.muscleGroup()).isEqualTo("chest");
            assertThat(l.decision()).isEqualTo("accepted");
        });
        // the technique lines come before the weight / rep previews
        int lastTechnique = p.getLines().indexOf(p.getLines().stream()
            .filter(l -> WeekProposalLineJson.KIND_TECHNIQUE.equals(l.kind())).reduce((a, b) -> b).orElseThrow());
        assertThat(p.getLines().subList(lastTechnique + 1, p.getLines().size()))
            .allSatisfy(l -> assertThat(l.kind()).isIn("weight", "reps"));

        ExerciseEntity pec = fresh(c.pecDeck());
        assertThat(pec.isChallenge()).isTrue();
        assertThat(pec.getTechnique()).isNull();
        assertThat(pec.getTechniqueSource()).isEqualTo("planner");
        assertThat(pec.getWorkingSets()).isEqualTo(3);
        ExerciseEntity fly = fresh(c.cableFly());
        assertThat(fly.getTechnique()).isEqualTo("rest_drop");
        assertThat(fly.getTechniqueSource()).isEqualTo("planner");
        assertThat(fly.isChallenge()).isFalse();
        assertThat(fly.getWorkingSets()).isEqualTo(2);
        assertThat(p.getGroups()).filteredOn(g -> g.muscle().equals("chest")).singleElement().satisfies(g -> {
            assertThat(g.setsBefore()).isEqualTo(6);
            assertThat(g.setsAfter()).isEqualTo(5);
        });

        // the proposal read maps the new fields (the GET endpoint's mapper)
        WeekProposal dto = queryService.toDtos(List.of(p), mesocycleRepository.findById(c.meso().getId())
            .orElseThrow()).get(0);
        WeekProposalLine flyLine = dto.getLines().stream()
            .filter(l -> l.getKind() == WeekProposalLine.KindEnum.TECHNIQUE && !l.getChallenge()).findFirst()
            .orElseThrow();
        assertThat(flyLine.getFromTechnique()).isEqualTo(io.mrkuhne.mezo.api.dto.Technique.NONE);
        assertThat(flyLine.getToTechnique()).isEqualTo(io.mrkuhne.mezo.api.dto.Technique.REST_DROP);
        assertThat(flyLine.getFrom()).isEqualByComparingTo(BigDecimal.valueOf(3));
        assertThat(flyLine.getTo()).isEqualByComparingTo(BigDecimal.valueOf(2));
        assertThat(flyLine.getReasons()).containsExactly(WeekProposalReason.EMPHASIS);
        WeekProposalLine challengeLine = dto.getLines().stream()
            .filter(l -> l.getKind() == WeekProposalLine.KindEnum.TECHNIQUE && l.getChallenge()).findFirst()
            .orElseThrow();
        assertThat(challengeLine.getToTechnique()).isEqualTo(io.mrkuhne.mezo.api.dto.Technique.PARTIALS);
        assertThat(challengeLine.getReasons()).containsExactly(WeekProposalReason.CHALLENGE);
        assertThat(dto.getMuscles()).filteredOn(m -> m.getMuscle().equals("chest")).singleElement()
            .satisfies(m -> assertThat(m.getSetsAfter()).isEqualTo(5));
    }

    @Test
    void unflaggedRunGetsNoTechniqueLines() {
        Chest c = chest(3, NO_DELOAD, false);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(c.meso(), 3);
        assertThat(techniqueLines(p)).isEmpty();
        verify(planService, never()).snapshotRun(any(), any(), anyInt(), any());
        assertThat(fresh(c.cableFly()).getTechnique()).isNull();
        assertThat(fresh(c.pecDeck()).isChallenge()).isFalse();
        assertThat(fresh(c.cableFly()).getWorkingSets()).isEqualTo(3);
    }

    @Test
    void deloadWeekEmitsNoTechniqueLines() {
        Chest c = chest(3, DELOAD_IN_WEEK_3, true);
        ExerciseEntity fly = fresh(c.cableFly());
        fly.setTechnique("rest_drop");
        fly.setTechniqueSource("planner");
        fly.setWorkingSets(2);
        exerciseRepository.saveAndFlush(fly);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(c.meso(), 3);
        assertThat(p.getRestore()).isNotNull(); // the deload halved the sets…
        assertThat(techniqueLines(p)).isEmpty(); // …and moved no technique
        ExerciseEntity after = fresh(c.cableFly());
        assertThat(after.getTechnique()).isEqualTo("rest_drop");
        assertThat(after.getTechniqueSource()).isEqualTo("planner");
    }

    @Test
    void editedRowIsKept() {
        Chest c = chest(3, NO_DELOAD, true);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MesocycleEntity meso = mesocycleRepository.findById(c.meso().getId()).orElseThrow();
            MesoWeekProposalEntity p = proposals.build(owner, meso, 3).proposal();
            ExerciseEntity fly = exerciseRepository.findById(c.cableFly().getId()).orElseThrow();
            fly.setWorkingSets(4); // his edit after the proposal was built
            exerciseRepository.saveAndFlush(fly);
            proposals.apply(p);
        });

        MesoWeekProposalEntity p = weekly(c.meso(), 3);
        assertThat(techniqueLines(p)).extracting(WeekProposalLineJson::exerciseId, WeekProposalLineJson::decision)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(c.pecDeck().getId(), "accepted"),
                org.assertj.core.groups.Tuple.tuple(c.cableFly().getId(), "kept"));
        ExerciseEntity fly = fresh(c.cableFly());
        assertThat(fly.getWorkingSets()).isEqualTo(4);
        assertThat(fly.getTechnique()).isNull();
        assertThat(fly.getTechniqueSource()).isNull();
    }

    @Test
    void ownerRowGetsNoLine() {
        Chest c = chest(3, NO_DELOAD, true);
        ExerciseEntity fly = fresh(c.cableFly());
        fly.setTechnique("myo");
        fly.setTechniqueSource("owner");
        exerciseRepository.saveAndFlush(fly);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(c.meso(), 3);
        assertThat(techniqueLines(p)).extracting(WeekProposalLineJson::exerciseId)
            .doesNotContain(c.cableFly().getId());
        ExerciseEntity after = fresh(c.cableFly());
        assertThat(after.getTechnique()).isEqualTo("myo");
        assertThat(after.getTechniqueSource()).isEqualTo("owner");
        assertThat(after.getWorkingSets()).isEqualTo(3);
    }

    @Test
    void manualAcceptWritesTechnique() {
        Chest c = chest(3, NO_DELOAD, true);
        MesoWeekProposalEntity built = new TransactionTemplate(transactionManager).execute(status ->
            proposals.build(owner, mesocycleRepository.findById(c.meso().getId()).orElseThrow(), 3).proposal());
        WeekProposalLineJson flyLine = techniqueLines(built).stream()
            .filter(l -> l.exerciseId().equals(c.cableFly().getId())).findFirst().orElseThrow();

        WeekProposal after = decisions.decide(owner, c.meso().getId(), built.getId(), new WeekProposalDecisionRequest()
            .decisions(List.of(new WeekProposalLineDecision().lineId(flyLine.id())
                .decision(WeekProposalLineDecision.DecisionEnum.ACCEPTED))));

        assertThat(after.getStatus()).isEqualTo(WeekProposal.StatusEnum.PENDING); // the challenge line waits
        ExerciseEntity fly = fresh(c.cableFly());
        assertThat(fly.getTechnique()).isEqualTo("rest_drop");
        assertThat(fly.getTechniqueSource()).isEqualTo("planner");
        assertThat(fly.getWorkingSets()).isEqualTo(2);
        assertThat(fresh(c.pecDeck()).isChallenge()).isFalse();
    }

    @Test
    void plannerFailureLeavesProposalWithoutTechniqueLines() {
        Chest c = chest(3, NO_DELOAD, true);
        doThrow(new NullPointerException("planner bug")).when(planService).snapshotRun(any(), any(), anyInt(), any());

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = weekly(c.meso(), 3);
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(techniqueLines(p)).isEmpty();
        assertThat(fresh(c.cableFly()).getWorkingSets()).isEqualTo(3);
        assertThat(mesocycleRepository.findById(c.meso().getId()).orElseThrow().getVolumeRecompute().lastRun())
            .isEqualTo("W3");
    }

    @Test
    void removalLineAppliesAndClearsTheSource() {
        Chest c = chest(3, NO_DELOAD, true);
        ExerciseEntity fly = fresh(c.cableFly());
        fly.setTechnique("rest_drop");
        fly.setTechniqueSource("planner");
        fly.setWorkingSets(2);
        exerciseRepository.saveAndFlush(fly);
        MesoWeekProposalEntity proposal = new MesoWeekProposalEntity();
        proposal.setCreatedBy(owner);
        WeekProposalLineJson remove = new WeekProposalLineJson("l1", fly.getId(), "Cable Fly", 0, "chest",
            WeekProposalLineJson.KIND_TECHNIQUE, 2, 3, List.of("emphasis"), null, "Hét", null, null, "rest_drop",
            "none", false, null, null, null, null);

        WeekProposalLineJson stale = new WeekProposalLineJson("l0", fly.getId(), "Cable Fly", 0, "chest",
            WeekProposalLineJson.KIND_TECHNIQUE, 2, 3, List.of("emphasis"), null, "Hét", null, null, "myo",
            "none", false, null, null, null, null);
        assertThat(proposals.applySetLine(proposal, stale).decision()).isEqualTo("kept"); // technique differs
        assertThat(proposals.applySetLine(proposal, remove).decision()).isEqualTo("accepted");

        ExerciseEntity after = fresh(c.cableFly());
        assertThat(after.getTechnique()).isNull();
        assertThat(after.getTechniqueSource()).isNull();
        assertThat(after.getWorkingSets()).isEqualTo(3);
    }

    @Test
    void challengeLineIsKeptOnATechniqueRow() {
        Chest c = chest(3, NO_DELOAD, true);
        ExerciseEntity fly = fresh(c.cableFly());
        fly.setTechnique("rest_drop");
        fly.setTechniqueSource("planner");
        exerciseRepository.saveAndFlush(fly);
        MesoWeekProposalEntity proposal = new MesoWeekProposalEntity();
        proposal.setCreatedBy(owner);
        WeekProposalLineJson on = new WeekProposalLineJson("c1", fly.getId(), "Cable Fly", 0, "chest",
            WeekProposalLineJson.KIND_TECHNIQUE, 3, 3, List.of("challenge"), null, "Hét", null, null, "none",
            "partials", true, null, null, null, null);

        // its technique's removal was kept: the challenge must not land next to the technique
        assertThat(proposals.applySetLine(proposal, on).decision()).isEqualTo("kept");
        assertThat(fresh(c.cableFly()).isChallenge()).isFalse();
    }

    @Test
    void techniqueLineIsKeptOnAnUnsourcedPick() {
        Chest c = chest(3, NO_DELOAD, true);
        ExerciseEntity fly = fresh(c.cableFly());
        fly.setTechnique("myo");
        fly.setTechniqueSource(null);
        exerciseRepository.saveAndFlush(fly);
        MesoWeekProposalEntity proposal = new MesoWeekProposalEntity();
        proposal.setCreatedBy(owner);
        WeekProposalLineJson remove = new WeekProposalLineJson("t1", fly.getId(), "Cable Fly", 0, "chest",
            WeekProposalLineJson.KIND_TECHNIQUE, 3, 4, List.of("emphasis"), null, "Hét", null, null, "myo",
            "none", false, null, null, null, null);

        assertThat(proposals.applySetLine(proposal, remove).decision()).isEqualTo("kept");
        assertThat(fresh(c.cableFly()).getTechnique()).isEqualTo("myo");
        assertThat(fresh(c.cableFly()).getWorkingSets()).isEqualTo(3);
    }

    @Test
    void repRangeLineWritesTheRangeAndMarksTheOverride() {
        Chest c = chest(3, NO_DELOAD, true);
        ExerciseEntity fly = fresh(c.cableFly()); // rep range 6–8 from the populator
        MesoWeekProposalEntity proposal = new MesoWeekProposalEntity();
        proposal.setCreatedBy(owner);
        WeekProposalLineJson line = new WeekProposalLineJson("r1", fly.getId(), "Cable Fly", 0, "chest",
            WeekProposalLineJson.KIND_REP_RANGE, 8, 12, List.of("stalled"), null, "Hét", null, null, null, null,
            null, 6, 8, 8, 12);

        assertThat(proposals.applySetLine(proposal, line).decision()).isEqualTo("accepted");
        ExerciseEntity after = fresh(c.cableFly());
        assertThat(after.getRepMin()).isEqualTo(8);
        assertThat(after.getRepMax()).isEqualTo(12);
        assertThat(after.getOverrides()).containsExactly("repRange");

        // applied again: the row no longer holds 6–8 → kept, nothing written twice
        assertThat(proposals.applySetLine(proposal, line).decision()).isEqualTo("kept");
        assertThat(fresh(c.cableFly()).getOverrides()).containsExactly("repRange");
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    private ExerciseEntity exercise(WorkoutSessionEntity day, String name, int order, String slug) {
        UUID catalogId = catalogRepository.findBySlug(slug).orElseThrow().getId();
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, order, "chest-mid", "isolation", catalogId);
        e.setWorkingSets(3);
        return train.save(e);
    }

    private static List<WeekProposalLineJson> techniqueLines(MesoWeekProposalEntity p) {
        return p.getLines().stream().filter(l -> WeekProposalLineJson.KIND_TECHNIQUE.equals(l.kind())).toList();
    }

    private ExerciseEntity fresh(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow();
    }

    private MesoWeekProposalEntity weekly(MesocycleEntity meso, int week) {
        return proposalRepository.findWeekly(owner, meso.getId(), week).orElseThrow();
    }
}
