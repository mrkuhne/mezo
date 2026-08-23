package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.UUID;

/**
 * L1 episodic memory (V2.1, spec §7): one pgvector row per NARRATIVE unit — a daily summary,
 * a chat turn, later a weekly summary. Raw numeric rows are never embedded (they stay in SQL
 * behind tools); recall is thematic ("volt már ilyen nap"), never the source of facts (that is
 * the L3 knowledge_fact layer).
 *
 * <p>ANN search runs as native SQL in {@code MemoryEmbeddingRepository} — the {@code <=>}
 * cosine operator has no JPQL form, and {@code @SQLRestriction} does NOT apply there (native
 * queries filter {@code is_deleted} explicitly).
 */
@Getter
@Setter
@Entity
@Table(name = "memory_embedding", uniqueConstraints =
    @UniqueConstraint(name = "uq_memory_embedding_kind_ref_id", columnNames = {"kind", "ref_id"}))
@SQLDelete(sql = "update memory_embedding set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryEmbeddingEntity extends OwnedEntity {

    public static final String KIND_CHAT_TURN = "chat_turn";
    public static final String KIND_DAILY_SUMMARY = "daily_summary";
    public static final String KIND_WEEKLY_SUMMARY = "weekly_summary";
    /** W3.2 (mezo-b3pp.13): the consolidation ladder's monthly rung. */
    public static final String KIND_MONTHLY_SUMMARY = "monthly_summary";
    public static final String KIND_JOURNAL_ENTRY = "journal_entry";
    public static final String KIND_DECISION = "decision";
    public static final String KIND_GRATITUDE = "gratitude";
    public static final String KIND_REFLECTION = "reflection";
    /** W1.5 (mezo-b3pp.5): a substantive „Napló" activity entry, embedded by the nightly catch-up. */
    public static final String KIND_ACTIVITY_NOTE = "activity_note";
    /** W1.5 (mezo-b3pp.5): a substantive check-in note, embedded by the nightly catch-up. */
    public static final String KIND_CHECKIN_NOTE = "checkin_note";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_memory_embedding_kind. */
    @NotNull
    @Size(max = 20)
    @Pattern(regexp = "chat_turn|daily_summary|weekly_summary|monthly_summary|journal_entry|reflection|gratitude|decision|activity_note|checkin_note")
    @Column(nullable = false, length = 20)
    private String kind;

    /** The embedded unit's row id (ai_message / daily_summary) — unique per kind (uq_...). */
    @NotNull
    @Column(name = "ref_id", nullable = false, columnDefinition = "uuid")
    private UUID refId;

    /** The narrative text that was embedded — kept verbatim so recall can quote it. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    /** L2-normalized unit vector from the {@link EmbeddingPort} (dimension is structural). */
    @NotNull
    @JdbcTypeCode(SqlTypes.VECTOR)
    @Array(length = EmbeddingPort.DIMENSIONS)
    @Column(nullable = false)
    private float[] embedding;

    /** The day the remembered episode happened (not when it was embedded) — recency ranking key. */
    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;
}
