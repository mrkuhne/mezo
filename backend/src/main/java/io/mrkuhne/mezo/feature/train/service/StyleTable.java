package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties.Style;

/** The style table lookup (mezo-r36n9.79). Pure, no beans. */
public final class StyleTable {
    private StyleTable() {}

    public record Stamp(int repMin, int repMax, Integer workingSets, int reserve, int restSec,
                        int repOverflow, TrainingStyle effectiveStyle) {}

    /**
     * ALLOUT needs a stable exercise; a free compound or free isolation under ALLOUT takes the HEAVY row
     * with the all-out-free reserve and {@code effectiveStyle = HEAVY}. The leg reserve applies only to
     * compound classes with {@code legs}; otherwise a stable compound takes the row's stable-compound reserve
     * and an isolation its isolation reserve, each falling back to the row's reserve (mezo-r36n9.115).
     */
    public static Stamp stamp(TrainingStyle style, ExerciseClass cls, boolean stable, boolean legs,
                              TrainStyleProperties p) {
        boolean fallback = style == TrainingStyle.ALLOUT && !stable;
        TrainingStyle eff = fallback ? TrainingStyle.HEAVY : style;
        Style row = p.styles().get(eff.wire());
        boolean compound = cls.compound();
        int reserve;
        if (fallback) {
            reserve = p.alloutFreeReserve();
        } else if (compound && legs && row.legReserve() != null) {
            reserve = row.legReserve();
        } else if (cls == ExerciseClass.COMPOUND_STABLE && row.stableCompoundReserve() != null) {
            reserve = row.stableCompoundReserve();
        } else if (cls == ExerciseClass.ISOLATION && row.isolationReserve() != null) {
            reserve = row.isolationReserve();
        } else {
            reserve = row.reserve();
        }
        return new Stamp(
            compound ? row.compoundRepMin() : row.isolationRepMin(),
            compound ? row.compoundRepMax() : row.isolationRepMax(),
            row.workingSets(), reserve,
            compound ? row.compoundRestSec() : row.isolationRestSec(),
            row.repOverflow(), eff);
    }
}
