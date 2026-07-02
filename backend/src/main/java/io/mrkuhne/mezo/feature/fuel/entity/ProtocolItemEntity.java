package io.mrkuhne.mezo.feature.fuel.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One normalized selection row of a {@link ProtocolEntity} — the pantry supplement chosen at a given
 * {@code itemOrder} (position in the built stack). {@code protocolId} (FK -> protocol, CASCADE) and
 * {@code pantryItemId} (FK -> pantry_item, RESTRICT) are PLAIN UUID columns (deliberately NOT JPA
 * associations), mirroring the {@code meal_item}/{@code medication_dose} plain-UUID-FK pattern.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "protocol_item")
@SQLDelete(sql = "update protocol_item set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ProtocolItemEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "protocol_id", nullable = false)
    private UUID protocolId;

    @NotNull
    @Column(name = "pantry_item_id", nullable = false)
    private UUID pantryItemId;

    @NotNull
    @Column(name = "item_order", nullable = false)
    private Integer itemOrder;
}
