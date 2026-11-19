package io.mrkuhne.mezo.feature.penz.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** An expense or income category; {@code monthlyBudgetMinor} is HUF minor units. Date-less: bespoke finders. */
@Getter
@Setter
@Entity
@Table(name = "penz_category")
@SQLDelete(sql = "update penz_category set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzCategoryEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    /** expense | income. */
    @Column(name = "kind", nullable = false, length = 8)
    private String kind;

    @Column(name = "icon", length = 40)
    private String icon;

    @Column(name = "monthly_budget_minor")
    private Long monthlyBudgetMinor;

    @Column(name = "position", nullable = false)
    private int position;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
