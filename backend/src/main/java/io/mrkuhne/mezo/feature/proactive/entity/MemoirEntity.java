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
 * The companion's weekly memoir narrative (proactive W2, spec §6) — one live row per
 * user + ISO-Monday week; partial unique so a soft-deleted row can be regenerated. Anchors are
 * a typed jsonb envelope of code-collected, model-selected refs (the briefing envelope precedent).
 */
@Getter
@Setter
@Entity
@Table(name = "memoir")
@SQLDelete(sql = "update memoir set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoirEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The ISO Monday of the memoir's week. */
    @NotNull
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    /** Display title of the week's narrative. */
    @NotNull
    @Column(nullable = false, length = 200)
    private String title;

    /** The memoir prose (single narrative paragraph block). */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String body;

    /** Code-collected, model-selected refs — never invented. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private MemoirAnchorsEnvelope anchors;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
