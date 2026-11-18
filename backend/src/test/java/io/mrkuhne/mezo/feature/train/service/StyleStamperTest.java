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
            style, 99, overrides, null, null, null);
    }

    @Test void unstyledIsUntouched() {
        var e = ex("compound", "chest-mid", null, null);
        assertThat(StyleStamper.stamp(e, null, true, P)).isSameAs(e);
    }

    @Test void exerciseStyleInUnstyledBlockIsUntouched() {
        // spec §11.3: style effects apply only to a block that HAS a style
        var e = ex("compound", "chest-mid", "heavy", null);
        assertThat(StyleStamper.stamp(e, null, true, P)).isSameAs(e);
    }

    @Test void plyoIsUntouched() {
        var e = ex("plyo", "quad", null, null);
        assertThat(StyleStamper.stamp(e, HEAVY, true, P)).isSameAs(e);
    }

    @Test void nonCountingRowIsUntouched() {
        // the fixed closing block never counts toward volume and is never styled
        var e = new GymExerciseJson(UUID.randomUUID(), "Back extension", "lower-back", 0, 2, 12, 15, 2, null,
            "isolation", null, null, false, null, null, null, null, null, null);
        assertThat(StyleStamper.stamp(e, HEAVY, true, P)).isSameAs(e);
    }

    @Test void blockStyleStampsAllFields() {
        var r = StyleStamper.stamp(ex("compound", "chest-mid", null, null), HEAVY, false, P);
        assertThat(r.repMin()).isEqualTo(5);
        assertThat(r.repMax()).isEqualTo(8);
        assertThat(r.targetRir()).isEqualTo(2);
        assertThat(r.restSec()).isEqualTo(180);
        assertThat(r.workingSets()).isEqualTo(3); // stamp has no number: plan's stays
    }

    @Test void exerciseStyleBeatsBlockStyle() {
        var r = StyleStamper.stamp(ex("isolation", "biceps-long", "volume", null), HEAVY, false, P);
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

    @Test void quadCompoundGetsLegsReserveThreeUnderBalanced() {
        assertThat(MuscleGroup.of("quad")).isEqualTo("quad");
        assertThat(MuscleGroup.of("ham")).isEqualTo("ham");
        assertThat(MuscleGroup.of("glute")).isEqualTo("glute");
        assertThat(StyleStamper.stamp(ex("compound", "quad", null, null), BALANCED, true, P).targetRir())
            .isEqualTo(3);
        assertThat(StyleStamper.stamp(ex("isolation", "quad", null, null), BALANCED, true, P).targetRir())
            .isEqualTo(2);
    }

    @Test void nullOverrideElementsAreIgnored() {
        var o = new java.util.ArrayList<String>();
        o.add(null);
        o.add("restSec");
        assertThat(StyleStamper.stamp(ex("compound", "chest-mid", null, o), HEAVY, false, P).restSec())
            .isEqualTo(99);
    }

    @Test void alloutStableSetsTwoSets() {
        var r = StyleStamper.stamp(ex("isolation", "biceps-long", null, null), ALLOUT, true, P);
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
