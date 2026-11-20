package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.penz.config.PenzNewsAsyncConfig;
import io.mrkuhne.mezo.feature.penz.config.PenzNewsProperties;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * One news run of Boop Pénz L6 (mezo-r36n9.104, build notes §3.1): refresh the held quotes (the quote service
 * records the {@code yahoo} provider health itself) → poll the feeds → build every active user's digest for his
 * own today. The twice-daily job hands off to {@link #runAsync}; a manual refresh goes through
 * {@link #requestRefresh} (one per user per {@code refreshCooldownMinutes}, else 429). Both run on the dedicated
 * single-thread {@code penzNewsExecutor}, so runs never overlap. Each step keeps its own try/catch: a dead quote
 * source still lets the news run, a dead feed set still builds (quiet or fallback) digests.
 */
@Slf4j
@Service
public class PenzNewsRunner {

    private final PenzQuoteService quotes;
    private final PenzNewsClient news;
    private final PenzDigestService digests;
    private final PenzSettingsService settings;
    private final UserFanOut users;
    private final PenzNewsProperties props;
    private final Executor executor;
    private final ObjectProvider<Clock> clock;
    private final Map<UUID, Instant> lastRefresh = new ConcurrentHashMap<>();

    public PenzNewsRunner(PenzQuoteService quotes, PenzNewsClient news, PenzDigestService digests,
                          PenzSettingsService settings, UserFanOut users, PenzNewsProperties props,
                          @Qualifier(PenzNewsAsyncConfig.EXECUTOR) Executor executor, ObjectProvider<Clock> clock) {
        this.quotes = quotes;
        this.news = news;
        this.digests = digests;
        this.settings = settings;
        this.users = users;
        this.props = props;
        this.executor = executor;
        this.clock = clock;
    }

    /** The job's entry: the whole run on the news executor. */
    @Async(PenzNewsAsyncConfig.EXECUTOR)
    public void runAsync() {
        run(ZonedDateTime.now(clock().withZone(ZoneId.of(props.zone()))));
    }

    /** The run body at an explicit instant — package-visible so ITs can pin it. */
    void run(ZonedDateTime now) {
        refreshQuotes(now);
        poll(now);
        users.forEachActiveUser("Penz news digest", user -> buildFor(user.getId(), now));
    }

    /**
     * The caller's manual refresh: accepted at most once per cooldown (else {@code PENZ_DIGEST_REFRESH_LIMITED},
     * 429), then quotes + feeds + his digest on the news executor.
     */
    public void requestRefresh(UUID owner) {
        Instant now = Instant.now(clock());
        Duration cooldown = Duration.ofMinutes(props.refreshCooldownMinutes());
        boolean[] accepted = {false};
        lastRefresh.compute(owner, (k, last) -> {
            if (last != null && now.isBefore(last.plus(cooldown))) {
                return last;
            }
            accepted[0] = true;
            return now;
        });
        if (!accepted[0]) {
            throw PenzErrors.tooManyRequests("PENZ_DIGEST_REFRESH_LIMITED");
        }
        executor.execute(() -> refreshNow(owner, ZonedDateTime.now(clock().withZone(ZoneId.of(props.zone())))));
    }

    /** The refresh body for one owner — package-visible so ITs can run it synchronously. */
    void refreshNow(UUID owner, ZonedDateTime now) {
        refreshQuotes(now);
        poll(now);
        LlmActorContext.runAs(owner, () -> buildFor(owner, now));
    }

    private void refreshQuotes(ZonedDateTime now) {
        try {
            quotes.refreshAllHeld(now.toLocalDate());
        } catch (RuntimeException e) {
            log.warn("Penz quote refresh failed: {}", e.getClass().getSimpleName());
        }
    }

    private void poll(ZonedDateTime now) {
        try {
            news.poll(now.toInstant());
        } catch (RuntimeException e) {
            log.warn("Penz news poll failed: {}", e.getClass().getSimpleName());
        }
    }

    private void buildFor(UUID owner, ZonedDateTime now) {
        try {
            digests.build(owner, now.withZoneSameInstant(settings.zone(owner)).toLocalDate(), now.toInstant());
        } catch (RuntimeException e) {
            log.warn("Penz digest failed for owner {}: {}", owner, e.getClass().getSimpleName());
        }
    }

    private Clock clock() {
        return clock.getIfAvailable(Clock::systemUTC);
    }
}
