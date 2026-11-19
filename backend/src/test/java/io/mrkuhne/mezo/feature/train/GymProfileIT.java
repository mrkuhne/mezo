package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymProfile;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips of the per-user gym profile ("Mi van a termemben", mezo-r36n9.66). */
class GymProfileIT extends ApiIntegrationTest {

    private static final String URI = "/api/train/gym-profile";

    @Autowired ExerciseCatalogRepository catalogRepository;

    private static GymProfile profile(List<String> kinds, List<UUID> missing) {
        return new GymProfile().offKinds(kinds).missingExerciseIds(missing);
    }

    @Test
    void testGet_shouldReturnBothListsEmpty_whenNeverSaved() {
        GymProfile p = getForBody(URI, registerUser("Gym Fresh").headers(), HttpStatus.OK, GymProfile.class);

        assertThat(p.getOffKinds()).isEmpty();
        assertThat(p.getMissingExerciseIds()).isEmpty();
    }

    @Test
    void testPut_shouldRoundTrip_andNotLeakToAnotherUser() {
        HttpHeaders mine = registerUser("Gym Mine").headers();
        HttpHeaders other = registerUser("Gym Other").headers();
        UUID someExercise = catalogRepository.findAll().stream()
            .map(ExerciseCatalogEntity::getId).findFirst().orElseThrow();

        putForBody(URI, profile(List.of("cable"), List.of(someExercise)), mine, HttpStatus.OK, GymProfile.class);
        // a second save replaces the single row
        putForBody(URI, profile(List.of("cable", "smith"), List.of(someExercise)), mine,
            HttpStatus.OK, GymProfile.class);

        GymProfile read = getForBody(URI, mine, HttpStatus.OK, GymProfile.class);
        assertThat(read.getOffKinds()).containsExactlyInAnyOrder("cable", "smith");
        assertThat(read.getMissingExerciseIds()).containsExactly(someExercise);

        GymProfile theirs = getForBody(URI, other, HttpStatus.OK, GymProfile.class);
        assertThat(theirs.getOffKinds()).isEmpty();
        assertThat(theirs.getMissingExerciseIds()).isEmpty();
    }

    @Test
    void testPut_shouldReturn400FieldError_whenKindUnknownOrBodyweight() {
        HttpHeaders auth = registerUser("Gym Bad").headers();

        String laser = putForBody(URI, profile(List.of("laser"), List.of()), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(laser, "offKinds", "TRAIN_GYM_KIND_INVALID");

        String bodyweight = putForBody(URI, profile(List.of("bodyweight"), List.of()), auth,
            HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(bodyweight, "offKinds", "TRAIN_GYM_KIND_INVALID");
    }
}
