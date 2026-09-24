package io.mrkuhne.mezo.feature.companion.reflection.service;

import java.util.regex.Pattern;

/**
 * Strips a mechanical meta-lead ("Korábbi bejegyzésekhez visszatérve: …") from the head of an
 * observation sentence (mezo-23ry3). The recovery prompt used to ASK the model to announce that it
 * returns to earlier entries, so persisted cards carry it; the card's own date already says so.
 * Applied on the read path, so old rows are fixed without a data migration, and new rows no
 * longer get it from the prompt. Deliberately narrow: only a leading clause about returning to /
 * looking back at earlier entries, never mid-sentence text.
 */
final class ObservationLead {

    private static final Pattern META_LEAD = Pattern.compile(
            "^\\s*(?:"
                    + "(?:a\\s+)?korábbi\\s+\\p{L}+\\s+visszatérve"            // Korábbi bejegyzésekhez visszatérve
                    + "|visszatérve\\s+(?:a\\s+)?korábbi\\s+\\p{L}+"            // Visszatérve a korábbi bejegyzésekhez
                    + "|(?:a\\s+)?korábbi\\s+\\p{L}+\\s+(?:visszatekintve|alapján\\s+visszatérve)"
                    + ")\\s*[:,.–—-]\\s*",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private ObservationLead() {
    }

    static String strip(String text) {
        if (text == null) {
            return null;
        }
        var m = META_LEAD.matcher(text);
        if (!m.find()) {
            return text;
        }
        String rest = text.substring(m.end());
        if (rest.isBlank()) {
            return text;
        }
        return rest.substring(0, 1).toUpperCase(java.util.Locale.ROOT) + rest.substring(1);
    }
}
