package io.mrkuhne.mezo.feature.train.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Train-owned LLM port of the technique refinement (T4, {@code mezo-r36n9.82}, spec §6.5 "AI refinement"; ADR 0012
 * consumer-owned port — the adapter lives in {@code feature.companion.llm.TechniqueLlmAdapter}). The model sees the
 * deterministic planner's week plus what the code cannot weigh (last week's logs, joint pain, soreness, stalls) and
 * may only MOVE or SWAP techniques among the rows marked eligible, and move each day's challenge among the rows marked
 * as challenge candidates, with a one-line reason per change. {@link TechniqueMerger} re-validates every change, so
 * nothing the model says is trusted. Empty = no usable answer; the planner's week stands.
 */
public interface TechniqueLlm {

    /**
     * One exercise row of the week. {@code technique} / {@code source} / {@code challenge}: what the row carries now;
     * {@code plannedTechnique} / {@code plannedChallenge}: what the code default wants this week; {@code eligible}: a
     * technique may go here; {@code challengeCandidate}: the day's challenge may go here; {@code lastWeek}: a short
     * summary of last week's logged sets (null when none).
     */
    record RowView(UUID exerciseId, String name, String group, String tier, int workingSets, Integer repMin,
                   Integer repMax, String style, String technique, String source, boolean challenge,
                   boolean eligible, boolean challengeCandidate, String plannedTechnique, boolean plannedChallenge,
                   String lastWeek) {}

    /** One training day; {@code allowance} = how many technique exercises the day may carry (the challenge aside). */
    record DayView(int dayIndex, String dayName, boolean sportDay, int allowance, List<RowView> rows) {}

    /** Last week's signals of a muscle group. */
    record GroupSignal(String group, boolean grind, boolean jointPain, boolean sorenessHigh, boolean stalled) {}

    record Request(int week, int weeks, boolean deficit, int maxPerMuscleWeek, List<DayView> days,
                   List<GroupSignal> signals) {}

    /** Set {@code exerciseId}'s technique to {@code technique} ({@code rest_drop|myo|drop|none}). */
    record Change(UUID exerciseId, String technique, String reason) {}

    /** Make {@code exerciseId} the challenge of day {@code dayIndex}. */
    record ChallengeMove(Integer dayIndex, UUID exerciseId, String reason) {}

    record Suggestion(List<Change> changes, List<ChallengeMove> challenges) {}

    Optional<Suggestion> refine(Request request);
}
