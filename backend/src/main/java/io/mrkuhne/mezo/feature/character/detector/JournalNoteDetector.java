package io.mrkuhne.mezo.feature.character.detector;

import java.util.List;
import org.springframework.stereotype.Component;

/** Surfaces the raw journal text written ON the observed day (spec §5). */
@Component
public class JournalNoteDetector implements CharacterDetector {

    private static final int MAX_CHARS = 500;

    @Override
    public String key() {
        return "journal-note";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        List<String> entries = in.journalTexts().get(in.day());
        if (entries == null || entries.isEmpty()) {
            return List.of();
        }
        String joined = String.join(" | ", entries);
        if (joined.length() > MAX_CHARS) {
            joined = joined.substring(0, MAX_CHARS);
        }
        String summary = "Napló (" + in.day() + "): " + joined;
        return List.of(new DetectorSignal(key(), "pszichologus", summary, 3));
    }
}
