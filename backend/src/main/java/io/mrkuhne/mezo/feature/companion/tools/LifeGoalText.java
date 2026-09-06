package io.mrkuhne.mezo.feature.companion.tools;

import java.util.Map;

/** A [Célok] blokk és a get_life_goals tool közös magyar szókincse (mezo-iizd.10). A nyíl-szavak
 *  a WeeklyReviewContextSources.arrowWord készletét tükrözik (a glif félreolvasható a promptban,
 *  a szó nem); a dimenzió-nevek a FE lifegoalLabels.ts készletét (spec §10). */
public final class LifeGoalText {

    private static final Map<String, String> ARROW_HU = Map.of(
        "up", "emelkedik", "flat", "tartja", "down", "csúszik",
        "insufficient", "kevés adat az irányhoz");

    private static final Map<String, String> DIMENSION_HU = Map.of(
        "positive_emotion", "Érzelem", "engagement", "Elmélyülés", "relationships", "Kapcsolatok",
        "meaning", "Értelem", "accomplishment", "Teljesítmény", "health", "Egészség");

    private LifeGoalText() {}

    public static String arrowWord(String arrow) {
        return arrow == null ? "nincs irány" : ARROW_HU.getOrDefault(arrow, "nincs irány");
    }

    public static String dimensionHu(String dimension) {
        return dimension == null ? "?" : DIMENSION_HU.getOrDefault(dimension, dimension);
    }
}
