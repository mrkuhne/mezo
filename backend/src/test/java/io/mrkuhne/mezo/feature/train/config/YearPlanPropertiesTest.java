package io.mrkuhne.mezo.feature.train.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** {@link YearPlanProperties#isPairsValid}: each pair is 2 distinct groups of one kind (mezo-r36n9.113). */
class YearPlanPropertiesTest {

    private static final Map<String, List<String>> KINDS = Map.of(
        "upper", List.of("chest", "back", "shoulder", "biceps", "triceps"),
        "lower", List.of("quad", "ham", "glute", "calf"));

    private static YearPlanProperties with(List<List<String>> pairs) {
        return new YearPlanProperties(52, 6, 2, 3, 14, KINDS, pairs);
    }

    @Test
    void pairsWithinOneKindAreValid() {
        assertThat(with(List.of(List.of("back", "biceps"), List.of("quad", "glute"))).isPairsValid()).isTrue();
    }

    @Test
    void pairAcrossKindsIsInvalid() {
        assertThat(with(List.of(List.of("back", "quad"))).isPairsValid()).isFalse();
    }

    @Test
    void pairOfOneGroupTwiceIsInvalid() {
        assertThat(with(List.of(List.of("back", "back"))).isPairsValid()).isFalse();
    }

    @Test
    void pairOfThreeOrOneIsInvalid() {
        assertThat(with(List.of(List.of("back", "biceps", "chest"))).isPairsValid()).isFalse();
        assertThat(with(List.of(List.of("back"))).isPairsValid()).isFalse();
    }

    @Test
    void unknownGroupIsInvalid() {
        assertThat(with(List.of(List.of("back", "wings"))).isPairsValid()).isFalse();
    }
}
