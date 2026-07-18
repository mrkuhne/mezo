package io.mrkuhne.mezo.feature.pantry.service;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** WebPageClient limits: happy fetch, upstream error, oversize cap, URL guard (mezo-8vum). */
class WebPageClientIT extends AbstractIntegrationTest {

    static final WireMockServer SHOP = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void shopProps(DynamicPropertyRegistry registry) {
        SHOP.start();
        // WireMock listens on loopback — relax the SSRF guard for ITs only.
        registry.add("mezo.pantry-scrape.allow-private-hosts", () -> "true");
        registry.add("mezo.pantry-scrape.max-body-bytes", () -> "20000");
    }

    @AfterAll
    static void stop() {
        SHOP.stop();
    }

    @Autowired
    private WebPageClient client;

    @BeforeEach
    void reset() {
        SHOP.resetAll();
    }

    @Test
    void testFetch_shouldReturnHtml_whenPageResponds() {
        SHOP.stubFor(get(urlPathEqualTo("/p/impact-whey")).willReturn(
            aResponse().withHeader("Content-Type", "text/html").withBody("<html><body>Impact Whey</body></html>")));
        assertThat(client.fetch(SHOP.baseUrl() + "/p/impact-whey")).contains("Impact Whey");
    }

    @Test
    void testFetch_shouldThrowFetchFailed_whenUpstream404() {
        SHOP.stubFor(get(urlPathEqualTo("/gone")).willReturn(aResponse().withStatus(404)));
        assertThatThrownBy(() -> client.fetch(SHOP.baseUrl() + "/gone"))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("PANTRY_SCRAPE_FETCH_FAILED");
    }

    @Test
    void testFetch_shouldThrowFetchFailed_whenBodyExceedsCap() {
        SHOP.stubFor(get(urlPathEqualTo("/huge")).willReturn(
            aResponse().withHeader("Content-Type", "text/html").withBody("x".repeat(30_000))));
        assertThatThrownBy(() -> client.fetch(SHOP.baseUrl() + "/huge"))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("PANTRY_SCRAPE_FETCH_FAILED");
    }

    @Test
    void testFetch_shouldThrowValidation_whenNotHttpUrl() {
        assertThatThrownBy(() -> client.fetch("ftp://example.com/x"))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("VALIDATION_INVALID_VALUE");
    }
}
