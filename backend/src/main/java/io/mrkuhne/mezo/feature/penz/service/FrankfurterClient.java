package io.mrkuhne.mezo.feature.penz.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.http.client.ClientHttpRequestFactoryBuilder;
import org.springframework.boot.http.client.HttpClientSettings;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * The ECB reference-rate adapter (frankfurter.dev, Boop Pénz L4 mezo-r36n9.102), shaped like {@code OffClient}:
 * {@code RestClient.Builder} + {@link PenzProperties}, explicit timeouts, a typed {@link SystemMessage} on
 * failure. {@code GET /{date}?from=CUR&to=HUF} answers the last rate published on or before the date, with that
 * publication date. "No rate" (404/422, or no HUF in the body) is {@link Optional#empty()}, not an error.
 */
@Slf4j
@Component
public class FrankfurterClient {

    private final RestClient rest;

    public FrankfurterClient(RestClient.Builder builder, PenzProperties props) {
        HttpClientSettings settings = HttpClientSettings.defaults()
            .withTimeouts(Duration.ofMillis(props.connectTimeoutMs()), Duration.ofMillis(props.readTimeoutMs()));
        this.rest = builder
            .baseUrl(props.frankfurterBaseUrl())
            .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent())
            .requestFactory(ClientHttpRequestFactoryBuilder.detect().build(settings))
            .build();
    }

    /** {@code quote} per one {@code base} for {@code date}; empty when the provider has no such rate. */
    public Optional<Quote> rate(String base, String quote, LocalDate date) {
        try {
            RateResponse body = rest.get()
                .uri(uri -> uri.path("/{date}").queryParam("from", base).queryParam("to", quote).build(date.toString()))
                .retrieve()
                .body(RateResponse.class);
            if (body == null || body.rates() == null || body.rates().get(quote) == null || body.date() == null) {
                return Optional.empty();
            }
            return Optional.of(new Quote(body.rates().get(quote), body.date()));
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404 || ex.getStatusCode().value() == 422) {
                return Optional.empty();
            }
            throw unavailable(ex);
        } catch (RestClientException ex) {
            throw unavailable(ex);
        }
    }

    private static SystemRuntimeErrorException unavailable(RestClientException cause) {
        log.warn("frankfurter rate fetch failed: {}", cause.getMessage());
        return new SystemRuntimeErrorException(SystemMessage.error("PENZ_FX_UNAVAILABLE").build(),
            HttpStatus.SERVICE_UNAVAILABLE);
    }

    /** One rate and the ECB publication date it belongs to. */
    public record Quote(BigDecimal rate, LocalDate publishedDate) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RateResponse(String base, LocalDate date, Map<String, BigDecimal> rates) {
    }
}
