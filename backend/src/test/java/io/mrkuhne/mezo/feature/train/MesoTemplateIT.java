package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExercise;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.VolumeBaseline;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.MesoTemplatePopulator;
import java.math.BigDecimal;
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
 * HTTP-level tests for meso TEMPLATE CRUD (mezo-meyc.1) — the reusable plan document behind the
 * template/run split ({@code /api/train/meso-templates}).
 *
 * <p>The create round-trip deliberately carries a two-muscle {@code volumePerMuscle} map AND
 * nested day exercises: {@code meso_template} is the project's first
 * {@code Map<String, record>} jsonb column, so the GET-back asserts prove the Hibernate
 * round-trip of both jsonb shapes (carried Task 2 review item).
 */
class MesoTemplateIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private MesoTemplatePopulator mesoTemplatePopulator;
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

    // ── fixtures ────────────────────────────────────────────────────────────────

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
