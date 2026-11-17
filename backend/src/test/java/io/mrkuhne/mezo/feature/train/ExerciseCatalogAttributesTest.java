package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Pure content test for the selection attributes of the master catalogue (mezo-r36n9.66, spec
 * 2026-11-17-boop-gyakorlatvalasztas-design §6.1). Reads {@code content/exercise-catalog.json}
 * straight from the classpath — no Spring — and checks every master row against the loader's
 * allowed sets. Collects every violation so one run lists all bad rows.
 */
class ExerciseCatalogAttributesTest {

    /**
     * The one plyo-typed row that is not a jump: the dead hang is an isometric hang filed under
     * {@code plyo} for its low-fatigue scheduling, not a ballistic movement.
     */
    private static final Set<String> PLYO_NOT_JUMP = Set.of("dead-hang");

    private static List<Map<String, Object>> rows() throws IOException {
        try (InputStream in = new ClassPathResource("content/exercise-catalog.json").getInputStream()) {
            return new ObjectMapper().readValue(in, new TypeReference<List<Map<String, Object>>>() {});
        }
    }

    @SuppressWarnings("unchecked")
    private static List<String> list(Map<String, Object> row, String key) {
        Object v = row.get(key);
        return v instanceof List<?> l ? (List<String>) l : null;
    }

    @Test
    void everyMasterRowCarriesValidSelectionAttributes() throws IOException {
        List<String> violations = new ArrayList<>();
        List<Map<String, Object>> rows = rows();
        assertThat(rows).hasSize(166);

        for (Map<String, Object> row : rows) {
            if (row.get("createdBy") != null) {
                continue; // user-authored rows carry none of these
            }
            String slug = (String) row.get("slug");
            String muscle = (String) row.get("muscle");

            List<String> equipment = list(row, "equipment");
            if (equipment == null || equipment.isEmpty()) {
                violations.add(slug + ": equipment missing");
            } else {
                equipment.stream().filter(e -> !ExerciseCatalogLoader.EQUIPMENT.contains(e))
                    .forEach(e -> violations.add(slug + ": unknown equipment " + e));
                if (equipment.contains("bodyweight") && equipment.size() > 1) {
                    violations.add(slug + ": bodyweight must be the only equipment");
                }
                if (equipment.size() != Set.copyOf(equipment).size()) {
                    violations.add(slug + ": duplicate equipment");
                }
            }

            Object pattern = row.get("pattern");
            if (!(pattern instanceof String p) || !ExerciseCatalogLoader.PATTERNS.contains(p)) {
                violations.add(slug + ": bad pattern " + pattern);
            }
            if ("plyo".equals(row.get("type")) && !PLYO_NOT_JUMP.contains(slug) && !"jump".equals(pattern)) {
                violations.add(slug + ": plyo row must have pattern jump");
            }

            List<String> secondary = list(row, "secondaryMuscles");
            if (secondary == null) {
                violations.add(slug + ": secondaryMuscles missing");
            } else {
                if (secondary.size() > 3) {
                    violations.add(slug + ": more than 3 secondary muscles");
                }
                secondary.stream().filter(m -> !ExerciseCatalogLoader.MUSCLES.contains(m))
                    .forEach(m -> violations.add(slug + ": unknown secondary muscle " + m));
                if (secondary.contains(muscle)) {
                    violations.add(slug + ": secondary muscles repeat the row's own muscle");
                }
            }

            List<String> joints = list(row, "joints");
            if (joints == null) {
                violations.add(slug + ": joints missing");
            } else {
                joints.stream().filter(j -> !ExerciseCatalogLoader.JOINTS.contains(j))
                    .forEach(j -> violations.add(slug + ": unknown joint " + j));
            }

            if (!(row.get("lengthened") instanceof Boolean)) {
                violations.add(slug + ": lengthened missing");
            }

            Object demand = row.get("demand");
            if (!(demand instanceof String d) || !ExerciseCatalogLoader.DEMANDS.contains(d)) {
                violations.add(slug + ": bad demand " + demand);
            }
        }
        assertThat(violations).isEmpty();
    }
}
