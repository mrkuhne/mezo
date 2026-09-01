package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Retro-logging ratio (round 3, spec §5.8): how much of what the user records is written on the day
 * it is about, versus reconstructed later. The same-calendar-day boundary is the diary-research
 * convention rather than an invented threshold (spec §2).
 *
 * <p>The two genres are reported SEPARATELY on purpose. A workout entered the next morning and a
 * gratitude note backfilled a week later are different behaviours, and one blended ratio would be
 * mush. A genre with too few records simply drops out of the state.
 *
 * <p>Deliberate limit on the claim: the literature measures loss of DETAIL with delay, not that a
 * late-recorded number is false. The summary therefore says when things were written and never that
 * retrospective entries are inaccurate.
 *
 * <p>No new-data pre-filter: the window shifting is itself enough to change the picture, and a quiet
 * day writes nothing to gate on.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class RetroLoggingRatioDetector implements CharacterDetector {

    private static final int MIN_RECORDS_PER_GROUP = 6;
    private static final double AZONNALI_MAX = 0.20;
    private static final double VEGYES_MAX = 0.50;

    private static final String GENRE_EVENT = "esemeny";
    private static final String GENRE_REFLECTION = "reflexio";

    @Override
    public String key() {
        return "retro-logging-ratio";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        List<String> parts = new ArrayList<>();
        if (today.event() != null) {
            parts.add("az edzés- és testadatokat " + phrase(today.event()));
        }
        if (today.reflection() != null) {
            parts.add("a naplózó bejegyzéseket " + phrase(today.reflection()));
        }
        String summary = "A rögzítés időzítése az elmúlt két hétben: " + String.join(", ", parts)
                + ". Ez arról szól, mikor íródtak, nem arról, hogy pontosak-e.";
        int salience = "utolagos".equals(today.reflection()) || "utolagos".equals(today.event()) ? 3 : 2;
        return List.of(new DetectorSignal(key(), "drill", summary, salience));
    }

    private static String phrase(String band) {
        return switch (band) {
            case "azonnali" -> "szinte mindig aznap rögzíti";
            case "vegyes" -> "hol aznap, hol utólag rögzíti";
            default -> "többnyire utólag rögzíti";
        };
    }

    private record State(String key, String event, String reflection) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        String event = band(in, asOf, GENRE_EVENT);
        String reflection = band(in, asOf, GENRE_REFLECTION);
        if (event == null && reflection == null) {
            return null;
        }
        String key = (event == null ? "" : GENRE_EVENT + ":" + event + "|")
                + (reflection == null ? "" : GENRE_REFLECTION + ":" + reflection);
        return new State(key, event, reflection);
    }

    private static String band(DetectorInput in, LocalDate asOf, String genre) {
        int total = 0;
        int retro = 0;
        for (DetectorInput.LogLatencyPoint p : in.trend().logLatencies()) {
            if (!genre.equals(p.genre()) || !TrailingWindow.inWindow(p.aboutDate(), asOf)
                    || p.writtenDate().isAfter(asOf)) {
                continue;
            }
            total++;
            if (!p.writtenDate().equals(p.aboutDate())) {
                retro++;
            }
        }
        if (total < MIN_RECORDS_PER_GROUP) {
            return null;
        }
        double ratio = (double) retro / total;
        return ratio < AZONNALI_MAX ? "azonnali" : ratio <= VEGYES_MAX ? "vegyes" : "utolagos";
    }
}
