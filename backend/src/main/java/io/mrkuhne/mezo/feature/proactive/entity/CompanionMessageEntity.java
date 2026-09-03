package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One generated companion-feed message per user+day+kind (companion-feed, spec §4). Regenerable
 * data: uniqueness is a PARTIAL index (uq_companion_message_created_by_date_kind where
 * is_deleted = false), so a staleness path can soft-delete + reinsert.
 */
@Getter
@Setter
@Entity
@Table(name = "companion_message")
@SQLDelete(sql = "update companion_message set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CompanionMessageEntity extends OwnedEntity {

    public static final String KIND_MORNING = "morning";
    public static final String KIND_SLEEP = "sleep";
    public static final String KIND_WEIGHT = "weight";
    public static final String KIND_MIDDAY = "midday";
    public static final String KIND_EVENING = "evening";
    /** W5.2 (bd mezo-b3pp.19): config-text intervention card — the only kind whose envelope
     *  carries an {@code interventionKey}; never LLM-generated. */
    public static final String KIND_INTERVENTION = "intervention";
    /** Emberek S6 (mezo-06o0.8): napi megfigyelés az emberi körről — az Emberek hub
     *  Mezo-sávja ezt mutatja, és a Napi Mezo szálban is megjelenik. */
    public static final String KIND_PEOPLE = "people";
    /** Setup card (S3, bd mezo-d58h.3, spec 2026-09-03 §4 setup table): the user's CONFIGURATION
     *  contradicts what coaching needs (no sleep goal; a sleep plan that cannot fit the evening
     *  schedule). Config text, never LLM-generated; the envelope carries {@code setupKey} so the
     *  weekly re-emit cooldown can be keyed per check. */
    public static final String KIND_SETUP = "setup";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The day this message is FOR — not when it was generated. */
    @NotNull
    @Column(name = "message_date", nullable = false)
    private LocalDate messageDate;

    /** Which feed slot this message fills (morning/sleep/weight/midday/evening). */
    @NotNull
    @Column(nullable = false, length = 16)
    private String kind;

    /** The generated content — eyebrow + paragraphs + model-selected refs. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private CompanionMessageEnvelope content;

    /** When the LLM call produced this row. */
    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
