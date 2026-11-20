package io.mrkuhne.mezo.feature.penz.service.net;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

/**
 * The SSRF-guarded GET (build notes §2, plan §4.1): the old app's URL vectors, the address check, and — against a
 * loopback WireMock with the test-only switch on — the never-followed redirect and the streaming body cap.
 */
class PenzHttpFetcherTest {

    private static final Set<String> CNBC = Set.of("cnbc.com");
    private static final WireMockServer SERVER = new WireMockServer(wireMockConfig().dynamicPort());

    private static PenzProperties props(boolean allowLoopback) {
        return new PenzProperties("http://fx.invalid", 1000, 1000, "test", 7, 2_000_000L, 20, 500,
            "http://quotes.invalid", "quotes.invalid", 60, 2000, "Mozilla/5.0", allowLoopback, 20000);
    }

    @BeforeAll
    static void start() {
        SERVER.start();
    }

    @AfterAll
    static void stop() {
        SERVER.stop();
    }

    @BeforeEach
    void reset() {
        SERVER.resetAll();
    }

    private static String refusal(String url, Set<String> allowed) {
        return PenzHttpFetcher.refusal(URI.create(url), allowed, false).orElse(null);
    }

    @Test
    void anAllowListedHostOrItsSubdomainPassesCaseInsensitively() {
        assertThat(refusal("https://WWW.CNBC.COM/x", CNBC)).isNull();
        assertThat(refusal("https://cnbc.com/markets", CNBC)).isNull();
        assertThat(refusal("http://cnbc.com./x", CNBC)).isNull();
    }

    @Test
    void theOldAppsVectorsAreRefused() {
        assertThat(refusal("https://evilcnbc.com/x", CNBC)).contains("host not allowed");
        assertThat(refusal("https://cnbc.com.evil.io/x", CNBC)).contains("host not allowed");
        assertThat(refusal("ftp://cnbc.com/x", CNBC)).contains("scheme");
        assertThat(refusal("http://169.254.169.254/latest/meta-data", CNBC)).contains("ip literal");
        assertThat(refusal("http://[::1]/x", CNBC)).contains("ip literal");
        assertThat(refusal("http://localhost/x", Set.of("localhost"))).contains("localhost");
        assertThat(refusal("https://user:pw@cnbc.com/x", CNBC)).contains("userinfo");
        assertThat(refusal("https://cnbc.com:8443/x", CNBC)).contains("port");
        assertThat(refusal("/relative/path", CNBC)).contains("scheme");
        assertThat(refusal("http://2130706433/x", CNBC)).contains("ip literal");
    }

    @Test
    void privateLoopbackLinkLocalAndMetadataAddressesAreNotPublic() throws Exception {
        for (String ip : new String[] {"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254",
            "0.0.0.0", "100.64.0.1", "::1", "fe80::1", "fc00::1", "fd12::1", "224.0.0.1", "::ffff:127.0.0.1"}) {
            assertThat(PenzHttpFetcher.isPublic(InetAddress.getByName(ip))).as(ip).isFalse();
        }
        assertThat(PenzHttpFetcher.isPublic(InetAddress.getByName("93.184.216.34"))).isTrue();
        assertThat(PenzHttpFetcher.isPublic(InetAddress.getByName("2606:4700::1111"))).isTrue();
    }

    @Test
    void withoutTheTestSwitchLoopbackIsRefusedBeforeAnyRequest() {
        PenzHttpFetcher fetcher = new PenzHttpFetcher(RestClient.builder(), props(false));
        PenzHttpFetcher.FetchResult r = fetcher.fetch(URI.create(SERVER.baseUrl() + "/x"), Set.of("localhost"),
            1000, "application/json");
        assertThat(r.ok()).isFalse();
        assertThat(r.failure()).startsWith("refused");
        assertThat(SERVER.getAllServeEvents()).isEmpty();
    }

    @Test
    void aBodyIsFetchedWithTheGivenAcceptHeader() {
        SERVER.stubFor(get(urlPathEqualTo("/ok")).willReturn(aResponse().withHeader("Content-Type",
            "application/json; charset=utf-8").withBody("{\"árfolyam\":1}")));
        PenzHttpFetcher fetcher = new PenzHttpFetcher(RestClient.builder(), props(true));
        PenzHttpFetcher.FetchResult r = fetcher.fetch(URI.create(SERVER.baseUrl() + "/ok"), Set.of("example.com"),
            1000, "application/json");
        assertThat(r.ok()).isTrue();
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body()).isEqualTo("{\"árfolyam\":1}");
        SERVER.verify(getRequestedFor(urlPathEqualTo("/ok")).withHeader("Accept", equalTo("application/json"))
            .withHeader("User-Agent", equalTo("Mozilla/5.0")));
    }

    @Test
    void aRedirectIsNeverFollowed() {
        SERVER.stubFor(get(urlPathEqualTo("/moved")).willReturn(aResponse().withStatus(302)
            .withHeader("Location", "http://169.254.169.254/latest/meta-data")));
        PenzHttpFetcher fetcher = new PenzHttpFetcher(RestClient.builder(), props(true));
        PenzHttpFetcher.FetchResult r = fetcher.fetch(URI.create(SERVER.baseUrl() + "/moved"), Set.of(), 1000,
            "text/html");
        assertThat(r.ok()).isFalse();
        assertThat(r.status()).isEqualTo(302);
        assertThat(r.failure()).isEqualTo("status 302");
        assertThat(r.body()).isNull();
    }

    @Test
    void anOversizeBodyIsCutOff() {
        SERVER.stubFor(get(urlPathEqualTo("/big")).willReturn(aResponse().withBody("x".repeat(5000))));
        PenzHttpFetcher fetcher = new PenzHttpFetcher(RestClient.builder(), props(true));
        PenzHttpFetcher.FetchResult r = fetcher.fetch(URI.create(SERVER.baseUrl() + "/big"), Set.of(), 4096,
            "text/html");
        assertThat(r.ok()).isFalse();
        assertThat(r.failure()).isEqualTo("body too large");
        assertThat(r.body()).isNull();
    }

    @Test
    void aServerErrorCarriesItsStatusButNoBody() {
        SERVER.stubFor(get(urlPathEqualTo("/down")).willReturn(aResponse().withStatus(503).withBody("secret")));
        PenzHttpFetcher fetcher = new PenzHttpFetcher(RestClient.builder(), props(true));
        PenzHttpFetcher.FetchResult r = fetcher.fetch(URI.create(SERVER.baseUrl() + "/down"), Set.of(), 1000,
            "text/html");
        assertThat(r.status()).isEqualTo(503);
        assertThat(r.failure()).isEqualTo("status 503");
        assertThat(r.body()).isNull();
    }
}
