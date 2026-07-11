package io.mrkuhne.mezo.feature.activity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One free-text life-activity entry (gamified growth E2, bd mezo-jzca). The AI proposes a LIFE
 * skill + XP; the server clamps and caps deterministically (ADR 0010 — the LLM proposes, the
 * server disposes). skillKey null = uncategorized: no XP yet, the client prompts for a manual
 * category; a later categorization grants xpSuggested within the day's remaining caps.
 */
@Getter
@Setter
@Entity
@Table(name = "activity_log")
@SQLDelete(sql = "update activity_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ActivityLogEntity extends OwnedEntity {

    public static final String BY_AI = "AI";
    public static final String BY_USER = "USER";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @NotNull
    @Column(nullable = false)
    private String text;

    @Column(name = "skill_key")
    private String skillKey;

    @Column
    private BigDecimal confidence;

    @NotNull
    @Column(name = "xp_awarded", nullable = false)
    private Integer xpAwarded = 0;

    @NotNull
    @Column(name = "xp_suggested", nullable = false)
    private Integer xpSuggested = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column
    private ActivityExtract extracted;

    @Column(name = "categorized_by")
    private String categorizedBy;
}
