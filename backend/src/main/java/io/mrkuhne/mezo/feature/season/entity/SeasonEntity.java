package io.mrkuhne.mezo.feature.season.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * Boop B6 Évad (mezo-r36n9.16): one N-week season. Owns its goal 1:1 ({@code goalId}); the weekly gym + sport slots
 * and the sleep goal stay in their own features and are WRITTEN on accept; the block attaches through
 * {@code goal_plan_link}. One {@code active} season per owner (partial unique index {@code uq_season_one_active}).
 */
@Getter
@Setter
@Entity
@Table(name = "season")
@SQLDelete(sql = "update season set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SeasonEntity extends OwnedEntity {

    public static final String STATUS_PLANNED = "planned";
    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_CLOSED = "closed";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "title", nullable = false, length = 80)
    private String title;

    /** planned | active | closed. */
    @Column(name = "status", nullable = false, length = 10)
    private String status;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "weeks", nullable = false)
    private Integer weeks;

    @Column(name = "goal_id", nullable = false)
    private UUID goalId;

    /** The derived sleep need, written to the sleep goal on accept. */
    @Column(name = "sleep_need_min")
    private Integer sleepNeedMin;

    /** The sleep goal minutes before the season took the need over — the rule's base. */
    @Column(name = "sleep_base_min")
    private Integer sleepBaseMin;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "processed_food_max_nova", nullable = false)
    private Integer processedFoodMaxNova = 2;

    @Column(name = "deload_maintain", nullable = false)
    private boolean deloadMaintain = true;

    @Column(name = "use_learned_expenditure", nullable = false)
    private boolean useLearnedExpenditure = true;

    @Column(name = "propose_experiments", nullable = false)
    private boolean proposeExperiments = true;

    /** 0 = hétfő .. 6 = vasárnap; null = no weekly menu. */
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "menu_day")
    private Integer menuDay = 6;

    @Column(name = "menu_time", nullable = false, length = 5)
    private String menuTime = "18:00";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "draft", columnDefinition = "jsonb")
    private SeasonDraftJson draft;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "closed_summary", columnDefinition = "jsonb")
    private Map<String, Object> closedSummary;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    /** {@code startDate + weeks*7 - 1}. */
    public LocalDate endDate() {
        return startDate.plusDays(weeks * 7L - 1);
    }
}
