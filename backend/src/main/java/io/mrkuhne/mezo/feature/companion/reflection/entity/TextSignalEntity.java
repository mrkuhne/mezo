package io.mrkuhne.mezo.feature.companion.reflection.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One LLM-extracted signal per source-row VERSION (Reflexió S1, bd mezo-eq85.1, spec 2026-09-06
 * §4.1). Never updated in place: an edited journal/gratitude entry (or a chat day that gained
 * turns) gets a NEW row with {@code version + 1}, and every series reads the newest version per
 * {@code (source_kind, source_id)}. That keeps the extraction history auditable instead of
 * silently rewriting yesterday's numbers.
 *
 * <p>{@code confidence = "unsure"} rows carry no numbers (the extractor nulls them) and exist for
 * audit only — they never enter a metric series. The source domain row stays authoritative; this
 * is a derived projection, exactly like {@code memory_item}.
 */
@Getter
@Setter
@Entity
@Table(name = "text_signal")
@SQLDelete(sql = "update text_signal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class TextSignalEntity extends OwnedEntity {

    /** Mirrors ck_text_signal_source_kind — also the {@code memory_item.source_kind} of the same row. */
    public static final String SOURCE_JOURNAL = "journal_entry";
    public static final String SOURCE_GRATITUDE = "gratitude";
    public static final String SOURCE_CHAT_DAY = "chat_day";

    /** Mirrors ck_text_signal_confidence. */
    public static final String CONFIDENCE_SURE = "sure";
    public static final String CONFIDENCE_UNSURE = "unsure";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "journal_entry|gratitude|chat_day")
    @Column(name = "source_kind", nullable = false, length = 16)
    private String sourceKind;

    @NotNull
    @Column(name = "source_id", nullable = false, columnDefinition = "uuid")
    private UUID sourceId;

    /** The day the source text is ABOUT (not when it was extracted). */
    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @NotNull
    @Size(max = 64)
    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    @NotNull
    @Min(1)
    @Column(nullable = false)
    private Integer version = 1;

    // The three scores are smallint in the DB (a 1..5 CHECK needs no more) but Integer in Java —
    // the extractor, the series map and every consumer speak Integer. The explicit SMALLINT jdbc
    // type is what reconciles the two; without it Hibernate's schema validation rejects int2.
    @Min(1)
    @Max(5)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer mood;

    @Min(1)
    @Max(5)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer energy;

    @Min(1)
    @Max(5)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer stress;

    @NotNull
    @Size(max = 8)
    @Pattern(regexp = "sure|unsure")
    @Column(nullable = false, length = 8)
    private String confidence;

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> people = new ArrayList<>();

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> topics = new ArrayList<>();

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> keywords = new ArrayList<>();

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private TextSignalProvenanceEnvelope provenance = TextSignalProvenanceEnvelope.empty();

    /** Only a {@code sure} row's numbers may enter a metric series. */
    public boolean isSure() {
        return CONFIDENCE_SURE.equals(confidence);
    }
}
