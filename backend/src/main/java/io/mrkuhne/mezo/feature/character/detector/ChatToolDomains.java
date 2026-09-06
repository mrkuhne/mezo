package io.mrkuhne.mezo.feature.character.detector;

import java.util.Map;

/**
 * The companion's 18 read tools → 7 topic domains (round-4 spec §5.4). A deterministic topic
 * proxy: what the assistant had to LOOK UP says what the conversation was about, without any
 * detector-side reading of the message text. Mirrors {@code frontend/src/features/insights/logic/
 * toolDomains.ts}; keep the two in step when a tool is added. The wire bakes args into the name
 * ({@code get_recovery(days=3)}) — the name is cut at the first '('.
 */
final class ChatToolDomains {
    private ChatToolDomains() {}

    private static final Map<String, String> DOMAIN_OF = Map.ofEntries(
            Map.entry("get_weight_log", "suly"), Map.entry("get_weight_trend", "suly"),
            Map.entry("get_recovery", "alvas"),
            Map.entry("get_fuel_log", "fuel"), Map.entry("get_pantry", "fuel"),
            Map.entry("get_recipes", "fuel"), Map.entry("get_protocol", "fuel"),
            Map.entry("get_training_log", "edzes"), Map.entry("get_training_plan", "edzes"),
            Map.entry("get_exercise_records", "edzes"),
            Map.entry("get_goal", "cel"), Map.entry("get_growth", "cel"), Map.entry("get_daily_practice", "cel"),
            Map.entry("get_life_goals", "cel"),
            Map.entry("get_insights", "mintak"), Map.entry("find_similar_past_days", "mintak"),
            Map.entry("compare_periods", "mintak"),
            Map.entry("get_medication", "gyogyszer"));

    private static final Map<String, String> HU = Map.of(
            "suly", "súly", "alvas", "alvás", "fuel", "fuel", "edzes", "edzés",
            "cel", "cél és growth", "mintak", "minták és emlékek", "gyogyszer", "gyógyszer");

    /** The domain key, or null for a tool this map does not know (never a guess). */
    static String domainOf(String toolName) {
        if (toolName == null) {
            return null;
        }
        int paren = toolName.indexOf('(');
        String base = (paren == -1 ? toolName : toolName.substring(0, paren)).strip();
        return DOMAIN_OF.get(base);
    }

    static String hu(String domain) {
        return HU.getOrDefault(domain, domain);
    }
}
