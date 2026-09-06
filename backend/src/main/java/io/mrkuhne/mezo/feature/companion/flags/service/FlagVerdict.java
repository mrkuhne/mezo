package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;

/**
 * What one rule concluded for one user on one evaluation (spec 2026-09-05 §4.1) — the replacement
 * for {@code Optional<FlagRaise>}, whose empty case threw away the two most interesting answers:
 * "I checked and it is fine" and "I could not check".
 *
 * <p>Exactly one of {@code payload} / {@code clear} / {@code reason} is non-null, matching
 * {@code outcome}; the factories are the only way to build one.
 */
public record FlagVerdict(
    String flagKey,
    FlagOutcome outcome,
    FlagPayloadEnvelope payload,
    ClearEvidence clear,
    UnavailableReason reason) {

    /**
     * Why a rule is not firing, in the rule's own numbers. {@code observed}/{@code threshold} are
     * null for a non-numeric clear (a goal trajectory, a muscle group), where {@code detail}
     * carries the value instead.
     */
    public record ClearEvidence(String metric, Double observed, Double threshold, String detail) {
    }

    public static FlagVerdict raised(String flagKey, FlagPayloadEnvelope payload) {
        if (payload == null) {
            throw new SystemRuntimeErrorException(SystemMessage.error("FLAG_VERDICT_RAISED_NEEDS_PAYLOAD")
                .params(List.of(flagKey)).build());
        }
        return new FlagVerdict(flagKey, FlagOutcome.RAISED, payload, null, null);
    }

    public static FlagVerdict clear(String flagKey, ClearEvidence evidence) {
        if (evidence == null) {
            throw new SystemRuntimeErrorException(SystemMessage.error("FLAG_VERDICT_CLEAR_NEEDS_EVIDENCE")
                .params(List.of(flagKey)).build());
        }
        return new FlagVerdict(flagKey, FlagOutcome.CLEAR, null, evidence, null);
    }

    public static FlagVerdict unavailable(String flagKey, UnavailableReason reason) {
        if (reason == null) {
            throw new SystemRuntimeErrorException(SystemMessage.error("FLAG_VERDICT_UNAVAILABLE_NEEDS_REASON")
                .params(List.of(flagKey)).build());
        }
        return new FlagVerdict(flagKey, FlagOutcome.UNAVAILABLE, null, null, reason);
    }
}
