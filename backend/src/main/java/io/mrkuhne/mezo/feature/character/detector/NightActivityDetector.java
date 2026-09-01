package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Night activity (round 3, spec §5.9): on how many of the trailing 14 days did the user write a chat
 * message between midnight and 05:00?
 *
 * <p><b>Attribution limit, stated in the summary itself:</b> this proves CHAT use at that hour, not
 * app use in general. Push and notification rows would prove the system acted rather than the user,
 * and {@code llm_log_history} moves 1:1 with chat anyway, so the user's own messages are both the
 * most direct evidence available and the honest bound on the claim.
 *
 * <p>No new-data pre-filter: the transition down to "no night activity" happens on a day when
 * nothing is written, which is exactly what such a gate would block (spec §4.2).
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class NightActivityDetector implements CharacterDetector {

    private static final LocalTime NIGHT_FROM = LocalTime.MIDNIGHT;
    private static final LocalTime NIGHT_TO = LocalTime.of(5, 0);
    private static final int ALKALMI_MAX = 2;

    @Override
    public String key() {
        return "night-activity";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String summary = "nincs".equals(today.band())
                ? "Az elmúlt két hétben nem írt éjfél és hajnali öt óra között a társnak."
                : "Az elmúlt két hétből " + today.nights()
                        + " napon írt éjfél és hajnali öt között a társnak; ez a chat használatát mutatja, nem az ébrenlét teljes képét.";
        int salience = "rendszeres".equals(today.band()) ? 4 : 2;
        return List.of(new DetectorSignal(key(), "szomnologus", summary, salience));
    }

    private record State(String key, String band, int nights) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        Set<LocalDate> nightDays = new HashSet<>();
        boolean anyChat = false;
        for (LocalDateTime t : in.trend().userChatTimes()) {
            if (!TrailingWindow.inWindow(t.toLocalDate(), asOf)) {
                continue;
            }
            anyChat = true;
            if (!t.toLocalTime().isBefore(NIGHT_FROM) && t.toLocalTime().isBefore(NIGHT_TO)) {
                nightDays.add(t.toLocalDate());
            }
        }
        if (!anyChat) {
            return null;   // the user does not chat at all — silence, not "no night activity"
        }
        int n = nightDays.size();
        String band = n == 0 ? "nincs" : n <= ALKALMI_MAX ? "alkalmi" : "rendszeres";
        return new State("ejszakai:" + band, band, n);
    }
}
