package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.ScoreSource;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import java.time.Duration;
import java.util.Locale;
import java.util.regex.Pattern;

/** The deterministic fallback score of an event (Boop B7 K1): used when the model is down or silent. Pure. */
public final class RuleEventScore {

    static final double CONFIDENCE = 0.5;
    private static final Pattern SPORT = Pattern.compile(
        "edz[ée]s|sport|futás|futas|gym|tréning|trening|training|workout|\\brun\\b|jóga|joga|úszás|uszas|kondi|foci");
    private static final Pattern REST = Pattern.compile("pihen|masszázs|masszazs|szauna|meditáció|meditacio|sétá|seta\\b");

    private RuleEventScore() {
    }

    public static EventScore score(CalendarEventView e) {
        String availability = e.availability() == null ? "" : e.availability();
        boolean free = "free".equals(availability);
        if (e.allDay()) {
            boolean busy = "busy".equals(availability) || "unavailable".equals(availability);
            return new EventScore(e.id(), busy ? 1 : 0, 0, 0, false, busy ? "other" : "free", CONFIDENCE,
                ScoreSource.RULE.value());
        }
        String text = ((e.title() == null ? "" : e.title()) + " " + (e.calendarName() == null ? "" : e.calendarName()))
            .toLowerCase(Locale.ROOT);
        long minutes = Math.max(0, Duration.between(e.start(), e.end()).toMinutes());
        int attendees = e.attendeeCount() == null ? 0 : e.attendeeCount();

        if (REST.matcher(text).find()) {
            return new EventScore(e.id(), 0, 0, 0, true, "rest", CONFIDENCE, ScoreSource.RULE.value());
        }
        if (SPORT.matcher(text).find()) {
            int physical = minutes >= 90 ? 3 : 2;
            return new EventScore(e.id(), 0, attendees > 0 ? 1 : 0, cap(physical, free), false, "sport", CONFIDENCE,
                ScoreSource.RULE.value());
        }
        int social = attendees >= 6 ? 3 : attendees >= 3 ? 2 : attendees >= 1 ? 1 : 0;
        int mental = minutes >= 120 ? 3 : minutes >= 45 ? 2 : minutes >= 10 ? 1 : 0;
        if (attendees > 0 && Boolean.TRUE.equals(e.organizerIsMe())) {
            mental = Math.min(3, mental + 1);
        }
        String kind = attendees > 0 ? "meeting" : "focus";
        return new EventScore(e.id(), cap(mental, free), cap(social, free), 0, false, kind, CONFIDENCE,
            ScoreSource.RULE.value());
    }

    /** A "free" (not blocking) event never demands more than 1. */
    private static int cap(int v, boolean free) {
        return free ? Math.min(v, 1) : v;
    }
}
