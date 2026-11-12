package io.mrkuhne.mezo.feature.boop.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** The generated Boop morning brief of one owner-local day (Boop S3, mezo-r36n9.7). The payload is the
 *  serialized BoopBrief DTO, kept as raw JSON text so the entity layer stays free of the API types. */
@Getter
@Setter
@Entity
@Table(name = "boop_brief")
@SQLDelete(sql = "update boop_brief set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class BoopBriefEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false)
    private LocalDate date;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String payload;

    @Column(name = "input_hash", nullable = false, length = 64)
    private String inputHash;

    /** Written on INSERT only; later changes go through {@code BoopBriefRepository#incrementRegen}
     *  (atomic, capped), so a payload rewrite can never write back a stale count. */
    @Column(name = "regen_count", nullable = false, updatable = false)
    private int regenCount;

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    /** True when the payload carries the model's words, false for the rule fallback (mezo-r36n9.24). */
    @Column(name = "ai_words", nullable = false)
    private boolean aiWords;
}
