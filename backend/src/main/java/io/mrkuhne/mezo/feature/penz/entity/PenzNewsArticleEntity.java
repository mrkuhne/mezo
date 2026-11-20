package io.mrkuhne.mezo.feature.penz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/**
 * One fetched news article (Boop Pénz L6, mezo-r36n9.104) — GLOBAL, not owned: public text from an allow-listed
 * feed, shared by every user's digest. One row per url, written only through the native ON CONFLICT insert of
 * {@code PenzNewsArticleRepository}, pruned after 30 days. The text is untrusted.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_news_article")
public class PenzNewsArticleEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "url", nullable = false, length = 1000)
    private String url;

    @Column(name = "source_key", nullable = false, length = 40)
    private String sourceKey;

    @Column(name = "source_name", nullable = false, length = 80)
    private String sourceName;

    @Column(name = "title", nullable = false, length = 300)
    private String title;

    @Column(name = "summary", length = 600)
    private String summary;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;
}
