package io.mrkuhne.mezo.feature.lifegoal.catalog;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarSourceJson;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * The closed signal catalog (spec D4): the ONLY sources a pillar may point at. The AI proposer
 * chooses from {@link #promptText()}; {@code LifeGoalPillarService} validates every pillar with
 * {@link #find(PillarSourceJson)}. Metric keys are MetricKey names (companion) — string-mirrored
 * here on purpose so this slice does not import companion until slice 2 needs the series.
 */
@Component
public class SignalCatalog {

    private static final List<String> HABIT_AVG = List.of("habit", "average");
    private static final List<String> AVG_BASE = List.of("average", "baseline");
    private static final List<String> HABIT_AVG_BASE = List.of("habit", "average", "baseline");
    private static final List<String> HABIT_BASE_TARGET = List.of("habit", "baseline", "target");

    private static PillarSourceJson metric(String key) { return new PillarSourceJson("metric", key, null, null, null, null); }
    private static PillarSourceJson activity(String skill, String measure) { return new PillarSourceJson("activity", null, skill, measure, null, null); }
    private static PillarSourceJson ring(String ring) { return new PillarSourceJson("needs_ring", null, null, null, null, ring); }

    private static final List<SignalCatalogEntry> ENTRIES = List.of(
        new SignalCatalogEntry("sleep_duration", metric("SLEEP_DURATION_H"), "Alváshossz", "Alvás", HABIT_AVG_BASE, "óra", "recovery"),
        new SignalCatalogEntry("sleep_quality", metric("SLEEP_QUALITY"), "Alvásminőség", "Alvás", AVG_BASE, "1–10", "recovery"),
        new SignalCatalogEntry("bedtime_variability", metric("BEDTIME_VARIABILITY"), "Lefekvés-szórás", "Alvás", AVG_BASE, "perc", "recovery"),
        new SignalCatalogEntry("protein", metric("DAILY_PROTEIN_G"), "Fehérje", "Fuel", HABIT_AVG_BASE, "g", "cooking"),
        new SignalCatalogEntry("kcal", metric("DAILY_KCAL"), "Kalória", "Fuel", AVG_BASE, "kcal", "cooking"),
        new SignalCatalogEntry("water", metric("DAILY_WATER_ML"), "Víz", "Fuel", HABIT_AVG, "ml", "recovery"),
        new SignalCatalogEntry("late_meal", metric("LATE_MEAL_HOUR"), "Utolsó étkezés ideje", "Fuel", HABIT_AVG, "óra", "mindset"),
        new SignalCatalogEntry("meal_score", metric("MEAL_SCORE"), "Étkezés-pontszám", "Fuel", AVG_BASE, "pont", "cooking"),
        new SignalCatalogEntry("gym_volume", metric("GYM_VOLUME_KG"), "Gym-volumen", "Edzés", HABIT_AVG_BASE, "kg", "max_strength"),
        new SignalCatalogEntry("sport_load", metric("SPORT_LOAD_MIN"), "Sportterhelés", "Edzés", HABIT_AVG_BASE, "perc", "aerobic_capacity"),
        new SignalCatalogEntry("acwr", metric("ACWR"), "Akut:krónikus terhelés", "Edzés", List.of("average"), "arány", "recovery"),
        new SignalCatalogEntry("hr_recovery", metric("RUN_HR_RECOVERY_S"), "Pulzus-visszaállás", "Edzés", AVG_BASE, "mp", "aerobic_capacity"),
        new SignalCatalogEntry("weight_goal", new PillarSourceJson("weight_goal", null, null, null, null, null), "Súlycél · ütem", "Edzés", List.of("linked"), "ítélet", "recovery"),
        new SignalCatalogEntry("checkin_energy", metric("CHECKIN_ENERGY"), "Check-in energia", "Elme", AVG_BASE, "1–10", "mindset"),
        new SignalCatalogEntry("checkin_mental", metric("CHECKIN_MENTAL"), "Check-in hangulat", "Elme", AVG_BASE, "1–10", "mindfulness"),
        new SignalCatalogEntry("checkin_stress", metric("CHECKIN_STRESS"), "Stressz", "Elme", AVG_BASE, "1–10", "mindfulness"),
        new SignalCatalogEntry("habits_done", metric("HABITS_DONE"), "Kész szokások", "Elme", HABIT_AVG, "db", "mindset"),
        new SignalCatalogEntry("ritual_closed", metric("RITUAL_CLOSED"), "Napzárás", "Elme", List.of("habit"), "igen/nem", "mindset"),
        new SignalCatalogEntry("daily_xp", metric("DAILY_XP"), "Napi XP", "Elme", AVG_BASE, "XP", "mindset"),
        new SignalCatalogEntry("activity_productivity", activity("productivity", "minutes"), "Produktivitás · perc", "Activity", HABIT_BASE_TARGET, "perc", "productivity"),
        new SignalCatalogEntry("activity_learning", activity("learning", "count"), "Tanulás · alkalom", "Activity", HABIT_BASE_TARGET, "alkalom", "learning"),
        new SignalCatalogEntry("activity_financial", activity("financial", "huf"), "Pénzügy · Ft", "Activity", List.of("target", "baseline"), "Ft", "financial"),
        new SignalCatalogEntry("activity_connection", activity("connection", "count"), "Kapcsolatok · alkalom", "Activity", HABIT_BASE_TARGET, "alkalom", "connection"),
        new SignalCatalogEntry("activity_cooking", activity("cooking", "count"), "Konyha · alkalom", "Activity", HABIT_BASE_TARGET, "alkalom", "cooking"),
        new SignalCatalogEntry("social_mentions", new PillarSourceJson("social_mentions", null, null, null, null, null), "Társas említések", "Emberek", HABIT_AVG_BASE, "ember", "connection"),
        new SignalCatalogEntry("ring_mozgas", ring("mozgas"), "Mozgás-gyűrű", "Életjel", AVG_BASE, "%", "recovery"),
        new SignalCatalogEntry("ring_pihenes", ring("pihenes"), "Pihenés-gyűrű", "Életjel", AVG_BASE, "%", "recovery"),
        new SignalCatalogEntry("ring_lelek", ring("lelek"), "Lélek-gyűrű", "Életjel", AVG_BASE, "%", "mindfulness"));

    public List<SignalCatalogEntry> entries() { return ENTRIES; }

    /** Exact-match lookup on the identifying fields of the source (type + key/skillKey+measure/ring). */
    public Optional<SignalCatalogEntry> find(PillarSourceJson s) {
        if (s == null || s.type() == null) return Optional.empty();
        return ENTRIES.stream().filter(e -> sameSource(e.source(), s)).findFirst();
    }

    public Optional<SignalCatalogEntry> byId(String id) {
        return ENTRIES.stream().filter(e -> e.id().equals(id)).findFirst();
    }

    /** One line per entry — the AI prompt's [Jelek] block. */
    public String promptText() {
        return ENTRIES.stream()
            .map(e -> e.id() + " · " + e.label() + " (" + e.group() + ", " + e.unit() + ", fajták: "
                + String.join("/", e.kinds()) + ", skill: " + e.defaultSkillKey() + ")")
            .collect(Collectors.joining("\n"));
    }

    private static boolean sameSource(PillarSourceJson a, PillarSourceJson b) {
        return Objects.equals(a.type(), b.type())
            && Objects.equals(a.key(), b.key())
            && Objects.equals(a.skillKey(), b.skillKey())
            && Objects.equals(a.measure(), b.measure())
            && Objects.equals(a.ring(), b.ring());
    }
}
