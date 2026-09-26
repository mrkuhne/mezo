package io.mrkuhne.mezo.feature.companion.entity;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The team character that owns a fact (U9b, mezo-zpxv7) — mirrors ck_learned_fact_owner /
 * ck_knowledge_fact_owner and the FE `TEAM` registry ids (features/insights/logic/team.ts).
 * The category is the fallback owner; the sleep lexicon only exists for the one-time backfill
 * (the SQL migration applies the same regex) — live producers name the owner themselves.
 */
public final class FactOwner {

    public static final Set<String> OWNERS = Set.of("szunya", "mocor", "falat", "deru", "mezo");

    private static final Map<String, String> BY_CATEGORY =
            Map.of("train", "mocor", "fuel", "falat", "health", "deru", "life", "mezo");

    /** Same alternation as the migration's `~*` backfill regex. */
    static final Pattern SLEEP = Pattern.compile("alv|alsz|lefekv|fekszel|fekszem|ébred|sleep|bed", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private FactOwner() {
    }

    public static String forCategory(String category) {
        return BY_CATEGORY.getOrDefault(category, "mezo");
    }

    public static String resolve(String proposed, String category) {
        if (proposed != null) {
            String lower = proposed.trim().toLowerCase(Locale.ROOT);
            if (OWNERS.contains(lower)) {
                return lower;
            }
        }
        return forCategory(category);
    }

    public static String backfill(String category, String text) {
        if ("health".equals(category) && text != null && SLEEP.matcher(text).find()) {
            return "szunya";
        }
        return forCategory(category);
    }
}
