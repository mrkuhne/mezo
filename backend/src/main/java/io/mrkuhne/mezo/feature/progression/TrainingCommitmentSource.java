package io.mrkuhne.mezo.feature.progression;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the training half of the discipline trait (planned vs done sessions in a window).
 * Implemented by the train slice ({@code feature/train/signal/TrainingCommitmentCalculator}) —
 * same one-directional pattern as {@link RobustnessSource}.
 */
public interface TrainingCommitmentSource {

    record Stats(int planned, int done) {}

    /** planned = window dates matching the active meso's template weekdays; done = distinct done-instance dates. */
    Stats commitmentStats(UUID createdBy, LocalDate from, LocalDate to);
}
