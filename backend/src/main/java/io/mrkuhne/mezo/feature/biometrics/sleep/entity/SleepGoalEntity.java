package io.mrkuhne.mezo.feature.biometrics.sleep.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** The user's sleep goal — one live row per owner (partial-unique on created_by, intention_creed shape). */
@Getter
@Setter
@Entity
@Table(name = "sleep_goal")
@SQLDelete(sql = "update sleep_goal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SleepGoalEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Min(1)
    @Max(1440)
    @Column(name = "target_minutes", nullable = false)
    private Integer targetMinutes;

    @NotNull
    @Pattern(regexp = "WAKE|BED")
    @Column(nullable = false, length = 4)
    private String anchor;

    @NotNull
    @Column(name = "anchor_time", nullable = false, length = 5)
    private String anchorTime;

    @NotNull
    @Min(1)
    @Column(name = "regularity_band_min", nullable = false)
    private Integer regularityBandMin = 15;
}
