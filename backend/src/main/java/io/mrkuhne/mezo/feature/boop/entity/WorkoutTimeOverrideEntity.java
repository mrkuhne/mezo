package io.mrkuhne.mezo.feature.boop.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** Today's training session moved to another time of day (Boop S3, mezo-r36n9.7). */
@Getter
@Setter
@Entity
@Table(name = "workout_time_override")
@SQLDelete(sql = "update workout_time_override set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class WorkoutTimeOverrideEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime time;
}
