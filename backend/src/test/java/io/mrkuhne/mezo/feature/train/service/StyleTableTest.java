package io.mrkuhne.mezo.feature.train.service;

import static io.mrkuhne.mezo.feature.train.service.ExerciseClass.COMPOUND_FREE;
import static io.mrkuhne.mezo.feature.train.service.ExerciseClass.COMPOUND_STABLE;
import static io.mrkuhne.mezo.feature.train.service.ExerciseClass.ISOLATION;
import static io.mrkuhne.mezo.feature.train.service.TrainingStyle.*;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties.Style;
import io.mrkuhne.mezo.feature.train.service.StyleTable.Stamp;
import java.util.Map;
import org.junit.jupiter.api.Test;

class StyleTableTest {
    static final TrainStyleProperties P = new TrainStyleProperties(Map.of(
        "balanced", new Style(6, 10, 10, 15, null, 2, 3, 150, 90, 3),
        "volume", new Style(10, 15, 15, 25, null, 2, null, 120, 75, 4),
        "heavy", new Style(5, 8, 8, 12, null, 2, null, 180, 120, 2),
        "allout", new Style(6, 10, 8, 12, 2, 0, null, 180, 120, 2)),
        1, 56, 2, new TrainStyleProperties.Ramp(1, 2, 2, 1));

    @Test void balancedLegCompound() {
        assertThat(StyleTable.stamp(BALANCED, COMPOUND_FREE, false, true, P))
            .isEqualTo(new Stamp(6, 10, null, 3, 150, 3, BALANCED));
    }

    @Test void legReserveIgnoredForIsolation() {
        assertThat(StyleTable.stamp(BALANCED, ISOLATION, false, true, P))
            .isEqualTo(new Stamp(10, 15, null, 2, 90, 3, BALANCED));
    }

    @Test void volumeIsolation() {
        assertThat(StyleTable.stamp(VOLUME, ISOLATION, true, false, P))
            .isEqualTo(new Stamp(15, 25, null, 2, 75, 4, VOLUME));
    }

    @Test void alloutOnFreeFallsBackToHeavy() {
        assertThat(StyleTable.stamp(ALLOUT, COMPOUND_FREE, false, false, P))
            .isEqualTo(new Stamp(5, 8, null, 1, 180, 2, HEAVY));
    }

    @Test void alloutOnFreeIsolationFallsBackToHeavyIsolationRow() {
        assertThat(StyleTable.stamp(ALLOUT, ISOLATION, false, false, P))
            .isEqualTo(new Stamp(8, 12, null, 1, 120, 2, HEAVY));
    }

    @Test void alloutStableIsTwoSetsToFailure() {
        assertThat(StyleTable.stamp(ALLOUT, ISOLATION, true, false, P))
            .isEqualTo(new Stamp(8, 12, 2, 0, 120, 2, ALLOUT));
        assertThat(StyleTable.stamp(ALLOUT, COMPOUND_STABLE, true, true, P))
            .isEqualTo(new Stamp(6, 10, 2, 0, 180, 2, ALLOUT));
    }

    @Test void heavyAndVolumeLegCompoundsKeepReserveTwo() {
        assertThat(StyleTable.stamp(HEAVY, COMPOUND_FREE, false, true, P))
            .isEqualTo(new Stamp(5, 8, null, 2, 180, 2, HEAVY));
        assertThat(StyleTable.stamp(VOLUME, COMPOUND_STABLE, true, true, P))
            .isEqualTo(new Stamp(10, 15, null, 2, 120, 4, VOLUME));
    }

    @Test void classOfPlyoIsNull() {
        assertThat(ExerciseClass.of("plyo", true)).isNull();
        assertThat(ExerciseClass.of("compound", true)).isEqualTo(COMPOUND_STABLE);
        assertThat(ExerciseClass.of("compound", false)).isEqualTo(COMPOUND_FREE);
        assertThat(ExerciseClass.of("isolation", false)).isEqualTo(ISOLATION);
    }

    @Test void wireRoundTrip() {
        assertThat(TrainingStyle.fromWire(null)).isNull();
        assertThat(TrainingStyle.fromWire("allout")).isEqualTo(ALLOUT);
        assertThat(ALLOUT.wire()).isEqualTo("allout");
    }
}
