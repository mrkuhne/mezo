package io.mrkuhne.mezo.feature.character.entity;

import java.math.BigDecimal;
import java.util.List;

/**
 * The konzílium's exchange as a STRUCTURE (mezo-xlvr): one thread per dossier chapter the
 * council touched, one item per proposal, each item carrying the whole chain that happened to
 * it — the peers who reacted, the Szkeptikus's verdict, the chair's ruling. The prose
 * {@link ConferenceTranscriptEnvelope} stays alongside it: this record does not replace what
 * was said, it stops the round from throwing away HOW it hung together.
 *
 * <p>{@code skeptic} and {@code chair} are nullable on purpose: a round whose answer failed to
 * parse produced no verdict, and fabricating a default one would misreport the meeting.
 */
public record ConferenceDeliberationEnvelope(List<Thread> threads) {

    /** One dossier chapter's thread. {@code dimensionKey} is null for a legacy, expert-grouped
     *  thread (see {@code LegacyTranscriptParser}); {@code title} is then the expert's name. */
    public record Thread(String dimensionKey, String title, List<Item> items) {
    }

    /**
     * One proposal with its chain. {@code index} is the proposal's position in the round's flat
     * proposal list — the same index the Szkeptikus and the chair answered on. {@code kind} is
     * one of {@code NEW}, {@code UP}, {@code DOWN}, {@code RETIRE}; {@code claimId} is the
     * targeted claim for the last three and null for {@code NEW}.
     */
    public record Item(int index, String expertKey, String text, String kind, String claimId,
                       boolean sensitive, List<PeerReaction> reactions,
                       SkepticVerdict skeptic, ChairRuling chair) {
    }

    /** One peer expert's stance on somebody else's proposal: {@code SUPPORT}, {@code CHALLENGE}
     *  or {@code NUANCE}. */
    public record PeerReaction(String expertKey, String stance, String argument) {
    }

    /** {@code verdict} is {@code KEEP} or {@code KILL}. */
    public record SkepticVerdict(String verdict, String argument) {
    }

    public record ChairRuling(boolean accepted, BigDecimal confidence, String reason) {
    }
}
