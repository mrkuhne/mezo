package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

/**
 * Reflexió S2 (bd mezo-eq85.2, spec 2026-09-06 §4.2): the FALSIFIABLE test behind a pattern row —
 * which two series, at what lag, in which direction, and the gates the evidence must clear. It is
 * the reason a hypothesis can be checked at all: the nightly pass re-runs exactly this test and
 * writes an {@code evidence} event with the outcome.
 *
 * <p>Deliberately a stored jsonb envelope rather than columns: the plan is one indivisible thing
 * (a plan with a swapped series is a DIFFERENT hypothesis, not an edited one), which is exactly
 * what {@link #key(TestPlanEnvelope)} encodes.
 */
public record TestPlanEnvelope(String seriesA, String seriesB, int lagDays, String expectedDirection,
                               int minN, int minGroupN, int windowDays) {

    public static final String DIRECTION_POSITIVE = "positive";
    public static final String DIRECTION_NEGATIVE = "negative";

    /** Identity string — case-insensitive on the series keys ({@code people:Anna} ≡ {@code people:anna}). */
    public String canonical() {
        return seriesA.toLowerCase(Locale.ROOT) + "|" + seriesB.toLowerCase(Locale.ROOT)
                + "|" + lagDays + "|" + expectedDirection;
    }

    /** Stable identity: rewording never changes it; a different test is a different hypothesis. */
    public static String key(TestPlanEnvelope plan) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(plan.canonical().getBytes(StandardCharsets.UTF_8));
            return "ref-" + HexFormat.of().formatHex(digest, 0, 4);
        } catch (Exception e) {
            // unreachable — SHA-256 is JDK-guaranteed; error_handling.md forbids raw runtime types
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build());
        }
    }

    /** Does an observed r point the way the plan predicted? A zero r matches neither direction. */
    public boolean directionMatches(double r) {
        return DIRECTION_NEGATIVE.equals(expectedDirection) ? r < 0 : r > 0;
    }
}
