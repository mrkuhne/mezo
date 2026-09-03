package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CatalogExerciseCreateRequest;
import io.mrkuhne.mezo.api.dto.ExerciseCatalogItem;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Slug generation under contention (mezo-2fc1 / S5): two requests creating the same name at the
 * same moment must both succeed with distinct slugs, never a 500 from uq_exercise_catalog_slug;
 * and a name matching a built-in row must be suffixed past the master slug.
 */
class ExerciseCatalogSlugRaceIT extends ApiIntegrationTest {

    private static CatalogExerciseCreateRequest request(String name) {
        return CatalogExerciseCreateRequest.builder()
            .name(name).muscle(CatalogExerciseCreateRequest.MuscleEnum.QUAD)
            .type(CatalogExerciseCreateRequest.TypeEnum.COMPOUND)
            .stim(BigDecimal.valueOf(0.6)).fatigue(BigDecimal.valueOf(0.4)).build();
    }

    @Test
    void testCreateExercise_shouldYieldDistinctSlugs_whenTwoRequestsRaceOnOneName() throws Exception {
        HttpHeaders auth = ownerAuthHeaders();
        CountDownLatch go = new CountDownLatch(1);
        Callable<ResponseEntity<String>> post = () -> {
            go.await(10, TimeUnit.SECONDS);
            return exchangeForResponse(HttpMethod.POST, "/api/train/exercises", request("Race Move"), auth);
        };
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<ResponseEntity<String>> first = pool.submit(post);
            Future<ResponseEntity<String>> second = pool.submit(post);
            go.countDown();
            ResponseEntity<String> r1 = first.get(30, TimeUnit.SECONDS);
            ResponseEntity<String> r2 = second.get(30, TimeUnit.SECONDS);

            assertThat(r1.getStatusCode()).withFailMessage("body: %s", r1.getBody()).isEqualTo(HttpStatus.CREATED);
            assertThat(r2.getStatusCode()).withFailMessage("body: %s", r2.getBody()).isEqualTo(HttpStatus.CREATED);
            ExerciseCatalogItem a = objectMapper.readValue(r1.getBody(), ExerciseCatalogItem.class);
            ExerciseCatalogItem b = objectMapper.readValue(r2.getBody(), ExerciseCatalogItem.class);
            assertThat(List.of(a.getSlug(), b.getSlug())).containsExactlyInAnyOrder("race-move", "race-move-2");
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void testCreateExercise_shouldSuffixPastMasterSlug_whenNameMatchesBuiltIn() {
        // "Box Jump" is loader content (slug box-jump); a user's row with the same name gets -2.
        ExerciseCatalogItem mine = postForBody("/api/train/exercises", request("Box Jump"),
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        assertThat(mine.getSlug()).isEqualTo("box-jump-2");
        ExerciseCatalogItem again = postForBody("/api/train/exercises", request("Box Jump"),
            ownerAuthHeaders(), HttpStatus.CREATED, ExerciseCatalogItem.class);
        assertThat(again.getSlug()).isEqualTo("box-jump-3");
    }
}
