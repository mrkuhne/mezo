package io.mrkuhne.mezo.feature.quest.entity;

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
 * One daily side quest (gamified growth E1, bd mezo-df7q): catalog-selected per (user, date, slot),
 * derived completion evaluated from already-logged data (never self-claimed in E1). Identity =
 * (created_by, quest_date, slot) among non-rerolled rows; a reroll marks the old row rerolled and
 * inserts the replacement into the same slot. An uncompleted quest of a past day expires quietly
 * (ADR 0010 — no failure state).
 */
@Getter
@Setter
@Entity
@Table(name = "daily_quest")
@SQLDelete(sql = "update daily_quest set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class DailyQuestEntity extends OwnedEntity {

    public static final String SLOT_BODY = "BODY";
    public static final String SLOT_FUELBIO = "FUELBIO";
    public static final String SLOT_GROWTH = "GROWTH";
    public static final String STATUS_OFFERED = "offered";
    public static final String STATUS_COMPLETED = "completed";
    public static final String STATUS_EXPIRED = "expired";
    public static final String STATUS_REROLLED = "rerolled";
    public static final String MODE_DERIVED = "DERIVED";
    public static final String MODE_ACTIVITY = "ACTIVITY";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "quest_date", nullable = false)
    private LocalDate questDate;

    @NotNull
    @Column(nullable = false)
    private String slot;

    @NotNull
    @Column(name = "catalog_key", nullable = false)
    private String catalogKey;

    @NotNull
    @Column(name = "skill_key", nullable = false)
    private String skillKey;

    @NotNull
    @Column(name = "skill_kind", nullable = false)
    private String skillKind;

    @NotNull
    @Column(nullable = false)
    private String title;

    @NotNull
    @Column(nullable = false)
    private String why;

    @NotNull
    @Column(name = "completion_mode", nullable = false)
    private String completionMode = MODE_DERIVED;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private QuestTargetEnvelope target;

    @NotNull
    @Column(nullable = false)
    private Integer xp;

    @NotNull
    @Column(nullable = false)
    private Integer coins = 0;

    @NotNull
    @Column(nullable = false)
    private String status = STATUS_OFFERED;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "source_activity_id")
    private UUID sourceActivityId;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
