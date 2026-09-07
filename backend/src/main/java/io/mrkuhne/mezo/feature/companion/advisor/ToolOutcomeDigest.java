package io.mrkuhne.mezo.feature.companion.advisor;

import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit.ToolOutcome;

import java.util.List;

/**
 * mezo-indo: renders the turn's tool calls AND their outputs into the verdict judge's payload,
 * inside a hard character budget.
 *
 * <p>Why the outputs at all: the v1 payload listed tool NAMES only, so every number a tool
 * produced was structurally unsupported to the judge — measured at 0% pass on every
 * reasoning-effort level up to xhigh (mezo-9yqq class 1, measured under mezo-641c S2/A). It is a
 * missing-INPUT problem, not a thinking-budget one, so more effort cannot fix it and this block
 * is the only fix.
 *
 * <p>Why a budget: the judge runs on the cheap tier and its payload already carries the system
 * prompt plus the whole rendered history. Tool outputs are per-turn unbounded (a 30-day weight log
 * is one line per day), so they get a per-result cap and a total cap.
 *
 * <p>Why the markers: the two lossy outcomes must stay VISIBLE. A silently cut output would let
 * the judge conclude "the tool did not return this number" from an artifact of our truncation, and
 * a silently dropped call would read as a tool that returned nothing. Both mislead in the exact
 * direction this ticket exists to remove — so truncation says so, an omitted output keeps its call
 * line, and the judge prompt tells the judge what the markers mean.
 */
final class ToolOutcomeDigest {

    /** No tool ran this turn — the honest empty case (a fabricated number here IS the v1 catch). */
    static final String NONE = "ESZKÖZHÍVÁSOK: nincs";

    static final String HEADER = "ESZKÖZHÍVÁSOK ÉS A KIMENETÜK:";

    /** Appended to an output cut at the per-result cap. */
    static final String TRUNCATED = " […a kimenet innen levágva]";

    /** Stands in for an output that did not fit the total budget — the CALL is still listed. */
    static final String OMITTED = "[a kimenet helyhiány miatt kimaradt]";

    /** Stands in for a call whose output was never recorded (no result reached the audit). */
    static final String UNKNOWN = "[a kimenet nem ismert]";

    private ToolOutcomeDigest() {
    }

    /**
     * @param maxCharsPerResult per-output cap; a longer output is cut here and marked
     * @param maxCharsTotal budget across all outputs; past it calls keep their line, outputs drop
     */
    static String render(List<ToolOutcome> outcomes, int maxCharsPerResult, int maxCharsTotal) {
        if (outcomes.isEmpty()) {
            return NONE;
        }
        StringBuilder b = new StringBuilder(HEADER);
        int spent = 0;
        for (ToolOutcome outcome : outcomes) {
            b.append("\n- ").append(outcome.name());
            if (outcome.args() != null && !outcome.args().isBlank()) {
                b.append('(').append(outcome.args()).append(')');
            }
            b.append(":\n");
            String result = outcome.result();
            if (result == null || result.isBlank()) {
                b.append(UNKNOWN);
                continue;
            }
            String clipped = result.length() > maxCharsPerResult
                    ? result.substring(0, maxCharsPerResult) + TRUNCATED
                    : result;
            // The budget is checked against what is already spent, so the FIRST output always
            // lands whole (up to its own cap) rather than a big first read starving itself.
            if (spent >= maxCharsTotal) {
                b.append(OMITTED);
                continue;
            }
            b.append(clipped);
            spent += clipped.length();
        }
        return b.toString();
    }
}
