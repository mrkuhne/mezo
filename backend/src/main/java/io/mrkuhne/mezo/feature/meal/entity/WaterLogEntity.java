package io.mrkuhne.mezo.feature.meal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "water_log")
@SQLDelete(sql = "update water_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WaterLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @NotNull
    @Column(name = "amount_ml", nullable = false)
    private Integer amountMl;
}
