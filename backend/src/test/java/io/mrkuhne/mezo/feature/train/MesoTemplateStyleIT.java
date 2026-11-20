package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;
import io.mrkuhne.mezo.api.dto.CustomWorkoutResponse;
import io.mrkuhne.mezo.api.dto.CustomWorkoutUpsertRequest;
import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.StyleOverride;
import io.mrkuhne.mezo.api.dto.TrainingStyle;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Training style on the plan template and the run (mezo-r36n9.79, T1 Task 4): the template save
 * stamps every exercise with its style's prescription, owner overrides survive, a web save (which
 * never sends a style field) carries them over, an unstyled template is byte-identical, and the run
 * inherits, keeps and re-stamps the style on start, rerun and day edit.
 */
class MesoTemplateStyleIT extends ApiIntegrationTest {

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
    void styledTemplateStampsExercises() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = request(TrainingStyle.BALANCED, List.of(
            ex("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, catalog("machine-chest-press")),
            ex("Leg Press", "quad", GymExerciseInput.TypeEnum.COMPOUND, catalog("leg-press")),
            ex("Cable Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION, catalog("cable-fly")),
            styled(ex("Barbell Bench Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
                catalog("barbell-bench-press")), TrainingStyle.ALLOUT),
            styled(ex("Chest Supported Row", "back-mid", GymExerciseInput.TypeEnum.COMPOUND,
                catalog("chest-supported-row")), TrainingStyle.ALLOUT),
            styled(ex("Saját nyomás", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND, null), TrainingStyle.ALLOUT),
            ex("Box Jump", "quad", GymExerciseInput.TypeEnum.PLYO, null)));

        MesoTemplateResponse t = postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(t.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
        List<GymExercise> e = t.getDays().get(0).getExercises();
        // balanced, stable compound: 6–10 at the stable-compound reserve 1 (mezo-r36n9.115), 150 s, the plan's sets
        assertStamp(e.get(0), 6, 10, 3, 1, 150, TrainingStyle.BALANCED);
        // balanced (stable) leg compound: the leg reserve 3 outranks the stable-compound reserve
        assertStamp(e.get(1), 6, 10, 3, 3, 150, TrainingStyle.BALANCED);
        // balanced isolation: 10–15 at the isolation reserve 1, 90 s
        assertStamp(e.get(2), 10, 15, 3, 1, 90, TrainingStyle.BALANCED);
        // all-out on a FREE compound falls back to heavy at reserve 1 and says so
        assertStamp(e.get(3), 5, 8, 3, 1, 180, TrainingStyle.HEAVY);
        assertThat(e.get(3).getTrainingStyle()).isEqualTo(TrainingStyle.ALLOUT);
        // all-out on a STABLE compound: two sets to failure
        assertStamp(e.get(4), 6, 10, 2, 0, 180, TrainingStyle.ALLOUT);
        // no catalog link = free
        assertStamp(e.get(5), 5, 8, 3, 1, 180, TrainingStyle.HEAVY);
        // plyo is never stamped
        assertStamp(e.get(6), 8, 12, 3, 1, null, null);
        assertThat(e.get(6).getTrainingStyle()).isNull();
    }

    @Test
    void ownerOverrideSurvivesSave() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        GymExerciseInput press = styled(ex("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("machine-chest-press")), TrainingStyle.BALANCED);
        press.setRepMin(12);
        press.setRepMax(15);
        press.setRestSec(200);
        press.setOverrides(List.of(StyleOverride.REP_RANGE, StyleOverride.REST_SEC));

        MesoTemplateResponse t = postForBody(TEMPLATES, request(TrainingStyle.VOLUME, List.of(press)), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        GymExercise saved = t.getDays().get(0).getExercises().get(0);
        // overridden: kept; not overridden: stamped (balanced stable-compound reserve 1, the exercise's own style)
        assertStamp(saved, 12, 15, 3, 1, 200, TrainingStyle.BALANCED);
        assertThat(saved.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
        assertThat(saved.getOverrides()).containsExactly(StyleOverride.REP_RANGE, StyleOverride.REST_SEC);

        // stored as WIRE values, never the Java constant names
        assertThat(jdbcTemplate.queryForObject(
            "select training_style from meso_template where id = ?", String.class, t.getId())).isEqualTo("volume");
        assertThat(jdbcTemplate.queryForObject(
            "select days->0->'exercises'->0->>'trainingStyle' from meso_template where id = ?",
            String.class, t.getId())).isEqualTo("balanced");
        assertThat(jdbcTemplate.queryForObject(
            "select days->0->'exercises'->0->'overrides'->>0 from meso_template where id = ?",
            String.class, t.getId())).isEqualTo("repRange");

        // ...and read back as such
        MesoTemplateResponse read = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).get(0);
        assertThat(read.getTrainingStyle()).isEqualTo(TrainingStyle.VOLUME);
        assertThat(read.getDays().get(0).getExercises().get(0).getOverrides())
            .containsExactly(StyleOverride.REP_RANGE, StyleOverride.REST_SEC);
    }

    @Test
    void webSaveCarriesStyleFieldsOver() throws Exception {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        GymExerciseInput press = ex("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("machine-chest-press"));
        press.setRepMin(12);
        press.setRepMax(15);
        press.setOverrides(List.of(StyleOverride.REP_RANGE));
        GymExerciseInput fly = styled(ex("Cable Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION,
            catalog("cable-fly")), TrainingStyle.HEAVY);
        GymExerciseInput own = ex("Saját húzás", "back-mid", GymExerciseInput.TypeEnum.COMPOUND, null);
        own.setRestSec(240);
        own.setOverrides(List.of(StyleOverride.REST_SEC));
        MesoTemplateResponse created = postForBody(TEMPLATES, request(TrainingStyle.BALANCED,
            List.of(press, fly, own)), auth, HttpStatus.OK, MesoTemplateResponse.class);
        JsonNode before = storedDays(created.getId());

        // The frozen web client echoes the plan back without any style field (block or exercise).
        MesoTemplateUpsertRequest webSave = webRequest(created);
        MesoTemplateResponse resaved = putForBody(TEMPLATES + "/" + created.getId(), webSave, auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(storedDays(created.getId())).isEqualTo(before);
        assertThat(resaved.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
        assertThat(resaved.getDays().get(0).getExercises().get(0).getOverrides())
            .containsExactly(StyleOverride.REP_RANGE);
        assertThat(resaved.getDays().get(0).getExercises().get(1).getTrainingStyle()).isEqualTo(TrainingStyle.HEAVY);
        assertThat(resaved.getDays().get(0).getExercises().get(2).getRestSec()).isEqualTo(240);
    }

    @Test
    void unstyledTemplateIsUntouched() throws Exception {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = request(null, List.of(
            GymExerciseInput.builder().name("Bench Press").muscle("chest").warmupSets(2).workingSets(4)
                .repMin(6).repMax(8).targetRIR(2).anchorWeightKg(new BigDecimal("60.00")).warning("Váll")
                .type(GymExerciseInput.TypeEnum.COMPOUND).catalogId(catalog("barbell-bench-press")).build(),
            ex("Cable Fly", "chest", GymExerciseInput.TypeEnum.ISOLATION, null),
            ex("Box Jump", "quad", GymExerciseInput.TypeEnum.PLYO, null)));

        MesoTemplateResponse created = postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(created.getTrainingStyle()).isNull();
        List<GymExercise> out = created.getDays().get(0).getExercises();
        for (int i = 0; i < out.size(); i++) {
            GymExerciseInput in = req.getDays().get(0).getExercises().get(i);
            GymExercise o = out.get(i);
            assertThat(o.getRepMin()).isEqualTo(in.getRepMin());
            assertThat(o.getRepMax()).isEqualTo(in.getRepMax());
            assertThat(o.getWorkingSets()).isEqualTo(in.getWorkingSets());
            assertThat(o.getTargetRIR()).isEqualTo(in.getTargetRIR());
            assertThat(o.getRestSec()).isNull();
            assertThat(o.getTrainingStyle()).isNull();
            assertThat(o.getEffectiveTrainingStyle()).isNull();
            assertThat(o.getOverrides()).isNullOrEmpty();
        }
        JsonNode stored = storedDays(created.getId());
        for (JsonNode e : stored.get(0).get("exercises")) {
            assertThat(e.get("trainingStyle").isNull()).isTrue();
            assertThat(e.get("restSec").isNull()).isTrue();
            assertThat(e.get("overrides").isNull()).isTrue();
        }
        assertThat(jdbcTemplate.queryForObject(
            "select training_style from meso_template where id = ?", String.class, created.getId())).isNull();

        // a web round-trip stores the very same document
        putForBody(TEMPLATES + "/" + created.getId(), webRequest(created), auth, HttpStatus.OK,
            MesoTemplateResponse.class);
        assertThat(storedDays(created.getId())).isEqualTo(stored);
    }

    @Test
    void runInheritsStyleOnStart() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        GymExerciseInput press = ex("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("machine-chest-press"));
        press.setRepMin(12);
        press.setRepMax(15);
        press.setOverrides(List.of(StyleOverride.REP_RANGE));
        GymExerciseInput bench = styled(ex("Barbell Bench Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("barbell-bench-press")), TrainingStyle.ALLOUT);
        MesoTemplateResponse t = postForBody(TEMPLATES, request(TrainingStyle.BALANCED, List.of(press, bench)), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        MesocycleResponse run = postForBody(TEMPLATES + "/" + t.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(run.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
        assertThat(jdbcTemplate.queryForObject(
            "select training_style from mesocycle where id = ?", String.class, run.getId())).isEqualTo("balanced");
        List<GymExercise> e = run.getDays().get(0).getExercises();
        assertStamp(e.get(0), 12, 15, 3, 1, 150, TrainingStyle.BALANCED);
        assertThat(e.get(0).getOverrides()).containsExactly(StyleOverride.REP_RANGE);
        assertStamp(e.get(1), 5, 8, 3, 1, 180, TrainingStyle.HEAVY);
        assertThat(e.get(1).getTrainingStyle()).isEqualTo(TrainingStyle.ALLOUT);
        assertThat(jdbcTemplate.queryForList(
            "select training_style from exercise where name = 'Barbell Bench Press'", String.class))
            .containsExactly("allout");
        assertThat(jdbcTemplate.queryForObject(
            "select overrides->>0 from exercise where name = 'Machine Chest Press'", String.class))
            .isEqualTo("repRange");
        // the list read carries the same
        MesocycleResponse listed = getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class).get(0);
        assertThat(listed.getTrainingStyle()).isEqualTo(TrainingStyle.BALANCED);
        assertThat(listed.getDays().get(0).getExercises().get(1).getEffectiveTrainingStyle())
            .isEqualTo(TrainingStyle.HEAVY);
    }

    @Test
    void rerunKeepsStyleFields() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Stílusos régi", "archived");
        jdbcTemplate.update("update mesocycle set training_style = 'heavy' where id = ?", legacy.getId());
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, legacy.getId(), "Hét", "Push", 0, "planned");
        ExerciseEntity row = trainPopulator.createExercise(owner, day.getId(), "Machine Chest Press", "chest-mid", "compound");
        row.setCatalogId(catalog("machine-chest-press"));
        row.setTrainingStyle("volume");
        row.setRestSec(200);
        row.setOverrides(List.of("restSec"));
        trainPopulator.save(row);

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + legacy.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        MesoTemplateResponse t = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
            .filter(x -> x.getId().equals(rerun.getTemplateId())).findFirst().orElseThrow();
        assertThat(t.getTrainingStyle()).isEqualTo(TrainingStyle.HEAVY);
        GymExercise e = t.getDays().get(0).getExercises().get(0);
        assertThat(e.getTrainingStyle()).isEqualTo(TrainingStyle.VOLUME);
        assertThat(e.getRestSec()).isEqualTo(200);
        assertThat(e.getOverrides()).containsExactly(StyleOverride.REST_SEC);
        assertThat(e.getEffectiveTrainingStyle()).isEqualTo(TrainingStyle.VOLUME);
        assertThat(jdbcTemplate.queryForObject(
            "select days->0->'exercises'->0->>'trainingStyle' from meso_template where id = ?",
            String.class, t.getId())).isEqualTo("volume");
    }

    @Test
    void runDayEditRestampsUnderRunStyle() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        GymExerciseInput press = ex("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("machine-chest-press"));
        press.setRepMin(12);
        press.setRepMax(15);
        press.setOverrides(List.of(StyleOverride.REP_RANGE));
        GymExerciseInput fly = styled(ex("Cable Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION,
            catalog("cable-fly")), TrainingStyle.HEAVY);
        MesoTemplateResponse t = postForBody(TEMPLATES, request(TrainingStyle.BALANCED, List.of(press, fly)), auth,
            HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + t.getId() + "/start", start(), auth,
            HttpStatus.OK, MesocycleResponse.class);
        MesoDay day = run.getDays().get(0);

        // A web-style day edit: no style field, a hand-typed range on the fly, one new exercise.
        List<GymExerciseInput> inputs = day.getExercises().stream().map(MesoTemplateStyleIT::webInput)
            .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));
        inputs.get(1).setRepMin(20);
        inputs.get(1).setRepMax(30);
        inputs.add(ex("Leg Press", "quad", GymExerciseInput.TypeEnum.COMPOUND, catalog("leg-press")));
        MesoDay edited = trainService.replaceDayExercises(owner, run.getId(), day.getId(), inputs);

        List<GymExercise> e = edited.getExercises();
        // carried override: the owner's range stays
        assertStamp(e.get(0), 12, 15, 3, 1, 150, TrainingStyle.BALANCED);
        assertThat(e.get(0).getOverrides()).containsExactly(StyleOverride.REP_RANGE);
        // carried exercise style, no override: re-stamped back to heavy isolation (isolation reserve 1)
        assertStamp(e.get(1), 8, 12, 3, 1, 120, TrainingStyle.HEAVY);
        assertThat(e.get(1).getTrainingStyle()).isEqualTo(TrainingStyle.HEAVY);
        // the new exercise is stamped under the run's style (leg reserve)
        assertStamp(e.get(2), 6, 10, 3, 3, 150, TrainingStyle.BALANCED);
        assertThat(jdbcTemplate.queryForObject(
            "select rest_sec from exercise where name = 'Leg Press' and is_deleted = false", Integer.class))
            .isEqualTo(150);
    }

    @Test
    void styledExerciseInUnstyledTemplateIsNotStamped() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        GymExerciseInput press = styled(ex("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("machine-chest-press")), TrainingStyle.ALLOUT);
        GymExerciseInput fly = styled(ex("Cable Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION,
            catalog("cable-fly")), TrainingStyle.HEAVY);
        fly.setRestSec(75);

        MesoTemplateResponse t = postForBody(TEMPLATES, request(null, List.of(press, fly)), auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        // spec §11.3: an unstyled block is never stamped — input values, the exercise style kept
        List<GymExercise> e = t.getDays().get(0).getExercises();
        assertStamp(e.get(0), 8, 12, 3, 1, null, null);
        assertThat(e.get(0).getTrainingStyle()).isEqualTo(TrainingStyle.ALLOUT);
        assertStamp(e.get(1), 8, 12, 3, 1, 75, null);
        assertThat(e.get(1).getTrainingStyle()).isEqualTo(TrainingStyle.HEAVY);
        MesoTemplateResponse read = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).get(0);
        assertThat(read.getDays().get(0).getExercises().get(0).getTrainingStyle()).isEqualTo(TrainingStyle.ALLOUT);
        assertThat(read.getDays().get(0).getExercises().get(0).getEffectiveTrainingStyle()).isNull();
    }

    @Test
    void styledExerciseInCustomWorkoutIsNotStamped() {
        UUID owner = ownerId();
        GymExerciseInput press = styled(ex("Machine Chest Press", "chest-mid", GymExerciseInput.TypeEnum.COMPOUND,
            catalog("machine-chest-press")), TrainingStyle.VOLUME);
        GymExerciseInput fly = styled(ex("Cable Fly", "chest-mid", GymExerciseInput.TypeEnum.ISOLATION,
            catalog("cable-fly")), TrainingStyle.HEAVY);
        fly.setRestSec(75);

        CustomWorkoutResponse created = trainService.createCustomWorkout(owner,
            CustomWorkoutUpsertRequest.builder().name("Saját").exercises(List.of(press, fly)).build());

        List<GymExercise> e = created.getExercises();
        assertStamp(e.get(0), 8, 12, 3, 1, null, null);
        assertThat(e.get(0).getTrainingStyle()).isEqualTo(TrainingStyle.VOLUME);
        assertStamp(e.get(1), 8, 12, 3, 1, 75, null);
        // a web-style update (no style field) carries the exercise's own fields over, still unstamped
        CustomWorkoutResponse updated = trainService.updateCustomWorkout(owner, created.getId(),
            CustomWorkoutUpsertRequest.builder().name("Saját").exercises(e.stream().map(MesoTemplateStyleIT::webInput)
                .toList()).build());
        assertThat(updated.getExercises().get(0).getTrainingStyle()).isEqualTo(TrainingStyle.VOLUME);
        assertThat(updated.getExercises().get(1).getTrainingStyle()).isEqualTo(TrainingStyle.HEAVY);
        assertStamp(updated.getExercises().get(1), 8, 12, 3, 1, 75, null);
        assertThat(trainService.listCustomWorkouts(owner).get(0).getExercises().get(0).getEffectiveTrainingStyle())
            .isNull();
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    private static void assertStamp(GymExercise e, int repMin, int repMax, int sets, int rir, Integer restSec,
                                    TrainingStyle effective) {
        assertThat(e.getRepMin()).as(e.getName() + " repMin").isEqualTo(repMin);
        assertThat(e.getRepMax()).as(e.getName() + " repMax").isEqualTo(repMax);
        assertThat(e.getWorkingSets()).as(e.getName() + " workingSets").isEqualTo(sets);
        assertThat(e.getTargetRIR()).as(e.getName() + " targetRIR").isEqualTo(rir);
        assertThat(e.getRestSec()).as(e.getName() + " restSec").isEqualTo(restSec);
        assertThat(e.getEffectiveTrainingStyle()).as(e.getName() + " effective").isEqualTo(effective);
    }

    /** The stored days document with the per-save recipe ids stripped (they re-mint on every save). */
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

    private static GymExerciseInput ex(String name, String muscle, GymExerciseInput.TypeEnum type, UUID catalogId) {
        return GymExerciseInput.builder().name(name).muscle(muscle).warmupSets(1).workingSets(3)
            .repMin(8).repMax(12).targetRIR(1).type(type).catalogId(catalogId).build();
    }

    private static GymExerciseInput styled(GymExerciseInput in, TrainingStyle style) {
        in.setTrainingStyle(style);
        return in;
    }

    /** What the frozen web client sends back: every field it knows, none of the style fields. */
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
                .exercises(d.getExercises().stream().map(MesoTemplateStyleIT::webInput).toList()).build()).toList())
            .build();
    }

    private static MesoTemplateStartRequest start() {
        return MesoTemplateStartRequest.builder().startDate(LocalDate.now())
            .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build();
    }

    private static MesoTemplateUpsertRequest request(TrainingStyle style, List<GymExerciseInput> exercises) {
        return MesoTemplateUpsertRequest.builder()
            .title("Stílus sablon").shortTitle("Stílus").goal("Hipertrófia").weeks(4)
            .split("Push · 3×/hét").style("RP · 4 hét").trainingStyle(style)
            .phaseCurve(List.of(MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV, MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .volumePerMuscle(Map.of("chest", VolumeBaseline.builder()
                .name("RP guidelines · intermediate").mev(8).mav(14).mrv(20).build()))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Push").muscle("chest")
                .exercises(exercises).build()))
            .build();
    }
}
