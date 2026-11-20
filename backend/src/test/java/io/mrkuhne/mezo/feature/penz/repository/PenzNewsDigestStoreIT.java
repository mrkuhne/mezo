package io.mrkuhne.mezo.feature.penz.repository;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.entity.PenzDigestEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzDigestItemJson;
import io.mrkuhne.mezo.feature.penz.entity.PenzNewsArticleEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * The news-digest store (mezo-r36n9.104): the global article upsert-by-url and prune, and the owner's one live
 * digest per day with its contract-shaped jsonb items surviving a round trip. Everything here is invented.
 */
@Transactional
class PenzNewsDigestStoreIT extends AbstractIntegrationTest {

    @Autowired private PenzNewsArticleRepository articles;
    @Autowired private PenzDigestRepository digests;
    @Autowired private DatabasePopulator db;
    @Autowired private EntityManager em;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = db.populateUser("penz-news-" + UUID.randomUUID() + "@test.local");
    }

    @Test
    void testInsertIfAbsent_shouldStoreAUrlOnce_andPruneOldArticles() {
        Instant now = Instant.parse("2026-11-20T06:30:00Z");
        String url = "https://example.com/" + UUID.randomUUID();

        assertThat(articles.insertIfAbsent(url, "cnbc-top", "CNBC Top News", "Kitalált cím", null,
            now.minus(Duration.ofHours(2)), now)).isEqualTo(1);
        assertThat(articles.insertIfAbsent(url, "cnbc-top", "CNBC Top News", "Más cím", "x", now, now)).isZero();
        articles.insertIfAbsent(url + "/old", "bbj", "Budapest Business Journal", "Régi cím", null,
            now.minus(Duration.ofDays(31)), now.minus(Duration.ofDays(31)));
        articles.insertIfAbsent(url + "/undated-old", "bbj", "Budapest Business Journal", "Dátum nélkül", null, null,
            now.minus(Duration.ofDays(40)));

        List<PenzNewsArticleEntity> window =
            articles.findByPublishedAtGreaterThanEqualOrderByPublishedAtDesc(now.minus(Duration.ofHours(36)));
        assertThat(window).extracting(PenzNewsArticleEntity::getUrl).contains(url).doesNotContain(url + "/old");
        assertThat(window).filteredOn(a -> a.getUrl().equals(url)).singleElement()
            .extracting(PenzNewsArticleEntity::getTitle).isEqualTo("Kitalált cím");

        assertThat(articles.deleteOlderThan(now.minus(Duration.ofDays(30)))).isGreaterThanOrEqualTo(2);
        em.clear();
        assertThat(articles.findAll()).extracting(PenzNewsArticleEntity::getUrl)
            .contains(url).doesNotContain(url + "/old", url + "/undated-old");
    }

    @Test
    void testDigest_shouldRoundTripItems_andBeReplacedOnRebuild() {
        LocalDate day = LocalDate.of(2026, 11, 20);
        PenzDigestItemJson item = new PenzDigestItemJson("holding-aaaaaaaaaa", "holding", UUID.randomUUID(),
            "Mintavilág ETF", "long", "Kitalált cím", -1_840_000L, "a te részeden", new BigDecimal("-1.1"), 2,
            "Kitalált olvasat.", "Bekezdés.\n\nMásik.", "Hol tévedhetek.", "Nincs teendőd.",
            Instant.parse("2026-11-20T05:00:00Z"),
            List.of(new PenzDigestItemJson.Source("Példa Hírek", "Kitalált cím", "https://example.com/1",
                Instant.parse("2026-11-20T05:00:00Z"))), "model");
        digests.saveAndFlush(digest(day, PenzDigestEntity.STATUS_READY, List.of(item)));
        em.clear();

        PenzDigestEntity read = digests.findByCreatedByAndDigestDateAndDeletedFalse(owner, day).orElseThrow();
        assertThat(read.getItems()).singleElement().usingRecursiveComparison().isEqualTo(item);

        assertThat(digests.purgeDay(owner, day)).isEqualTo(1);
        digests.saveAndFlush(digest(day, PenzDigestEntity.STATUS_QUIET, List.of()));
        em.clear();
        PenzDigestEntity rebuilt = digests.findByCreatedByAndDigestDateAndDeletedFalse(owner, day).orElseThrow();
        assertThat(rebuilt.getStatus()).isEqualTo("quiet");
        assertThat(rebuilt.getItems()).isEmpty();
    }

    private PenzDigestEntity digest(LocalDate day, String status, List<PenzDigestItemJson> items) {
        PenzDigestEntity d = new PenzDigestEntity();
        d.setCreatedBy(owner);
        d.setDigestDate(day);
        d.setStatus(status);
        d.setItems(items);
        d.setGeneratedAt(Instant.parse("2026-11-20T06:31:00Z"));
        return d;
    }
}
