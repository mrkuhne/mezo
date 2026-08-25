package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MusclePrioritiesUpdateRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.HashMap;
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
 * Carries {@code musclePriorities} (mezo-3m5m) through every backend path: template upsert,
 * template→run stamping ({@code start}), and the legacy rerun materialization. Modeled on {@link
 * GoalPresetCarryIT}'s API-driving style.
 */
class MusclePrioritiesCarryIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final String MESOCYCLES = "/api/train/mesocycles";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testStartTemplate_shouldCarryMusclePrioritiesOntoTheRun() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        req.setMusclePriorities(Map.of("back", "emphasize", "glute", "maintain"));
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(created.getMusclePriorities())
            .containsExactlyInAnyOrderEntriesOf(Map.of("back", "emphasize", "glute", "maintain"));

        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(run.getMusclePriorities())
            .containsExactlyInAnyOrderEntriesOf(Map.of("back", "emphasize", "glute", "maintain"));

        List<MesocycleResponse> mesos =
            getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class);
        assertThat(mesos).singleElement()
            .satisfies(m -> assertThat(m.getMusclePriorities())
                .containsExactlyInAnyOrderEntriesOf(Map.of("back", "emphasize", "glute", "maintain")));

        String musclePrioritiesColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from mesocycle where id = ?", String.class, run.getId());
        assertThat(musclePrioritiesColumn).contains("emphasize");
    }

    @Test
    void testRerun_shouldMaterializeMusclePrioritiesFromLegacyRun() {
        UUID owner = ownerId();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Legacy blokk", "archived");
        jdbcTemplate.update("update mesocycle set muscle_priorities = ?::jsonb where id = ?",
            "{\"back\":\"emphasize\"}", legacy.getId());
        HttpHeaders auth = ownerAuthHeaders();

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + legacy.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        MesoTemplateResponse template =
            getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
                .filter(t -> t.getId().equals(rerun.getTemplateId())).findFirst().orElseThrow();
        assertThat(template.getMusclePriorities()).containsExactlyInAnyOrderEntriesOf(
            Map.of("back", "emphasize"));
    }

    @Test
    void testUpsert_withNullMap_shouldPersistNull() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(created.getMusclePriorities()).isNull();

        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        String musclePrioritiesColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from mesocycle where id = ?", String.class, run.getId());
        assertThat(musclePrioritiesColumn).isNull();

        // mezo-3m5m final review, fix 4: MesoTemplateService#applyUpsert used to store {} verbatim
        // while TrainService#updateMusclePriorities (the run PUT, exercised above) normalizes {} to
        // NULL — an observable asymmetry between the two upsert paths. Pin the template side too,
        // with a non-empty map first so a bug that just skips the write (rather than normalizing)
        // couldn't pass this by accident.
        MesoTemplateUpsertRequest seeded = upsertRequest();
        seeded.setMusclePriorities(Map.of("back", "emphasize"));
        MesoTemplateResponse withMap =
            putForBody(TEMPLATES + "/" + created.getId(), seeded, auth, HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(withMap.getMusclePriorities()).containsExactlyInAnyOrderEntriesOf(
            Map.of("back", "emphasize"));

        MesoTemplateUpsertRequest emptyMapUpdate = upsertRequest();
        emptyMapUpdate.setMusclePriorities(Map.of());
        MesoTemplateResponse withEmptyMap = putForBody(TEMPLATES + "/" + created.getId(), emptyMapUpdate,
            auth, HttpStatus.OK, MesoTemplateResponse.class);

        assertThat(withEmptyMap.getMusclePriorities()).isNull();
        String templateMusclePrioritiesColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from meso_template where id = ?", String.class, created.getId());
        assertThat(templateMusclePrioritiesColumn).isNull();
    }

    @Test
    void testUpdateMusclePriorities_shouldReplaceTheMapOnTheRun() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        req.setMusclePriorities(Map.of("back", "emphasize"));
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);
        // The freshly-started run always carries its template day(s) — used below to pin that the
        // PUT response is the fully-assembled MesocycleResponse (assembleResponse), not the bare
        // mapper.toResponse, which would silently drop days/volumePerMuscle/hasReport and risk
        // clobbering the FE mesocycles cache on write.
        assertThat(run.getDays()).hasSize(1);

        MesocycleResponse updated = putForBody(MESOCYCLES + "/" + run.getId() + "/muscle-priorities",
            MusclePrioritiesUpdateRequest.builder().musclePriorities(Map.of("glute", "maintain")).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);

        assertThat(updated.getMusclePriorities()).containsExactlyInAnyOrderEntriesOf(
            Map.of("glute", "maintain"));
        assertThat(updated.getDays()).hasSize(1);
        String musclePrioritiesColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from mesocycle where id = ?", String.class, run.getId());
        assertThat(musclePrioritiesColumn).doesNotContain("emphasize").contains("maintain");

        MesocycleResponse cleared = putForBody(MESOCYCLES + "/" + run.getId() + "/muscle-priorities",
            MusclePrioritiesUpdateRequest.builder().musclePriorities(Map.of()).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);

        assertThat(cleared.getMusclePriorities()).isNull();
        String clearedColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from mesocycle where id = ?", String.class, run.getId());
        assertThat(clearedColumn).isNull();
    }

    @Test
    void testUpdateMusclePriorities_shouldReject400_whenTierValueUnknown() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        req.setMusclePriorities(Map.of("back", "emphasize"));
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        String body = exchangeForBody(HttpMethod.PUT, MESOCYCLES + "/" + run.getId() + "/muscle-priorities",
            MusclePrioritiesUpdateRequest.builder().musclePriorities(Map.of("back", "typo")).build(),
            auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_MUSCLE_PRIORITY_TIER_INVALID");
        // DB unchanged: the pre-existing "emphasize" value from the template start survives the
        // rejected PUT — normalize() must throw BEFORE anything is written, not after a partial write.
        String musclePrioritiesColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from mesocycle where id = ?", String.class, run.getId());
        assertThat(musclePrioritiesColumn).contains("emphasize").doesNotContain("typo");
    }

    @Test
    void testUpdateMusclePriorities_shouldDropGrowEntries_whileKeepingKnownTiers() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        // "grow" is semantically identical to an absent key — it drops during normalization
        // rather than 400ing (mezo-ltk0 ruling), leaving only the non-default tier persisted.
        MesocycleResponse updated = putForBody(MESOCYCLES + "/" + run.getId() + "/muscle-priorities",
            MusclePrioritiesUpdateRequest.builder()
                .musclePriorities(Map.of("back", "grow", "glute", "maintain")).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);

        assertThat(updated.getMusclePriorities()).containsExactlyInAnyOrderEntriesOf(
            Map.of("glute", "maintain"));
        String musclePrioritiesColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from mesocycle where id = ?", String.class, run.getId());
        assertThat(musclePrioritiesColumn).doesNotContain("back").contains("maintain");
    }

    @Test
    void testUpsertTemplate_shouldReject400_whenTierValueUnknown() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        req.setMusclePriorities(Map.of("back", "typo"));

        String body = exchangeForBody(HttpMethod.POST, TEMPLATES, req,
            auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_MUSCLE_PRIORITY_TIER_INVALID");
    }

    @Test
    void testUpdateTemplate_shouldReject400_whenTierValueUnknown() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        // POST create and PUT update both funnel through MesoTemplateService#applyUpsert —
        // the "upsert" in the spec means both entry points, not just create (review fix-round-1).
        MesoTemplateResponse created =
            postForBody(TEMPLATES, upsertRequest(), auth, HttpStatus.OK, MesoTemplateResponse.class);

        MesoTemplateUpsertRequest badUpdate = upsertRequest();
        badUpdate.setMusclePriorities(Map.of("back", "typo"));

        String body = exchangeForBody(HttpMethod.PUT, TEMPLATES + "/" + created.getId(), badUpdate,
            auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_MUSCLE_PRIORITY_TIER_INVALID");
        // The pre-existing (null) musclePriorities must be untouched by the rejected update.
        MesoTemplateResponse unchanged =
            getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
                .filter(t -> t.getId().equals(created.getId())).findFirst().orElseThrow();
        assertThat(unchanged.getMusclePriorities()).isNull();
    }

    @Test
    void testUpdateMusclePriorities_shouldReject400_whenTierValueNull() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        req.setMusclePriorities(Map.of("back", "emphasize"));
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        // {"back": null} deserializes fine into Map<String,String> — must 400, not 500/NPE
        // (review fix-round-1: the null selector in normalize()'s switch used to NPE).
        Map<String, String> withNullValue = new HashMap<>();
        withNullValue.put("back", null);
        String body = exchangeForBody(HttpMethod.PUT, MESOCYCLES + "/" + run.getId() + "/muscle-priorities",
            MusclePrioritiesUpdateRequest.builder().musclePriorities(withNullValue).build(),
            auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_MUSCLE_PRIORITY_TIER_INVALID");
        String musclePrioritiesColumn = jdbcTemplate.queryForObject(
            "select muscle_priorities::text from mesocycle where id = ?", String.class, run.getId());
        assertThat(musclePrioritiesColumn).contains("emphasize");
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    private static MesoTemplateStartRequest startRequest(
            LocalDate startDate, MesoTemplateStartRequest.StatusEnum status) {
        return MesoTemplateStartRequest.builder().startDate(startDate).status(status).build();
    }

    /** A minimal single-day wizard template — this suite exercises musclePriorities, not plan shape. */
    private static MesoTemplateUpsertRequest upsertRequest() {
        return MesoTemplateUpsertRequest.builder()
            .title("Priority teszt")
            .shortTitle("Priority")
            .goal("Erő")
            .weeks(4)
            .split("Full body · 3×/hét")
            .style("RP · 4 hét")
            .phaseCurve(List.of(
                MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MRV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Rest").build()))
            .build();
    }
}
