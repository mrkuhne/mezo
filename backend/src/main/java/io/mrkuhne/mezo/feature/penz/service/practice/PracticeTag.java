package io.mrkuhne.mezo.feature.penz.service.practice;

import java.util.Arrays;
import java.util.Optional;

/**
 * The eight practice tags (Boop Pénz L7, mezo-r36n9.105, build notes call 3) — fixed and server-owned, in display
 * order. A close needs at least one; the mistake flag is separate. {@code mistakePhrase} is the noun phrase the
 * weekly review's copy names a mistake with ("A hírre ugrás vitte el a hetet").
 */
public enum PracticeTag {
    KITORES("kitores", "Kitörés", "a kitörésre belépés"),
    VISSZATESZT("visszateszt", "Visszateszt", "a visszatesztre belépés"),
    NYITASI_TARTOMANY("nyitasi_tartomany", "Nyitási tartomány", "a nyitási tartományra belépés"),
    TREND("trend", "Trend mentén", "a trend menti belépés"),
    FORDULO("fordulo", "Fordulóra", "a fordulóra belépés"),
    HIRRE("hirre", "Hírre ugrottam", "a hírre ugrás"),
    KORAI_ZARAS("korai_zaras", "Korán zártam", "a korai zárás"),
    TERVEN_KIVUL("terven_kivul", "Eltértem a tervtől", "a tervtől eltérés");

    private final String key;
    private final String label;
    private final String mistakePhrase;

    PracticeTag(String key, String label, String mistakePhrase) {
        this.key = key;
        this.label = label;
        this.mistakePhrase = mistakePhrase;
    }

    public String key() {
        return key;
    }

    public String label() {
        return label;
    }

    public String mistakePhrase() {
        return mistakePhrase;
    }

    /** The tag of a wire key (exact, lower case); empty for anything else. */
    public static Optional<PracticeTag> of(String key) {
        return key == null ? Optional.empty() : Arrays.stream(values()).filter(t -> t.key.equals(key)).findFirst();
    }
}
