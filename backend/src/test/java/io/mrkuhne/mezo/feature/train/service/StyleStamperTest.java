package io.mrkuhne.mezo.feature.train.service;

import static io.mrkuhne.mezo.feature.train.service.StyleTableTest.P;
import static io.mrkuhne.mezo.feature.train.service.TrainingStyle.*;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StyleStamperTest {
    static GymExerciseJson ex(String type, String muscle, String style, List<String> overrides) {
        return new GymExerciseJson(UUID.randomUUID(), "X", muscle, 1, 3, 8, 12, 3, 50.0, type, null, null, true,
            style, 99, overrides);
    }

    @Test void unstyledIsUntouched() {
        var e = ex("compound", "chest-upper", null, null);
        assertThat(StyleStamper.stamp(e, null, true, P)).isSameAs(e);
    }

    @Test void plyoIsUntouched() {
        var e = ex("plyo", "quad", null, null);
        assertThat(StyleStamper.stamp(e, HEAVY, true, P)).isSameAs(e);
    }

    @Test void blockStyleStampsAllFields() {
        var r = StyleStamper.stamp(ex("compound", "chest-upper", null, null), HEAVY, false, P);
        assertThat(r.repMin()).isEqualTo(5);
        assertThat(r.repMax()).isEqualTo(8);
        assertThat(r.targetRir()).isEqualTo(2);
        assertThat(r.restSec()).isEqualTo(180);
        assertThat(r.workingSets()).isEqualTo(3); // stamp has no number: plan's stays
    }

    @Test void exerciseStyleBeatsBlockStyle() {
        var r = StyleStamper.stamp(ex("isolation", "biceps", "volume", null), HEAVY, false, P);
        assertThat(r.repMin()).isEqualTo(15);
        assertThat(r.repMax()).isEqualTo(25);
        assertThat(r.restSec()).isEqualTo(75);
        assertThat(r.trainingStyle()).isEqualTo("volume");
    }

    @Test void legCompoundGetsLegReserve() {
        assertThat(StyleStamper.stamp(ex("compound", "quad", null, null), BALANCED, false, P).targetRir())
            .isEqualTo(3);
        assertThat(StyleStamper.stamp(ex("compound", "chest", null, null), BALANCED, false, P).targetRir())
            .isEqualTo(2);
    }

    @Test void alloutStableSetsTwoSets() {
        var r = StyleStamper.stamp(ex("isolation", "biceps", null, null), ALLOUT, true, P);
        assertThat(r.workingSets()).isEqualTo(2);
        assertThat(r.targetRir()).isZero();
    }

    @Test void overridesAreKept() {
        var r = StyleStamper.stamp(ex("compound", "chest", null, List.of("repRange", "workingSets", "restSec")),
            ALLOUT, true, P);
        assertThat(r.repMin()).isEqualTo(8);
        assertThat(r.repMax()).isEqualTo(12);
        assertThat(r.workingSets()).isEqualTo(3);
        assertThat(r.restSec()).isEqualTo(99);
        assertThat(r.targetRir()).isZero();
    }
}
