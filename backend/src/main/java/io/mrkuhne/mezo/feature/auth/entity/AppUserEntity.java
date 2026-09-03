package io.mrkuhne.mezo.feature.auth.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Getter
@Setter
@Entity
@Table(name = "app_user")
public class AppUserEntity {

    public enum UserRole { OWNER, USER }
    public enum UserStatus { ACTIVE, DISABLED }

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull @Size(max = 255)
    @Column(nullable = false, length = 255)
    private String email;

    @NotNull @Size(max = 100)
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @NotNull @Size(max = 120)
    @Column(nullable = false, length = 120)
    private String name;

    /** DB CHECK ck_app_user_role. */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserRole role = UserRole.USER;

    /** DB CHECK ck_app_user_status. A DISABLED account is rejected on every request (CurrentUser). */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UserStatus status = UserStatus.ACTIVE;

    /** T1 decision: stored for the future, not yet consulted by any "today" logic. */
    @NotNull @Size(max = 64)
    @Column(nullable = false, length = 64)
    private String timezone = "Europe/Budapest";

    @Column(name = "onboarded_at")
    private Instant onboardedAt;

    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = false;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    /**
     * Token-revocation watermark (mezo-qw37.1 review, Finding 4): stamped to {@code now()} by
     * {@code AuthService.changePassword} on a successful change; {@code CurrentUser.load()}
     * rejects any JWT whose {@code iat} precedes this. {@code null} (never changed a password)
     * means every token is valid, subject only to the normal 30-day expiry.
     */
    @Column(name = "tokens_valid_from")
    private Instant tokensValidFrom;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public boolean isOwner() { return role == UserRole.OWNER; }
    public boolean isOnboarded() { return onboardedAt != null; }
}
