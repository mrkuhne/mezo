package io.mrkuhne.mezo.feature.gamification.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Per-user gamification ledger head (mezo-huzd): coin balance, streak state, equipped shop
 * title and derived account level. One live row per user ({@code uq_gamification_profile_user}).
 */
@Getter
@Setter
@Entity
@Table(name = "gamification_profile")
@SQLDelete(sql = "update gamification_profile set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class GamificationProfileEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(nullable = false)
    private int coins = 0;

    @Column(name = "streak_days", nullable = false)
    private int streakDays = 0;

    @Column(name = "streak_savers", nullable = false)
    private int streakSavers = 0;

    @NotNull
    @Column(name = "equipped_title_key", nullable = false)
    private String equippedTitleKey = "ujonc";

    @Column(name = "last_streak_date")
    private LocalDate lastStreakDate;

    @Column(name = "account_level", nullable = false)
    private int accountLevel = 1;
}
