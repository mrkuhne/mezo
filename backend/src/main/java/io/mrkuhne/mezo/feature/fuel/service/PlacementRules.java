package io.mrkuhne.mezo.feature.fuel.service;

import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Deterministic placement rules (mezo-vx9v). Ordered — first matching rule wins. Needles are
 *  lowercase name substrings (accent-safe stems where possible). restDayFallback: zone key,
 *  "skip", or null (= keep the zone on rest days too). The reason and the daily-total hint are
 *  message-bundle keys ({@code FUEL_PLACEMENT_*}), rendered in the account's language by
 *  {@link PlacementEngine} (mezo-n4wf5.5). */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class PlacementRules {

    public record Rule(List<String> needles, String slotKey, String restDayFallback,
                       String reasonKey, String dailyTotalHintKey) {}

    public static final List<Rule> RULES = List.of(
        new Rule(List.of("kreatin", "creatine"), "wake", null,
            "FUEL_PLACEMENT_REASON_CREATINE", "FUEL_PLACEMENT_HINT_CREATINE"),
        new Rule(List.of("kávé", "espresso", "koffein", "caffeine"), "wake", null,
            "FUEL_PLACEMENT_REASON_CAFFEINE", null),
        new Rule(List.of("pwo", "pre-workout", "pump", "aakg", "arginin",
                "béta-alanin", "beta-alanin", "betaalanin", "citrullin"), "pre_workout", "skip",
            "FUEL_PLACEMENT_REASON_PUMP", null),
        new Rule(List.of("whey", "protein", "fehérje"), "post_workout", "breakfast",
            "FUEL_PLACEMENT_REASON_PROTEIN", null),
        new Rule(List.of("d3", "k2", "omega", "halolaj", "krill", "kurkum", "q10", "koenzim"),
            "lunch", null,
            "FUEL_PLACEMENT_REASON_FAT_SOLUBLE", null),
        new Rule(List.of("magn", "magné"), "evening", null,
            "FUEL_PLACEMENT_REASON_MAGNESIUM", null),
        new Rule(List.of("zma", "melatonin", "glicin"), "bedtime", null,
            "FUEL_PLACEMENT_REASON_BEDTIME", null),
        new Rule(List.of("cink", "zinc"), "dinner", null,
            "FUEL_PLACEMENT_REASON_ZINC", null),
        new Rule(List.of("multivitamin", "vitamin"), "breakfast", null,
            "FUEL_PLACEMENT_REASON_VITAMIN", null));

    /** Secondary signal: the pantry item's own timing hint → zone key (null = no mapping). */
    public static String zoneForTiming(String timing) {
        if (timing == null) return null;
        return switch (timing) {
            case "morning" -> "wake";
            case "midday" -> "lunch";
            case "evening" -> "evening";
            case "dinner" -> "dinner";
            case "pre-workout" -> "pre_workout";
            default -> timing.startsWith("weekly") ? "wake" : null;
        };
    }
}
