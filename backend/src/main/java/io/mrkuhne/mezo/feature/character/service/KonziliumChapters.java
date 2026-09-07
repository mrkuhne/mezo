package io.mrkuhne.mezo.feature.character.service;

import java.util.Map;
import java.util.UUID;

/**
 * The ONE answer to "which dossier chapter does this proposal belong to?" (mezo-xlvr final
 * review, I4/M11). Both the cross-talk round (which chapters are contested) and the deliberation
 * assembler (which thread an item joins) used to decide this on their own, and disagreed on the
 * unresolvable case; they now share this resolution and only differ in what they DO with a
 * {@code null} answer — cross-talk gives such a proposal no debate, the assembler puts it in the
 * "Egyéb javaslatok" bucket.
 *
 * <p>Pure data: {@code keyToTitle} is the owner's chapter titles, {@code claimIdToChapterKey}
 * the chapter of every claim the proposals target. {@link KonziliumChapterResolver} builds it.
 */
public record KonziliumChapters(Map<String, String> keyToTitle, Map<UUID, String> claimIdToChapterKey) {

    private static final String NEW_KIND = "NEW";

    public static KonziliumChapters empty() {
        return new KonziliumChapters(Map.of(), Map.of());
    }

    /**
     * The chapter key this proposal belongs to, or {@code null} when it cannot be resolved — a
     * NEW proposal names its chapter, the others are placed by the claim they target. Never
     * guesses: an unresolvable proposal is never silently merged into somebody else's chapter.
     */
    public String chapterKeyOf(ClaimProposal proposal) {
        if (NEW_KIND.equals(proposal.kind())) {
            return proposal.dimensionKey();
        }
        return proposal.claimId() == null ? null : claimIdToChapterKey.get(proposal.claimId());
    }

    /** The chapter's own title, falling back to the raw key when the owner has no row for it. */
    public String titleOf(String chapterKey) {
        return keyToTitle.getOrDefault(chapterKey, chapterKey);
    }
}
