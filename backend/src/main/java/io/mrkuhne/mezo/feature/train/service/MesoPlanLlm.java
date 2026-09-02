package io.mrkuhne.mezo.feature.train.service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Train-owned LLM port of the plan generator (ADR 0012 consumer-owned port; the Gemini adapter
 * lives in {@code feature.companion.llm.MesoPlanLlmAdapter} — companion→train is the sanctioned
 * dependency direction, never the reverse). The model only PICKS exercises into frames the
 * deterministic skeleton already fixed; {@link MesoPlanMerger} validates every pick against the
 * candidate list and the frame, so a hallucinated id or an off-frame set count never reaches
 * the client. Empty = unusable answer; the caller keeps the deterministic fill.
 */
public interface MesoPlanLlm {

    record FramedDay(String day, String type, Map<String, Integer> setsByGroup) {}

    record Request(List<FramedDay> days, List<MesoPlanFiller.Candidate> candidates,
                   Map<String, String> tiers, String goalText) {}

    record ExercisePick(UUID catalogId, Integer workingSets) {}

    record DayPick(String day, List<ExercisePick> exercises) {}

    record Suggestion(String rationale, List<DayPick> days) {}

    Optional<Suggestion> propose(Request request);
}
