package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * The explorer's "is this user's vector store healthy" rollups (mezo-4qyt): small grouped counts,
 * all owner-scoped, no dynamic identifiers anywhere.
 *
 * <p>Gated on {@link FeaturesConfiguration#COMPANION_SWITCH} only, even though the node/edge
 * statements are the graph's: splitting the repository would mean {@code /health} answers nothing
 * when the graph is off, and the surface's rule is that the other views keep working. The caller
 * simply does not ask for the graph buckets when the graph provider is absent.
 *
 * <p>No savepoint wrapper: no pgvector operator appears in any of these statements, and these
 * reads ARE the request rather than an optional extra.
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryHealthQuery {

    /** One grouped count as the DB returned it; the human-readable label is the mapper's job. */
    public record Bucket(String key, long count) {}

    private static final String VECTORS_BY_STATUS = """
        select v.status as key, count(*) as count from memory_vector v
        where v.created_by = :userId and v.is_deleted = false group by 1 order by 1
        """;

    private static final String VECTOR_FAILURES = """
        select coalesce(v.failure_code, 'UNKNOWN') as key, count(*) as count from memory_vector v
        where v.created_by = :userId and v.is_deleted = false and v.status = 'failed'
        group by 1 order by 2 desc, 1
        """;

    private static final String VECTORS_BY_VERSION = """
        select v.embedding_version as key, count(*) as count from memory_vector v
        where v.created_by = :userId and v.is_deleted = false group by 1 order by 1
        """;

    /** Present but ANN-ineligible: the quiet failure mode the surface exists to expose. */
    private static final String STALE_VECTORS = """
        select count(*) from memory_vector v
        join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
        where v.created_by = :userId and v.is_deleted = false and v.status = 'ready'
          and v.embedded_content_hash <> i.content_hash
        """;

    private static final String ITEMS_BY_STATE = """
        select i.state as key, count(*) as count from memory_item i
        where i.created_by = :userId and i.is_deleted = false group by 1 order by 1
        """;

    private static final String NODES_BY_STATUS = """
        select n.status as key, count(*) as count from knowledge_node n
        where n.created_by = :userId and n.is_deleted = false group by 1 order by 1
        """;

    private static final String NODES_BY_KIND = """
        select n.kind as key, count(*) as count from knowledge_node n
        where n.created_by = :userId and n.is_deleted = false group by 1 order by 1
        """;

    /**
     * {@code width_bucket} returns {@code buckets + 1} for a weight of exactly 1.0; the mapper
     * folds that into the last bucket, or the histogram grows a phantom extra column.
     */
    private static final String EDGE_WEIGHT_HISTOGRAM = """
        select width_bucket(e.weight, 0, 1, :buckets) as bucket, count(*) as count
        from knowledge_edge e where e.created_by = :userId and e.is_deleted = false
        group by 1 order by 1
        """;

    /**
     * There is no job-run table, so every timestamp is INFERRED from the newest row the pass
     * writes. The DTO description and the Hungarian label both say "becsült".
     */
    private static final String JOBS = """
        select
          (select max(created_at) from daily_summary
             where created_by = :userId and is_deleted = false) as last_daily_summary,
          (select max(last_detected_at) from pattern
             where created_by = :userId and is_deleted = false) as last_pattern_detection,
          (select max(last_reinforced_at) from knowledge_edge
             where created_by = :userId and is_deleted = false) as last_edge_reinforcement,
          (select max(created_at) from memory_retrieval_run
             where created_by = :userId) as last_retrieval_run,
          (select max(created_at) from memory_vector
             where created_by = :userId and is_deleted = false) as last_vector_write
        """;

    private static final RowMapper<Bucket> BUCKET_MAPPER =
            (rs, rowNum) -> new Bucket(rs.getString("key"), rs.getLong("count"));

    private final NamedParameterJdbcTemplate jdbc;

    public List<Bucket> vectorsByStatus(UUID userId) {
        return buckets(VECTORS_BY_STATUS, userId);
    }

    public List<Bucket> vectorFailures(UUID userId) {
        return buckets(VECTOR_FAILURES, userId);
    }

    public List<Bucket> vectorsByVersion(UUID userId) {
        return buckets(VECTORS_BY_VERSION, userId);
    }

    public long staleVectorCount(UUID userId) {
        Long count = jdbc.queryForObject(STALE_VECTORS, owner(userId), Long.class);
        return count == null ? 0L : count;
    }

    public List<Bucket> itemsByState(UUID userId) {
        return buckets(ITEMS_BY_STATE, userId);
    }

    public List<Bucket> nodesByStatus(UUID userId) {
        return buckets(NODES_BY_STATUS, userId);
    }

    public List<Bucket> nodesByKind(UUID userId) {
        return buckets(NODES_BY_KIND, userId);
    }

    /**
     * Raw {@code width_bucket} index -&gt; count, with the {@code buckets + 1} overflow (weight
     * exactly 1.0) already folded into {@code buckets}. Zero-count buckets are absent; labelling
     * and gap-filling belong to the admin mapper, which owns the Hungarian range labels.
     */
    public Map<Integer, Long> edgeWeightHistogram(UUID userId, int buckets) {
        Map<Integer, Long> byBucket = new LinkedHashMap<>();
        jdbc.query(EDGE_WEIGHT_HISTOGRAM, owner(userId).addValue("buckets", buckets), rs -> {
            int bucket = Math.min(Math.max(rs.getInt("bucket"), 1), buckets);
            byBucket.merge(bucket, rs.getLong("count"), Long::sum);
        });
        return byBucket;
    }

    /** The five inferred job timestamps; a null value means "that pass has written nothing". */
    public Map<String, Instant> jobs(UUID userId) {
        Map<String, Instant> jobs = new LinkedHashMap<>();
        jdbc.query(JOBS, owner(userId), rs -> {
            jobs.put("lastDailySummary", instant(rs, "last_daily_summary"));
            jobs.put("lastPatternDetection", instant(rs, "last_pattern_detection"));
            jobs.put("lastEdgeReinforcement", instant(rs, "last_edge_reinforcement"));
            jobs.put("lastRetrievalRun", instant(rs, "last_retrieval_run"));
            jobs.put("lastVectorWrite", instant(rs, "last_vector_write"));
        });
        return jobs;
    }

    /**
     * {@code timestamptz} -> {@link Instant} via {@link OffsetDateTime}: this project's PostgreSQL
     * JDBC driver rejects {@code getObject(label, Instant.class)} outright, so the two-step
     * conversion is required rather than stylistic.
     */
    private static Instant instant(ResultSet rs, String label) throws SQLException {
        OffsetDateTime value = rs.getObject(label, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private List<Bucket> buckets(String sql, UUID userId) {
        return jdbc.query(sql, owner(userId), BUCKET_MAPPER);
    }

    private static MapSqlParameterSource owner(UUID userId) {
        return new MapSqlParameterSource().addValue("userId", userId);
    }
}
