package io.mrkuhne.mezo.feature.character.service;

import java.util.ArrayList;
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

    /** Memória mindenhol S10.2 (mezo-eq85.10): appends one extra evidence line (the
     *  {@code [Hosszú távú memória]} block) with a placeholder ref id — the
     *  {@code CharacterHistoryReads#addNarratives} "every expert gets it" precedent, applied to a
     *  single cross-cutting memory block rather than a per-day narrative. Returns a NEW instance;
     *  {@code lines}/{@code refIds} stay parallel. */
    public ExpertEvidence withLine(String line, String refId) {
        List<String> newLines = new ArrayList<>(lines);
        newLines.add(line);
        List<String> newRefIds = new ArrayList<>(refIds);
        newRefIds.add(refId);
        return new ExpertEvidence(expertKey, newLines, newRefIds);
    }
}
