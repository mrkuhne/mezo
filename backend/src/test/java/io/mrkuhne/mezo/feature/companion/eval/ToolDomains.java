package io.mrkuhne.mezo.feature.companion.eval;

import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Which domain each companion tool belongs to (mezo-ozri.3) — the vocabulary behind the eval's
 * "critical wrong tool" count. Every tool is read-only, so a wrong selection can never corrupt
 * data; what it CAN do is answer a training question out of the food log, confidently. That
 * cross-domain miss is the failure mode the go/no-go gate cares about.
 *
 * <p>An unmapped name deliberately counts as critical: a tool this map has not heard of is either
 * a hallucinated name or a new tool nobody re-baselined against, and both deserve to show up red
 * rather than to be quietly averaged away. {@code ToolSelectionEvalIT} additionally asserts the
 * live tool registry is fully covered here, so the map cannot silently rot.
 */
final class ToolDomains {

    private static final Map<String, String> DOMAINS = Map.ofEntries(
        Map.entry("get_training_plan", "train"),
        Map.entry("get_training_log", "train"),
        Map.entry("get_exercise_records", "train"),
        Map.entry("get_fuel_log", "fuel"),
        Map.entry("get_pantry", "fuel"),
        Map.entry("get_recipes", "fuel"),
        Map.entry("get_weight_trend", "biometrics"),
        Map.entry("get_weight_log", "biometrics"),
        Map.entry("get_recovery", "biometrics"),
        Map.entry("get_insights", "insights"),
        Map.entry("compare_periods", "insights"),
        Map.entry("get_goal", "goal"),
        Map.entry("get_life_goals", "lifegoal"),
        Map.entry("get_growth", "growth"),
        Map.entry("find_similar_past_days", "memory"),
        Map.entry("get_medication", "medication"),
        Map.entry("get_protocol", "medication"),
        Map.entry("get_daily_practice", "practice"));

    private ToolDomains() {
    }

    static Optional<String> domainOf(String toolName) {
        return Optional.ofNullable(DOMAINS.get(toolName));
    }

    static Set<String> knownTools() {
        return DOMAINS.keySet();
    }
}
