package io.mrkuhne.mezo.feature.penz.entity;

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
 * The health of one outbound provider (GLOBAL, not owned) — each news feed, the quote source. The source of the
 * {@code mezo_penz_provider_fail_streak} gauge and its alerts. {@code lastError} is a short reason, never a body.
 */
@Getter
@Setter
@Entity
@Table(name = "penz_provider_status")
public class PenzProviderStatusEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "provider_key", nullable = false, length = 60)
    private String providerKey;

    /** news | quotes. */
    @Column(name = "kind", nullable = false, length = 6)
    private String kind;

    @Column(name = "last_success_at")
    private Instant lastSuccessAt;

    @Column(name = "last_failure_at")
    private Instant lastFailureAt;

    @Column(name = "fail_streak", nullable = false)
    private int failStreak;

    @Column(name = "last_error", length = 200)
    private String lastError;
}
