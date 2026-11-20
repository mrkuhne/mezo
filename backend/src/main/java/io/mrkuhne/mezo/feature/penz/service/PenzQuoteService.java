package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import io.mrkuhne.mezo.feature.penz.entity.PenzQuoteEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzQuoteRepository;
import io.mrkuhne.mezo.feature.penz.service.QuoteClient.Quote;
import io.mrkuhne.mezo.feature.penz.service.QuoteClient.QuoteResult;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * The global quote cache (Boop Pénz L6): one {@code penz_quote} row per symbol — securities and the
 * {@code CURHUF=X} pairs the valuation policy reads.
 *
 * <p>A symbol is fetched again when its cached quote is dated before today AND the last attempt is older than
 * {@code mezo.penz.quote-refetch-minutes} (so a weekend or a dead source is not hammered). A failure keeps the
 * cached quote. Every fetch records the quote provider's health ({@link PenzProviderHealth}, key
 * {@value #PROVIDER_KEY}, kind {@code quotes}): an answer — even "unknown symbol" — is a success, an unreachable
 * source a failure. No method runs inside a transaction: each write is its own short statement, the HTTP call
 * happens outside any.
 */
@Slf4j
@Service
public class PenzQuoteService {

    public static final String PROVIDER_KEY = "yahoo";

    private final PenzQuoteRepository quotes;
    private final PenzHoldingRepository holdings;
    private final QuoteClient client;
    private final PenzProviderHealth health;
    private final PenzProperties props;
    private final ObjectProvider<Clock> clock;

    public PenzQuoteService(PenzQuoteRepository quotes, PenzHoldingRepository holdings, QuoteClient client,
                            PenzProviderHealth health, PenzProperties props, ObjectProvider<Clock> clock) {
        this.quotes = quotes;
        this.holdings = holdings;
        this.client = client;
        this.health = health;
        this.props = props;
        this.clock = clock;
    }

    /** The Yahoo FX pair that prices one unit of {@code currency} in HUF, e.g. {@code EURHUF=X}. */
    public static String fxSymbol(String currency) {
        return currency + "HUF=X";
    }

    /**
     * Refreshes every symbol held (live, not archived) by any user plus the FX pair of every non-HUF currency held
     * — what the twice-daily poll calls before building digests.
     */
    public void refreshAllHeld(LocalDate today) {
        Set<String> symbols = new LinkedHashSet<>(holdings.findAllHeldSymbols());
        holdings.findAllHeldForeignCurrencies().forEach(c -> symbols.add(fxSymbol(c)));
        refreshSymbols(symbols, today);
    }

    /** Refreshes each symbol whose cached quote is due (see the class doc). */
    public void refreshSymbols(Collection<String> symbols, LocalDate today) {
        Map<String, PenzQuoteEntity> cached = cached(symbols);
        for (String symbol : symbols) {
            if (due(cached.get(symbol), today)) {
                store(symbol, client.fetch(symbol));
            }
        }
    }

    /** One symbol, refreshed if due; the cached quote (kept on failure). */
    public Optional<PenzQuoteEntity> refresh(String symbol, LocalDate today) {
        refreshSymbols(Set.of(symbol), today);
        return quotes.findBySymbol(symbol);
    }

    /** Fetches a symbol now (the create / update check): stores a found quote, records the provider's health. */
    public QuoteResult check(String symbol) {
        QuoteResult result = client.fetch(symbol);
        store(symbol, result);
        return result;
    }

    /** The cached quotes of these symbols, by symbol. */
    public Map<String, PenzQuoteEntity> cached(Collection<String> symbols) {
        if (symbols.isEmpty()) {
            return Map.of();
        }
        return quotes.findBySymbolIn(symbols).stream()
            .collect(Collectors.toMap(PenzQuoteEntity::getSymbol, Function.identity()));
    }

    private boolean due(PenzQuoteEntity cached, LocalDate today) {
        if (cached == null) {
            return true;
        }
        Instant lastTry = cached.getFetchedAt();
        return cached.getAsOf().isBefore(today)
            && lastTry.isBefore(now().minus(Duration.ofMinutes(props.quoteRefetchMinutes())));
    }

    private void store(String symbol, QuoteResult result) {
        Instant now = now();
        switch (result) {
            case QuoteResult.Found found -> {
                Quote q = found.quote();
                quotes.upsert(symbol, q.currency(), q.price(), q.previousClose(), q.marketTime(), q.asOf(), now);
                health.recordSuccess(PROVIDER_KEY, PenzProviderHealth.KIND_QUOTES);
            }
            case QuoteResult.Unknown unknown -> {
                quotes.touch(symbol, now);
                health.recordSuccess(PROVIDER_KEY, PenzProviderHealth.KIND_QUOTES);
            }
            case QuoteResult.Missing missing -> {
                quotes.touch(symbol, now);
                health.recordSuccess(PROVIDER_KEY, PenzProviderHealth.KIND_QUOTES);
            }
            case QuoteResult.Failed failed -> {
                log.warn("quote fetch failed for {}: {}", symbol, failed.reason());
                quotes.touch(symbol, now);
                health.recordFailure(PROVIDER_KEY, PenzProviderHealth.KIND_QUOTES, failed.reason());
            }
        }
    }

    private Instant now() {
        return Instant.now(clock.getIfAvailable(Clock::systemUTC));
    }
}
