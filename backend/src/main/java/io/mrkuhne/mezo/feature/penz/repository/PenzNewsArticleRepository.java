package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzNewsArticleEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/**
 * The global article store — not owned, no soft delete: upsert by url, read by window, prune by age. The two writes
 * carry their own transaction: the poll calls them outside any service transaction, one article at a time.
 */
public interface PenzNewsArticleRepository extends JpaRepository<PenzNewsArticleEntity, UUID> {

    /** Stores one article unless its url is already known (a re-poll, or a concurrent poll): 1 inserted, 0 known. */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into penz_news_article (url, source_key, source_name, title, summary, published_at, fetched_at)
        values (:url, :sourceKey, :sourceName, :title, :summary, :publishedAt, :fetchedAt)
        on conflict (url) do nothing
        """, nativeQuery = true)
    int insertIfAbsent(@Param("url") String url, @Param("sourceKey") String sourceKey,
                       @Param("sourceName") String sourceName, @Param("title") String title,
                       @Param("summary") String summary, @Param("publishedAt") Instant publishedAt,
                       @Param("fetchedAt") Instant fetchedAt);

    /** The articles published at or after {@code from} (the matcher's 36 h window), newest first. */
    List<PenzNewsArticleEntity> findByPublishedAtGreaterThanEqualOrderByPublishedAtDesc(Instant from);

    /**
     * Deletes the articles older than {@code cutoff} (30 days): by publication date, or by fetch date when the
     * feed gave none. Returns how many went.
     */
    @Transactional
    @Modifying(flushAutomatically = true)
    @Query(value = """
        delete from penz_news_article
        where coalesce(published_at, fetched_at) < :cutoff
        """, nativeQuery = true)
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
