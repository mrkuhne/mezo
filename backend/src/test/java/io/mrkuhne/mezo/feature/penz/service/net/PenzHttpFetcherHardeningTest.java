package io.mrkuhne.mezo.feature.penz.service.net;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.feature.penz.config.PenzProperties;
import java.net.InetAddress;
import java.net.URI;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.client.RestClient;

/**
 * Regression tests from the L6 security review (mezo-r36n9.104): #11 (IPv4 embedded in IPv6, documentation and
 * Teredo ranges are not public) and #12 (an overall per-fetch deadline, so a slow drip cannot hold the news thread).
 */
class PenzHttpFetcherHardeningTest {

    private static final WireMockServer SERVER = new WireMockServer(wireMockConfig().dynamicPort());

    @BeforeAll
    static void start() {
        SERVER.start();
    }

    @AfterAll
    static void stop() {
        SERVER.stop();
    }

    @ParameterizedTest
    @ValueSource(strings = {"::127.0.0.1", "::10.0.0.1", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe", "2002:7f00:1::",
        "2002:c0a8:101::", "2001::1", "2001:0:4136:e378::1", "2001:db8::1", "192.0.2.1", "198.51.100.7",
        "203.0.113.9"})
    void testIsPublic_shouldRefuseEmbeddedPrivateDocumentationAndTeredoAddresses(String ip) throws Exception {
        assertThat(PenzHttpFetcher.isPublic(InetAddress.getByName(ip))).as(ip).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"64:ff9b::808:808", "2002:808:808::", "93.184.216.34", "2606:4700::1111"})
    void testIsPublic_shouldAcceptPublicAddresses_includingEmbeddedPublicIpv4(String ip) throws Exception {
        assertThat(PenzHttpFetcher.isPublic(InetAddress.getByName(ip))).as(ip).isTrue();
    }

    @Test
    void testFetch_shouldGiveUp_whenTheBodyDribblesPastTheDeadline() {
        SERVER.stubFor(get(urlPathEqualTo("/slow")).willReturn(aResponse().withBody("x".repeat(4_000))
            .withChunkedDribbleDelay(40, 4_000)));
        PenzProperties props = new PenzProperties("http://fx.invalid", 1000, 1000, "test", 7, 2_000_000L, 20, 500,
            "http://quotes.invalid", "quotes.invalid", 60, 2000, "Mozilla/5.0", true, 1000);
        PenzHttpFetcher fetcher = new PenzHttpFetcher(RestClient.builder(), props);

        long start = System.nanoTime();
        PenzHttpFetcher.FetchResult r = fetcher.fetch(URI.create(SERVER.baseUrl() + "/slow"), Set.of("localhost"),
            1_000_000, "text/plain");
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertThat(r.ok()).isFalse();
        assertThat(r.failure()).isEqualTo("deadline");
        assertThat(elapsedMs).isLessThan(2_500);
    }
}
