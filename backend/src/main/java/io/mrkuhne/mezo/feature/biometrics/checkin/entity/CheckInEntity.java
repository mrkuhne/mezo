package io.mrkuhne.mezo.feature.biometrics.checkin.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "check_in")
@SQLDelete(sql = "update check_in set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CheckInEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @NotNull
    @Column(name = "slot_time", nullable = false, length = 5)
    private String slotTime;

    @NotNull
    @Column(nullable = false, length = 10)
    private String state;

    @Column
    private Integer energy;

    @Column
    private Integer stress;

    @Column
    private Integer body;

    @Column
    private Integer mental;

    @Column(columnDefinition = "text")
    private String note;

    // ── Check-in 2.0 (mezo-ck2) ─────────────────────────────────────────────────────────────
    // Every answer is nullable with NO default: NULL = not answered (skipped, or not asked —
    // askedItems tells the two apart; askedItems NULL = legacy row). Scales are 1..10 (CHECK
    // ck_check_in_<col>_range); stress and soreness keep "10 = worse".

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer mood;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer rested;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer soreness;

    /** "Fáj valami?" — true = yes, false = "Nem", NULL = not answered. */
    @Column
    private Boolean pain;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "pain_regions", columnDefinition = "varchar(16)[]")
    private List<PainRegion> painRegions;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "pain_intensity")
    private Integer painIntensity;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer motivation;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer hunger;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer craving;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "craving_kinds", columnDefinition = "varchar(8)[]")
    private List<CravingKind> cravingKinds;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer digestion;

    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column
    private Integer connection;

    /** "A nap mérlege" — item id {@code day}. */
    @Min(1) @Max(10)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "day_rating")
    private Integer dayRating;

    /** Item ids the sheet showed (plan + adaptive), e.g. {@code energy}; CHECK ck_check_in_asked_items. */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "asked_items", columnDefinition = "varchar(16)[]")
    private List<String> askedItems;

    /** The question of the day's item id; CHECK ck_check_in_adaptive_item. */
    @Size(max = 16)
    @Column(name = "adaptive_item", length = 16)
    private String adaptiveItem;

    /** Why the question of the day was chosen: NEED | RANDOM (CHECK ck_check_in_adaptive_reason). */
    @Size(max = 16)
    @Pattern(regexp = "NEED|RANDOM")
    @Column(name = "adaptive_reason", length = 16)
    private String adaptiveReason;

    /** Saved via "Most csak ennyi" after the core five; the rest stays NULL. */
    @Column(name = "quick_exit", nullable = false)
    private boolean quickExit;

    @Column(name = "saved_at")
    private Instant savedAt;
}
