package io.mrkuhne.mezo.feature.season.entity;

import java.time.LocalDate;
import java.util.List;

/**
 * A finished experiment's verdict (the contract's {@code SeasonExperimentResult} + the overlaps of the whole window),
 * stored as {@code season_experiment.result} jsonb (Boop B6 Évad S4, mezo-r36n9.16).
 */
public record SeasonExperimentResultJson(
    String verdict,            // clear | none | insufficient
    List<Signal> signals,
    LocalDate baselineFrom,
    LocalDate baselineTo,
    int markedCount,
    List<Overlap> overlaps
) {

    public record Signal(String key, Double before, Double after, int nBefore, int nAfter, Double cliffsDelta,
                         boolean clear, Boolean better) {
    }

    public record Overlap(String kind, LocalDate date, String text) {
    }

    public List<Signal> signalsOrEmpty() {
        return signals == null ? List.of() : signals;
    }

    public List<Overlap> overlapsOrEmpty() {
        return overlaps == null ? List.of() : overlaps;
    }
}
