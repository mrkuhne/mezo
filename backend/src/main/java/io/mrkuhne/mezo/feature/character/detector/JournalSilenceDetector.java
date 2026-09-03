package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** No journal entry anywhere in the last 7 days ending the observed day (spec §5). */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class JournalSilenceDetector implements CharacterDetector {

    @Override
    public String key() {
        return "journal-silence";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        for (int i = 0; i <= 6; i++) {
            LocalDate d = in.day().minusDays(i);
            if (in.journalTexts().containsKey(d)) {
                return List.of();
            }
        }
        return List.of(new DetectorSignal(key(), "drill", "7 napja nincs naplóbejegyzés.", 2));
    }
}
