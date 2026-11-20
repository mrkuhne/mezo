package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import io.mrkuhne.mezo.feature.penz.service.net.PenzHttpFetcher;
import io.mrkuhne.mezo.feature.penz.service.net.PenzHttpFetcher.FetchResult;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Set;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * The market-data adapter (Boop Pénz L6 build notes call 1): the free Yahoo chart endpoint
 * {@code {base}/v8/finance/chart/{symbol}?range=5d&interval=1d} for securities and FX pairs ({@code EURHUF=X}),
 * through the guarded {@link PenzHttpFetcher} (allow-list = {@code mezo.penz.yahoo-allowed-host}).
 *
 * <p>Price = {@code chart.result[0].meta.regularMarketPrice} (≤ 0 or missing → {@link QuoteResult.Missing}),
 * currency, {@code regularMarketTime}; the quote's date is the Europe/Budapest date of the market time. Previous
 * close = the last non-null close of {@code timestamp[]} / {@code indicators.quote[0].close[]} whose Budapest date
 * is before that date. {@code chart.error} or a 404 → {@link QuoteResult.Unknown}; any other failure →
 * {@link QuoteResult.Failed} with a short reason (never the body).
 */
@Component
public class QuoteClient {

    public static final ZoneId MARKET_ZONE = ZoneId.of("Europe/Budapest");
    private static final long MAX_BYTES = 512 * 1024;

    private final PenzHttpFetcher fetcher;
    private final PenzProperties props;
    private final ObjectMapper objectMapper;

    public QuoteClient(PenzHttpFetcher fetcher, PenzProperties props, ObjectMapper objectMapper) {
        this.fetcher = fetcher;
        this.props = props;
        this.objectMapper = objectMapper;
    }

    public QuoteResult fetch(String symbol) {
        URI uri = URI.create(props.yahooBaseUrl() + "/v8/finance/chart/"
            + URLEncoder.encode(symbol, StandardCharsets.UTF_8) + "?range=5d&interval=1d");
        FetchResult r = fetcher.fetch(uri, Set.of(props.yahooAllowedHost()), MAX_BYTES, "application/json");
        if (r.status() == 404) {
            return new QuoteResult.Unknown();
        }
        if (!r.ok()) {
            return new QuoteResult.Failed(r.failure());
        }
        return parse(symbol, r.body(), objectMapper);
    }

    /** Parses one chart answer. Package-private for the unit test. */
    static QuoteResult parse(String symbol, String body, ObjectMapper objectMapper) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (JacksonException ex) {
            return new QuoteResult.Failed("unreadable answer");
        }
        JsonNode chart = root.path("chart");
        if (!chart.path("error").isMissingNode() && !chart.path("error").isNull()) {
            return new QuoteResult.Unknown();
        }
        JsonNode result = chart.path("result").path(0);
        if (result.isMissingNode() || result.isNull()) {
            return new QuoteResult.Unknown();
        }
        JsonNode meta = result.path("meta");
        JsonNode priceNode = meta.path("regularMarketPrice");
        JsonNode timeNode = meta.path("regularMarketTime");
        String currency = meta.path("currency").isString() ? meta.path("currency").asString() : null;
        if (!priceNode.isNumber() || priceNode.decimalValue().signum() <= 0 || !timeNode.isNumber()
                || currency == null || currency.length() != 3) {
            return new QuoteResult.Missing();
        }
        Instant marketTime = Instant.ofEpochSecond(timeNode.asLong());
        LocalDate asOf = marketTime.atZone(MARKET_ZONE).toLocalDate();
        return new QuoteResult.Found(new Quote(symbol, currency.toUpperCase(java.util.Locale.ROOT),
            priceNode.decimalValue(), previousClose(result, asOf), marketTime, asOf));
    }

    private static BigDecimal previousClose(JsonNode result, LocalDate marketDate) {
        JsonNode stamps = result.path("timestamp");
        JsonNode closes = result.path("indicators").path("quote").path(0).path("close");
        BigDecimal best = null;
        long bestStamp = Long.MIN_VALUE;
        for (int i = 0; i < stamps.size() && i < closes.size(); i++) {
            JsonNode close = closes.get(i);
            if (!stamps.get(i).isNumber() || close == null || !close.isNumber() || close.decimalValue().signum() <= 0) {
                continue;
            }
            long stamp = stamps.get(i).asLong();
            LocalDate day = Instant.ofEpochSecond(stamp).atZone(MARKET_ZONE).toLocalDate();
            if (day.isBefore(marketDate) && stamp > bestStamp) {
                bestStamp = stamp;
                best = close.decimalValue();
            }
        }
        return best;
    }

    /**
     * One quote: price per unit in major units of {@code currency}; {@code asOf} = the Budapest date of the market
     * time; {@code previousClose} null when the answer had no earlier close.
     */
    public record Quote(String symbol, String currency, BigDecimal price, BigDecimal previousClose,
                        Instant marketTime, LocalDate asOf) {
    }

    /** The outcome of one quote fetch. */
    public sealed interface QuoteResult {

        /** A usable quote. */
        record Found(Quote quote) implements QuoteResult {
        }

        /** The source does not know the symbol ({@code chart.error}, 404, no result). */
        record Unknown() implements QuoteResult {
        }

        /** The source knows the symbol but gave no usable price right now. */
        record Missing() implements QuoteResult {
        }

        /** The source could not be reached or answered with a failure. */
        record Failed(String reason) implements QuoteResult {
        }
    }
}
