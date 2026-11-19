package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.Technique;
import io.mrkuhne.mezo.api.dto.TechniqueSource;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * Set techniques on the plan template and the run (mezo-r36n9.80, T2 Task 4): the template save
 * stores and validates the technique / challenge of each exercise (stable only; partials and the
 * challenge also lengthened-friendly; one challenge a day), a web save carries them over, and the
 * run inherits the block flag and the picks on start, rerun and day edit.
 */
class MesoTemplateTechniqueIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final String MESOCYCLES = "/api/train/mesocycles";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ExerciseCatalogRepository catalogRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private TrainService trainService;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private UUID catalog(String slug) {
        return catalogRepository.findBySlug(slug).orElseThrow().getId();
    }

    @Test
    void techniqueRoundTripsOnTemplate() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        GymExerciseInput fly = tech(ex("Cable Fly", "chest-mid", catalog("cable-fly")), Technique.REST_DROP);
        GymExerciseInput deck = challenge(ex("Pec Deck", "chest-mid", catalog("pec-deck")));
        GymExerciseInput plain = ex("Leg Extension", "quad", catalog("leg-extension"));

        MesoTemplateResponse t = postForBody(TEMPLATES, request(true, List.of(fly, deck, plain)), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(t.getTechniquesEnabled()).isTrue();
        List<GymExercise> e = t.getDays().get(0).getExercises();
        assertThat(e.get(0).getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(e.get(0).getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(e.get(1).getChallenge()).isTrue();
        assertThat(e.get(1).getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(e.get(2).getTechnique()).isNull();
        assertThat(e.get(2).getTechniqueSource()).isNull();
        // stored as WIRE values
        assertThat(jdbcTemplate.queryForObject(
            "select days->0->'exercises'->0->>'technique' from meso_template where id = ?",
            String.class, t.getId())).isEqualTo("rest_drop");
        assertThat(jdbcTemplate.queryForObject(
            "select techniques_enabled from meso_template where id = ?", Boolean.class, t.getId())).isTrue();
        MesoTemplateResponse read = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).get(0);
        assertThat(read.getTechniquesEnabled()).isTrue();
        assertThat(read.getDays().get(0).getExercises().get(0).getTechnique()).isEqualTo(Technique.REST_DROP);
    }

    @Test
    void webSaveCarriesTechniqueOver() throws Exception {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse created = postForBody(TEMPLATES, request(true, List.of(
            tech(ex("Cable Fly", "chest-mid", catalog("cable-fly")), Technique.MYO),
            challenge(ex("Pec Deck", "chest-mid", catalog("pec-deck"))))), auth,
            HttpStatus.OK, MesoTemplateResponse.class);
        JsonNode before = storedDays(created.getId());

        // the frozen web client: no technique field, no techniquesEnabled
        MesoTemplateResponse resaved = putForBody(TEMPLATES + "/" + created.getId(), webRequest(created), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(storedDays(created.getId())).isEqualTo(before);
        assertThat(resaved.getTechniquesEnabled()).isTrue();
        assertThat(resaved.getDays().get(0).getExercises().get(0).getTechnique()).isEqualTo(Technique.MYO);
        assertThat(resaved.getDays().get(0).getExercises().get(1).getChallenge()).isTrue();

        // an explicit "none" clears the pick and the challenge
        MesoTemplateUpsertRequest clear = webRequest(created);
        clear.getDays().get(0).getExercises().forEach(x -> {
            x.setTechnique(Technique.NONE);
            x.setChallenge(false);
        });
        MesoTemplateResponse cleared = putForBody(TEMPLATES + "/" + created.getId(), clear, auth,
            HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(cleared.getDays().get(0).getExercises().get(0).getTechnique()).isNull(); // none is stored (and echoed) as null
        assertThat(cleared.getDays().get(0).getExercises().get(1).getChallenge()).isFalse();
        assertThat(cleared.getDays().get(0).getExercises().get(0).getTechniqueSource()).isNull();
    }

    @Test
    void freeExerciseTechniqueRejected() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        GymExerciseInput bench = tech(ex("Barbell Bench Press", "chest-mid", catalog("barbell-bench-press")),
            Technique.DROP);

        String body = postForBody(TEMPLATES, request(true, List.of(bench)), auth, HttpStatus.BAD_REQUEST,
            String.class);

        assertHasRequestError(body, "TRAIN_TECHNIQUE_NOT_STABLE");
        assertThat(body).contains("Barbell Bench Press");
    }

    @Test
    void noCatalogIdIsFree() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        String body = postForBody(TEMPLATES, request(true, List.of(
            tech(ex("Saját gép", "chest-mid", null), Technique.MYO))), ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "TRAIN_TECHNIQUE_NOT_STABLE");
    }

    @Test
    void partialsOnNonLengthenedRejected() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        // machine chest press is stable but not lengthened-friendly
        String partials = postForBody(TEMPLATES, request(true, List.of(
            tech(ex("Machine Chest Press", "chest-mid", catalog("machine-chest-press")), Technique.PARTIALS))), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(partials, "TRAIN_TECHNIQUE_NOT_LENGTHENED");
        String chal = postForBody(TEMPLATES, request(true, List.of(
            challenge(ex("Machine Chest Press", "chest-mid", catalog("machine-chest-press"))))), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(chal, "TRAIN_TECHNIQUE_NOT_LENGTHENED");
        // a plain drop on it is fine
        postForBody(TEMPLATES, request(true, List.of(
            tech(ex("Machine Chest Press", "chest-mid", catalog("machine-chest-press")), Technique.DROP))), auth,
            HttpStatus.OK, MesoTemplateResponse.class);
    }

    @Test
    void twoChallengesOnADayRejected() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        String two = postForBody(TEMPLATES, request(true, List.of(
            challenge(ex("Cable Fly", "chest-mid", catalog("cable-fly"))),
            challenge(ex("Pec Deck", "chest-mid", catalog("pec-deck"))))), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(two, "TRAIN_TECHNIQUE_TWO_CHALLENGES");

        GymExerciseInput both = challenge(ex("Cable Fly", "chest-mid", catalog("cable-fly")));
        both.setTechnique(Technique.DROP);
        String onChallenge = postForBody(TEMPLATES, request(true, List.of(both)), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(onChallenge, "TRAIN_TECHNIQUE_ON_CHALLENGE");
    }

    @Test
    void runInheritsFlagAndTechniques() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse t = postForBody(TEMPLATES, request(true, List.of(
            tech(ex("Cable Fly", "chest-mid", catalog("cable-fly")), Technique.DROP),
            challenge(ex("Pec Deck", "chest-mid", catalog("pec-deck"))),
            ex("Leg Extension", "quad", catalog("leg-extension")))), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        MesocycleResponse run = postForBody(TEMPLATES + "/" + t.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(run.getTechniquesEnabled()).isTrue();
        assertThat(jdbcTemplate.queryForObject(
            "select techniques_enabled from mesocycle where id = ?", Boolean.class, run.getId())).isTrue();
        List<GymExercise> e = run.getDays().get(0).getExercises();
        assertThat(e.get(0).getTechnique()).isEqualTo(Technique.DROP);
        assertThat(e.get(0).getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(e.get(1).getChallenge()).isTrue();
        assertThat(jdbcTemplate.queryForObject(
            "select technique from exercise where name = 'Cable Fly'", String.class)).isEqualTo("drop");
        assertThat(jdbcTemplate.queryForObject(
            "select challenge from exercise where name = 'Pec Deck'", Boolean.class)).isTrue();
        MesocycleResponse listed = getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class).get(0);
        assertThat(listed.getTechniquesEnabled()).isTrue();
        assertThat(listed.getDays().get(0).getExercises().get(0).getTechnique()).isEqualTo(Technique.DROP);
    }

    @Test
    void rerunKeepsTechniques() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Technikás régi", "archived");
        jdbcTemplate.update("update mesocycle set techniques_enabled = true where id = ?", legacy.getId());
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, legacy.getId(), "Hét", "Push", 0, "planned");
        ExerciseEntity row = trainPopulator.createExercise(owner, day.getId(), "Cable Fly", "chest-mid", "isolation");
        row.setCatalogId(catalog("cable-fly"));
        row.setTechnique("myo");
        row.setTechniqueSource("owner");
        trainPopulator.save(row);
        ExerciseEntity row2 = trainPopulator.createExercise(owner, day.getId(), "Pec Deck", "chest-mid", "isolation");
        row2.setCatalogId(catalog("pec-deck"));
        row2.setChallenge(true);
        row2.setTechniqueSource("owner");
        trainPopulator.save(row2);

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + legacy.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        MesoTemplateResponse t = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
            .filter(x -> x.getId().equals(rerun.getTemplateId())).findFirst().orElseThrow();
        assertThat(t.getTechniquesEnabled()).isTrue();
        assertThat(t.getDays().get(0).getExercises().get(0).getTechnique()).isEqualTo(Technique.MYO);
        assertThat(t.getDays().get(0).getExercises().get(0).getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(t.getDays().get(0).getExercises().get(1).getChallenge()).isTrue();
    }

    @Test
    void runDayEditValidatesAndCarries() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse t = postForBody(TEMPLATES, request(true, List.of(
            tech(ex("Cable Fly", "chest-mid", catalog("cable-fly")), Technique.DROP),
            challenge(ex("Pec Deck", "chest-mid", catalog("pec-deck"))))), auth,
            HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + t.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);
        MesoDay day = run.getDays().get(0);

        // a web-style edit: no technique fields → carried from the old rows
        List<GymExerciseInput> inputs = new ArrayList<>(day.getExercises().stream()
            .map(MesoTemplateTechniqueIT::webInput).toList());
        MesoDay edited = trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs);
        assertThat(edited.getExercises().get(0).getTechnique()).isEqualTo(Technique.DROP);
        assertThat(edited.getExercises().get(0).getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(edited.getExercises().get(1).getChallenge()).isTrue();

        // a technique on a free movement is refused, and the day is left as it was
        List<GymExerciseInput> bad = new ArrayList<>(inputs);
        bad.add(tech(ex("Barbell Bench Press", "chest-mid", catalog("barbell-bench-press")), Technique.MYO));
        assertThatThrownBy(() -> trainService.replaceDayExercises(owner, run.getId(), day.getId(), bad))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getMessages().get(0).getCode())
                .isEqualTo("TRAIN_TECHNIQUE_NOT_STABLE"));
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from exercise where workout_session_id = ? and is_deleted = false",
            Integer.class, day.getId())).isEqualTo(2);
    }

    @Test
    void carriedPickThatBecameInvalidIsClearedNotBlocking() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse created = postForBody(TEMPLATES, request(true, List.of(
            tech(ex("Cable Fly", "chest-mid", catalog("cable-fly")), Technique.DROP),
            ex("Leg Extension", "quad", catalog("leg-extension")))), auth, HttpStatus.OK,
            MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);
        jdbcTemplate.update("update exercise_catalog set stability = 'free' where slug = 'cable-fly'");
        try {
            // a web resave of an unrelated field: the stale pick is cleared, no 400
            MesoTemplateUpsertRequest web = webRequest(created);
            web.setNotes("csak egy jegyzet");
            MesoTemplateResponse resaved = putForBody(TEMPLATES + "/" + created.getId(), web, auth,
                HttpStatus.OK, MesoTemplateResponse.class);
            GymExercise fly = resaved.getDays().get(0).getExercises().get(0);
            assertThat(fly.getTechnique()).isNull();
            assertThat(fly.getTechniqueSource()).isNull();
            assertThat(fly.getChallenge()).isFalse();

            // the same on a run day edit
            MesoDay day = run.getDays().get(0);
            List<GymExerciseInput> inputs = new ArrayList<>(day.getExercises().stream()
                .map(MesoTemplateTechniqueIT::webInput).toList());
            MesoDay edited = trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs);
            assertThat(edited.getExercises().get(0).getTechnique()).isNull();
            assertThat(edited.getExercises().get(0).getChallenge()).isFalse();
            // ...but SENDING a pick on the now-free movement is still refused
            inputs.get(0).setTechnique(Technique.DROP);
            assertThatThrownBy(() -> trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs))
                .isInstanceOf(SystemRuntimeErrorException.class);
        } finally {
            jdbcTemplate.update("update exercise_catalog set stability = 'stable' where slug = 'cable-fly'");
        }
    }

    @Test
    void runDayEditSendingTechniqueStoresWireAndOwner() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse t = postForBody(TEMPLATES, request(true, List.of(
            ex("Cable Fly", "chest-mid", catalog("cable-fly")))), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + t.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);
        MesoDay day = run.getDays().get(0);
        List<GymExerciseInput> inputs = new ArrayList<>(day.getExercises().stream()
            .map(MesoTemplateTechniqueIT::webInput).toList());
        inputs.get(0).setTechnique(Technique.REST_DROP);

        MesoDay edited = trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs);

        assertThat(edited.getExercises().get(0).getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(jdbcTemplate.queryForObject(
            "select technique from exercise where name = 'Cable Fly' and is_deleted = false", String.class))
            .isEqualTo("rest_drop");
        assertThat(jdbcTemplate.queryForObject(
            "select technique_source from exercise where name = 'Cable Fly' and is_deleted = false", String.class))
            .isEqualTo("owner");
    }

    /** A started flagged run whose Cable Fly carries a planner rest-drop (one straight set given back). */
    private MesocycleResponse runWithPlannerPick(HttpHeaders auth) {
        MesoTemplateResponse t = postForBody(TEMPLATES, request(true, List.of(
            ex("Cable Fly", "chest-mid", catalog("cable-fly")))), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + t.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);
        jdbcTemplate.update("update exercise set technique = 'rest_drop', technique_source = 'planner', "
            + "working_sets = 2 where name = 'Cable Fly' and is_deleted = false and workout_session_id = ?",
            run.getDays().get(0).getId());
        return run;
    }

    @Test
    void echoedPlannerPickStaysPlanner() {
        UUID owner = ownerId();
        MesocycleResponse run = runWithPlannerPick(ownerAuthHeaders());
        MesoDay day = run.getDays().get(0);
        // an iOS-style edit of another field: the planner's technique fields echoed back as they came
        List<GymExerciseInput> inputs = new ArrayList<>(day.getExercises().stream()
            .map(MesoTemplateTechniqueIT::webInput).toList());
        inputs.get(0).setWorkingSets(2);
        inputs.get(0).setTechnique(Technique.REST_DROP);
        inputs.get(0).setTechniqueSource(TechniqueSource.PLANNER);
        inputs.get(0).setChallenge(false);

        MesoDay edited = trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs);

        assertThat(edited.getExercises().get(0).getTechnique()).isEqualTo(Technique.REST_DROP);
        assertThat(edited.getExercises().get(0).getTechniqueSource()).isEqualTo(TechniqueSource.PLANNER);
        assertThat(jdbcTemplate.queryForObject(
            "select technique_source from exercise where name = 'Cable Fly' and is_deleted = false", String.class))
            .isEqualTo("planner");
    }

    @Test
    void ownerChangeOfPlannerPickBecomesOwner() {
        UUID owner = ownerId();
        MesocycleResponse run = runWithPlannerPick(ownerAuthHeaders());
        MesoDay day = run.getDays().get(0);
        List<GymExerciseInput> inputs = new ArrayList<>(day.getExercises().stream()
            .map(MesoTemplateTechniqueIT::webInput).toList());
        inputs.get(0).setWorkingSets(2);
        inputs.get(0).setTechnique(Technique.DROP); // his own change, even if the client echoes "planner"
        inputs.get(0).setTechniqueSource(TechniqueSource.PLANNER);

        MesoDay edited = trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs);

        assertThat(edited.getExercises().get(0).getTechnique()).isEqualTo(Technique.DROP);
        assertThat(edited.getExercises().get(0).getTechniqueSource()).isEqualTo(TechniqueSource.OWNER);
        assertThat(jdbcTemplate.queryForObject(
            "select technique_source from exercise where name = 'Cable Fly' and is_deleted = false", String.class))
            .isEqualTo("owner");
    }

    @Test
    void runDayEditWithTwoChallengesRejected() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse t = postForBody(TEMPLATES, request(true, List.of(
            ex("Cable Fly", "chest-mid", catalog("cable-fly")),
            ex("Pec Deck", "chest-mid", catalog("pec-deck")))), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + t.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);
        MesoDay day = run.getDays().get(0);
        List<GymExerciseInput> inputs = new ArrayList<>(day.getExercises().stream()
            .map(MesoTemplateTechniqueIT::webInput).toList());
        inputs.forEach(i -> i.setChallenge(true));

        assertThatThrownBy(() -> trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .satisfies(ex -> assertThat(((SystemRuntimeErrorException) ex).getMessages().get(0).getCode())
                .isEqualTo("TRAIN_TECHNIQUE_TWO_CHALLENGES"));
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from exercise where workout_session_id = ? and is_deleted = false",
            Integer.class, day.getId())).isEqualTo(2);
    }

    @Test
    void unflaggedTemplateIsUntouched() throws Exception {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse created = postForBody(TEMPLATES, request(null, List.of(
            ex("Cable Fly", "chest-mid", catalog("cable-fly")),
            ex("Barbell Bench Press", "chest-mid", catalog("barbell-bench-press")),
            ex("Saját", "back-mid", null))), auth, HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(created.getTechniquesEnabled()).isFalse();
        JsonNode stored = storedDays(created.getId());
        for (JsonNode e : stored.get(0).get("exercises")) {
            assertThat(e.get("technique") == null || e.get("technique").isNull()).isTrue();
            assertThat(e.get("techniqueSource") == null || e.get("techniqueSource").isNull()).isTrue();
        }
        putForBody(TEMPLATES + "/" + created.getId(), webRequest(created), auth, HttpStatus.OK,
            MesoTemplateResponse.class);
        assertThat(storedDays(created.getId())).isEqualTo(stored);
        assertThat(jdbcTemplate.queryForObject(
            "select techniques_enabled from meso_template where id = ?", Boolean.class, created.getId())).isFalse();
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private JsonNode storedDays(UUID templateId) throws Exception {
        JsonNode days = objectMapper.readTree(jdbcTemplate.queryForObject(
            "select days::text from meso_template where id = ?", String.class, templateId));
        for (JsonNode d : days) {
            for (JsonNode e : d.get("exercises")) {
                ((ObjectNode) e).remove("id");
            }
        }
        return days;
    }

    private static GymExerciseInput ex(String name, String muscle, UUID catalogId) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(1).workingSets(3)
            .repMin(8).repMax(12).targetRIR(1).type(GymExerciseInput.TypeEnum.ISOLATION).catalogId(catalogId).build();
    }

    private static GymExerciseInput tech(GymExerciseInput in, Technique t) {
        in.setTechnique(t);
        return in;
    }

    private static GymExerciseInput challenge(GymExerciseInput in) {
        in.setChallenge(true);
        return in;
    }

    /** What the frozen web client sends back: every field it knows, none of the new ones. */
    private static GymExerciseInput webInput(GymExercise g) {
        return GymExerciseInput.builder().name(g.getName()).muscle(g.getMuscle()).warmupSets(g.getWarmupSets())
            .workingSets(g.getWorkingSets()).repMin(g.getRepMin()).repMax(g.getRepMax()).targetRIR(g.getTargetRIR())
            .anchorWeightKg(g.getAnchorWeightKg()).type(GymExerciseInput.TypeEnum.fromValue(g.getType().getValue()))
            .warning(g.getWarning()).catalogId(g.getCatalogId()).countsTowardVolume(g.getCountsTowardVolume())
            .build();
    }

    private static MesoTemplateUpsertRequest webRequest(MesoTemplateResponse t) {
        return MesoTemplateUpsertRequest.builder().title(t.getTitle()).shortTitle(t.getShortTitle())
            .goal(t.getGoal()).weeks(t.getWeeks()).split(t.getSplit()).style(t.getStyle()).notes(t.getNotes())
            .phaseCurve(t.getPhaseCurve().stream()
                .map(p -> MesoTemplateUpsertRequest.PhaseCurveEnum.fromValue(p.getValue())).toList())
            .days(t.getDays().stream().map(d -> MesoDayInput.builder().day(d.getDay()).type(d.getType())
                .muscle(d.getMuscle()).muscleAccent(d.getMuscleAccent()).note(d.getNote())
                .exercises(d.getExercises().stream().map(MesoTemplateTechniqueIT::webInput).toList()).build()).toList())
            .volumePerMuscle(t.getVolumePerMuscle())
            .build();
    }

    private static MesoTemplateStartRequest start() {
        return MesoTemplateStartRequest.builder().startDate(LocalDate.now())
            .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build();
    }

    private static MesoTemplateUpsertRequest request(Boolean techniquesEnabled, List<GymExerciseInput> exercises) {
        return MesoTemplateUpsertRequest.builder()
            .title("Technika sablon").shortTitle("Technika").goal("Hipertrófia").weeks(4)
            .split("Push · 3×/hét").style("RP · 4 hét").techniquesEnabled(techniquesEnabled)
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV, MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .volumePerMuscle(Map.of("chest", VolumeBaseline.builder()
                .name("RP guidelines · intermediate").mev(8).mav(14).mrv(20).build()))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Push").muscle("chest")
                .exercises(exercises).build()))
            .build();
    }
}
