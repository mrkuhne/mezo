package io.mrkuhne.mezo.feature.biometrics.sleep.entity;

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
}
