package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * HTTP-level tests for the meso TEMPLATE/RUN split (mezo-meyc.1): template CRUD
 * ({@code /api/train/meso-templates}), stamping a run from a template
 * ({@code .../{id}/start}) and materializing a template out of a legacy run
 * ({@code /api/train/mesocycles/{id}/rerun}).
 *
 * <p>The create round-trip deliberately carries a two-muscle {@code volumePerMuscle} map AND
 * nested day exercises: {@code meso_template} is the project's first
 * {@code Map<String, record>} jsonb column, so the GET-back asserts prove the Hibernate
 * round-trip of both jsonb shapes (carried Task 2 review item).
 */
class MesoTemplateIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final String MESOCYCLES = "/api/train/mesocycles";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MesoTemplatePopulator mesoTemplatePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    // ── template CRUD (Task 3) ───────────────────────────────────────────────────

    @Test
    void testListMesoTemplates_shouldReturn401_whenUnauthenticated() {
        // Security-layer 401s come from Spring Security BEFORE the dispatcher, so they carry no
        // SystemMessage body by design — status-only is correct.
        getForBody(TEMPLATES, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateTemplate_shouldRoundTripPlanDocument_whenValidRequest() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateResponse created =
            postForBody(TEMPLATES, upsertRequest(), auth, HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(created.getId()).isNotNull();

        List<MesoTemplateResponse> templates =
            getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(templates).singleElement().satisfies(t -> {
            assertThat(t.getId()).isEqualTo(created.getId());
            assertThat(t.getTitle()).isEqualTo("Sablon teszt");
            assertThat(t.getShortTitle()).isEqualTo("Sablon");
            assertThat(t.getGoal()).isEqualTo("Hipertrófia");
            assertThat(t.getWeeks()).isEqualTo(4);
            assertThat(t.getSplit()).isEqualTo("Push / Pull · 4×/hét");
            assertThat(t.getStyle()).isEqualTo("RP · 4 hét");
            assertThat(t.getNotes()).isEqualTo("Sablon jegyzet");
            assertThat(t.getPhaseCurve()).containsExactly(
                MesoTemplateResponse.PhaseCurveEnum.MEV,
                MesoTemplateResponse.PhaseCurveEnum.MAV,
                MesoTemplateResponse.PhaseCurveEnum.MRV,
                MesoTemplateResponse.PhaseCurveEnum.DELOAD);
            assertThat(t.getRunCount()).isZero();

            // days jsonb: the nested day → exercise structure must survive verbatim.
            assertThat(t.getDays()).hasSize(2);
            assertThat(t.getDays().get(0).getDay()).isEqualTo("Hét");
            assertThat(t.getDays().get(0).getType()).isEqualTo("Push");
            assertThat(t.getDays().get(0).getMuscle()).isEqualTo("chest");
            assertThat(t.getDays().get(0).getMuscleAccent()).isTrue();
            assertThat(t.getDays().get(0).getNote()).isEqualTo("Nehéz nap");
            assertThat(t.getDays().get(0).getExerciseCount()).isEqualTo(2);
            assertThat(t.getDays().get(0).getExercises()).extracting(GymExercise::getName)
                .containsExactly("Bench Press", "Cable Fly");
            GymExercise bench = t.getDays().get(0).getExercises().get(0);
            assertThat(bench.getMuscle()).isEqualTo("chest");
            assertThat(bench.getWarmupSets()).isEqualTo(2);
            assertThat(bench.getWorkingSets()).isEqualTo(4);
            assertThat(bench.getRepMin()).isEqualTo(6);
            assertThat(bench.getRepMax()).isEqualTo(8);
            assertThat(bench.getTargetRIR()).isEqualTo(2);
            assertThat(bench.getType()).isEqualTo(GymExercise.TypeEnum.COMPOUND);
            assertThat(bench.getWarning()).isEqualTo("Váll");
            assertThat(bench.getAnchorWeightKg()).isEqualByComparingTo("60.00");
            assertThat(t.getDays().get(1).getDay()).isEqualTo("Csüt");
            assertThat(t.getDays().get(1).getExercises()).extracting(GymExercise::getName)
                .containsExactly("Row");

            // volume_per_muscle jsonb: Map<String, record> — two muscles, full landmark set.
            assertThat(t.getVolumePerMuscle()).containsOnlyKeys("chest", "back");
            VolumeBaseline chest = t.getVolumePerMuscle().get("chest");
            assertThat(chest.getName()).isEqualTo("RP guidelines · intermediate");
            assertThat(chest.getMev()).isEqualTo(8);
            assertThat(chest.getMav()).isEqualTo(14);
            assertThat(chest.getMrv()).isEqualTo(20);
            VolumeBaseline back = t.getVolumePerMuscle().get("back");
            assertThat(back.getMev()).isEqualTo(10);
            assertThat(back.getMav()).isEqualTo(16);
            assertThat(back.getMrv()).isEqualTo(22);
        });
    }

    @Test
    void testCreateTemplate_shouldFillRequiredDayAndExerciseFields_whenRestDayHasNeither() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = upsertRequest();
        // A rest day carries neither muscle nor exercises — both are optional on MesoDayInput but
        // REQUIRED on the MesoDay response, so the stored document must be coerced, not served null.
        List<MesoDayInput> days = new ArrayList<>(req.getDays());
        days.add(MesoDayInput.builder().day("Vas").type("Rest").build());
        req.setDays(days);

        postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);

        MesoTemplateResponse t = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class)
            .get(0);
        assertThat(t.getDays()).hasSize(3);
        assertThat(t.getDays().get(2).getDay()).isEqualTo("Vas");
        assertThat(t.getDays().get(2).getMuscle()).isEmpty();
        assertThat(t.getDays().get(2).getExercises()).isEmpty();
        assertThat(t.getDays().get(2).getExerciseCount()).isZero();

        // Every recipe gets a server-synthesized, stable, per-exercise unique id (contract-required).
        List<UUID> exerciseIds = t.getDays().stream()
            .flatMap(d -> d.getExercises().stream()).map(GymExercise::getId).toList();
        assertThat(exerciseIds).hasSize(3).doesNotContainNull().doesNotHaveDuplicates();
        // ...and it is stable across reads — the id lives in the stored document, not in the mapper.
        assertThat(getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).get(0)
            .getDays().stream().flatMap(d -> d.getExercises().stream()).map(GymExercise::getId))
            .containsExactlyElementsOf(exerciseIds);
    }

    @Test
    void testCreateTemplate_shouldReturn400SystemMessage_whenTitleMissing() {
        ownerId();
        MesoTemplateUpsertRequest req = upsertRequest();
        req.setTitle(null);

        String body = exchangeForBody(HttpMethod.POST, TEMPLATES, req,
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "title", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testUpdateTemplate_shouldReplaceDaysAndBaseline_whenValidRequest() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse created =
            postForBody(TEMPLATES, upsertRequest(), auth, HttpStatus.OK, MesoTemplateResponse.class);

        MesoTemplateUpsertRequest update = upsertRequest();
        update.setTitle("Sablon v2");
        update.setWeeks(6);
        update.setDays(List.of(MesoDayInput.builder().day("Kedd").type("Legs").muscle("quad")
            .exercises(List.of(exercise("Squat", "quad", GymExerciseInput.TypeEnum.COMPOUND)))
            .build()));
        update.setVolumePerMuscle(Map.of("quad",
            VolumeBaseline.builder().name("RP guidelines · intermediate").mev(6).mav(12).mrv(18).build()));

        MesoTemplateResponse updated = putForBody(TEMPLATES + "/" + created.getId(), update, auth,
            HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(updated.getId()).isEqualTo(created.getId());
        assertThat(updated.getTitle()).isEqualTo("Sablon v2");
        assertThat(updated.getWeeks()).isEqualTo(6);
        assertThat(updated.getDays()).singleElement().satisfies(d -> {
            assertThat(d.getDay()).isEqualTo("Kedd");
            assertThat(d.getExercises()).extracting(GymExercise::getName).containsExactly("Squat");
        });
        assertThat(updated.getVolumePerMuscle()).containsOnlyKeys("quad");

        // Full replace, not a second row: the list still holds exactly one template.
        assertThat(getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class))
            .singleElement()
            .satisfies(t -> {
                assertThat(t.getTitle()).isEqualTo("Sablon v2");
                assertThat(t.getDays()).singleElement()
                    .satisfies(d -> assertThat(d.getDay()).isEqualTo("Kedd"));
                assertThat(t.getVolumePerMuscle()).containsOnlyKeys("quad");
            });
    }

    @Test
    void testDeleteTemplate_shouldSoftDelete_whenOwned() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse created =
            postForBody(TEMPLATES, upsertRequest(), auth, HttpStatus.OK, MesoTemplateResponse.class);

        deleteAndExpect(TEMPLATES + "/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        assertThat(getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class)).isEmpty();
        // Soft delete (house rule): the row survives with is_deleted = true, so past runs keep
        // pointing at a real template row.
        Long deletedRows = jdbcTemplate.queryForObject(
            "select count(*) from meso_template where id = ? and is_deleted = true",
            Long.class, created.getId());
        assertThat(deletedRows).isEqualTo(1L);
    }

    @Test
    void testUpdateTemplate_shouldReturn404_whenForeignOwner() {
        ownerId();
        UUID foreign = databasePopulator.populateUser("meso-template-foreign@test.local");
        MesoTemplateEntity foreignTemplate = mesoTemplatePopulator.template(foreign);

        String body = exchangeForBody(HttpMethod.PUT, TEMPLATES + "/" + foreignTemplate.getId(),
            upsertRequest(), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "TRAIN_MESO_TEMPLATE_NOT_FOUND");
    }

    // ── start: stamping a run from a template (Task 4) ───────────────────────────

    @Test
    void testStartTemplate_shouldStampFullRun_whenActive() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        LocalDate start = LocalDate.now();

        MesocycleResponse run = postForBody(TEMPLATES + "/" + template.getId() + "/start",
            startRequest(start, MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(run.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        assertThat(run.getTemplateId()).isEqualTo(template.getId());
        assertThat(run.getCurrentWeek()).isGreaterThanOrEqualTo(1);
        assertThat(run.getTitle()).isEqualTo("Sablon A");
        assertThat(run.getWeeks()).isEqualTo(4);
        assertThat(run.getStartDate()).isEqualTo(start);
        assertThat(run.getEndDate()).isEqualTo(start.plusWeeks(4));
        assertThat(run.getClosedAt()).isNull();

        List<MesocycleResponse> mesos =
            getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class);
        assertThat(mesos).singleElement().satisfies(m -> {
            assertThat(m.getTemplateId()).isEqualTo(template.getId());
            // days jsonb -> workout_session + exercise rows
            assertThat(m.getDays()).hasSize(2);
            assertThat(m.getDays().get(0).getDay()).isEqualTo("Hét");
            assertThat(m.getDays().get(0).getMuscle()).isEqualTo("chest");
            assertThat(m.getDays().get(0).getExercises()).extracting(GymExercise::getName)
                .containsExactly("Bench Press", "Incline Bench Press");
            assertThat(m.getDays().get(1).getExercises()).extracting(GymExercise::getName)
                .containsExactly("Row", "Lat Pulldown");
            // volumePerMuscle jsonb -> muscle_group_volume_log rows, W1 start at MEV
            assertThat(m.getVolumePerMuscle()).containsOnlyKeys("chest", "back");
            assertThat(m.getVolumePerMuscle().get("chest").getMev()).isEqualTo(8);
            assertThat(m.getVolumePerMuscle().get("chest").getMav()).isEqualTo(14);
            assertThat(m.getVolumePerMuscle().get("chest").getMrv()).isEqualTo(20);
            assertThat(m.getVolumePerMuscle().get("chest").getCurrent()).isEqualTo(8);
            assertThat(m.getVolumePerMuscle().get("back").getMev()).isEqualTo(10);
            assertThat(m.getVolumePerMuscle().get("chest").getSource().getBaseline().getName())
                .isEqualTo("RP guidelines · intermediate");
            // The landmarks came from the PLAN, not from the generic RP table — the two happen to
            // agree numerically for chest/back, so the provenance note is what tells them apart.
            assertThat(m.getVolumePerMuscle().get("chest").getSource().getNote())
                .startsWith("Sablon baseline");
        });
        // The run's exercise rows are fresh rows with their own PKs — the template's recipe ids
        // (stored in the plan jsonb) must never be reused as workout exercise ids.
        List<UUID> recipeIds = template.getDays().stream()
            .flatMap(d -> d.exercises().stream()).map(GymExerciseJson::id).toList();
        List<UUID> runExerciseIds = mesos.get(0).getDays().stream()
            .flatMap(d -> d.getExercises().stream()).map(GymExercise::getId).toList();
        assertThat(recipeIds).hasSize(4).doesNotContainNull();
        assertThat(runExerciseIds).hasSize(4).doesNotContainNull().doesNotContainAnyElementsOf(recipeIds);
        // ...and the RP-table fill that runs after the plan seeding must not duplicate a muscle.
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from muscle_group_volume_log where mesocycle_id = ?",
            Long.class, run.getId())).isEqualTo(2L);

        // The template now counts its run.
        assertThat(getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class))
            .singleElement().satisfies(t -> assertThat(t.getRunCount()).isEqualTo(1));
    }

    @Test
    void testStartTemplate_shouldArchiveOtherActives_whenActive() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        String startUri = TEMPLATES + "/" + template.getId() + "/start";

        MesocycleResponse first = postForBody(startUri,
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);
        MesocycleResponse second = postForBody(startUri,
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(second.getId()).isNotEqualTo(first.getId());
        assertThat(second.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        // Single-active invariant: the earlier run is archived by the new start.
        assertThat(getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class))
            .filteredOn(m -> m.getId().equals(first.getId())).singleElement()
            .satisfies(m -> assertThat(m.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ARCHIVED));
    }

    @Test
    void testStartTemplate_shouldCreatePlannedRun_whenPlannedStatus() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        MesocycleEntity running = trainPopulator.createMesocycle(owner, "Fut még", "active");
        HttpHeaders auth = ownerAuthHeaders();

        MesocycleResponse run = postForBody(TEMPLATES + "/" + template.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.PLANNED), auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(run.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.PLANNED);
        assertThat(run.getCurrentWeek()).isZero();
        // A planned run stays volume-profile-less until it is activated (MesoVolume "csak aktív").
        assertThat(run.getVolumePerMuscle()).isNullOrEmpty();
        // ...and it must NOT archive the running mesocycle.
        assertThat(getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class))
            .filteredOn(m -> m.getId().equals(running.getId())).singleElement()
            .satisfies(m -> assertThat(m.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE));
    }

    @Test
    void testStartTemplate_shouldExemptPlyoExerciseFromVolume_whenTemplateFlagAbsent() {
        // mezo-gbo7 regression: the planner emits plyo recipes (Box Jump, Depth Jump) with NO
        // explicit countsTowardVolume — the wizard's generated split never sets it. The stored plan
        // document and the toExerciseEntity() stamp must agree that an absent flag on a plyo
        // exercise means "exempt", or a plyo exercise silently rejoins its muscle's weekly volume.
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = upsertRequest();
        List<MesoDayInput> days = new ArrayList<>(req.getDays());
        GymExerciseInput boxJump = GymExerciseInput.builder()
            .name("Box Jump").muscle("quad").warmupSets(0).workingSets(3).repMin(5).repMax(8)
            .targetRIR(2).type(GymExerciseInput.TypeEnum.PLYO).build(); // no countsTowardVolume
        days.add(MesoDayInput.builder().day("Szo").type("Legs").muscle("quad")
            .exercises(List.of(boxJump)).build());
        req.setDays(days);
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);

        postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        Boolean countsTowardVolume = jdbcTemplate.queryForObject(
            "select counts_toward_volume from exercise where name = 'Box Jump'", Boolean.class);
        assertThat(countsTowardVolume).isFalse();
    }

    // ── rerun: materializing a template out of a legacy run (Task 4) ─────────────

    @Test
    void testRerun_shouldMaterializeTemplate_whenLegacyRunHasNone() {
        UUID owner = ownerId();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Legacy blokk", "archived");
        WorkoutSessionEntity day =
            trainPopulator.createWorkoutSession(owner, legacy.getId(), "Hét", "Pull", 0, "planned");
        trainPopulator.createExercise(owner, day.getId(), "Régi húzás", 0);
        trainPopulator.createVolumeLog(owner, legacy.getId(), "back");
        HttpHeaders auth = ownerAuthHeaders();

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + legacy.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        assertThat(rerun.getTemplateId()).isNotNull();
        // The legacy run is linked back to the freshly materialized template.
        assertThat(getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class))
            .singleElement()
            .satisfies(m -> assertThat(m.getTemplateId()).isEqualTo(rerun.getTemplateId()));

        MesoTemplateResponse template =
            getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
                .filter(t -> t.getId().equals(rerun.getTemplateId())).findFirst().orElseThrow();
        assertThat(template.getTitle()).isEqualTo("Legacy blokk");
        assertThat(template.getWeeks()).isEqualTo(6);
        assertThat(template.getSplit()).isEqualTo("Pull / Push / Legs · 5×/hét");
        assertThat(template.getPhaseCurve()).containsExactly(
            MesoTemplateResponse.PhaseCurveEnum.MEV,
            MesoTemplateResponse.PhaseCurveEnum.MAV,
            MesoTemplateResponse.PhaseCurveEnum.DELOAD);
        assertThat(template.getRunCount()).isEqualTo(1);
        assertThat(template.getDays()).singleElement().satisfies(d -> {
            assertThat(d.getDay()).isEqualTo("Hét");
            assertThat(d.getType()).isEqualTo("Pull");
            assertThat(d.getExercises()).extracting(GymExercise::getName).containsExactly("Régi húzás");
            assertThat(d.getExercises().get(0).getWorkingSets()).isEqualTo(3);
            assertThat(d.getExercises().get(0).getTargetRIR()).isEqualTo(1);
        });
        assertThat(template.getVolumePerMuscle()).containsOnlyKeys("back");
        assertThat(template.getVolumePerMuscle().get("back").getMev()).isEqualTo(8);
        assertThat(template.getVolumePerMuscle().get("back").getMav()).isEqualTo(14);
        assertThat(template.getVolumePerMuscle().get("back").getMrv()).isEqualTo(20);
        assertThat(template.getVolumePerMuscle().get("back").getName())
            .isEqualTo("RP guidelines · intermediate");
        // The materialized recipes carry the run's own exercise row ids as their stored identity.
        assertThat(template.getDays().get(0).getExercises().get(0).getId()).isNotNull();
    }

    @Test
    void testRerun_shouldNameInheritedBaseline_whenVolumeLogHasNoProvenanceBaseline() {
        UUID owner = ownerId();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Provenance nélküli", "archived");
        WorkoutSessionEntity day =
            trainPopulator.createWorkoutSession(owner, legacy.getId(), "Hét", "Pull", 0, "planned");
        trainPopulator.createExercise(owner, day.getId(), "Régi húzás", 0);
        trainPopulator.createVolumeLogWithoutBaseline(owner, legacy.getId(), "back");
        HttpHeaders auth = ownerAuthHeaders();

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + legacy.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        // VolumeBaseline.name is contract-required, so the materialization names it rather than
        // storing a null into the plan document.
        MesoTemplateResponse template =
            getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
                .filter(t -> t.getId().equals(rerun.getTemplateId())).findFirst().orElseThrow();
        assertThat(template.getVolumePerMuscle().get("back").getName()).isEqualTo("Örökölt kiindulás");

        // ...and that name survives into the next run's volume-log provenance (the chain the null
        // used to travel down).
        MesocycleResponse restarted = postForBody(TEMPLATES + "/" + rerun.getTemplateId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);
        assertThat(getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class))
            .filteredOn(m -> m.getId().equals(restarted.getId())).singleElement()
            .satisfies(m -> assertThat(
                m.getVolumePerMuscle().get("back").getSource().getBaseline().getName())
                .isEqualTo("Örökölt kiindulás"));
    }

    @Test
    void testRerun_shouldReturnExistingTemplate_whenAlreadyLinked() {
        UUID owner = ownerId();
        MesoTemplateEntity template = mesoTemplatePopulator.template(owner);
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse run = postForBody(TEMPLATES + "/" + template.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + run.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        assertThat(rerun.getTemplateId()).isEqualTo(template.getId());
        // No duplicate template is materialized for an already-linked run.
        assertThat(getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class)).hasSize(1);
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    private static MesoTemplateStartRequest startRequest(
            LocalDate startDate, MesoTemplateStartRequest.StatusEnum status) {
        return MesoTemplateStartRequest.builder().startDate(startDate).status(status).build();
    }

    private static GymExerciseInput exercise(String name, String muscle, GymExerciseInput.TypeEnum type) {
        return GymExerciseInput.builder()
            .name(name).muscle(muscle).warmupSets(1).workingSets(3).repMin(10).repMax(12).targetRIR(1)
            .type(type).build();
    }

    /** A 2-day wizard template with nested exercises and a two-muscle volume baseline. */
    private static MesoTemplateUpsertRequest upsertRequest() {
        return MesoTemplateUpsertRequest.builder()
            .title("Sablon teszt")
            .shortTitle("Sablon")
            .goal("Hipertrófia")
            .weeks(4)
            .split("Push / Pull · 4×/hét")
            .style("RP · 4 hét")
            .notes("Sablon jegyzet")
            .phaseCurve(List.of(
                MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MRV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .volumePerMuscle(Map.of(
                "chest", VolumeBaseline.builder()
                    .name("RP guidelines · intermediate").mev(8).mav(14).mrv(20).build(),
                "back", VolumeBaseline.builder()
                    .name("RP guidelines · intermediate").mev(10).mav(16).mrv(22).build()))
            .days(List.of(
                MesoDayInput.builder().day("Hét").type("Push").muscle("chest")
                    .muscleAccent(true).note("Nehéz nap")
                    .exercises(List.of(
                        GymExerciseInput.builder().name("Bench Press").muscle("chest")
                            .warmupSets(2).workingSets(4).repMin(6).repMax(8).targetRIR(2)
                            .anchorWeightKg(new BigDecimal("60.00")).warning("Váll")
                            .type(GymExerciseInput.TypeEnum.COMPOUND).build(),
                        exercise("Cable Fly", "chest", GymExerciseInput.TypeEnum.ISOLATION)))
                    .build(),
                MesoDayInput.builder().day("Csüt").type("Pull").muscle("back")
                    .exercises(List.of(exercise("Row", "back", GymExerciseInput.TypeEnum.COMPOUND)))
                    .build()))
            .build();
    }
}
