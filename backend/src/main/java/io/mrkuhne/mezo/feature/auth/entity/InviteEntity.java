package io.mrkuhne.mezo.feature.auth.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** One-shot invite code; consumed by {@code AuthService.register}. */
@Getter
@Setter
@Entity
@Table(name = "invite")
public class InviteEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Size(max = 32)
    @Column(nullable = false, length = 32)
    private String code;

    @Size(max = 120)
    @Column(length = 120)
    private String label;

    @NotNull
    @Column(name = "created_by", nullable = false, columnDefinition = "uuid")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "used_by", columnDefinition = "uuid")
    private UUID usedBy;

    @Column(name = "used_at")
    private Instant usedAt;

    public boolean isUsed() { return usedAt != null; }
    public boolean isExpired(Instant now) { return expiresAt != null && expiresAt.isBefore(now); }
}
