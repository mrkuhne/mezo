package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;

/** Whether the model is still learning the owner's baseline (Boop B7 K1). */
public final class LearningState {

    private LearningState() {
    }

    /** True ("tanuló") until enough full days AND enough own labels exist. */
    public static boolean of(int fullDays, int labelledDays, CapacityProperties p) {
        return fullDays < p.learning().minDays() || labelledDays < p.learning().minLabels();
    }
}
