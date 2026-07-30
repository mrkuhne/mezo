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
 * <p>The window looks <b>BACKWARD</b>, never forward: an item fires when
 * {@code nowMinuteOfDay - (anchorMinuteOfDay - leadMinutes) ∈ [0, catchUpMinutes)} — i.e. on the
 * fire minute itself, plus the {@code catchUpMinutes - 1} minutes AFTER it. With the default
 * {@code catch-up-minutes: 2} that is "on time, or one minute late".
 *
 * <p><b>Why backward is the only correct direction</b> (fix wave, mezo-h4wp.6.2): the whole point
 * of the window is that a genuinely MISSED tick still delivers. This job shares a <b>size-1
 * scheduler thread</b> with 18 other crons, so a slow LLM job straddling two ticks is a realistic
 * way to lose a minute. A forward window ({@code fireMinute - now ∈ [0, catchUp)}) gets both halves
 * wrong: it fires one minute EARLY (and the {@code push_log} dedup then suppresses the on-time
 * minute), and when {@code now == fireMinute + 1} — the actual missed-tick case — it never fires at
 * all, dropping the anchor for the whole day.
 *
 * <p>This MUST NOT be "improved" by narrowing the window instead: the half-open
 * {@code [0, catchUpMinutes)} shape is deliberate, and a double-send is prevented by
 * {@code NotificationDispatchJob}'s {@code push_log} dedup on {@link DueItem#dedupKey()}, never by
 * this interval.
 *
 * <p>Deliberately does NOT normalize a negative fire minute (e.g. a 00:10 anchor with a
 * 30-minute lead computes -20): wrapping it into the previous evening (23:40) would fire a
 * notification a day early/late for the wrong reason, so it is left as a large negative fire
 * minute, which no {@code nowMinuteOfDay} in {@code [0, 1439]} can be within {@code catchUpMinutes}
 * of, and therefore never fires. The honest answer for such a combination is that it never fires.
 */
@Component
public class DueEvaluator {

    /**
     * @param nowMinuteOfDay the current local minute-of-day (0-1439)
     * @param prefs          effective preference per category; a category with no entry here can
     *                        never be due — this evaluator does not fabricate a default
     * @param anchors        the day's resolved anchors; {@code null}/empty lists contribute
     *                        nothing
     * @param catchUpMinutes width of the BACKWARD firing window (normally 2): the fire minute plus
     *                        the {@code catchUpMinutes - 1} minutes after it
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
            // BACKWARD window: elapsed minutes since the fire minute, in [0, catchUpMinutes).
            // Never `fireMinute - now` — that fires a minute early and drops a missed tick
            // entirely (see the class javadoc).
            int elapsedSinceFireMinute = nowMinuteOfDay - fireMinute;
            if (elapsedSinceFireMinute >= 0 && elapsedSinceFireMinute < catchUpMinutes) {
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
