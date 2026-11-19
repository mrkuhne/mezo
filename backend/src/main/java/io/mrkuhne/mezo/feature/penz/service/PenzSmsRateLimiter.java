package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Per-key rate limit of the SMS ingest (Boop Pénz L4, mezo-r36n9.102, spec §10.1.7): at most
 * {@code mezo.penz.sms-per-minute} calls in any rolling minute and {@code mezo.penz.sms-per-day} per UTC day.
 * The repo had no limiter to reuse, so this is a small in-memory one — one replica (k3s, single pod), and a
 * restart only forgets the counters, which is harmless for a bank-SMS rate. A rejected call does not count.
 */
@Component
public class PenzSmsRateLimiter {

    private static final Duration MINUTE = Duration.ofMinutes(1);

    private final PenzProperties properties;
    private final ObjectProvider<Clock> clock;
    private final Map<UUID, Window> windows = new ConcurrentHashMap<>();

    public PenzSmsRateLimiter(PenzProperties properties, ObjectProvider<Clock> clock) {
        this.properties = properties;
        this.clock = clock;
    }

    /** {@code allowed}, or the seconds the caller should wait ({@code Retry-After}, at least 1). */
    public record Decision(boolean allowed, long retryAfterSeconds) {
    }

    public Decision tryAcquire(UUID keyId) {
        Instant now = Instant.now(clock.getIfAvailable(Clock::systemUTC));
        Window w = windows.computeIfAbsent(keyId, k -> new Window());
        synchronized (w) {
            LocalDate day = now.atZone(ZoneOffset.UTC).toLocalDate();
            if (!day.equals(w.day)) {
                w.day = day;
                w.dayCount = 0;
            }
            while (!w.minute.isEmpty() && !w.minute.peekFirst().plus(MINUTE).isAfter(now)) {
                w.minute.pollFirst();
            }
            if (w.dayCount >= properties.smsPerDay()) {
                Instant nextDay = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
                return new Decision(false, seconds(Duration.between(now, nextDay)));
            }
            if (w.minute.size() >= properties.smsPerMinute()) {
                return new Decision(false, seconds(Duration.between(now, w.minute.peekFirst().plus(MINUTE))));
            }
            w.minute.addLast(now);
            w.dayCount++;
            return new Decision(true, 0);
        }
    }

    private static long seconds(Duration d) {
        long s = (d.toMillis() + 999) / 1000;
        return Math.max(1, s);
    }

    private static final class Window {
        private final Deque<Instant> minute = new ArrayDeque<>();
        private LocalDate day;
        private int dayCount;
    }
}
