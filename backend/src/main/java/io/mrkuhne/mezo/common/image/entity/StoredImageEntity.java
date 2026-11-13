package io.mrkuhne.mezo.common.image.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/**
 * One stored image (meal photo, recipe image). Deliberately NOT an {@code OwnedEntity}: there is no
 * soft delete — a deleted photo must release its bytes (the owner's decision 19 is "kept forever,
 * deleted on request", and a flag would keep the bytes). {@code createdBy} is the owning user and
 * every lookup is scoped by it.
 */
@Getter
@Setter
@Entity
@Table(name = "stored_image")
public class StoredImageEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "content_type", nullable = false, updatable = false)
    private String contentType;

    @Column(nullable = false, updatable = false)
    private byte[] bytes;

    @Column(name = "byte_size", nullable = false, updatable = false)
    private int byteSize;

    @Column(nullable = false, updatable = false)
    private int width;

    @Column(nullable = false, updatable = false)
    private int height;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
