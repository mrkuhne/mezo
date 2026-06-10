package io.mrkuhne.mezo.feature.biometrics.checkin.entity;

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

    @Column(length = 500)
    private String note;

    @Column(name = "saved_at")
    private Instant savedAt;
}
