package io.mrkuhne.mezo.feature.fuel.service;

import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Deterministic placement rules (mezo-vx9v). Ordered — first matching rule wins. Needles are
 *  lowercase name substrings (accent-safe stems where possible). restDayFallback: zone key,
 *  "skip", or null (= keep the zone on rest days too). */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class PlacementRules {

    public record Rule(List<String> needles, String slotKey, String restDayFallback,
                       String reasonHu, String dailyTotalHintHu) {}

    public static final List<Rule> RULES = List.of(
        new Rule(List.of("kreatin", "creatine"), "wake", null,
            "Kreatin ébredés után vízben — étkezéstől független, a napi konzisztencia számít.",
            "ajánlott napi összmennyiség 15–20g — érdemes 3-4 bevételre osztani"),
        new Rule(List.of("kávé", "espresso", "koffein", "caffeine"), "wake", null,
            "Koffein a nap elején — bőven a 14:00-s cutoff előtt.", null),
        new Rule(List.of("pwo", "pre-workout", "pump", "aakg", "arginin",
                "béta-alanin", "beta-alanin", "betaalanin", "citrullin"), "pre_workout", "skip",
            "Pump-stack ~40 perccel edzés előtt — plazmacsúcs edzéskezdésre; pihenőnapon kimarad.", null),
        new Rule(List.of("whey", "protein", "fehérje"), "post_workout", "breakfast",
            "Fehérje az edzés utáni ablakban — pihenőnapon reggelihez.", null),
        new Rule(List.of("d3", "k2", "omega", "halolaj", "krill", "kurkum", "q10", "koenzim"),
            "lunch", null,
            "Zsírban oldódó — zsíros étkezéssel 3–4× jobb a felszívódás.", null),
        new Rule(List.of("magn", "magné"), "evening", null,
            "Magnézium este — GABA-moduláció, mélyalvás-támogatás, lefekvés előtt ~2 órával.", null),
        new Rule(List.of("zma", "melatonin", "glicin"), "bedtime", null,
            "Közvetlenül lefekvés előtt hat a legjobban.", null),
        new Rule(List.of("cink", "zinc"), "dinner", null,
            "Cink vacsorához — távol a reggeli koffeintől és ásványi interakcióktól.", null),
        new Rule(List.of("multivitamin", "vitamin"), "breakfast", null,
            "Reggelihez kötve — étellel kímélőbb, könnyű rutin.", null));

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
