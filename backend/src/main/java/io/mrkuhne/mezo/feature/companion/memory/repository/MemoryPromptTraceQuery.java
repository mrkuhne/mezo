package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * "What the LLM actually saw" for one retrieval run (mezo-4qyt).
 *
 * <p>The rendered {@code [Emlékek]} block is NOT stored anywhere. The only bridge from a run to
 * the model's prompt is {@code ai_message.recalled_memories} — a typed jsonb envelope
 * ({@code RecalledMemoriesEnvelope}) whose items carry {@code retrievalRunId} — and only NEW-mode
 * turns write it, because SHADOW runs never reach the model at all. Hence: native, jsonb
 * containment, and a null answer with an explicit reason rather than an empty list.
 *
 * <p>Owner-scoped and time-bounded on purpose: there is no index on the jsonb path, so the
 * predicate is {@code created_by} + a window around the run's own {@code created_at} (the turn
 * that consumed a retrieval is written in the same request), which keeps the scan to one user's
 * few rows even before the caller's {@code statement_timeout} would fire.
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryPromptTraceQuery {

    private static final Duration WINDOW = Duration.ofMinutes(10);

    private static final String SQL = """
        select m.recalled_memories::text as envelope
        from ai_message m
        where m.created_by = :userId
          and m.is_deleted = false
          and m.recalled_memories is not null
          and m.created_at between :from and :to
          and m.recalled_memories -> 'items' @> cast(:probe as jsonb)
        order by m.created_at desc
        limit 1
        """;

    private final NamedParameterJdbcTemplate jdbc;

    /**
     * The raw envelope json for the message that consumed {@code runId}, or empty.
     *
     * <p>{@code probe} is a BOUND parameter, never concatenated SQL: {@code runId} is a
     * {@link UUID}, so its {@code toString()} cannot carry a quote, and the string is assembled
     * only to shape the jsonb array literal the containment operator needs. The envelope itself is
     * read through a {@code ::text} cast with {@code getString} so no driver {@code PGobject}
     * survives past the connection's return to the pool (the {@code AdminRowQuery.readCell}
     * reasoning).
     */
    public Optional<String> findEnvelopeJson(UUID userId, UUID runId, Instant runCreatedAt) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("from", utc(runCreatedAt.minus(WINDOW)))
                .addValue("to", utc(runCreatedAt.plus(WINDOW)))
                .addValue("probe", "[{\"retrievalRunId\":\"" + runId + "\"}]");
        return jdbc.query(SQL, params, (rs, i) -> rs.getString("envelope")).stream().findFirst();
    }

    /** {@code timestamptz} bind value the driver accepts without a type hint. */
    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
