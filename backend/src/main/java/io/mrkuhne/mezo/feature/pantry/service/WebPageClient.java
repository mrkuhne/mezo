package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.feature.pantry.config.PantryScrapeProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.boot.http.client.HttpRedirects;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Outbound product-page fetch for the URL-scrape import (mezo-8vum). Mirrors {@link OffClient}'s
 * RestClient/timeout construction, adding browser-like headers (some shops 403 obvious bots), a
 * hard body-size cap that is enforced <em>while streaming</em> the response (the body is read in
 * chunks with a running byte count and aborted the instant it crosses {@code maxBodyBytes}, so a
 * multi-GB response is never buffered whole), and an SSRF guard: only http/https, only public
 * hosts, and redirects are <em>never</em> followed — the request factory is pinned to
 * {@link HttpRedirects#DONT_FOLLOW} so a 30x cannot bounce a public URL to a private/link-local
 * host; any redirect therefore surfaces as a fetch failure rather than being chased. The
 * {@code allow-private-hosts} escape hatch exists solely so WireMock ITs can hit loopback.
 * Every failure maps to a typed SystemMessage — a fetch/upstream problem (any non-2xx incl. a 30x,
 * an oversize body, or a transport error) is {@code PANTRY_SCRAPE_FETCH_FAILED} (502); a null,
 * blank or malformed URL is {@code VALIDATION_INVALID_VALUE}/url (400).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class WebPageClient {

    private final RestClient rest;
    private final PantryScrapeProperties props;

    public WebPageClient(RestClient.Builder builder, PantryScrapeProperties props) {
        this.props = props;
        // DONT_FOLLOW makes the redirect policy explicit (not classpath/client-dependent): every
        // detect-able factory honours it (JDK -> Redirect.NEVER, HttpComponents -> no-follow
        // strategy), so a 30x is returned as-is and caught below instead of being chased into a
        // possibly private/link-local host (SSRF).
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withRedirects(HttpRedirects.DONT_FOLLOW)
            .withTimeouts(Duration.ofMillis(props.timeoutMs()), Duration.ofMillis(props.timeoutMs()));
        this.rest = builder
            .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent())
            .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, props.acceptLanguage())
            .defaultHeader(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml")
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /**
     * Fetches the page and returns its HTML. The body is streamed and the {@code maxBodyBytes} cap
     * is enforced incrementally, so an oversize (or non-2xx, incl. a never-followed 30x) response is
     * rejected as {@code PANTRY_SCRAPE_FETCH_FAILED} without being buffered whole.
     */
    public String fetch(String url) {
        URI uri = validated(url);
        try {
            return rest.get().uri(uri).exchange((request, response) -> {
                HttpStatusCode status = response.getStatusCode();
                if (!status.is2xxSuccessful()) {
                    // Redirects are never followed, so a 30x lands here too (alongside 4xx/5xx).
                    throw fetchFailed(url, "upstream status " + status.value(), null);
                }
                byte[] body = readCapped(url, response.getBody());
                return new String(body, charsetOf(response.getHeaders()));
            });
        } catch (RestClientException ex) {
            // Transport failure (connect/read) — the exchange wraps read IOExceptions as this.
            throw fetchFailed(url, ex.getClass().getSimpleName(), ex);
        }
    }

    /**
     * Reads the response body chunk-by-chunk, aborting the moment the running byte count exceeds
     * {@code maxBodyBytes} — the whole (possibly multi-GB) body is never held in memory at once.
     */
    private byte[] readCapped(String url, InputStream body) throws IOException {
        int cap = props.maxBodyBytes();
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int total = 0;
        int read;
        while ((read = body.read(chunk)) != -1) {
            total += read;
            if (total > cap) {
                throw fetchFailed(url, "body exceeds cap", null);
            }
            buffer.write(chunk, 0, read);
        }
        if (total == 0) {
            throw fetchFailed(url, "empty body", null);
        }
        return buffer.toByteArray();
    }

    /**
     * Charset from the response Content-Type, UTF-8 when the header is absent, charset-less, or
     * malformed — {@code getContentType()} throws {@link InvalidMediaTypeException} (an
     * IllegalArgumentException, not a RestClientException) on an unparseable header, which would
     * otherwise escape {@code fetch}'s outer catch as a generic 500; swallow it to the same UTF-8
     * fallback so every path stays within the class's typed-SystemMessage contract.
     */
    private Charset charsetOf(HttpHeaders headers) {
        MediaType contentType;
        try {
            contentType = headers.getContentType();
        } catch (InvalidMediaTypeException ex) {
            return StandardCharsets.UTF_8;
        }
        return contentType != null && contentType.getCharset() != null
            ? contentType.getCharset() : StandardCharsets.UTF_8;
    }

    /** http/https + public-host guard; null/blank/bad URL -> VALIDATION_INVALID_VALUE (400). */
    private URI validated(String url) {
        if (url == null || url.isBlank()) {
            throw badUrl();
        }
        URI uri;
        try {
            uri = URI.create(url.strip());
        } catch (IllegalArgumentException ex) {
            throw badUrl();
        }
        String scheme = uri.getScheme();
        if (uri.getHost() == null || (!"http".equals(scheme) && !"https".equals(scheme))) {
            throw badUrl();
        }
        if (!props.allowPrivateHosts()) {
            try {
                InetAddress addr = InetAddress.getByName(uri.getHost());
                if (addr.isLoopbackAddress() || addr.isSiteLocalAddress()
                        || addr.isLinkLocalAddress() || addr.isAnyLocalAddress()) {
                    throw badUrl();
                }
            } catch (UnknownHostException ex) {
                throw fetchFailed(url, "unknown host", ex);
            }
        }
        return uri;
    }

    private SystemRuntimeErrorException badUrl() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "url").build(), HttpStatus.BAD_REQUEST);
    }

    private SystemRuntimeErrorException fetchFailed(String url, String reason, Exception cause) {
        // Log the cause's message only (never the throwable) — mirrors OffClient#lookupFailed and
        // keeps the warn line to one row; the typed SystemMessage already carries the client-facing text.
        log.warn("Scrape fetch failed for {}: {} ({})", url, reason,
            cause == null ? "no cause" : cause.getMessage());
        return new SystemRuntimeErrorException(
            SystemMessage.error("PANTRY_SCRAPE_FETCH_FAILED").build(), HttpStatus.BAD_GATEWAY);
    }
}
