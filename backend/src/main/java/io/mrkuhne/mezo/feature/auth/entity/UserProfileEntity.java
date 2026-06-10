package io.mrkuhne.mezo.feature.auth.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@Entity
@Table(name = "user_profiles")
public class UserProfileEntity {

    @Id
    @Column(name = "created_by", columnDefinition = "uuid")
    private UUID createdBy;

    @Column(length = 60)
    private String handle;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "member_since", nullable = false)
    private LocalDate memberSince = LocalDate.now();

    @Column(name = "streak_days", nullable = false)
    private int streakDays = 0;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
