package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolOutcomesEnvelope;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * S9.7: turns ONE outcome list into the two persisted provenance envelopes. Every persistence
 * path goes through here, which is what keeps plan-truth and ran-truth from mixing inside one
 * row: a PIPELINE turn passes the executor's plan-ordered list (synthetic budget drops included),
 * a LEGACY turn passes {@code audit.toolOutcomes()}. Whichever list arrives, both envelopes
 * describe the same one.
 *
 * <p>Static by design — no bean, so no COMPANION_SWITCH gate and no constructor churn on the two
 * already-dense call sites.
 */
public final class TurnProvenance {

    /** Wire/FE tool type; V0.5 emits only reads and the planner can only plan reads. */
    private static final String READ = "read";
    private static final String TRUNCATED = " …(rövidítve)";
    private static final String OVER_BUDGET = "…(a többi részlet nem fér ide)";
    private static final String NO_OUTPUT = "Erre a lekérésre nem érkezett válasz.";

    /** Plain instance, no Spring wiring — this class is static by design (see class doc). */
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private TurnProvenance() {
    }

    /** The two envelopes of one turn; either side is null when there was nothing to disclose. */
    public record Built(ToolCallsEnvelope ask, ToolOutcomesEnvelope result) {
    }

    public static Built build(List<ToolCallAudit.ToolOutcome> outcomes, CompanionProperties.Turn.Provenance limits) {
        if (outcomes == null || outcomes.isEmpty()) {
            return new Built(null, null);
        }
        List<ToolCallsEnvelope.ToolCall> ask = new ArrayList<>(outcomes.size());
        List<ToolOutcomesEnvelope.Outcome> result = new ArrayList<>(outcomes.size());
        int spent = 0;
        for (ToolCallAudit.ToolOutcome outcome : outcomes) {
            ask.add(new ToolCallsEnvelope.ToolCall(READ, outcome.name(), compactArgs(outcome.args()), outcome.why()));
            String raw = outcome.result() == null ? NO_OUTPUT : outcome.result();
            String text;
            if (spent >= limits.totalChars()) {
                text = OVER_BUDGET;
            } else if (raw.length() > limits.perOutcomeChars()) {
                text = raw.substring(0, limits.perOutcomeChars()) + TRUNCATED;
            } else {
                text = raw;
            }
            spent += text.length();
            result.add(new ToolOutcomesEnvelope.Outcome(outcome.name(), text, failed(outcome.result())));
        }
        return new Built(new ToolCallsEnvelope(List.copyOf(ask)), ToolOutcomesEnvelope.ofOrNull(result));
    }

    /**
     * Reconciles the two {@code args} dialects that can arrive here: a PLAN-truth outcome's
     * {@code args} is raw JSON ({@code PlanExecutor} calls {@code argsJson(step.args())}, e.g.
     * {@code {"days":7}}); a RAN-truth outcome's {@code args} is already the compact chip form
     * ({@code "days=7"}) that {@code RecordingToolCallback.compactArgs} produced at record time.
     * Detected by a leading {@code '{'}; on ANY parse failure the input is returned unchanged —
     * provenance must never fail a turn.
     */
    private static String compactArgs(String args) {
        if (args == null) {
            return null;
        }
        String trimmed = args.trim();
        if (!trimmed.startsWith("{")) {
            return args;
        }
        try {
            JsonNode node = MAPPER.readTree(trimmed);
            if (!node.isObject()) {
                return args;
            }
            return node.properties().stream()
                    .map(entry -> entry.getKey() + "=" + entry.getValue().asString())
                    .collect(Collectors.joining(", "));
        } catch (RuntimeException e) {
            return args;
        }
    }

    /**
     * True for a null result (a call whose output never arrived, {@code toolOutcomes()} allows
     * it) and for a result equal to (or starting with) one of the executor's/callback's honest
     * failure markers — shown honestly rather than hidden.
     */
    private static boolean failed(String result) {
        if (result == null) {
            return true;
        }
        return result.startsWith(PlanExecutor.STEP_TIMEOUT)
                || result.startsWith(PlanExecutor.STEP_FAILED)
                || result.startsWith(RecordingToolCallback.BUDGET_EXHAUSTED);
    }
}
