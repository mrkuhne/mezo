package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract tests for GET /api/train/exercises and the catalogId linkage on
 * the day-exercises PUT (round-trip + unknown-id 400 via SystemMessage field error).
 */
class ExerciseCatalogContractIT extends ApiIntegrationTest {

    @Test
    void testGetExerciseCatalog_shouldReturn401_whenNoToken() {
        getForBody("/api/train/exercises", null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testGetExerciseCatalog_shouldReturnCuratedItemsSorted_whenAuthenticated() {
        List<ExerciseCatalogItem> items =
            getForList("/api/train/exercises", ownerAuthHeaders(), HttpStatus.OK, ExerciseCatalogItem.class);
        assertThat(items).hasSize(113);
        assertThat(items).isSortedAccordingTo(
            Comparator.comparing(ExerciseCatalogItem::getMuscle).thenComparing(ExerciseCatalogItem::getName));
        assertThat(items).anySatisfy(i -> {
            assertThat(i.getSlug()).isEqualTo("box-jump");
            assertThat(i.getType()).isEqualTo(ExerciseCatalogItem.TypeEnum.PLYO);
            assertThat(i.getId()).isNotNull();
        });
    }

    @Test
    void testReplaceDayExercises_shouldPersistCatalogId_whenProvided() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID catalogId = catalogIdOf(auth, "hip-thrust");
        MesocycleResponse meso = createMesoWithOneDay(auth);
        UUID dayId = meso.getDays().get(0).getId();

        GymExerciseInput input = GymExerciseInput.builder()
            .name("Hip Thrust").muscle("glute").warmupSets(2).workingSets(3).repMin(8).repMax(12)
            .targetRIR(1)
            .type(GymExerciseInput.TypeEnum.COMPOUND).catalogId(catalogId)
            .build();
        MesoDay day = putForBody(
            "/api/train/mesocycles/" + meso.getId() + "/days/" + dayId + "/exercises",
            List.of(input), auth, HttpStatus.OK, MesoDay.class);

        assertThat(day.getExercises()).hasSize(1);
        assertThat(day.getExercises().get(0).getCatalogId()).isEqualTo(catalogId);
    }

    @Test
    void testReplaceDayExercises_shouldReturn400_whenCatalogIdUnknown() {
        HttpHeaders auth = ownerAuthHeaders();
        MesocycleResponse meso = createMesoWithOneDay(auth);
        UUID dayId = meso.getDays().get(0).getId();

        GymExerciseInput input = GymExerciseInput.builder()
            .name("Ghost Exercise").muscle("glute").warmupSets(2).workingSets(3).repMin(8).repMax(12)
            .targetRIR(1)
            .type(GymExerciseInput.TypeEnum.COMPOUND).catalogId(UUID.randomUUID())
            .build();
        String body = putForBody(
            "/api/train/mesocycles/" + meso.getId() + "/days/" + dayId + "/exercises",
            List.of(input), auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "catalogId", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testReplaceDayExercises_shouldPersistPlyoType_whenPicked() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID catalogId = catalogIdOf(auth, "box-jump");
        MesocycleResponse meso = createMesoWithOneDay(auth);
        UUID dayId = meso.getDays().get(0).getId();

        GymExerciseInput input = GymExerciseInput.builder()
            .name("Box Jump").muscle("quad").warmupSets(2).workingSets(3).repMin(5).repMax(5)
            .targetRIR(2)
            .type(GymExerciseInput.TypeEnum.PLYO).catalogId(catalogId)
            .build();
        MesoDay day = putForBody(
            "/api/train/mesocycles/" + meso.getId() + "/days/" + dayId + "/exercises",
            List.of(input), auth, HttpStatus.OK, MesoDay.class);

        assertThat(day.getExercises().get(0).getType().getValue()).isEqualTo("plyo");
    }

    private UUID catalogIdOf(HttpHeaders auth, String slug) {
        return getForList("/api/train/exercises", auth, HttpStatus.OK, ExerciseCatalogItem.class)
            .stream().filter(i -> slug.equals(i.getSlug())).findFirst().orElseThrow().getId();
    }

    private MesocycleResponse createMesoWithOneDay(HttpHeaders auth) {
        MesocycleCreateRequest req = MesocycleCreateRequest.builder()
            .title("Catalog IT meso").status(MesocycleCreateRequest.StatusEnum.PLANNED)
            .startDate(LocalDate.of(2026, 6, 15)).weeks(4)
            .split("Upper / Lower · 4×/hét").style("Linear · 4 hét")
            .phaseCurve(List.of(MesocycleCreateRequest.PhaseCurveEnum.MEV,
                MesocycleCreateRequest.PhaseCurveEnum.MAV))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Upper").muscle("back").build()))
            .build();
        return postForBody("/api/train/mesocycles", req, auth, HttpStatus.CREATED, MesocycleResponse.class);
    }
}
