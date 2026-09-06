package io.mrkuhne.mezo.feature.companion.flags.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * How a rule is NAMED to the user (spec 2026-09-05 §5): the Hungarian label the observer shows and
 * the DOMAIN the surface turns into a colour wash and a clay icon. Server-side on purpose — a
 * per-key map in the frontend would mean every round-2 rule needs a frontend change; here the
 * engine returns a correctly-named rule the day it starts evaluating.
 *
 * <p>Deliberately holds NO ranking. The severity order is {@code AdvicePriority}'s, reached through
 * {@link AdviceRankPort} — duplicating it here is exactly the five-mirrors defect class round 1 hit
 * (bd memory: adding-a-flagkey-needs-five-mirrored-changes).
 *
 * <p>An unknown key falls back rather than throwing: an unmapped key must never break the observer,
 * the same argument {@code AdvicePriority.rankOf} makes for its own last-place default.
 * {@code FlagCatalogTest} asserts every live {@link FlagKey} is present, so the fallback is a last
 * resort rather than the normal way a new key behaves.
 */
public final class FlagCatalog {

    /** The domain of a key we do not know — the frontend's own fallback wash/icon. */
    public static final String DOMAIN_FALLBACK = "general";

    public static final String DOMAIN_SLEEP = "sleep";
    public static final String DOMAIN_TRAINING = "training";
    public static final String DOMAIN_NUTRITION = "nutrition";
    public static final String DOMAIN_RECOVERY = "recovery";
    public static final String DOMAIN_HABITS = "habits";
    public static final String DOMAIN_LOGGING = "logging";
    public static final String DOMAIN_BODY = "body";

    /** label + domain for one rule. */
    private record Entry(String label, String domain) {
    }

    private static final Map<String, Entry> ENTRIES = new LinkedHashMap<>();

    static {
        ENTRIES.put(FlagKey.ACUTE_BAD_DAY, new Entry("Rossz nap", DOMAIN_RECOVERY));
        ENTRIES.put(FlagKey.LOAD_FUEL_MISMATCH, new Entry("Terhelés–táplálás", DOMAIN_NUTRITION));
        ENTRIES.put(FlagKey.RAPID_WEIGHT_LOSS, new Entry("Gyors fogyás", DOMAIN_BODY));
        ENTRIES.put(FlagKey.JOINT_OVERUSE, new Entry("Vállterhelés", DOMAIN_TRAINING));
        ENTRIES.put(FlagKey.MISSED_WORKOUTS, new Entry("Kimaradt edzések", DOMAIN_TRAINING));
        ENTRIES.put(FlagKey.SLEEP_DEBT, new Entry("Alvásadósság", DOMAIN_SLEEP));
        ENTRIES.put(FlagKey.LOGGING_GAP, new Entry("Rögzítési hiány", DOMAIN_LOGGING));
        ENTRIES.put(FlagKey.IGNORED_NUDGE, new Entry("Elengedett emlékeztető", DOMAIN_SLEEP));
        ENTRIES.put(FlagKey.LATE_EATING, new Entry("Késői evés", DOMAIN_NUTRITION));
        // Round 2 S1 (bd mezo-d58h.7.1): a Fuel protocol item (a supplement) missed on consecutive
        // DUE days — hence the nutrition domain. Placed here, not at the file's tail, because
        // AdvicePriority.ORDER ranks it directly after late_eating (above the setup checks and the
        // round-0 tail); this map's insertion order is documentation of that rank, not behaviour.
        ENTRIES.put(FlagKey.PROTOCOL_LAPSE, new Entry("Kihagyott protokoll", DOMAIN_NUTRITION));
        // Round 2 S4 (bd mezo-d58h.7.4): the meal-slot plan vs. the logged reality — a Fuel/meal
        // observation, hence the nutrition domain. Insertion order again mirrors
        // AdvicePriority.ORDER, where it sits directly after protocol_lapse.
        ENTRIES.put(FlagKey.MEAL_RHYTHM_DRIFT, new Entry("Étkezési ritmus", DOMAIN_NUTRITION));
        // Round 2 S6 (bd mezo-d58h.7.7): afternoon energy vs. meal timing — a Meal/Fuel-side
        // observation, hence the nutrition domain (the actionable half of the correlation is WHEN
        // the user eats). Insertion order again mirrors AdvicePriority.ORDER, where it sits
        // directly after meal_rhythm_drift.
        ENTRIES.put(FlagKey.ENERGY_DIP_MEAL_TIMING, new Entry("Délutáni energia", DOMAIN_NUTRITION));
        ENTRIES.put(FlagKey.RECOVERY_NEEDED, new Entry("Regeneráció kell", DOMAIN_RECOVERY));
        ENTRIES.put(FlagKey.SUSTAINED_STRESS, new Entry("Tartós stressz", DOMAIN_RECOVERY));
        ENTRIES.put(FlagKey.MOMENTUM_AT_RISK, new Entry("Lendület veszélyben", DOMAIN_HABITS));
        ENTRIES.put(FlagKey.ALL_HEALTHY, new Entry("Minden rendben", DOMAIN_HABITS));
    }

    /** The rules the observer renders — enumeration only; the ORDER of the response is the rank's. */
    public static final List<String> KEYS = List.copyOf(ENTRIES.keySet());

    private FlagCatalog() {
    }

    /** The Hungarian label, or the key itself when unmapped (never null for a non-null key). */
    public static String labelOf(String flagKey) {
        Entry entry = ENTRIES.get(flagKey);
        return entry == null ? flagKey : entry.label();
    }

    public static String domainOf(String flagKey) {
        Entry entry = ENTRIES.get(flagKey);
        return entry == null ? DOMAIN_FALLBACK : entry.domain();
    }
}
