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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * The companion's weekly plan-suggestion prose (proactive W1, spec §5) — one live row per
 * user + ISO-Monday week; partial unique so a soft-deleted row can be regenerated.
 */
@Getter
@Setter
@Entity
@Table(name = "weekly_suggestion")
@SQLDelete(sql = "update weekly_suggestion set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WeeklySuggestionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The ISO Monday of the suggested week. */
    @NotNull
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    /** Smart-tier generated plain Hungarian prose. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String prose;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
