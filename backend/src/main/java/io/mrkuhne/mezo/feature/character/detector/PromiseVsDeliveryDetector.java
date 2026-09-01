package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Promise vs delivery (round 3, spec §5.2): the morning sets foci, the evening records a day-close
 * verdict. Two independent things can go wrong, so two dimensions are tracked — how the closed days
 * went ({@code tart}) and whether the days get closed at all ({@code zaras}). A user who keeps every
 * promise but never closes the day looks identical to one who never promises, unless closure is
 * measured separately.
 *
 * <p>The verdict comes from {@code DailyIntentionEntity.reflection}, a closed enum — no text is
 * read anywhere in this detector.
 */
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class PromiseVsDeliveryDetector implements CharacterDetector {

    private static final int MIN_FOCUS_DAYS = 5;
    private static final int MIN_CLOSED_DAYS = 4;
    private static final double TARTJA_MIN = 0.75;
    private static final double RESZBEN_MIN = 0.40;
    private static final double ZARAS_TELJES_MIN = 0.70;

    private static final String REFLECTION_YES = "yes";
    private static final String REFLECTION_PARTIAL = "partial";

    @Override
    public String key() {
        return "promise-vs-delivery";
    }

    @Override
    public List<DetectorSignal> detect(DetectorInput in) {
        if (!DetectorGates.newIntentionData(in)) {
            return List.of();
        }
        State today = state(in, in.day());
        State yesterday = state(in, in.day().minusDays(1));
        if (today == null || today.key().equals(yesterday == null ? "" : yesterday.key())) {
            return List.of();
        }
        String closurePhrase = "teljes".equals(today.closure())
                ? "a fókusszal induló napok többségét le is zárja"
                : "a fókusszal induló napok jelentős részét nem zárja le";
        StringBuilder sb = new StringBuilder("A napi fókusz és a napzárás viszonya: ")
                .append(closurePhrase)
                .append(" (").append(today.focusDays()).append(" fókusznapból ")
                .append(today.closedDays()).append(" lezárva, 14 nap)");
        if (today.delivery() != null) {
            sb.append("; a lezárt napokon ").append(switch (today.delivery()) {
                case "tartja" -> "többnyire teljesítette, amit kitűzött";
                case "reszben" -> "jellemzően részben teljesítette, amit kitűzött";
                default -> "többnyire nem teljesítette, amit kitűzött";
            });
        }
        return List.of(new DetectorSignal(key(), "drill", sb.append(".").toString(), salience(today)));
    }

    private static int salience(State s) {
        return "csuszik".equals(s.delivery()) || "hianyos".equals(s.closure()) ? 4 : 2;
    }

    private record State(String key, String delivery, String closure, int focusDays, int closedDays) {}

    private static State state(DetectorInput in, LocalDate asOf) {
        List<DetectorInput.IntentionDayPoint> focusDays = new ArrayList<>();
        for (DetectorInput.IntentionDayPoint p : in.trend().intentionDays()) {
            if (TrailingWindow.inWindow(p.date(), asOf) && p.focusCount() > 0) {
                focusDays.add(p);
            }
        }
        if (focusDays.size() < MIN_FOCUS_DAYS) {
            return null;
        }
        List<DetectorInput.IntentionDayPoint> closed = focusDays.stream()
                .filter(p -> p.reflection() != null)
                .toList();
        double closureRate = (double) closed.size() / focusDays.size();
        String closure = closureRate >= ZARAS_TELJES_MIN ? "teljes" : "hianyos";

        String delivery = null;
        if (closed.size() >= MIN_CLOSED_DAYS) {
            double score = 0;
            for (DetectorInput.IntentionDayPoint p : closed) {
                score += switch (p.reflection()) {
                    case REFLECTION_YES -> 1.0;
                    case REFLECTION_PARTIAL -> 0.5;
                    default -> 0.0;
                };
            }
            double mean = score / closed.size();
            delivery = mean >= TARTJA_MIN ? "tartja" : mean >= RESZBEN_MIN ? "reszben" : "csuszik";
        }
        String key = (delivery == null ? "" : "tart:" + delivery + "|") + "zaras:" + closure;
        return new State(key, delivery, closure, focusDays.size(), closed.size());
    }
}
