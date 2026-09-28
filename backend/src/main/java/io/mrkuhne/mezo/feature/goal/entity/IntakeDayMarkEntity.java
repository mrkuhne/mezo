package io.mrkuhne.mezo.feature.goal.entity;

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

/**
 * One day's owner mark of whether their logged intake fairly represents the day (bd mezo-3n2so,
 * spec 2026-09-27-learned-expenditure-part2-design §6.1): COMPLETE or INCOMPLETE. One row per user
 * per calendar day, enforced by {@code uq_intake_day_mark_user_day}.
 */
@Getter
@Setter
@Entity
@Table(name = "intake_day_mark")
@SQLDelete(sql = "update intake_day_mark set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class IntakeDayMarkEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Column(nullable = false) private LocalDate day;
    @NotNull @Column(nullable = false) private String status; // COMPLETE|INCOMPLETE (DB CHECK)
}
