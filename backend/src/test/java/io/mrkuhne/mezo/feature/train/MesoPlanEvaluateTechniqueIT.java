package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluateRequest;
import io.mrkuhne.mezo.api.dto.MesoPlanEvaluation;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.PlannedChallenge;
import io.mrkuhne.mezo.api.dto.PlannedTechnique;
import io.mrkuhne.mezo.api.dto.Technique;
import io.mrkuhne.mezo.api.dto.TechniqueSource;
import io.mrkuhne.mezo.api.dto.TechniqueWarning;
import io.mrkuhne.mezo.api.dto.TrainingStyle;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * The evaluator shows the technique plan (mezo-r36n9.81, T3 Task 4): a draft with a style and the techniques flag
 * gets the planner's picks per path week (from week 3) and counts its own picks against the caps; a run shows the
 * STORED picks for its current week and the projection after; a block that does not opt in is unchanged (the
 * planner keys are present but JSON null: every path week's techniques / challenges and the techniqueWarnings).
 */
class MesoPlanEvaluateTechniqueIT extends ApiIntegrationTest {

    private static final String EVALUATE = "/api/train/meso-plans/evaluate";
    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final List<MesoPlanEvaluateRequest.PhaseCurveEnum> CURVE = List.of(
        MesoPlanEvaluateRequest.PhaseCurveEnum.MEV, MesoPlanEvaluateRequest.PhaseCurveEnum.MAV,
        MesoPlanEvaluateRequest.PhaseCurveEnum.MRV, MesoPlanEvaluateRequest.PhaseCurveEnum.DELOAD);

    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void draftShowsTechniquesFromWeekThree() {
        MesoPlanEvaluation e = evaluate(draft(TrainingStyle.BALANCED, true, day("Hét", pecDeck(), cableFly())));

        assertThat(e.getPath()).hasSize(4);
        assertThat(e.getPath().get(0).getTechniques()).isEmpty();
        assertThat(e.getPath().get(1).getTechniques()).isEmpty();
        assertThat(e.getPath().get(0).getChallenges()).containsExactly(
            PlannedChallenge.builder().dayIndex(0).exerciseIndex(0).build());
        assertThat(e.getPath().get(2).getTechniques()).containsExactly(PlannedTechnique.builder()
            .dayIndex(0).exerciseIndex(1).technique(Technique.REST_DROP).source(TechniqueSource.PLANNER).build());
        assertThat(e.getPath().get(3).getTechniques()).isEmpty(); // deload
        assertThat(e.getPath().get(3).getChallenges()).isEmpty();
        assertThat(e.getTechniqueWarnings()).isEmpty();
    }

    @Test
    void draftWithoutFlagShowsNone() {
        for (MesoPlanEvaluateRequest req : List.of(
            draft(TrainingStyle.BALANCED, null, day("Hét", pecDeck(), cableFly())),
            draft(null, true, day("Hét", pecDeck(), cableFly())))) {
            String json = postForBody(EVALUATE, req, ownerAuthHeaders(), HttpStatus.OK, String.class);
            assertUnflaggedShape(json);
        }
    }

    @Test
    void draftCapWeightCountsPicks() {
        GymExerciseInput picked = pecDeck();
        picked.setWorkingSets(5);
        picked.setTechnique(Technique.DROP);
        GymExerciseInput plainFive = cableFly();
        plainFive.setWorkingSets(5);

        // flag on: the owner's drop set weighs 2 → 6 against the exercise cap of 5; a plain 5 is fine
        MesoPlanEvaluation on = evaluate(draft(TrainingStyle.BALANCED, true, day("Hét", picked, plainFive)));
        assertThat(on.getDays().get(0).getExerciseCapWarnings()).singleElement()
            .satisfies(w -> {
                assertThat(w.getExerciseIndex()).isZero();
                assertThat(w.getSets()).isEqualTo(6);
                assertThat(w.getCap()).isEqualTo(5);
            });

        // flag off: the pick is not counted, exactly as today
        MesoPlanEvaluation off = evaluate(draft(TrainingStyle.BALANCED, null, day("Hét", picked, plainFive)));
        assertThat(off.getDays().get(0).getExerciseCapWarnings()).isEmpty();
    }

    @Test
    void runShowsStoredPicksThisWeek() {
        ownerId();
        MesocycleResponse run = startRun(TrainingStyle.BALANCED, true, day("Hét", pecDeck(), cableFly()));
        // week 1's challenge (Pec Deck) is stored by the start; this week's rest-drop is stored on the Cable Fly
        jdbcTemplate.update("update exercise set technique = 'rest_drop', technique_source = 'planner' "
            + "where name = 'Cable Fly' and workout_session_id in "
            + "(select id from workout_session where mesocycle_id = ? and template_session_id is null)", run.getId());
        jdbcTemplate.update("update mesocycle set current_week = 3 where id = ?", run.getId());

        MesoPlanEvaluation e = evaluateRun(run.getId());

        assertThat(e.getPath().get(0).getTechniques()).isEmpty();
        assertThat(e.getPath().get(1).getTechniques()).isEmpty();
        assertThat(e.getPath().get(0).getChallenges()).isEmpty();
        assertThat(e.getPath().get(2).getTechniques()).containsExactly(PlannedTechnique.builder()
            .dayIndex(0).exerciseIndex(1).technique(Technique.REST_DROP).source(TechniqueSource.PLANNER).build());
        assertThat(e.getPath().get(2).getChallenges()).containsExactly(
            PlannedChallenge.builder().dayIndex(0).exerciseIndex(0).build());
        assertThat(e.getPath().get(3).getTechniques()).isEmpty(); // deload projection
    }

    @Test
    void ownerOverAllowanceWarning() {
        GymExerciseInput a = pecDeck();
        a.setTechnique(Technique.DROP);
        GymExerciseInput b = cableFly();
        b.setTechnique(Technique.REST_DROP);
        GymExerciseInput c = legExtension();
        c.setTechnique(Technique.DROP);

        MesoPlanEvaluation e = evaluate(draft(TrainingStyle.BALANCED, true, day("Hét", a, b, c)));

        // three owner techniques on one day against an allowance of 2: nothing removed, a warning
        assertThat(e.getTechniqueWarnings()).extracting(TechniqueWarning::getCode)
            .contains(TechniqueWarning.CodeEnum.OWNER_OVER_ALLOWANCE);
        assertThat(e.getTechniqueWarnings()).extracting(TechniqueWarning::getCode).doesNotHaveDuplicates();
        assertThat(e.getPath().get(2).getTechniques()).hasSize(3)
            .extracting(PlannedTechnique::getSource).containsOnly(TechniqueSource.OWNER);
    }

    @Test
    void evaluationOfUnflaggedRunUnchanged() {
        ownerId();
        for (MesocycleResponse run : List.of(
            startRun(null, true, day("Hét", pecDeck(), cableFly())),
            startRun(TrainingStyle.BALANCED, null, day("Hét", pecDeck(), cableFly())))) {
            String json = getForBody("/api/train/mesocycles/" + run.getId() + "/evaluation", ownerAuthHeaders(),
                HttpStatus.OK, String.class);
            assertUnflaggedShape(json);
        }
    }

    /** An unflagged block: every path week's techniques / challenges and the techniqueWarnings are JSON null. */
    private void assertUnflaggedShape(String json) {
        JsonNode root = JsonMapper.builder().build().readTree(json);
        assertThat(root.has("techniqueWarnings")).isTrue();
        assertThat(root.get("techniqueWarnings").isNull()).isTrue();
        assertThat(root.get("path")).isNotEmpty().allSatisfy(week -> {
            assertThat(week.has("techniques")).isTrue();
            assertThat(week.get("techniques").isNull()).isTrue();
            assertThat(week.has("challenges")).isTrue();
            assertThat(week.get("challenges").isNull()).isTrue();
        });
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private MesoPlanEvaluation evaluate(MesoPlanEvaluateRequest req) {
        return postForBody(EVALUATE, req, ownerAuthHeaders(), HttpStatus.OK, MesoPlanEvaluation.class);
    }

    private MesoPlanEvaluation evaluateRun(UUID runId) {
        return getForBody("/api/train/mesocycles/" + runId + "/evaluation", ownerAuthHeaders(), HttpStatus.OK,
            MesoPlanEvaluation.class);
    }

    private MesoPlanEvaluateRequest draft(TrainingStyle style, Boolean techniquesEnabled, MesoDayInput... days) {
        return MesoPlanEvaluateRequest.builder().weeks(4).trainingStyle(style).techniquesEnabled(techniquesEnabled)
            .phaseCurve(CURVE).days(List.of(days)).build();
    }

    private MesocycleResponse startRun(TrainingStyle style, Boolean techniquesEnabled, MesoDayInput... days) {
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = MesoTemplateUpsertRequest.builder()
            .title("Terv sablon").shortTitle("Terv").goal("Hipertrófia").weeks(4)
            .split("Push · 2×/hét").style("RP · 4 hét").trainingStyle(style).techniquesEnabled(techniquesEnabled)
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV, MesoTemplateUpsertRequest.PhaseCurveEnum.MRV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .volumePerMuscle(Map.of("chest", VolumeBaseline.builder()
                .name("RP guidelines · intermediate").mev(8).mav(14).mrv(20).build()))
            .days(List.of(days))
            .build();
        MesoTemplateResponse t = postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        return postForBody(TEMPLATES + "/" + t.getId() + "/start",
            MesoTemplateStartRequest.builder().startDate(LocalDate.now())
                .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
    }

    private UUID catalog(String slug) {
        return catalogRepository.findBySlug(slug).orElseThrow().getId();
    }

    private static MesoDayInput day(String label, GymExerciseInput... exercises) {
        return MesoDayInput.builder().day(label).type("Push").muscle("chest").exercises(List.of(exercises)).build();
    }

    private GymExerciseInput pecDeck() {
        return ex("Pec Deck", "chest-mid", catalog("pec-deck"));
    }

    private GymExerciseInput cableFly() {
        return ex("Cable Fly", "chest-mid", catalog("cable-fly"));
    }

    private GymExerciseInput legExtension() {
        return ex("Leg Extension", "quad", catalog("leg-extension"));
    }

    private static GymExerciseInput ex(String name, String muscle, UUID catalogId) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(1).workingSets(3)
            .repMin(8).repMax(12).targetRIR(1).type(GymExerciseInput.TypeEnum.ISOLATION).catalogId(catalogId).build();
    }
}
