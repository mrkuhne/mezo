package io.mrkuhne.mezo.feature.season.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** The shopping list of one approved menu week; past lists are kept. */
@Getter
@Setter
@Entity
@Table(name = "shopping_list")
@SQLDelete(sql = "update shopping_list set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ShoppingListEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "week_id", nullable = false)
    private UUID weekId;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
