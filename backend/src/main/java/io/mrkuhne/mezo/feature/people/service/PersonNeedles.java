package io.mrkuhne.mezo.feature.people.service;

import io.mrkuhne.mezo.feature.people.entity.PersonEntity;
import io.mrkuhne.mezo.techcore.text.TextFold;
import java.util.ArrayList;
import java.util.List;

/**
 * A név-illeszkedés KÖZÖS primitívjei (bd mezo-xih1): egy személy kereshető alakjai, és a magyar
 * ragozáshoz szabott illeszkedés-szabály. Két hívó osztja meg: a {@link MentionDetectionService}
 * (needle = a személy neve, haystack = a bejegyzés mondata) és a {@link PersonNameCanonicalizer}
 * (haystack = egy LLM-től kapott név). A szabálynak egyeznie KELL a két úton, különben ugyanaz a
 * szöveg említést szülne az Emberek oldalon, de más kulcsot a Reflexió sorozataiban.
 */
final class PersonNeedles {

    /** 1–2 betűs needle szinte mindenre illik — sosem az, amire a user gondolt. */
    static final int MIN_NEEDLE_LENGTH = 3;

    private PersonNeedles() {
    }

    /** A személy neve + aliasai, hajtogatva; a túl rövid alakok kiesnek. */
    static List<String> of(PersonEntity person) {
        List<String> needles = new ArrayList<>();
        add(needles, person.getName());
        if (person.getAliases() != null) {
            person.getAliases().forEach(alias -> add(needles, alias));
        }
        return needles;
    }

    /**
     * A needle SZÓHATÁRON kezdődik, de a szó vége szabad: a magyar ragozás miatt („adammal",
     * „rekanak") a szóvégi határ-őrzés a valódi találatok zömét dobná el.
     */
    static boolean containsAtWordStart(String foldedHaystack, String foldedNeedle) {
        int i = -1;
        while ((i = foldedHaystack.indexOf(foldedNeedle, i + 1)) >= 0) {
            if (i == 0 || !Character.isLetterOrDigit(foldedHaystack.charAt(i - 1))) {
                return true;
            }
        }
        return false;
    }

    private static void add(List<String> needles, String raw) {
        String folded = TextFold.fold(raw).strip();
        if (folded.length() >= MIN_NEEDLE_LENGTH) {
            needles.add(folded);
        }
    }
}
