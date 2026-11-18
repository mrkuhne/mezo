package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.ObjectMapper;

/**
 * Pure JSON pin of the owner-approved classification (2026-11-18): the strict list has 57 stable
 * and 23 lengthened-friendly rows, and a lengthened-friendly row is always stable (a machine or
 * cable keeps its resistance profile) except the single-leg calf raise.
 */
class ExerciseCatalogClassificationTest {

    private static final Set<String> EQUIPMENT =
        Set.of("machine", "cable", "dumbbell", "barbell", "bodyweight", "kettlebell", "other");

    private List<ExerciseCatalogLoader.CatalogJsonItem> rows() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        try (InputStream in = new ClassPathResource("content/exercise-catalog.json").getInputStream()) {
            return mapper.readValue(in,
                mapper.getTypeFactory().constructCollectionType(List.class, ExerciseCatalogLoader.CatalogJsonItem.class));
        }
    }

    @Test
    void testCatalog_shouldPinStableAndLengthenedCounts_whenStrictListApproved() throws Exception {
        List<ExerciseCatalogLoader.CatalogJsonItem> rows = rows();
        assertThat(rows).hasSize(166);
        assertThat(rows.stream().filter(r -> "stable".equals(r.stability()))).hasSize(57);
        assertThat(rows.stream().filter(r -> Boolean.TRUE.equals(r.lengthenedFriendly()))).hasSize(23);
    }

    @Test
    void testCatalog_shouldKeepLengthenedRowsStable_exceptSingleLegCalfRaise() throws Exception {
        assertThat(rows().stream()
            .filter(r -> Boolean.TRUE.equals(r.lengthenedFriendly()) && !"stable".equals(r.stability()))
            .map(ExerciseCatalogLoader.CatalogJsonItem::slug)).containsExactly("single-leg-calf-raise");
    }

    @Test
    void testCatalog_shouldClassifyEveryRow_withKnownTokens() throws Exception {
        assertThat(rows()).allSatisfy(r -> {
            assertThat(EQUIPMENT).contains(r.equipment());
            assertThat(Set.of("stable", "free")).contains(r.stability());
            assertThat(r.lengthenedFriendly()).isNotNull();
        });
    }
}
