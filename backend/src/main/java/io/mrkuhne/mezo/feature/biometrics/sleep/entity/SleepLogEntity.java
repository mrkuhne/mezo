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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "sleep_log")
@SQLDelete(sql = "update sleep_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SleepLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @Column(length = 5)
    private String bedtime;

    @Column(length = 5)
    private String wakeup;

    @Column(name = "duration_h", precision = 4, scale = 2)
    private BigDecimal durationH;

    @Column
    private Integer quality;

    @Column
    private Integer awakenings;

    @Column(length = 500)
    private String notes;

    // Tracker-grade enrichment (mezo-dbsr): nullable — manual rows stay sparse; slice B (screenshot) fills them.
    @Min(1)
    @Column(name = "in_bed_min")
    private Integer inBedMin;

    @Min(0)
    @Column(name = "awake_min")
    private Integer awakeMin;

    @Min(0)
    @Column(name = "light_min")
    private Integer lightMin;

    @Min(0)
    @Column(name = "rem_min")
    private Integer remMin;

    @Min(0)
    @Column(name = "deep_min")
    private Integer deepMin;

    @Min(0)
    @Max(100)
    @Column(name = "source_quality_pct")
    private Integer sourceQualityPct;

    @Pattern(regexp = "manual|screenshot")
    @Column(length = 10)
    private String source = "manual";
}
