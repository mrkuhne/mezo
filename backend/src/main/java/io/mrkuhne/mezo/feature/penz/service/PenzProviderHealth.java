package io.mrkuhne.mezo.feature.penz.service;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.mrkuhne.mezo.feature.penz.entity.PenzProviderStatusEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzProviderStatusRepository;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

/**
 * The health of every outbound Pénz provider (L6 build notes call 9): one {@code penz_provider_status} row per
 * provider key (each news feed, the quote source), and the Micrometer gauge {@code mezo.penz.provider.fail.streak}
 * tagged {@code provider} + {@code kind} — exported as {@code mezo_penz_provider_fail_streak} on
 * {@code /actuator/prometheus}, alerted by {@code PenzQuotesProviderDown} / {@code PenzNewsProviderDown} in
 * {@code k8s/monitoring/vmrule-mezo.yaml}. The gauge is loaded from the table at startup and set from the stored
 * row after every record, so it survives restarts.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PenzProviderHealth {

    public static final String KIND_QUOTES = "quotes";
    public static final String KIND_NEWS = "news";
    public static final String METRIC = "mezo.penz.provider.fail.streak";
    private static final int MAX_ERROR = 200;

    private final PenzProviderStatusRepository repository;
    private final MeterRegistry registry;
    private final Map<String, AtomicInteger> streaks = new ConcurrentHashMap<>();

    /** Loads every stored streak into the gauge. */
    @EventListener(ApplicationReadyEvent.class)
    public void loadGauges() {
        repository.findAll().forEach(row -> gauge(row.getProviderKey(), row.getKind()).set(row.getFailStreak()));
    }

    /** The provider answered (whatever it answered): the streak resets. */
    public void recordSuccess(String key, String kind) {
        repository.recordSuccess(key, kind);
        refresh(key, kind);
    }

    /**
     * The provider failed. {@code shortError} is a reason like {@code status 503} — never a response body; cut to
     * 200 characters.
     */
    public void recordFailure(String key, String kind, String shortError) {
        String error = shortError == null ? null
            : shortError.length() > MAX_ERROR ? shortError.substring(0, MAX_ERROR) : shortError;
        repository.recordFailure(key, kind, error);
        refresh(key, kind);
    }

    /** The provider's current fail streak (0 when it never failed or was never called). */
    public int failStreak(String key) {
        return repository.findByProviderKey(key).map(PenzProviderStatusEntity::getFailStreak).orElse(0);
    }

    /** True when the kind has at least one provider and every one of them failed its last fetch. */
    public boolean allFailing(String kind) {
        List<PenzProviderStatusEntity> rows = repository.findByKind(kind);
        return !rows.isEmpty() && rows.stream().allMatch(r -> r.getFailStreak() > 0);
    }

    private void refresh(String key, String kind) {
        gauge(key, kind).set(failStreak(key));
    }

    private AtomicInteger gauge(String key, String kind) {
        return streaks.computeIfAbsent(key, k -> {
            AtomicInteger value = new AtomicInteger();
            Gauge.builder(METRIC, value, AtomicInteger::get)
                .description("Consecutive failed fetches of a Boop Pénz outbound provider")
                .tag("provider", k).tag("kind", kind)
                .register(registry);
            return value;
        });
    }
}
