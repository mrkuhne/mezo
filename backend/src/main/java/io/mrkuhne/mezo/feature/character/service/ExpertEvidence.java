package io.mrkuhne.mezo.feature.character.service;

import java.util.List;

/**
 * One expert's evidence block for a konzílium proposal round (Karakter S4, mezo-1gim.6) — the
 * seam {@link KonziliumProposalRound#runOnEvidence} shares between the weekly flow ({@code run}
 * builds one of these per expert from the week's observations) and the monthly bootstrap flow
 * ({@link CharacterHistoryReads#gatherHistory} builds them from the companion's episodic memory).
 * {@code lines} render verbatim into the expert's user message, one numbered item each;
 * {@code refIds} are the source rows' ids (parallel to {@code lines}, same order) and become the
 * transcript turn's {@code refIds}.
 */
public record ExpertEvidence(String expertKey, List<String> lines, List<String> refIds) {
}
