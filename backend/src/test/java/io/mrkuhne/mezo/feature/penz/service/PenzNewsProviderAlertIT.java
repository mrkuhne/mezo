package io.mrkuhne.mezo.feature.penz.service;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.anyUrl;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;

import com.github.tomakehurst.wiremock.WireMockServer;
import io.mrkuhne.mezo.api.dto.PenzDigestResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.penz.service.news.NewsSource;
import io.mrkuhne.mezo.feature.penz.service.news.NewsSources;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PenzPopulator;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * The news-provider alert of Boop Pénz L6 (mezo-r36n9.104, build notes call 9): every feed answering 500 for three
 * runs puts every news provider at fail streak 3, {@code allFailing(news)} turns true, the Prometheus gauge
 * {@code mezo_penz_provider_fail_streak} shows 3 and the digest says the news is unhealthy; the vmalert rule exists;
 * the poll job bean is absent while its switch is off (the test profile).
 */
class PenzNewsProviderAlertIT extends ApiIntegrationTest {

    static final WireMockServer MOCK = new WireMockServer(wireMockConfig().dynamicPort());

    @DynamicPropertySource
    static void outbound(DynamicPropertyRegistry registry) {
        MOCK.start();
        registry.add("mezo.penz.yahoo-base-url", MOCK::baseUrl);
        registry.add("mezo.penz.news.feed-base-url-override", MOCK::baseUrl);
        registry.add("mezo.penz.allow-loopback-for-tests", () -> "true");
    }

    @AfterAll
    static void stopMock() {
        MOCK.stop();
    }

    @Autowired private PenzNewsRunner runner;
    @Autowired private PenzProviderHealth health;
    @Autowired private MeterRegistry registry;
    @Autowired private PenzPopulator penz;
    @Autowired private AppUserRepository users;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private ApplicationContext context;
    @Autowired private PenzNewsClient news;
    @Autowired private io.mrkuhne.mezo.feature.penz.repository.PenzNewsArticleRepository articles;

    private UUID owner;

    @BeforeEach
    void setUp() {
        MOCK.resetAll();
        MOCK.stubFor(get(anyUrl()).willReturn(aResponse().withStatus(500)));
        owner = users.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testThreeFailedRuns_shouldPutEveryNewsProviderAtStreakThree_andRaiseTheSignals() {
        // a holding gives the poll a Google News term, so the Google provider row exists too
        penz.holding(owner, "Példabank Nyrt", "stock", null, "mid", "HUF", null);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Europe/Budapest"));

        for (int run = 0; run < 3; run++) {
            runner.run(now);
        }

        List<String> keys = new ArrayList<>();
        NewsSources.SEED.stream().map(PenzNewsClient::providerKey).forEach(keys::add);
        keys.add(PenzNewsClient.GOOGLE_PROVIDER_KEY);
        for (String key : keys) {
            assertThat(health.failStreak(key)).as(key).isEqualTo(3);
            Gauge gauge = registry.find(PenzProviderHealth.METRIC).tag("provider", key).tag("kind", "news").gauge();
            assertThat(gauge).as(key).isNotNull();
            assertThat(gauge.value()).as(key).isEqualTo(3.0);
        }
        assertThat(health.allFailing(PenzProviderHealth.KIND_NEWS)).isTrue();

        PenzDigestResponse digest = getForBody("/api/penz/digest", ownerAuthHeaders(), HttpStatus.OK,
            PenzDigestResponse.class);
        assertThat(digest.getNewsHealthy()).isFalse();
    }

    @Test
    void testOneFeedRecovering_shouldEndAllFailing() {
        NewsSource first = NewsSources.SEED.get(0);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("Europe/Budapest"));
        runner.run(now);
        assertThat(health.allFailing(PenzProviderHealth.KIND_NEWS)).isTrue();

        MOCK.stubFor(get(com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo(
                java.net.URI.create(first.url()).getPath())).atPriority(1)
            .willReturn(aResponse().withBody("<rss><channel></channel></rss>")));
        runner.run(now);

        assertThat(health.failStreak(PenzNewsClient.providerKey(first))).isZero();
        assertThat(health.allFailing(PenzProviderHealth.KIND_NEWS)).isFalse();
    }

    @Test
    void testVmRule_shouldAlertWhenEveryNewsProviderFailsThreeTimes() throws IOException {
        String rules = Files.readString(Path.of("..", "k8s", "monitoring", "vmrule-mezo.yaml"));

        assertThat(rules).contains("alert: PenzNewsProviderDown")
            .contains("min(mezo_penz_provider_fail_streak{kind=\"news\"}) >= 3");
    }

    @Test
    void testJob_shouldBeAbsent_whenItsSwitchIsOff() {
        assertThat(context.getBeanProvider(PenzNewsJob.class).getIfAvailable()).isNull();
        assertThat(context.getBean(PenzNewsRunner.class)).isNotNull();
    }

    @Test
    void testPoll_shouldStoreAndRecordTheOtherFeeds_whenOneFeedCarriesControlCharacters() {
        NewsSource bad = NewsSources.SEED.get(0);
        NewsSource good = NewsSources.SEED.get(1);
        String when = java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME.format(java.time.ZonedDateTime.now(
            java.time.ZoneOffset.UTC).minusHours(1));
        MOCK.stubFor(get(com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo(
                java.net.URI.create(bad.url()).getPath())).atPriority(1)
            .willReturn(aResponse().withBody("<rss><item><title>Rossz\u0000 cím\u202E</title><link>" + MOCK.baseUrl()
                + "/a/bad</link><pubDate>" + when + "</pubDate></item></rss>")));
        MOCK.stubFor(get(com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo(
                java.net.URI.create(good.url()).getPath())).atPriority(1)
            .willReturn(aResponse().withBody("<rss><item><title>Jó cím</title><link>" + MOCK.baseUrl()
                + "/a/good</link><pubDate>" + when + "</pubDate></item></rss>")));

        news.poll(java.time.Instant.now());

        assertThat(articles.findAll()).extracting(a -> a.getTitle())
            .contains("Rossz cím", "Jó cím");
        assertThat(health.failStreak(PenzNewsClient.providerKey(bad))).isZero();
        assertThat(health.failStreak(PenzNewsClient.providerKey(good))).isZero();
    }
}
