package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One N=1 experiment (proactive P2): the companion proposes it, Daniel accepts/dismisses (L2),
 * the outcome cron evaluates the window deterministically. Lifecycle proposed → active →
 * completed | proposed → dismissed. {@code startDate} is null until accepted; {@code outcomeGood}
 * is null until the window closes (and stays null when the window has no data — honest
 * "inconclusive"). The metric/direction vocabularies are shared with {@code PredictionEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "experiment")
@SQLDelete(sql = "update experiment set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ExperimentEntity extends OwnedEntity {

    public static final String STATUS_PROPOSED = "proposed";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_DISMISSED = "dismissed";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false, length = 200)
    private String title;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String hypothesis;

    @NotNull
    @Pattern(regexp = "proposed|active|completed|dismissed")
    @Column(nullable = false, length = 10)
    private String status = STATUS_PROPOSED;

    @NotNull
    @Column(name = "metric_key", nullable = false, length = 40)
    private String metricKey;

    @NotNull
    @Pattern(regexp = "up|down|stable")
    @Column(name = "expected_direction", nullable = false, length = 8)
    private String expectedDirection;

    @Column(name = "start_date")
    private LocalDate startDate;

    @NotNull
    @Column(name = "total_days", nullable = false)
    private Integer totalDays;

    @Column(columnDefinition = "text")
    private String outcome;

    @Column(name = "outcome_good")
    private Boolean outcomeGood;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
