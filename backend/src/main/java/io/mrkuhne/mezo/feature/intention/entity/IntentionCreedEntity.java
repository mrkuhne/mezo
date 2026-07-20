package io.mrkuhne.mezo.feature.intention.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/** The user's standing creed — one live row per owner (partial-unique on created_by). */
@Getter
@Setter
@Entity
@Table(name = "intention_creed")
@SQLDelete(sql = "update intention_creed set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class IntentionCreedEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false, length = 280)
    private String text;
}
