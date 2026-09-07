package io.mrkuhne.mezo.feature.telemetry.service;

import io.mrkuhne.mezo.api.dto.ScreenEventInput;
import io.mrkuhne.mezo.feature.telemetry.config.TelemetryProperties;
import io.mrkuhne.mezo.feature.telemetry.entity.ScreenEventEntity;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenEventRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Screen-event ingest (bd mezo-o5cz, spec 2026-09-07 §5). Three guards, in this order:
 *
 * <ol>
 *   <li><b>Batch cap</b> — more than {@code mezo.telemetry.batch-max} events is a 400, never a
 *       silent truncation: a client whose buffer outgrew the cap must learn about it.</li>
 *   <li><b>Rate limit</b> — an in-memory token bucket per user, refilled continuously at
 *       {@code rate-limit-per-minute} events/minute. Single-replica deployment, so no
 *       distributed limiter (spec §5); the state is intentionally lost on restart.</li>
 *   <li><b>occurredAt clamp</b> — the client clock is trusted but pinned into
 *       {@code now ± occurred-at-clamp-hours}, so a device with a wrong date cannot write rows
 *       into 1970 or next year and skew every window query (spec T4).</li>
 * </ol>
 *
 * <p>{@code createdBy} is a parameter, always sourced from the authenticated principal by the
 * controller — the payload has no owner field at all (spec T5).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SCREEN_TELEMETRY_SWITCH, havingValue = "true")
public class ScreenEventService {

    /** Above this many tracked users, buckets idle for a full window are dropped on write. */
    private static final int BUCKET_PRUNE_THRESHOLD = 500;

    private final TelemetryProperties properties;
    private final ScreenEventRepository repository;

    private final Map<UUID, Bucket> buckets = new ConcurrentHashMap<>();

    /** A continuously-refilling token bucket; {@code tokens} is fractional so slow drips count. */
    private static final class Bucket {
        private double tokens;
        private long lastRefillNanos;

        private Bucket(double tokens, long nowNanos) {
            this.tokens = tokens;
            this.lastRefillNanos = nowNanos;
        }
    }

    @Transactional
    public void ingest(UUID userId, List<ScreenEventInput> events) {
        if (events == null || events.isEmpty()) return;
        if (events.size() > properties.batchMax()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TELEMETRY_BATCH_TOO_LARGE").build(), HttpStatus.BAD_REQUEST);
        }
        Instant now = Instant.now();
        if (!tryConsume(userId, events.size())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("TELEMETRY_RATE_LIMITED").build(), HttpStatus.TOO_MANY_REQUESTS);
        }

        Duration clamp = Duration.ofHours(properties.occurredAtClampHours());
        Instant earliest = now.minus(clamp);
        Instant latest = now.plus(clamp);

        List<ScreenEventEntity> rows = new ArrayList<>(events.size());
        for (ScreenEventInput input : events) {
            var row = new ScreenEventEntity();
            row.setCreatedBy(userId);
            row.setScreen(input.getScreen());
            row.setEvent(ScreenEventEntity.EVENT_VIEW);
            row.setOccurredAt(clampOccurredAt(input.getOccurredAt(), now, earliest, latest));
            row.setMeta(input.getMeta());
            rows.add(row);
        }
        repository.saveAll(rows);
    }

    /**
     * The clamp itself, package-visible so the unit-level reasoning is testable without HTTP:
     * a null (or absent) client timestamp becomes {@code now} rather than being rejected — the
     * event happened, the clock just failed to say when.
     */
    static Instant clampOccurredAt(OffsetDateTime candidate, Instant now, Instant earliest, Instant latest) {
        if (candidate == null) return now;
        Instant at = candidate.toInstant();
        if (at.isBefore(earliest)) return earliest;
        if (at.isAfter(latest)) return latest;
        return at;
    }

    /** Consumes {@code cost} tokens for {@code userId}; false when the budget is exhausted. */
    private boolean tryConsume(UUID userId, int cost) {
        double capacity = properties.rateLimitPerMinute();
        long nowNanos = System.nanoTime();
        if (buckets.size() > BUCKET_PRUNE_THRESHOLD) prune(nowNanos);
        Bucket bucket = buckets.computeIfAbsent(userId, id -> new Bucket(capacity, nowNanos));
        synchronized (bucket) {
            double refill = (nowNanos - bucket.lastRefillNanos) / 60_000_000_000.0 * capacity;
            bucket.lastRefillNanos = nowNanos;
            bucket.tokens = Math.min(capacity, bucket.tokens + Math.max(0.0, refill));
            if (bucket.tokens < cost) return false;
            bucket.tokens -= cost;
            return true;
        }
    }

    /** Drops buckets that have been full (i.e. idle for a whole window) — bounded memory. */
    private void prune(long nowNanos) {
        buckets.values().removeIf(b -> nowNanos - b.lastRefillNanos > 60_000_000_000L);
    }
}
