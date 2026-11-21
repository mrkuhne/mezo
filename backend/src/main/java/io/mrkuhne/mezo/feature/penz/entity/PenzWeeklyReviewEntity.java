package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
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
 * The owner's weekly long-horizon review (Boop Pénz, mezo-r36n9.120): one live row per owner and {@code weekStart}
 * (the Monday of a complete Monday–Sunday week in his money timezone, {@code uq_penz_weekly_review_created_by_week_start}).
 * {@code status} ready|quiet|failed mirrors {@code ck_penz_weekly_review_status} (the API's {@code pending} is "no
 * row"); {@code sections} are the three validated, contract-shaped sleeve sections.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_weekly_review")
@SQLDelete(sql = "update penz_weekly_review set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzWeeklyReviewEntity extends OwnedEntity {

    public static final String STATUS_READY = "ready";
    public static final String STATUS_QUIET = "quiet";
    public static final String STATUS_FAILED = "failed";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "status", nullable = false, length = 6)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "sections", nullable = false)
    private List<PenzWeeklySectionJson> sections = new ArrayList<>();

    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
