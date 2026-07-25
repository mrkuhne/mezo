package io.mrkuhne.mezo.feature.gamification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A shop title the user has bought/unlocked (mezo-huzd). One live row per
 * {@code (created_by, title_key)} ({@code uq_owned_title_user_key}).
 */
@Getter
@Setter
@Entity
@Table(name = "owned_title")
@SQLDelete(sql = "update owned_title set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class OwnedTitleEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "title_key", nullable = false)
    private String titleKey;

    @CreationTimestamp
    @Column(name = "acquired_at", nullable = false, updatable = false)
    private Instant acquiredAt;
}
