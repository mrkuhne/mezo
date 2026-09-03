package io.mrkuhne.mezo.feature.train.service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * Derives a session's ACTIVE seconds from its set-completion stamps (spec 2026-09-02).
 *
 * <p>done_at marks when a set was FINISHED, so the interval between two consecutive stamps is
 * "rest + the next set's execution" — one indivisible unit. Each interval is clipped at
 * {@code gapCapSeconds} so a phone call or a queue at the machine cannot inflate the total; the
 * lead-in (session start to the first set) is clipped separately and more generously, because a
 * real warm-up block legitimately takes several minutes.
 *
 * <p>Pure and static: no Spring, no repository, table-tested.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class SessionTimingCalculator {

    public static Integer activeSeconds(
            Instant startedAt, List<Instant> doneAt, int gapCapSeconds, int leadInCapSeconds) {
        if (doneAt == null || doneAt.isEmpty()) {
            return null;
        }
        List<Instant> sorted = new ArrayList<>(doneAt);
        sorted.sort(Comparator.naturalOrder());
        long total = 0;
        if (startedAt != null) {
            total += clipped(startedAt, sorted.get(0), leadInCapSeconds);
        }
        for (int i = 1; i < sorted.size(); i++) {
            total += clipped(sorted.get(i - 1), sorted.get(i), gapCapSeconds);
        }
        return Math.toIntExact(total);
    }

    /** Seconds between two stamps, floored at 0 and capped at {@code capSeconds}. */
    private static long clipped(Instant from, Instant to, int capSeconds) {
        long seconds = Duration.between(from, to).getSeconds();
        return Math.min(Math.max(seconds, 0), capSeconds);
    }
}
