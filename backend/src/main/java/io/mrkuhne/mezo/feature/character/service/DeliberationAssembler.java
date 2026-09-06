package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds the {@link ConferenceDeliberationEnvelope} from what the konzílium's three rounds
 * actually produced (mezo-xlvr): proposals, peer stances, the Szkeptikus's verdicts and the
 * chair's rulings, all index-aligned on the round's flat proposal list. Pure function, no I/O —
 * every lookup it needs (chapter titles, a claim's chapter) is passed in by the caller.
 *
 * <p>A missing verdict or ruling stays {@code null} on the item: a round that produced nothing
 * must not be shown as if it had ruled.
 */
public final class DeliberationAssembler {

    private static final String NEW_KIND = "NEW";
    private static final String FALLBACK_CHAPTER_KEY = "egyeb";
    private static final String FALLBACK_CHAPTER_TITLE = "Egyéb javaslatok";

    private DeliberationAssembler() {
    }

    public static ConferenceDeliberationEnvelope assemble(
            List<ClaimProposal> proposals,
            List<KonziliumCrossTalkRound.Reaction> reactions,
            List<KonziliumVerdictRound.SkepticVerdict> verdicts,
            List<ClaimRuling> rulings,
            Map<String, String> chapterKeyToTitle,
            Map<UUID, String> claimIdToChapterKey) {

        Map<Integer, List<ConferenceDeliberationEnvelope.PeerReaction>> reactionsByIndex = new LinkedHashMap<>();
        for (KonziliumCrossTalkRound.Reaction reaction : reactions) {
            reactionsByIndex
                    .computeIfAbsent(reaction.index(), index -> new ArrayList<>())
                    .add(new ConferenceDeliberationEnvelope.PeerReaction(
                            reaction.expertKey(), reaction.stance(), reaction.argument()));
        }

        Map<Integer, ConferenceDeliberationEnvelope.SkepticVerdict> verdictByIndex = new LinkedHashMap<>();
        for (KonziliumVerdictRound.SkepticVerdict verdict : verdicts) {
            verdictByIndex.put(verdict.index(),
                    new ConferenceDeliberationEnvelope.SkepticVerdict(verdict.verdict(), verdict.argument()));
        }

        Map<String, List<ConferenceDeliberationEnvelope.Item>> itemsByChapter = new LinkedHashMap<>();
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal proposal = proposals.get(i);
            String chapterKey = chapterKeyOf(proposal, claimIdToChapterKey);
            ConferenceDeliberationEnvelope.ChairRuling chair = i < rulings.size()
                    ? new ConferenceDeliberationEnvelope.ChairRuling(
                            rulings.get(i).accepted(), rulings.get(i).ruledConfidence(), rulings.get(i).reason())
                    : null;
            itemsByChapter
                    .computeIfAbsent(chapterKey, key -> new ArrayList<>())
                    .add(new ConferenceDeliberationEnvelope.Item(
                            i,
                            proposal.expertKey(),
                            proposal.text(),
                            proposal.kind(),
                            proposal.claimId() == null ? null : proposal.claimId().toString(),
                            proposal.sensitive(),
                            List.copyOf(reactionsByIndex.getOrDefault(i, List.of())),
                            verdictByIndex.get(i),
                            chair));
        }

        List<ConferenceDeliberationEnvelope.Thread> threads = new ArrayList<>();
        for (Map.Entry<String, List<ConferenceDeliberationEnvelope.Item>> entry : itemsByChapter.entrySet()) {
            String chapterKey = entry.getKey();
            String title = FALLBACK_CHAPTER_KEY.equals(chapterKey)
                    ? FALLBACK_CHAPTER_TITLE
                    : chapterKeyToTitle.getOrDefault(chapterKey, chapterKey);
            threads.add(new ConferenceDeliberationEnvelope.Thread(chapterKey, title, List.copyOf(entry.getValue())));
        }
        return new ConferenceDeliberationEnvelope(List.copyOf(threads));
    }

    /** A NEW proposal names its chapter; the others are placed by the claim they target. An
     *  unresolvable claim falls back to the literal {@code "egyeb"} chapter — never silently
     *  merged into somebody else's chapter. */
    private static String chapterKeyOf(ClaimProposal proposal, Map<UUID, String> claimIdToChapterKey) {
        if (NEW_KIND.equals(proposal.kind()) && proposal.dimensionKey() != null) {
            return proposal.dimensionKey();
        }
        if (proposal.claimId() != null) {
            String chapterKey = claimIdToChapterKey.get(proposal.claimId());
            if (chapterKey != null) {
                return chapterKey;
            }
        }
        return FALLBACK_CHAPTER_KEY;
    }
}
