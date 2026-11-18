package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/** Stamps a template exercise with its style's prescription (mezo-r36n9.79). Pure, no beans. */
public final class StyleStamper {
    private StyleStamper() {}

    public static GymExerciseJson stamp(GymExerciseJson ex, TrainingStyle blockStyle, boolean stable,
                                        TrainStyleProperties p) {
        // Style effects apply only to a block that HAS a style (spec §11.3): an exercise's own style
        // overrides a styled block's, but never wakes up an unstyled block.
        if (blockStyle == null || !ex.countsTowardVolume()) return ex; // closing block / plyo: never styled
        TrainingStyle style = TrainingStyle.fromWire(ex.trainingStyle());
        if (style == null) style = blockStyle;
        ExerciseClass cls = ExerciseClass.of(ex.type(), stable);
        if (cls == null) return ex;
        StyleTable.Stamp s = StyleTable.stamp(style, cls, stable, legs(cls, ex.muscle()), p);
        Set<String> keep = (ex.overrides() == null ? List.<String>of() : ex.overrides()).stream()
            .filter(Objects::nonNull).collect(Collectors.toUnmodifiableSet());
        boolean range = !keep.contains("repRange");
        return new GymExerciseJson(ex.id(), ex.name(), ex.muscle(), ex.warmupSets(),
            keep.contains("workingSets") || s.workingSets() == null ? ex.workingSets() : s.workingSets(),
            range ? s.repMin() : ex.repMin(),
            range ? s.repMax() : ex.repMax(),
            keep.contains("targetRir") ? ex.targetRir() : s.reserve(),
            ex.anchorWeightKg(), ex.type(), ex.warning(), ex.catalogId(), ex.countsTowardVolume(),
            ex.trainingStyle(),
            keep.contains("restSec") ? ex.restSec() : s.restSec(),
            ex.overrides());
    }

    /** "Legs" for the leg reserve: a compound exercise whose coarse group is quad, ham or glute. */
    static boolean legs(ExerciseClass cls, String muscle) {
        String group = MuscleGroup.of(muscle);
        return cls.compound() && ("quad".equals(group) || "ham".equals(group) || "glute".equals(group));
    }
}
