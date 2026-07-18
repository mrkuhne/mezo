package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.feature.pantry.config.PantryScrapeProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Outbound product-page fetch for the URL-scrape import (mezo-8vum). Mirrors {@link OffClient}'s
 * RestClient/timeout construction, adding browser-like headers (some shops 403 obvious bots), a
 * hard body-size cap, and an SSRF guard: only http/https and only public hosts (the
 * {@code allow-private-hosts} escape hatch exists solely so WireMock ITs can hit loopback).
 * Every failure maps to a typed SystemMessage — a fetch/upstream problem is
 * {@code PANTRY_SCRAPE_FETCH_FAILED} (502); a bad URL is {@code VALIDATION_INVALID_VALUE}/url (400).
 */
@Slf4j
@Component
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class WebPageClient {

    private final RestClient rest;
    private final PantryScrapeProperties props;

    public WebPageClient(RestClient.Builder builder, PantryScrapeProperties props) {
        this.props = props;
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withTimeouts(Duration.ofMillis(props.timeoutMs()), Duration.ofMillis(props.timeoutMs()));
        this.rest = builder
            .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent())
            .defaultHeader(HttpHeaders.ACCEPT_LANGUAGE, props.acceptLanguage())
            .defaultHeader(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml")
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /** Fetches the page and returns its HTML (bounded by {@code maxBodyBytes}). */
    public String fetch(String url) {
        URI uri = validated(url);
        try {
            String body = rest.get().uri(uri).retrieve().body(String.class);
            if (body == null || body.getBytes(StandardCharsets.UTF_8).length > props.maxBodyBytes()) {
                throw fetchFailed(url, body == null ? "empty body" : "body exceeds cap", null);
            }
            return body;
        } catch (RestClientException ex) {
            throw fetchFailed(url, ex.getClass().getSimpleName(), ex);
        }
    }

    /** http/https + public-host guard; bad URL -> VALIDATION_INVALID_VALUE (400). */
    private URI validated(String url) {
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
