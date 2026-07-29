package io.mrkuhne.mezo.feature.notification.service;

import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet.AnchoredEvent;
import io.mrkuhne.mezo.feature.notification.domain.CategoryPref;
import io.mrkuhne.mezo.feature.notification.domain.DueItem;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Pure due-computation (bd mezo-h4wp.6.2) — decides which notifications are due this minute.
 * Deliberately has NO collaborators: no repository, no clock, no properties. Everything it needs
 * arrives as a parameter, which is what makes it exhaustively table-testable without Spring, a
 * database, or a clock.
 *
 * <p>The formula — proven in production by the {@code weekly-planner} project's {@code dueBlocks}
 * ({@code src/lib/pushSchedule.js}) and already validated by the N1 slice — is: an item fires
 * when {@code (anchorMinuteOfDay - leadMinutes) - nowMinuteOfDay ∈ [0, catchUpMinutes)}. This
 * MUST NOT be "improved" (e.g. the window is a half-open {@code [0, catchUp)}, not
 * {@code (0, catchUp]} or a closed interval) — the catch-up window exists so a single missed cron
 * minute still delivers the notification; it does NOT cause a double-send, because a later task
 * dedups against {@code push_log} by {@link DueItem#dedupKey()}, not by narrowing this window.
 *
 * <p>Deliberately does NOT normalize a negative fire minute (e.g. a 00:10 anchor with a
 * 30-minute lead computes -20): wrapping it into the previous evening (23:40) would fire a
 * notification a day early/late for the wrong reason, so it is left as a large negative delta,
 * which never falls in {@code [0, catchUpMinutes)} and therefore never fires. The honest answer
 * for such a combination is that it never fires.
 */
@Component
public class DueEvaluator {

    /**
     * @param nowMinuteOfDay the current local minute-of-day (0-1439)
     * @param prefs          effective preference per category; a category with no entry here can
     *                        never be due — this evaluator does not fabricate a default
     * @param anchors        the day's resolved anchors; {@code null}/empty lists contribute
     *                        nothing
     * @param catchUpMinutes width of the firing window (normally 2)
     * @return the notifications due this minute, in no particular order
     */
    public List<DueItem> due(int nowMinuteOfDay, List<CategoryPref> prefs, AnchorSet anchors,
                              int catchUpMinutes) {
        Map<NotificationCategory, CategoryPref> prefByCategory = indexByCategory(prefs);

        List<DueItem> due = new ArrayList<>();
        for (AnchoredEvent event : allEvents(anchors)) {
            CategoryPref pref = prefByCategory.get(event.category());
            if (pref == null || !pref.enabled()) {
                continue;
            }

            int fireMinute = event.minuteOfDay() - pref.leadMinutes();
            int delta = fireMinute - nowMinuteOfDay;
            if (delta >= 0 && delta < catchUpMinutes) {
                due.add(new DueItem(event.category(), event.minuteOfDay(), dedupKey(event),
                        event.title(), event.body(), event.url()));
            }
        }
        return due;
    }

    private static Map<NotificationCategory, CategoryPref> indexByCategory(List<CategoryPref> prefs) {
        Map<NotificationCategory, CategoryPref> byCategory = new EnumMap<>(NotificationCategory.class);
        if (prefs != null) {
            for (CategoryPref pref : prefs) {
                byCategory.put(pref.category(), pref);
            }
        }
        return byCategory;
    }

    private static List<AnchoredEvent> allEvents(AnchorSet anchors) {
        if (anchors == null) {
            return List.of();
        }
        List<AnchoredEvent> all = new ArrayList<>();
        addAllIfPresent(all, anchors.backendAnchors());
        addAllIfPresent(all, anchors.proseAnchors());
        addAllIfPresent(all, anchors.scheduleAnchors());
        return all;
    }

    private static void addAllIfPresent(List<AnchoredEvent> target, List<AnchoredEvent> source) {
        if (source != null) {
            target.addAll(source);
        }
    }

    /** {@code "{category}:{anchorSuffix}"} — the ANCHOR's identity, never the fire minute. */
    private static String dedupKey(AnchoredEvent event) {
        return event.category().key() + ":" + event.dedupSuffix();
    }
}
