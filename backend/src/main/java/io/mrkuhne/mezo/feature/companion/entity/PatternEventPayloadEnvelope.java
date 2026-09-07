package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;
import java.util.UUID;

/**
 * Typed jsonb payload of one {@link PatternEventEntity} (S1, spec 2026-08-14). All fields
 * nullable — each kind fills only its own: snapshot → r/n/p; reinforced → reinforcementCount;
 * promoted → factId; the three decision kinds carry an empty payload.
 *
 * <p>Reflexió S2 (mezo-eq85.2) appends the trailing components: evidence → r/n/p + verdict + hit;
 * observation → text + evidenceRefs + surfaced; user_reply → channel/choice/text; revised → text.
 * Jackson deserializes pre-S2 rows with every trailing component null (the {@code
 * CompanionMessageEnvelope} precedent) — the record grows at the END for exactly that reason.
 */
public record PatternEventPayloadEnvelope(Double r, Integer n, Double p,
                                          Integer reinforcementCount, UUID factId,
                                          Boolean hit, String verdict, String channel,
                                          String choice, String text,
                                          List<String> evidenceRefs, Boolean surfaced) {

    public static PatternEventPayloadEnvelope empty() {
        return new PatternEventPayloadEnvelope(null, null, null, null, null,
                null, null, null, null, null, null, null);
    }

    public static PatternEventPayloadEnvelope snapshot(double r, int n, double p) {
        return new PatternEventPayloadEnvelope(r, n, p, null, null,
                null, null, null, null, null, null, null);
    }

    public static PatternEventPayloadEnvelope reinforced(int reinforcementCount) {
        return new PatternEventPayloadEnvelope(null, null, null, reinforcementCount, null,
                null, null, null, null, null, null, null);
    }

    public static PatternEventPayloadEnvelope promoted(UUID factId) {
        return new PatternEventPayloadEnvelope(null, null, null, null, factId,
                null, null, null, null, null, null, null);
    }

    /** S2: one nightly re-run of the test plan. {@code hit} is null when the gate was not LIVE —
     *  "we could not tell" is not a miss (the streaks read it exactly that way). */
    public static PatternEventPayloadEnvelope evidence(Double r, Integer n, Double p,
                                                       String verdict, Boolean hit) {
        return new PatternEventPayloadEnvelope(r, n, p, null, null,
                hit, verdict, null, null, null, null, null);
    }

    /** S2: what the companion said about the pattern, and whether it actually reached the user. */
    public static PatternEventPayloadEnvelope observation(String text, List<String> evidenceRefs,
                                                          boolean surfaced) {
        return new PatternEventPayloadEnvelope(null, null, null, null, null,
                null, null, null, null, text, evidenceRefs, surfaced);
    }

    /** S2: the user's own answer — the only user-authored input to {@code belief}. */
    public static PatternEventPayloadEnvelope userReply(String channel, String choice, String text) {
        return new PatternEventPayloadEnvelope(null, null, null, null, null,
                null, null, channel, choice, text, null, null);
    }

    /** S2: a rewording — the test plan (and therefore the identity) is unchanged. */
    public static PatternEventPayloadEnvelope revised(String text) {
        return new PatternEventPayloadEnvelope(null, null, null, null, null,
                null, null, null, null, text, null, null);
    }
}
