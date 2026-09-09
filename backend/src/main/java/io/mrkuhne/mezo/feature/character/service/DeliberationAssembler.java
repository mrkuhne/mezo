package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.character.entity.ConferenceDeliberationEnvelope;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the {@link ConferenceDeliberationEnvelope} from what the konzílium's three rounds
 * actually produced (mezo-xlvr): proposals, peer stances, the Szkeptikus's verdicts and the
 * chair's rulings, all index-aligned on the round's flat proposal list. Pure function, no I/O —
 * every lookup it needs (chapter titles, a claim's chapter) is passed in by the caller.
 *
 * <p>A missing verdict or ruling stays {@code null} on the item: a round that produced nothing
 * must not be shown as if it had ruled. Callers therefore pass the SHOWABLE rulings
 * ({@link KonziliumVerdictRound.Result#shownRulings()}) — empty when the Integrátor's answer
 * never parsed — not the lifecycle's index-complete, defaulted list.
 */
public final class DeliberationAssembler {

    private static final String FALLBACK_CHAPTER_KEY = "egyeb";
    private static final String FALLBACK_CHAPTER_TITLE = "Egyéb javaslatok";

    private DeliberationAssembler() {
    }

    public static ConferenceDeliberationEnvelope assemble(
            List<ClaimProposal> proposals,
            List<KonziliumCrossTalkRound.Reaction> reactions,
            List<KonziliumVerdictRound.SkepticVerdict> verdicts,
            List<ClaimRuling> rulings,
            KonziliumChapters chapters) {

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
                    new ConferenceDeliberationEnvelope.SkepticVerdict(
                            verdict.verdict(), verdict.argument(), verdict.suggestedConfidence()));
        }

        Map<String, List<ConferenceDeliberationEnvelope.Item>> itemsByChapter = new LinkedHashMap<>();
        for (int i = 0; i < proposals.size(); i++) {
            ClaimProposal proposal = proposals.get(i);
            String resolved = chapters.chapterKeyOf(proposal);
            String chapterKey = resolved == null ? FALLBACK_CHAPTER_KEY : resolved;
            ConferenceDeliberationEnvelope.ChairRuling chair = i < rulings.size()
                    ? new ConferenceDeliberationEnvelope.ChairRuling(
                            rulings.get(i).accepted(), rulings.get(i).ruledConfidence(),
                            rulings.get(i).reason(), rulings.get(i).dissent(),
                            rulings.get(i).note(), rulings.get(i).suggestedDimensionKey())
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
            boolean fallback = FALLBACK_CHAPTER_KEY.equals(chapterKey);
            // The fallback bucket has no dossier chapter behind it, so it must not claim a
            // dimension key the dossier does not contain (mezo-xlvr final review, M3) — it marks
            // "no chapter" with a null key, exactly the way a legacy expert-grouped thread does.
            threads.add(new ConferenceDeliberationEnvelope.Thread(
                    fallback ? null : chapterKey,
                    fallback ? FALLBACK_CHAPTER_TITLE : chapters.titleOf(chapterKey),
                    List.copyOf(entry.getValue())));
        }
        return new ConferenceDeliberationEnvelope(List.copyOf(threads));
    }
}
