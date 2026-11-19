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

/** An SMS-ingest API key (spec §10.1.7): only its SHA-256 hex and its last four characters are stored. */
@Getter
@Setter
@Entity
@Table(name = "penz_api_key")
@SQLDelete(sql = "update penz_api_key set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PenzApiKeyEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "name", nullable = false, length = 60)
    private String name;

    @Column(name = "key_hash", nullable = false, length = 64)
    private String keyHash;

    @Column(name = "last4", nullable = false, length = 4)
    private String last4;

    @Column(name = "revoked", nullable = false)
    private boolean revoked;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;
}
