package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluation;
import io.mrkuhne.mezo.api.dto.MesocycleVolumeArcResponse;
import io.mrkuhne.mezo.api.dto.MuscleEvaluation;
import io.mrkuhne.mezo.api.dto.MuscleVolumeArc;
import io.mrkuhne.mezo.api.dto.VolumeArcWeek;
import io.mrkuhne.mezo.api.dto.VolumePathWeek;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoTemplateRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** The plan evaluator's two endpoints (volume engine v2 S2): a draft plan, and a run's own plan. */
class MesoPlanEvaluateContractIT extends ApiIntegrationTest {

    private static final String EVALUATE = "/api/train/meso-plans/evaluate";
    private static final List<MesoPlanEvaluateRequest.PhaseCurveEnum> CURVE = List.of(
        MesoPlanEvaluateRequest.PhaseCurveEnum.MEV, MesoPlanEvaluateRequest.PhaseCurveEnum.MAV,
        MesoPlanEvaluateRequest.PhaseCurveEnum.MRV, MesoPlanEvaluateRequest.PhaseCurveEnum.DELOAD);

    @Autowired TrainPopulator train;
    @Autowired GoalPopulator goals;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired MesoTemplateRepository templateRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired MuscleGroupVolumeLogRepository volumeLogRepository;

    private static GymExerciseInput ex(String name, String muscle, int sets) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(1).workingSets(sets)
            .repMin(6).repMax(10).targetRIR(1).type(GymExerciseInput.TypeEnum.COMPOUND).build();
    }

    private static MesoDayInput day(String label, GymExerciseInput... exercises) {
        return MesoDayInput.builder().day(label).type("Upper").exercises(List.of(exercises)).build();
    }

    private static MesoPlanEvaluateRequest.MesoPlanEvaluateRequestBuilder request(MesoDayInput... days) {
        return MesoPlanEvaluateRequest.builder().weeks(4).phaseCurve(CURVE).days(List.of(days));
    }

    private MesoPlanEvaluation evaluate(MesoPlanEvaluateRequest req) {
        return postForBody(EVALUATE, req, ownerAuthHeaders(), HttpStatus.OK, MesoPlanEvaluation.class);
    }

    private static MuscleEvaluation muscle(MesoPlanEvaluation e, String name) {
        return e.getMuscles().stream().filter(m -> m.getMuscle().equals(name)).findFirst().orElseThrow();
    }

    private static int step(MesoPlanEvaluation e, String group) {
        List<VolumePathWeek> path = e.getPath();
        return path.get(1).getMuscles().get(group) - path.get(0).getMuscles().get(group);
    }

    @Test
    void evaluatesAPlanAndNeverWrites() {
        long mesos = mesocycleRepository.count();
        long templates = templateRepository.count();
        long exercises = exerciseRepository.count();
        long proposals = proposalRepository.count();

        MesoPlanEvaluation e = evaluate(request(day("Hét", ex("Fekvenyomás", "chest", 3))).build());

        assertThat(muscle(e, "chest").getWeeklySets()).isEqualTo(3);
        assertThat(e.getDays()).hasSize(1);
        assertThat(e.getDays().get(0).getMinutesEstimate()).isPositive();
        assertThat(e.getDays().get(0).getOverTarget()).isNull();
        assertThat(e.getPath()).hasSize(4);
        assertThat(mesocycleRepository.count()).isEqualTo(mesos);
        assertThat(templateRepository.count()).isEqualTo(templates);
        assertThat(exerciseRepository.count()).isEqualTo(exercises);
        assertThat(proposalRepository.count()).isEqualTo(proposals);
    }

    @Test
    void styledPlanMinutesIncludePrescribedRest() {
        GymExerciseInput rested = ex("Fekvenyomás", "chest", 3);
        rested.setRestSec(180);
        MesoDayInput d = day("Hét", rested);
        MesoPlanEvaluation unstyled = evaluate(request(d).build());
        MesoPlanEvaluation styled = evaluate(request(d).trainingStyle(
            io.mrkuhne.mezo.api.dto.TrainingStyle.values()[0]).build());

        assertThat(unstyled.getDays().get(0).getMinutesEstimate()).isEqualTo(14);   // 2.4*3 + 1 + 6
        assertThat(styled.getDays().get(0).getMinutesEstimate()).isEqualTo(19);     // 3*220/60 + 1 + 1 + 6
    }

    @Test
    void evaluationCarriesBasisAndBudget() {
        MesoPlanEvaluation e = evaluate(request(
            day("Hét", ex("Fekvenyomás", "chest", 4), ex("Evezés", "back", 4)),
            day("Kedd", ex("Húzódzkodás", "back", 4)))
            .musclePriorities(Map.of("chest", "maintain")).sessionMinutesTarget(60).build());

        assertThat(muscle(e, "chest").getBasis().getSource())
            .isEqualTo(io.mrkuhne.mezo.api.dto.MuscleBasis.SourceEnum.MAINTAIN_THIRD);
        assertThat(muscle(e, "back").getBasis().getSource())
            .isEqualTo(io.mrkuhne.mezo.api.dto.MuscleBasis.SourceEnum.LANDMARKS_RP);
        assertThat(muscle(e, "back").getConsecutiveHeavy()).singleElement().satisfies(c -> {
            assertThat(c.getDayIndex()).isZero();
            assertThat(c.getNextDayIndex()).isEqualTo(1);
            assertThat(c.getSets()).isEqualTo(4);
            assertThat(c.getNextSets()).isEqualTo(4);
        });
        assertThat(muscle(e, "chest").getConsecutiveHeavy()).isEmpty();

        assertThat(e.getBudget()).isNotNull();
        assertThat(e.getBudget().getCapacitySets()).isPositive();
        assertThat(e.getBudget().getUsedSets()).isPositive();
        assertThat(e.getBudget().getEmphasizeCount()).isZero();
        assertThat(e.getBudget().getEmphasizeMax()).isEqualTo(2);
        assertThat(e.getBudget().getRaiseCost()).containsKeys("chest", "back");
    }

    @Test
    void deficitSlowsThePath() {
        // an active cut goal through the real goal populator + the real adapter (no mock)
        MesoPlanEvaluateRequest req = request(day("Hét", ex("Fekvenyomás", "chest", 3)))
            .musclePriorities(Map.of("chest", "emphasize")).build();
        MesoPlanEvaluation before = evaluate(req);
        assertThat(before.getDeficit()).isFalse();
        assertThat(step(before, "chest")).isEqualTo(2);

        goals.createGoal(ownerId(), "cut", "active");
        MesoPlanEvaluation cutting = evaluate(req);
        assertThat(cutting.getDeficit()).isTrue();
        assertThat(step(cutting, "chest")).isEqualTo(1);
    }

    @Test
    void sportScheduleSuggestsLegGroups() {
        train.createScheduleSlot(ownerId(), 1, "18:00", 90, "training"); // Kedd, volleyball
        MesoPlanEvaluation e = evaluate(request(day("Kedd", ex("Fekvenyomás", "chest", 3))).build());

        assertThat(e.getSportDays()).containsExactly(1);
        assertThat(e.getSuggestedSportGroups()).containsExactly("quad", "ham", "glute", "calf");
        assertThat(e.getDays().get(0).getSportSameDay()).isTrue();

        MesoPlanEvaluation explicit = evaluate(request(day("Kedd", ex("Fekvenyomás", "chest", 3)))
            .sportGroups(List.of("chest")).build());
        assertThat(explicit.getSuggestedSportGroups()).isEmpty();
    }

    @Test
    void explicitSportGroupsLowerTheBand() {
        MesoDayInput d = day("Hét", ex("Guggolás", "quad", 4));
        MuscleEvaluation plain = muscle(evaluate(request(d).build()), "quad");
        MuscleEvaluation loaded = muscle(evaluate(request(d).sportGroups(List.of("quad")).build()), "quad");

        assertThat(plain.getBand().getSportAdjusted()).isFalse();
        assertThat(loaded.getBand().getSportAdjusted()).isTrue();
        assertThat(loaded.getBand().getLow()).isLessThan(plain.getBand().getLow());
    }

    @Test
    void invalidTierIs400() {
        postForBody(EVALUATE, request(day("Hét", ex("Fekvenyomás", "chest", 3)))
            .musclePriorities(Map.of("chest", "bogus")).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        postForBody(EVALUATE, request(day("Hét", ex("Fekvenyomás", "chest", 3)))
            .sportGroups(List.of("wing")).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void phaseCurveLengthMismatchIs400() {
        postForBody(EVALUATE, request(day("Hét", ex("Fekvenyomás", "chest", 3))).weeks(6).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
    }

    @Test
    void exerciseAboveTheCapIsWarned() {
        MesoPlanEvaluation e = evaluate(request(day("Hét", ex("Fekvenyomás", "chest", 3),
            ex("Dőlt", "chest", 7))).build());
        assertThat(e.getDays().get(0).getExerciseCapWarnings()).hasSize(1);
        assertThat(e.getDays().get(0).getExerciseCapWarnings().get(0).getExerciseIndex()).isEqualTo(1);
        assertThat(e.getDays().get(0).getExerciseCapWarnings().get(0).getSets()).isEqualTo(7);
        assertThat(e.getDays().get(0).getExerciseCapWarnings().get(0).getCap()).isEqualTo(5);
    }

    @Test
    void runEvaluationReportsTheSessionOrderIndexAndNeverWrites() {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(ownerId(), 0, 4, List.of("MEV", "MAV", "MRV", "Deload"));
        WorkoutSessionEntity thu = train.createWorkoutSession(ownerId(), meso.getId(), "Csüt", "gym", 3, "active");
        var e1 = train.createExercise(ownerId(), thu.getId(), "Fekvenyomás", "chest", "compound");
        e1.setWorkingSets(3);
        train.save(e1);
        long mesos = mesocycleRepository.count();
        long exercises = exerciseRepository.count();
        long proposals = proposalRepository.count();
        long logs = volumeLogRepository.count();

        MesoPlanEvaluation e = getForBody("/api/train/mesocycles/" + meso.getId() + "/evaluation",
            ownerAuthHeaders(), HttpStatus.OK, MesoPlanEvaluation.class);

        assertThat(e.getDays()).hasSize(1);
        assertThat(e.getDays().get(0).getDayIndex()).isEqualTo(3);
        assertThat(muscle(e, "chest").getSpread().get(0).getDayIndex()).isEqualTo(3);
        assertThat(mesocycleRepository.count()).isEqualTo(mesos);
        assertThat(exerciseRepository.count()).isEqualTo(exercises);
        assertThat(proposalRepository.count()).isEqualTo(proposals);
        assertThat(volumeLogRepository.count()).isEqualTo(logs);
    }

    @Test
    void anArchivedRunsEvaluationIgnoresTheDeficit() {
        MesocycleEntity meso = runWithChest(ownerId(), 3);
        meso.setStatus("archived");
        mesocycleRepository.saveAndFlush(meso);
        goals.createGoal(ownerId(), "cut", "active");

        MesoPlanEvaluation e = getForBody("/api/train/mesocycles/" + meso.getId() + "/evaluation",
            ownerAuthHeaders(), HttpStatus.OK, MesoPlanEvaluation.class);
        assertThat(e.getDeficit()).isFalse();
    }

    @Test
    void runEvaluationOfAForeignRunIs404() {
        RegisteredUser other = registerUser("evaluate-foreign");
        MesocycleEntity foreign = train.activeMesoStartedWeeksAgo(other.id(), 0, 4,
            List.of("MEV", "MAV", "MRV", "Deload"));
        getForBody("/api/train/mesocycles/" + foreign.getId() + "/evaluation", ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);
        getForBody("/api/train/mesocycles/" + UUID.randomUUID() + "/evaluation", ownerAuthHeaders(),
            HttpStatus.NOT_FOUND, String.class);
    }

    private MesocycleEntity runWithChest(UUID owner, int sets) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 0, 4, List.of("MEV", "MAV", "MRV", "Deload"));
        meso.setMusclePriorities(Map.of("chest", "emphasize"));
        meso.setSportGroups(List.of("quad"));
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(owner, meso.getId(), "Hét", "gym", 0, "active");
        var e = train.createExercise(owner, mon.getId(), "Fekvenyomás", "chest", "compound");
        e.setWorkingSets(sets);
        train.save(e);
        return meso;
    }

    @Test
    void runEvaluationUsesTheRunsPlan() {
        MesocycleEntity meso = runWithChest(ownerId(), 3);

        MesoPlanEvaluation e = getForBody("/api/train/mesocycles/" + meso.getId() + "/evaluation",
            ownerAuthHeaders(), HttpStatus.OK, MesoPlanEvaluation.class);

        MuscleEvaluation chest = muscle(e, "chest");
        assertThat(chest.getTier()).isEqualTo(MuscleEvaluation.TierEnum.EMPHASIZE);
        assertThat(chest.getWeeklySets()).isEqualTo(3);
        assertThat(e.getDays()).hasSize(1);
        assertThat(e.getDays().get(0).getDay()).isEqualTo("Hét");
        assertThat(e.getPath()).hasSize(4);
    }

    @Test
    void arcAndEvaluationAgree() {
        MesocycleEntity meso = runWithChest(ownerId(), 3);
        train.createVolumeLog(ownerId(), meso.getId(), "chest", 3);

        MesoPlanEvaluation e = getForBody("/api/train/mesocycles/" + meso.getId() + "/evaluation",
            ownerAuthHeaders(), HttpStatus.OK, MesoPlanEvaluation.class);
        MesocycleVolumeArcResponse arc = getForBody("/api/train/mesocycles/" + meso.getId() + "/volume-arc",
            ownerAuthHeaders(), HttpStatus.OK, MesocycleVolumeArcResponse.class);

        assertThat(arc.getMuscles()).isNotEmpty();
        for (MuscleVolumeArc m : arc.getMuscles()) {
            for (VolumeArcWeek w : m.getWeeks()) {
                VolumePathWeek pw = e.getPath().get(w.getWeek() - 1);
                assertThat(pw.getMuscles().get(m.getMuscle()))
                    .as("%s week %d", m.getMuscle(), w.getWeek()).isEqualTo(w.getPlanned());
            }
        }
    }

    /** Find-or-create yields the demodata-seeded owner's id — the single-user principal. */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Autowired private io.mrkuhne.mezo.feature.auth.OwnerProperties ownerProperties;
}
