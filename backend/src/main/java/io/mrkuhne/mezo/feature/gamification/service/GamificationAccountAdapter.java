package io.mrkuhne.mezo.feature.gamification.service;

import io.mrkuhne.mezo.feature.gamification.AccountLevelCurve;
import io.mrkuhne.mezo.feature.gamification.config.GamificationProperties;
import io.mrkuhne.mezo.feature.gamification.entity.CoinEventEntity;
import io.mrkuhne.mezo.feature.gamification.entity.GamificationProfileEntity;
import io.mrkuhne.mezo.feature.gamification.repository.CoinEventRepository;
import io.mrkuhne.mezo.feature.gamification.repository.GamificationProfileRepository;
import io.mrkuhne.mezo.feature.progression.AccountProgressPort;
import io.mrkuhne.mezo.feature.progression.repository.LevelUpEventRepository;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fans a newly-recorded XP award out into the coin ledger + streak rollover (bd mezo-huzd, spec
 * clause 3). Runs INSIDE the award's own transaction ({@code Propagation.MANDATORY} — it never
 * opens its own), so a rollback of the XP grant rolls this back too. {@link
 * io.mrkuhne.mezo.feature.progression.service.ProgressionService#applyGym} et al. only invoke this
 * port on a NEWLY-created level_up_event (the idempotent replay path returns before firing it), and
 * every coin_event write here is additionally guarded by the DB partial-unique-backed existence
 * check, so re-processing the same award is a safe no-op end to end.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.GAMIFICATION_SWITCH, havingValue = "true")
public class GamificationAccountAdapter implements AccountProgressPort {

    private static final String SOURCE_QUEST = "QUEST";
    private static final int QUESTS_PER_DAY = 3;
    private static final String REASON_QUEST = "quest";
    private static final String REASON_ALL3 = "all3";
    private static final String REASON_LEVEL_UP = "level_up";
    private static final String REASON_SAVER_USED = "saver_used";

    private final GamificationProfileRepository profileRepository;
    private final CoinEventRepository coinEventRepository;
    private final SkillProgressRepository skillProgressRepository;
    private final LevelUpEventRepository levelUpEventRepository;
    private final GamificationProperties properties;

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void onXpAwarded(UUID createdBy, String sourceType, UUID sourceRefId, LocalDate occurredOn) {
        GamificationProfileEntity profile = ensureProfile(createdBy);

        applyStreakRollover(profile, createdBy, occurredOn);

        if (SOURCE_QUEST.equals(sourceType)) {
            applyQuestCoins(profile, createdBy, sourceRefId, occurredOn);
        }

        applyLevelUpCoins(profile, createdBy, occurredOn);

        profileRepository.save(profile);
    }

    /**
     * Idempotent per-day: on the SECOND (or later) award of the same {@code occurredOn}, {@code
     * lastStreakDate} already equals it, so the outer equality guard skips re-processing.
     */
    private void applyStreakRollover(GamificationProfileEntity profile, UUID createdBy, LocalDate occurredOn) {
        LocalDate last = profile.getLastStreakDate();
        boolean eligible = !occurredOn.equals(last)
            && (last == null || occurredOn.equals(LocalDate.now()) || occurredOn.isAfter(last));
        if (!eligible) {
            return;
        }

        long gap = last == null ? -1 : ChronoUnit.DAYS.between(last, occurredOn);
        if (gap == 1) {
            profile.setStreakDays(profile.getStreakDays() + 1);
        } else if (gap == 2 && profile.getStreakSavers() > 0) {
            profile.setStreakSavers(profile.getStreakSavers() - 1);
            awardCoin(profile, createdBy, REASON_SAVER_USED, 0, "saver-" + occurredOn, occurredOn);
            profile.setStreakDays(profile.getStreakDays() + 1);
        } else {
            profile.setStreakDays(1);
        }
        profile.setLastStreakDate(occurredOn);

        int days = profile.getStreakDays();
        Integer milestoneCoins = properties.milestoneCoins().get(days);
        if (milestoneCoins != null) {
            String reason = "streak_" + days;
            String ref = "streak-" + days + "-" + occurredOn;
            awardCoin(profile, createdBy, reason, milestoneCoins, ref, occurredOn);
        }
    }

    private void applyQuestCoins(GamificationProfileEntity profile, UUID createdBy, UUID sourceRefId, LocalDate occurredOn) {
        awardCoin(profile, createdBy, REASON_QUEST, properties.questCoins(), sourceRefId.toString(), occurredOn);

        long questsToday = levelUpEventRepository.findByCreatedByAndOccurredOn(createdBy, occurredOn).stream()
            .filter(e -> SOURCE_QUEST.equals(e.getSourceType()))
            .count();
        if (questsToday == QUESTS_PER_DAY) {
            awardCoin(profile, createdBy, REASON_ALL3, properties.all3Coins(), "all3-" + occurredOn, occurredOn);
        }
    }

    /** For every account level crossed above the STORED level (computed from the already-updated skill sum). */
    private void applyLevelUpCoins(GamificationProfileEntity profile, UUID createdBy, LocalDate occurredOn) {
        long totalXp = skillProgressRepository.sumCumulativeXp(createdBy);
        int newLevel = AccountLevelCurve.levelFor(totalXp).level();
        int storedLevel = profile.getAccountLevel();
        for (int n = storedLevel + 1; n <= newLevel; n++) {
            awardCoin(profile, createdBy, REASON_LEVEL_UP, properties.levelUpCoins(), "level-" + n, occurredOn);
        }
        if (newLevel > storedLevel) {
            profile.setAccountLevel(newLevel);
        }
    }

    /** Every coin_event insert is guarded by the idempotency key; coins increment only on actual insert. */
    private void awardCoin(GamificationProfileEntity profile, UUID createdBy, String reason, int amount,
        String sourceRefId, LocalDate occurredOn) {
        if (coinEventRepository.existsByCreatedByAndReasonAndSourceRefId(createdBy, reason, sourceRefId)) {
            return;
        }
        CoinEventEntity e = new CoinEventEntity();
        e.setCreatedBy(createdBy);
        e.setReason(reason);
        e.setAmount(amount);
        e.setSourceRefId(sourceRefId);
        e.setOccurredOn(occurredOn);
        coinEventRepository.save(e);
        profile.setCoins(profile.getCoins() + amount);
    }

    private GamificationProfileEntity ensureProfile(UUID createdBy) {
        return profileRepository.findByCreatedBy(createdBy).orElseGet(() -> {
            GamificationProfileEntity e = new GamificationProfileEntity();
            e.setCreatedBy(createdBy);
            return profileRepository.saveAndFlush(e);
        });
    }
}
